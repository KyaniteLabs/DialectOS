"""Local Desktop events carry counts and dialect ids, never translation text."""
import json
import os
import sys
from types import ModuleType
from pathlib import Path

import pytest


def _hermes023_path():
    hermes_path = os.environ.get('HERMES023_PATH')
    if hermes_path:
        return Path(hermes_path)
    if os.environ.get('CI'):
        pytest.fail('HERMES023_PATH is required for native Hermes regressions in CI')
    pytest.skip('set HERMES023_PATH to real Hermes source')


@pytest.fixture
def bridge(monkeypatch):
    calls = []
    hermes = ModuleType("hermes_cli")
    events = ModuleType("hermes_cli.plugin_events")
    events.broadcast_plugin_event = lambda *args: calls.append(args)
    monkeypatch.setitem(sys.modules, "hermes_cli", hermes)
    monkeypatch.setitem(sys.modules, "hermes_cli.plugin_events", events)
    # Broadcasts only run where a TUI gateway (and so a Desktop listener) is loaded.
    monkeypatch.setitem(sys.modules, "tui_gateway", ModuleType("tui_gateway"))
    monkeypatch.setitem(sys.modules, "tui_gateway.server", ModuleType("tui_gateway.server"))
    return events, calls


@pytest.mark.parametrize("tool", ["translate", "detect", "validate", "list_dialects"])
def test_recorded_tool_broadcasts_only_committed_ledger_count(plugin, bridge, tool):
    events, calls = bridge
    def capture(*args):
        assert len(json.loads(plugin._ledger_path().read_text())) == 1
        calls.append(args)
    events.broadcast_plugin_event = capture
    plugin._on_post_tool(f"dialectos_{tool}", {"dialect": "private text"}, {
        "ok": True, "text": "private translation", "data": {"valid": False, "blockingIssues": ["private issue"]},
    })
    assert calls == [("dialectos", "ledger.updated", {"count": 1})]


def test_ledger_event_count_respects_storage_cap(plugin, bridge, monkeypatch):
    _, calls = bridge
    monkeypatch.setattr(plugin, "LEDGER_MAX", 2)
    for _ in range(3):
        plugin._append_ledger({"tool": "dialectos_detect", "ok": True})
    assert [p["count"] for _, _, p in calls] == [1, 2, 2]


@pytest.mark.parametrize("view", ["translate", "check", "dialects", "by_dialect", "recent"])
def test_show_broadcasts_real_section_and_optional_dialect_id(plugin, bridge, view):
    _, calls = bridge
    out = json.loads(plugin._tool_show({"view": view, "item_id": "es-AR"}))
    assert out["ok"] and view in out["text"] and "es-AR" in out["text"]
    assert "open DialectOS Desktop page" in out["text"]
    assert calls == [("dialectos", "view.set", {"view": view, "item_id": "es-AR"})]
    plugin._on_post_tool("dialectos_show", {}, out)
    assert len(calls) == 1  # navigation does not create a QA verdict
    assert not plugin._ledger_path().exists()


def test_show_without_item(plugin, bridge):
    _, calls = bridge
    assert json.loads(plugin._tool_show({"view": "recent"}))["ok"]
    assert calls == [("dialectos", "view.set", {"view": "recent"})]


@pytest.mark.parametrize("args", [
    None, [], "recent", {}, {"view": []}, {"view": "unknown"}, {"view": "x" * 1000},
    {"view": "recent", "item_id": ""}, {"view": "recent", "item_id": None},
    {"view": "recent", "item_id": 12}, {"view": "recent", "item_id": "x" * 1000},
    {"view": "recent", "item_id": "es-AR\n"}, {"view": "recent", "item_id": "private title"},
    {"view": "recent", "text": "private text"},
])
def test_show_rejects_invalid_input_without_broadcast(plugin, bridge, args):
    _, calls = bridge
    out = json.loads(plugin._tool_show(args))
    assert out["ok"] is False and out["error"]
    assert calls == []


@pytest.mark.parametrize("event,payload", [
    ("unknown", {}), ("ledger.updated", {"count": -1}),
    ("ledger.updated", {"count": True}), ("ledger.updated", {"count": 201}),
    ("ledger.updated", {"count": 1, "text": "private"}),
    ("view.set", {"view": "unknown"}), ("view.set", {"view": "recent", "item_id": "es-AR\n"}),
])
def test_event_helper_rejects_invalid_payloads(plugin, bridge, event, payload):
    _, calls = bridge
    with pytest.raises(ValueError):
        plugin._broadcast_pane_event(event, payload)
    assert calls == []


def test_hermes_absent_still_allows_show_and_ledger(plugin, monkeypatch):
    monkeypatch.setitem(sys.modules, "hermes_cli.plugin_events", None)
    assert json.loads(plugin._tool_show({"view": "check"}))["ok"]
    plugin._on_post_tool("dialectos_detect", {}, {"ok": True})
    assert len(json.loads(plugin._ledger_path().read_text())) == 1


