"""Backend routes for the desktop page and dashboard tab (dashboard/plugin_api.py).

The CLI is stubbed at the operation level; these tests cover the HTTP shape, the
verdict-only ledger and the guard that Translate needs an explicit provider.
"""

from __future__ import annotations

import importlib.util
import json
import sys

import pytest

fastapi = pytest.importorskip("fastapi")
from fastapi import FastAPI  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from conftest import PLUGIN_DIR, FakeCtx  # noqa: E402


@pytest.fixture
def api(plugin, monkeypatch):
    monkeypatch.setitem(sys.modules, "dialectos_hermes_core", plugin)
    name = "dialectos_dashboard_api"
    spec = importlib.util.spec_from_file_location(name, PLUGIN_DIR / "dashboard" / "plugin_api.py")
    mod = importlib.util.module_from_spec(spec)
    monkeypatch.setitem(sys.modules, name, mod)
    spec.loader.exec_module(mod)
    assert mod.core is plugin
    app = FastAPI()
    app.include_router(mod.router, prefix="/api/plugins/dialectos")
    return TestClient(app), plugin


def _ledger(plugin):
    return json.loads(plugin._ledger_path().read_text())


REPORT_BLOCKED = {
    "valid": False,
    "outputJudge": {"issues": [{"message": "placeholder {name} missing"}, {"message": "uses 'coger'"}],
                    "blockingIssues": [{"message": "placeholder {name} missing"}]},
    "blockingIssues": ["placeholder {name} missing"],
}


def test_status_defaults_without_provider(api):
    client, _ = api
    s = client.get("/api/plugins/dialectos/status").json()
    assert s["cli"] == "release" and s["cli_version"] == "0.3.2"
    assert s["provider"] == "" and s["default_dialect"]
    assert s["ledger_entries"] == 0
    assert s["limits"] == {"text": 8000, "translated": 100_000}


def test_status_custom_command_and_unknown_provider(api):
    client, plugin = api
    plugin._ctx = FakeCtx({"dialectos_command": "node /opt/dialectos/cli.js", "provider": "openrouter"})
    s = client.get("/api/plugins/dialectos/status").json()
    assert s["cli"] == "custom" and s["cli_version"] is None
    assert s["provider"] == ""  # anything outside PROVIDERS reads as none


def test_dialects_are_cached_and_trimmed(api, monkeypatch):
    client, plugin = api
    calls = []
    monkeypatch.setattr(plugin, "list_dialects", lambda: calls.append(1) or {
        "ok": True, "data": [{"code": "es-MX", "name": "Mexican Spanish", "extra": 1}]})
    for _ in range(2):
        r = client.get("/api/plugins/dialectos/dialects").json()
    assert r == {"ok": True, "data": [{"code": "es-MX", "name": "Mexican Spanish"}]}
    assert len(calls) == 1


def test_dialects_failure_is_not_cached(api, monkeypatch):
    client, plugin = api
    monkeypatch.setattr(plugin, "list_dialects", lambda: {"ok": False, "error": "npx not found"})
    assert client.get("/api/plugins/dialectos/dialects").json() == {"ok": False, "error": "npx not found"}


def test_translate_refuses_without_provider_and_runs_nothing(api, monkeypatch):
    client, plugin = api
    monkeypatch.setattr(plugin, "run_dialectos", lambda *a, **k: pytest.fail("CLI must not run"))
    r = client.post("/api/plugins/dialectos/translate", json={"text": "Hello", "dialect": "es-AR"}).json()
    assert r["ok"] is False and "provider" in r["error"]


