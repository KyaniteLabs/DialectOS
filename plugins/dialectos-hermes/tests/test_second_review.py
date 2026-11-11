"""Second-review regressions; subprocess stand-ins never contact providers."""
import json
from pathlib import Path

import pytest


@pytest.mark.parametrize("valid", [True, False])
def test_root_report_with_nested_arrays(plugin, fake_cli, valid):
    report = {"valid": valid, "dialect": "es-MX", "lexicalCompliance": {"violations": []},
              "outputJudge": {"issues": [], "blockingIssues": []},
              "blockingIssues": [] if valid else ["Negation was dropped in translation"]}
    fake_cli(f"print(json.dumps({report!r})); sys.exit({0 if valid else 1})")
    result = plugin.validate("Hola", "es-MX", "Hello")
    assert result["ok"] is True
    assert result["data"] == report


def test_real_failure_status_trailer(plugin, fake_cli):
    fake_cli('print(\'{"valid": false, "blockingIssues": ["missing token"]}\\nValidation failed with 1 blocking issue(s).\'); sys.exit(1)')
    result = plugin.validate("Hola", "es-MX", "Hello")
    assert result["ok"] is True
    assert result["data"]["valid"] is False


@pytest.mark.parametrize("report", [[], {}, {"valid": "false"}, {"valid": 1}, {"passed": False}])
def test_validate_refuses_non_verdict_shape(plugin, fake_cli, report):
    fake_cli(f"print(json.dumps({report!r}))")
    result = plugin.validate("Hola", "es-MX", "Hello")
    assert result["ok"] is False
    assert "verdict" in result["error"]


def test_complete_json_not_nested_fragment(plugin, fake_cli):
    fake_cli("print('noise {bad [1, 2]')")
    assert plugin.run_dialectos([], expect_json=True)["ok"] is False


@pytest.mark.parametrize("suffix", ["untrusted trailing text", "[1,2]", "Validation failed with 1 blocking issue(s). EXTRA"])
def test_reject_unknown_json_trailer(plugin, fake_cli, suffix):
    fake_cli(f"print('{{}}' + {suffix!r})")
    assert plugin.run_dialectos([], expect_json=True)["ok"] is False


def test_slash_real_metadata_is_complete(plugin, fake_cli):
    payload = json.loads((Path(__file__).parent / "fixtures/dialects-v0.3.1.json").read_text())
    assert len(payload) == 25
    fake_cli(f"print(json.dumps({payload!r}))")
    assert plugin.list_dialects()["data"] == payload
    rendered = plugin._slash("list")
    assert len(rendered) <= plugin.SLASH_DISPLAY
    for dialect in payload:
        assert f"{dialect['code']} — {dialect['name']}" in rendered


def test_exact_issue_message_union(plugin):
    issue = {"message": "Negation dropped", "severity": "major", "rule": "negation"}
    report = {"outputJudge": {"issues": [issue], "blockingIssues": [issue]},
              "blockingIssues": ["Negation dropped", "Semantic quality below threshold"]}
    assert plugin._issue_counts(report) == (2, 2)
    assert plugin._issue_counts({"outputJudge": {"blockingIssues": [issue]}}) == (1, 1)


def test_expansion_can_be_validated(plugin, fake_cli):
    body = "á" * 9599
    fake_cli(f"print({body!r})", provider="llm")
    translated = plugin.translate("x" * 7499, "es-MX")["text"]
    fake_cli("print(json.dumps({'valid': True}))")
    assert plugin.validate(translated, "es-MX", "x" * 7499)["ok"] is True
    assert plugin.validate("a" * plugin.MAX_OUT, "es-MX", "Hello")["ok"] is True
    with pytest.raises(ValueError, match="100000"):
        plugin.validate("á" * (plugin.MAX_OUT + 1), "es-MX", "Hello")


@pytest.mark.parametrize("message", ["Translate this Spanish copy into German.",
    "Please do not translate to Spanish; localize it to Japanese."])
def test_brief_cannot_override_non_spanish_target(plugin, message):
    brief = plugin._on_pre_llm(message)
    assert brief is None or ("Only if" in brief["context"] and "non-Spanish target" in brief["context"])


def test_fence_transport_does_not_promise_release_bypass(plugin, fake_cli):
    fake_cli("print(json.dumps({'valid': False})); sys.exit(1)")
    assert plugin.validate("```hola```", "es-MX", "Hello")['data']['valid'] is False
    assert "v0.3.2" in plugin.VALIDATE_SCHEMA["description"]


@pytest.mark.parametrize("provider", [None, "auto", ""])
def test_no_implicit_or_auto_provider(plugin, monkeypatch, provider):
    calls = []
    monkeypatch.setattr(plugin, "run_dialectos", lambda *a, **kw: calls.append(a))
    with pytest.raises(ValueError, match="explicit"):
        plugin.translate("Hello", provider=provider)
    assert calls == []


def test_explicit_provider_and_configured_provider(plugin, fake_cli):
    fake_cli("print(sys.argv[sys.argv.index('--provider') + 1])", provider="deepl")
    assert plugin.translate("Hello")["text"] == "deepl"
    assert plugin.translate("Hello", provider="llm")["text"] == "llm"
    assert "auto" not in plugin.TRANSLATE_SCHEMA["parameters"]["properties"]["provider"]["enum"]


@pytest.mark.parametrize("payload", [{"code": "es-MX"}, [1], [{"code": "es-MX"}]])
def test_list_requires_metadata_array(plugin, fake_cli, payload):
    fake_cli(f"print(json.dumps({payload!r}))")
    assert plugin.list_dialects()["ok"] is False


def test_large_unicode_argument_returns_explicit_error(plugin, fake_cli):
    fake_cli("print(json.dumps({'valid': True}))")
    result = plugin.validate("á" * plugin.MAX_OUT, "es-MX", "Hello")
    assert result["ok"] is False or result["data"]["valid"] is True


def test_configured_auto_cannot_spawn(plugin, fake_cli):
    fake_cli("raise AssertionError('must not spawn')", provider="auto")
    with pytest.raises(ValueError, match="explicit"):
        plugin.translate("Hello")