def test_bridge_failure_does_not_break_tools_or_persisted_ledger(plugin, bridge):
    events, _ = bridge
    def broken(*args):
        raise RuntimeError("transport unavailable")
    events.broadcast_plugin_event = broken
    assert json.loads(plugin._tool_show({"view": "check"}))["ok"]
    plugin._on_post_tool("dialectos_detect", {}, {"ok": True})
    assert len(json.loads(plugin._ledger_path().read_text())) == 1


def test_failed_write_does_not_notify_page(plugin, bridge, monkeypatch):
    _, calls = bridge
    def broken(*args):
        raise OSError("disk unavailable")
    monkeypatch.setattr(plugin, "_atomic_write_json", broken)
    plugin._on_post_tool("dialectos_detect", {}, {"ok": True})
    assert calls == []


def test_show_registered_with_bounded_schema(plugin):
    tools = {}
    class Ctx:
        def register_hook(self, *args): pass
        def register_command(self, *args, **kwargs): pass
        def register_skill(self, *args): pass
        def register_tool(self, **kwargs): tools[kwargs["name"]] = kwargs
    plugin.register(Ctx())
    show = tools["dialectos_show"]
    assert show["handler"] is plugin._tool_show and show["toolset"] == "dialectos"
    params = show["schema"]["parameters"]
    assert params["required"] == ["view"] and params["additionalProperties"] is False
    assert params["properties"]["view"]["enum"] == ["translate", "check", "dialects", "by_dialect", "recent"]
    assert params["properties"]["item_id"]["maxLength"] == 5


def test_show_uses_real_hermes_v023_event_bridge(plugin, monkeypatch):
    hermes_path = _hermes023_path()
    assert (hermes_path / 'hermes_cli' / 'plugin_events.py').is_file()
    monkeypatch.syspath_prepend(str(hermes_path))
    for name in ('hermes_cli', 'hermes_cli.plugin_events'):
        monkeypatch.delitem(sys.modules, name, raising=False)

    frames = []
    server = ModuleType('tui_gateway.server')
    server._broadcast_global_event = lambda name, payload: frames.append((name, payload))
    monkeypatch.setitem(sys.modules, 'tui_gateway', ModuleType('tui_gateway'))
    monkeypatch.setitem(sys.modules, 'tui_gateway.server', server)

    out = plugin._tool_show({'view': 'by_dialect', 'item_id': 'es-AR'})
    assert json.loads(out)['ok'] is True
    assert frames == [('plugin.dialectos.view.set', {'view': 'by_dialect', 'item_id': 'es-AR'})]


def test_tool_calls_outside_the_tui_keep_stdout_on_stdout(plugin, monkeypatch):
    """Roast r4 X-R4-1: importing the real bridge loads tui_gateway.server, which swaps
    sys.stdout to stderr, so "hermes chat -q" answers would leave on stderr."""
    monkeypatch.syspath_prepend(str(_hermes023_path()))
    for name in ('hermes_cli', 'hermes_cli.plugin_events', 'tui_gateway', 'tui_gateway.server'):
        monkeypatch.delitem(sys.modules, name, raising=False)
    stdout, excepthook = sys.stdout, sys.excepthook
    plugin._on_post_tool('dialectos_detect', {}, {'ok': True})
    assert json.loads(plugin._tool_show({'view': 'check'}))['ok'] is True
    assert 'tui_gateway.server' not in sys.modules
    assert sys.stdout is stdout and sys.excepthook is excepthook


def test_missing_native_runtime_fails_in_ci(plugin, monkeypatch):
    monkeypatch.delenv('HERMES023_PATH', raising=False)
    monkeypatch.setenv('CI', 'true')
    with pytest.raises(pytest.fail.Exception, match='HERMES023_PATH is required'):
        _hermes023_path()


def test_ci_pins_and_supplies_native_hermes_runtime():
    repo_root = Path(__file__).resolve().parents[3]
    workflow = (repo_root / '.github' / 'workflows' / 'ci.yml').read_text()
    assert 'ref: 2bd378ed1b8d6bf2192cb26e0a55ff3091e6bd19 # v0.23.0' in workflow
    assert 'HERMES023_PATH: ${{ github.workspace }}/.hermes-v023-runtime' in workflow


def test_forgejo_profile_runs_plugin_pytests_with_pinned_hermes():
    repo_root = Path(__file__).resolve().parents[3]
    profile = json.loads((repo_root / '.ci' / 'profile.json').read_text())
    steps = [" ".join(step["argv"]) for step in profile["steps"]]
    command = next(step for step in steps if "plugins/dialectos-hermes/tests" in step)
    assert "2bd378ed1b8d6bf2192cb26e0a55ff3091e6bd19" in command
    assert 'HERMES023_PATH="$PWD/.hermes-v023-runtime"' in command
    assert "-m pytest plugins/dialectos-hermes/tests" in command
