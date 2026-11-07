"""Regressions for Kai's CHANGES REQUIRED on KyaniteLabs/DialectOS#254 (review 5791819315 + inline 4485854754).

Each case reproduces what Kai described against head a6bc585.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import textwrap
import threading
import time
from pathlib import Path

import pytest


# --- P1 (1): gateway identity from Hermes ContextVars -------------------------

def test_telegram_contextvar_refuses_slash_translate(plugin, runtime, monkeypatch):
    assert "HERMES_PLATFORM" not in os.environ
    assert "HERMES_SESSION_PLATFORM" not in os.environ
    called = []
    monkeypatch.setattr(plugin, "translate", lambda *a, **k: called.append(a) or {"ok": True, "text": "hola"})
    runtime.set_session_vars(platform="telegram", source="telegram")
    assert runtime.session_is_messaging_surface() is True

    out = plugin._slash("translate es-MX private text")

    assert "disabled on gateway" in out
    assert called == []


def test_local_contextvar_allows_slash_translate(plugin, runtime, monkeypatch):
    called = []
    monkeypatch.setattr(plugin, "translate", lambda *a, **k: called.append(a) or {"ok": True, "text": "hola"})
    runtime.set_session_vars(platform="", source="desktop")
    plugin._slash("translate es-MX hello")
    assert called == [("hello", "es-MX")]


def test_telegram_opt_in_allows_slash_translate(plugin, runtime, monkeypatch):
    from conftest import FakeCtx

    plugin._ctx = FakeCtx({"allow_translate_slash_on_gateway": True})
    called = []
    monkeypatch.setattr(plugin, "translate", lambda *a, **k: called.append(a) or {"ok": True, "text": "hola"})
    runtime.set_session_vars(platform="telegram", source="telegram")
    plugin._slash("translate es-MX hello")
    assert called == [("hello", "es-MX")]


# --- P1 (2): source-less validate must not reach empty-source semantic QA -----

def test_validate_without_source_refuses(plugin, fake_cli):
    called = []
    fake_cli("print('should-not-run'); sys.exit(0)")
    # Patch after fake_cli so we observe whether run_dialectos is reached with empty source.
    real = plugin.run_dialectos

    def spy(args, stdin=None, **kw):
        called.append(list(args))
        return real(args, stdin=stdin, **kw)

    plugin.run_dialectos = spy
    with pytest.raises(ValueError, match="source"):
        plugin.validate("Hola mundo", "es-MX", source=None)
    assert called == []


def test_slash_validate_requires_source_separator(plugin, monkeypatch):
    called = []
    monkeypatch.setattr(
        plugin,
        "validate",
        lambda translated, dialect=None, source=None: called.append((translated, dialect, source))
        or {"ok": True, "data": {"valid": True}},
    )
    out = plugin._slash("validate es-MX Hola mundo")
    assert "source" in out.lower()
    assert called == []

    plugin._slash("validate es-MX Hello world :: Hola mundo")
    assert called == [("Hola mundo", "es-MX", "Hello world")]


def test_validate_schema_requires_source(plugin):
    required = plugin.VALIDATE_SCHEMA["parameters"]["required"]
    assert "source" in required
    assert "translated" in required


# --- P2 (3): JSON parse prefers [; translation stdout stays text --------------

def test_list_dialects_returns_all_25(plugin, fake_cli):
    dialects = [{"code": f"es-{c}", "name": c} for c in (
        "ES", "MX", "AR", "CO", "CL", "PE", "VE", "EC", "GT", "CR",
        "PA", "CU", "DO", "PR", "UY", "PY", "BO", "HN", "SV", "NI",
        "US", "GQ", "PH", "BZ", "AD",
    )]
    assert len(dialects) == 25
    fake_cli(f"print(json.dumps({dialects!r}))")
    res = plugin.list_dialects()
    assert res["ok"] is True
    assert isinstance(res["data"], list)
    assert len(res["data"]) == 25
    assert res["data"][0]["code"] == "es-ES"


def test_translate_preserves_prose_containing_json(plugin, fake_cli):
    prose = 'Estado:\n{"status":"bien"}\nFin de la traducción.'
    fake_cli(f"print({prose!r})")
    res = plugin.translate("Status: ok", "es-MX", provider="llm")
    assert res["ok"] is True
    assert res.get("text") == prose
    assert res.get("data") is None or "status" not in (res.get("data") or {})


# --- P2 (4): forward provider activation/endpoint settings --------------------

def test_scrubbed_env_forwards_mymemory_and_local_llm(plugin, runtime, monkeypatch):
    from agent.secret_scope import set_secret_scope

    token = set_secret_scope({
        "ENABLE_MYMEMORY": "1",
        "LLM_ALLOW_LOCAL": "1",
        "LM_STUDIO_URL": "http://127.0.0.1:1234/v1",
        "LLM_API_KEY": "sk-test",
        "UNRELATED_SECRET": "nope",
    })
    try:
        env = plugin._scrubbed_env()
    finally:
        from agent.secret_scope import reset_secret_scope
        reset_secret_scope(token)
    assert env.get("ENABLE_MYMEMORY") == "1"
    assert env.get("LLM_ALLOW_LOCAL") == "1"
    assert env.get("LM_STUDIO_URL") == "http://127.0.0.1:1234/v1"
    assert env.get("LLM_API_KEY") == "sk-test"
    assert "UNRELATED_SECRET" not in env


# --- File transport does not override a failing released CLI verdict ---------

def test_validate_retains_cli_fence_failure(plugin, fake_cli):
    fake_cli("print(json.dumps({'valid': False, 'blockingIssues': ['fence']})); sys.exit(1)")
    fenced = "Hola mundo\n```\nconst x = 1;\n```"
    result = plugin.validate(fenced, "es-MX", source="Hello world\n```\nconst x = 1;\n```")
    assert result['ok'] is True and result['data']['valid'] is False


def test_validate_description_discloses_released_pin_limit(plugin):
    desc = plugin.VALIDATE_SCHEMA["description"].lower()
    assert "v0.3.1" in desc and "fence" in desc


# --- P2 (6): no silent truncation of successful translations ------------------

def test_long_translation_is_not_silently_cut(plugin, fake_cli):
    body = "á" * 9599
    fake_cli(f"print({body!r})")
    res = plugin.translate("x" * 7499, "es-MX", provider="llm")
    assert res["ok"] is True
    assert res["text"] == body
    assert len(res["text"]) == 9599


def test_slash_translate_does_not_silently_cut(plugin, monkeypatch):
    long_text = "ñ" * 4199
    monkeypatch.setattr(plugin, "translate", lambda *a, **k: {"ok": True, "text": long_text})
    monkeypatch.setattr(plugin, "_on_gateway", lambda: False)
    out = plugin._slash("translate es-MX hello")
    assert "truncat" in out.lower() or len(out) >= 4199
    if "truncat" in out.lower():
        assert long_text not in out or "4199" in out
    else:
        assert out == long_text


def test_wrap_does_not_slice_json_mid_envelope(plugin):
    huge = {"ok": True, "text": "x" * 25000}
    out = plugin._wrap(lambda a: huge)({})
    parsed = json.loads(out)  # must be valid JSON
    assert parsed.get("truncated") is True or parsed.get("text") == huge["text"]
    if parsed.get("truncated"):
        assert parsed.get("ok") is False


# --- P2 (7): ledger reads real report fields + effective dialect --------------

def test_ledger_counts_output_judge_and_blocking_issues(plugin):
    payload = {
        "ok": True,
        "data": {
            "valid": False,
            "passed": False,
            "outputJudge": {
                "issues": [{"severity": "error", "message": "fence"}, {"severity": "warn", "message": "x"}],
                "blockingIssues": [{"severity": "error", "message": "fence"}],
            },
            "blockingIssues": ["Negation dropped"],
        },
    }
    plugin._on_post_tool("dialectos_validate", {"dialect": None}, json.dumps(payload))
    entry = json.loads(plugin._ledger_path().read_text())[-1]
    assert entry["passed"] is False
    assert entry["issue_count"] >= 1
    assert entry["blocking_issue_count"] >= 1
    assert entry["dialect"] == plugin.DEFAULTS["default_dialect"]


def test_ledger_blocking_only_without_output_judge_issues(plugin):
    payload = {
        "ok": True,
        "data": {
            "valid": False,
            "outputJudge": {"issues": [], "blockingIssues": []},
            "blockingIssues": ["Semantic quality below threshold: 0%"],
        },
    }
    plugin._on_post_tool("dialectos_validate", {"dialect": "es-AR"}, json.dumps(payload))
    entry = json.loads(plugin._ledger_path().read_text())[-1]
    assert entry["blocking_issue_count"] == 1
    assert entry["issue_count"] == 1
    assert entry["dialect"] == "es-AR"


# --- P2 (8): concurrent ledger lock + unique temps ----------------------------

def test_overlapping_ledger_appends_keep_both(plugin, monkeypatch):
    barrier = threading.Barrier(2, timeout=2.0)
    real_load = plugin._load_json
    errors = []

    def racing_load(path, default):
        value = real_load(path, default)
        if Path(path).name == "qa_ledger.json":
            try:
                barrier.wait()
            except threading.BrokenBarrierError:
                pass
        return value

    monkeypatch.setattr(plugin, "_load_json", racing_load)

    def append(tag):
        try:
            plugin._append_ledger({"ts": 1, "tool": "dialectos_detect", "ok": True, "tag": tag})
        except Exception as exc:
            errors.append(exc)

    threads = [threading.Thread(target=append, args=(t,)) for t in ("a", "b")]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    tags = sorted(e["tag"] for e in json.loads(plugin._ledger_path().read_text()) if "tag" in e)
    assert tags == ["a", "b"], (tags, errors)
    assert errors == []


def test_cross_process_ledger_appends_are_not_lost(plugin, hermes_home, tmp_path):
    from conftest import PLUGIN_DIR

    worker = tmp_path / "worker.py"
    worker.write_text(textwrap.dedent(
        f"""
        import importlib.util, sys
        spec = importlib.util.spec_from_file_location("d", {str(PLUGIN_DIR / "__init__.py")!r})
        mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
        for i in range(25):
            mod._append_ledger({{"ts": i, "tool": "dialectos_detect", "ok": True, "tag": sys.argv[1] + str(i)}})
        """
    ))
    env = {**os.environ, "HERMES_HOME": str(hermes_home)}
    procs = [subprocess.Popen([sys.executable, str(worker), p], env=env) for p in ("a", "b", "c")]
    assert [p.wait(timeout=60) for p in procs] == [0, 0, 0]
    ledger = json.loads(plugin._ledger_path().read_text())
    assert len(ledger) == 75
    assert not list(plugin._ledger_path().parent.glob("*.tmp"))


# --- P2 (9): timeout kills process group --------------------------------------

def _tree_cli(marker: Path, detach: bool) -> str:
    child = (
        "import os, time\n"
        + ("os.setsid()\n" if detach else "")
        + f"time.sleep(2.0)\nopen({str(marker)!r}, 'w').write('alive')\n"
    )
    return f"subprocess.Popen([sys.executable, '-c', {child!r}])\ntime.sleep(30)\n"


@pytest.mark.skipif(os.name == "nt", reason="POSIX process groups")
@pytest.mark.parametrize("detach", [False, True], ids=["same-group", "setsid-grandchild"])
def test_timeout_kills_descendants(plugin, fake_cli, tmp_path, detach):
    marker = tmp_path / f"marker-{detach}"
    fake_cli(_tree_cli(marker, detach), timeout_seconds=1)

    t0 = time.monotonic()
    res = plugin.run_dialectos(["translate", "--dialect", "es-MX"])
    elapsed = time.monotonic() - t0

    assert res["ok"] is False and "timed out" in res["error"]
    assert elapsed < 5
    time.sleep(2.5)
    assert not marker.exists(), "descendant kept running after timeout"


# --- P2 (10): Spanish regex must not fire on German/Japanese localize/i18n ----

def test_german_localize_does_not_inject_spanish_brief(plugin):
    out = plugin._on_pre_llm("Localize this copy into German.")
    assert out is None


def test_japanese_i18n_does_not_inject_spanish_brief(plugin):
    out = plugin._on_pre_llm("Fix i18n routing for the Japanese UI")
    assert out is None


def test_spanish_localize_still_injects(plugin):
    out = plugin._on_pre_llm("Localize this copy into Spanish for Mexico.")
    assert out is not None
    assert "Spanish" in out["context"]


def test_es_mx_code_still_injects(plugin):
    out = plugin._on_pre_llm("Please translate to es-MX")
    assert out is not None
