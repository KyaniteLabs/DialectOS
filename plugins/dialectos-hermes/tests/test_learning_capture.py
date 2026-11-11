"""Learning capture shares validation flows without changing their results."""
import json

from test_learning import make_store, miss


def test_validate_and_post_hook_capture_without_changing_output(plugin, monkeypatch):
    store = make_store(plugin)
    result = {"ok": True, "data": miss()}
    monkeypatch.setattr(plugin, "run_dialectos", lambda *a, **k: result)
    actual = plugin.validate("El autobús", "es-AR", "The bus")
    assert actual is result
    assert len(store.cards("es-AR")) == 1
    store.path.unlink()
    plugin._on_post_tool("dialectos_validate", {"dialect": "es-AR"}, json.dumps(result))
    assert len(store.cards("es-AR")) == 1
    assert "learning" not in actual and "learning" not in actual["data"]


def test_address_forms_capture_only_dictionary_concepts(plugin):
    store = make_store(plugin)
    store.capture({"addressForms": {"passed": False, "violations": [
        {"concept": "informal_address", "expectedTerm": "che", "foundTerm": "tío"}]}}, "es-AR")
    assert store.cards("es-AR")[0]["concept"] == "informal_address"
    store.capture({"addressForms": {"passed": True, "violations": [{"concept": "bus"}]}}, "es-AR")
    assert len(store.cards("es-AR")) == 1


def test_capture_failure_does_not_change_validation_or_ledger(plugin, monkeypatch):
    result = {"ok": True, "data": miss()}
    monkeypatch.setattr(plugin, "run_dialectos", lambda *a, **k: result)
    assert plugin.validate("El autobús", "es-AR", "The bus") is result
    plugin._on_post_tool("dialectos_validate", {"dialect": "es-AR"}, result)
    assert json.loads(plugin._ledger_path().read_text())[-1]["passed"] is True