def test_translate_checks_against_source_and_records_verdicts_only(api, monkeypatch):
    client, plugin = api
    plugin._ctx = FakeCtx({"provider": "deepl"})
    monkeypatch.setattr(plugin, "translate", lambda text, d, formal=None: {"ok": True, "text": "Hola, {name}.\n"})
    seen = {}

    def fake_validate(translated, d, source):
        seen.update(translated=translated, d=d, source=source)
        return {"ok": True, "data": REPORT_BLOCKED}

    monkeypatch.setattr(plugin, "validate", fake_validate)
    r = client.post("/api/plugins/dialectos/translate", json={"text": "Hi, {name}.", "dialect": "es-AR"}).json()
    assert r["ok"] and r["text"] == "Hola, {name}." and r["dialect"] == "es-AR"
    assert seen == {"translated": "Hola, {name}.", "d": "es-AR", "source": "Hi, {name}."}
    chk = r["check"]
    assert chk["valid"] is False
    assert {"message": "placeholder {name} missing", "blocking": True} in chk["issues"]
    assert {"message": "uses 'coger'", "blocking": False} in chk["issues"]
    rows = _ledger(plugin)
    assert [x["tool"] for x in rows] == ["dialectos_translate", "dialectos_validate"]
    assert all(x["via"] == "page" for x in rows)
    assert rows[1]["passed"] is False and rows[1]["blocking_issue_count"] == 1
    blob = json.dumps(rows)
    assert "Hola" not in blob and "Hi," not in blob  # never the text


def test_validate_needs_source(api):
    client, _ = api
    r = client.post("/api/plugins/dialectos/validate", json={"source": " ", "translated": "Hola"}).json()
    assert r["ok"] is False and "source is required" in r["error"]


def test_detect_passthrough_and_ledger(api, monkeypatch):
    client, plugin = api
    data = {"dialect": "es-AR", "confidence": 0.82, "name": "Rioplatense Spanish", "matchedKeywords": ["vos"]}
    monkeypatch.setattr(plugin, "detect", lambda text: {"ok": True, "data": data})
    r = client.post("/api/plugins/dialectos/detect", json={"text": "Vos sabés"}).json()
    assert r["data"] == data
    assert _ledger(plugin)[-1]["tool"] == "dialectos_detect"


def test_oversized_text_rejected_before_cli(api, monkeypatch):
    client, plugin = api
    monkeypatch.setattr(plugin, "run_dialectos", lambda *a, **k: pytest.fail("CLI must not run"))
    r = client.post("/api/plugins/dialectos/detect", json={"text": "x" * 8001})
    assert r.status_code == 422


def test_ledger_summary_newest_first(api):
    client, plugin = api
    rows = [
        {"ts": 1, "tool": "dialectos_validate", "dialect": "es-MX", "passed": True},
        {"ts": 2, "tool": "dialectos_validate", "dialect": "es-MX", "passed": False},
        {"ts": 3, "tool": "dialectos_validate", "dialect": "es-MX", "passed": False, "blocking_issue_count": 0},
        {"ts": 4, "tool": "dialectos_translate", "dialect": "es-AR", "ok": True},
        "junk",
    ]
    plugin._ledger_path().write_text(json.dumps(rows))
    r = client.get("/api/plugins/dialectos/ledger?limit=2").json()
    assert r["total"] == 4
    assert [x["ts"] for x in r["rows"]] == [4, 3]
    mx = next(x for x in r["by_dialect"] if x["dialect"] == "es-MX")
    # an unreadable count stays blocked; zero blocking issues reads as advisory
    assert mx == {"dialect": "es-MX", "checked": 3, "passed": 1, "blocked": 1, "advisory": 1, "calls": 3}
    assert r["by_dialect"][0]["dialect"] == "es-MX"


def test_settings_fall_back_to_config_without_ctx(plugin, monkeypatch):
    plugin._ctx = None
    monkeypatch.setattr(plugin, "_settings_from_config", lambda: {"provider": "libre", "default_dialect": "es-CO"})
    assert plugin._cfg("provider") == "libre"
    assert plugin._cfg("default_dialect") == "es-CO"
    assert plugin._cfg("inject_on_spanish") == plugin.DEFAULTS["inject_on_spanish"]
