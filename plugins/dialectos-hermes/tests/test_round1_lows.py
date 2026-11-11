"""Round-1 roast lows: provider setting, local surfaces, trigger, status and slash validate."""
import json

import pytest

from conftest import FakeCtx


# --- D4: the user's provider setting wins over the model's argument -----------

def test_the_provider_setting_beats_the_tool_argument(plugin, monkeypatch):
    calls = []
    monkeypatch.setattr(plugin, "run_dialectos", lambda args, **kw: calls.append(args) or {"ok": True})
    plugin._ctx = FakeCtx({"provider": "llm"})
    plugin.translate("Hello", "es-MX", None, "mymemory")
    assert calls[-1][calls[-1].index("--provider") + 1] == "llm"


def test_the_argument_chooses_only_when_nothing_is_set(plugin, monkeypatch):
    calls = []
    monkeypatch.setattr(plugin, "run_dialectos", lambda args, **kw: calls.append(args) or {"ok": True})
    plugin.translate("Hello", "es-MX", None, "deepl")
    assert calls[-1][calls[-1].index("--provider") + 1] == "deepl"


# --- D6: only cli/tui/desktop/local/acp are local -----------------------------

def test_a_process_that_never_bound_a_session_is_the_local_cli(plugin, runtime):
    assert runtime.session_context_engaged() is False
    assert plugin._on_gateway() is False


def test_a_gateway_process_with_an_unnamed_turn_is_remote(plugin, runtime):
    runtime.set_session_vars(platform="", source="")
    assert plugin._on_gateway() is True


def test_a_cron_turn_cannot_use_slash_translate(plugin, runtime, monkeypatch):
    called = []
    monkeypatch.setattr(plugin, "translate", lambda *a, **k: called.append(a) or {"ok": True, "text": "x"})
    runtime.set_session_vars(platform="cron", source="cron")
    assert "disabled on gateway" in plugin._slash("translate es-MX hello")
    assert called == []


# --- D7: the brief comes in for a Spanish target, not a bare mention ----------

@pytest.mark.parametrize("message", [
    "What caused the Spanish flu?",
    "Book a table at a Spanish restaurant downtown.",
    "Do NOT answer in Spanish, reply in English.",
    "Summarize LATAM sales for Q3.",
    "Please don't translate this into Spanish.",
])
def test_bare_mentions_and_refusals_do_not_inject(plugin, message):
    assert plugin._on_pre_llm(message) is None


@pytest.mark.parametrize("message", [
    "Translate this into Spanish.",
    "Write the release notes in Mexican Spanish.",
    "Pásalo al mexicano, por favor.",
    "Escríbelo en argentino.",
    "Reply in Castilian.",
    "I need a Spanish version of this page.",
    "Translate this for our LATAM customers.",
    "Please translate to es-MX",
])
def test_spanish_targets_inject(plugin, message):
    out = plugin._on_pre_llm(message)
    assert out is not None and "Spanish" in out["context"]


# --- D8: status and slash validate --------------------------------------------

def test_status_survives_a_ledger_that_is_not_a_list(plugin):
    plugin._ledger_path().parent.mkdir(parents=True, exist_ok=True)
    plugin._ledger_path().write_text(json.dumps({"broken": True}))
    assert json.loads(plugin._slash("status")) == []


def test_slash_validate_splits_at_the_middle_separator(plugin, monkeypatch):
    seen = []
    monkeypatch.setattr(plugin, "validate", lambda t, d, s: seen.append((s, t)) or {"ok": True, "data": {"valid": True}})
    plugin._slash("validate es-MX Call std :: move here :: Llama a std :: move aquí")
    assert seen == [("Call std :: move here", "Llama a std :: move aquí")]


def test_slash_validate_is_recorded_in_the_ledger(plugin, monkeypatch):
    monkeypatch.setattr(plugin, "validate", lambda t, d, s: {"ok": True, "data": {"valid": False, "blockingIssues": ["x"]}})
    plugin._slash("validate es-AR Hello :: Hola")
    row = json.loads(plugin._ledger_path().read_text())[-1]
    assert row["tool"] == "dialectos_validate" and row["dialect"] == "es-AR" and row["passed"] is False
