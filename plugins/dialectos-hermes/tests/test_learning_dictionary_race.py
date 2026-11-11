"""Losing the installed dictionary during a read must not erase progress."""
import pytest

from test_learning import make_store, miss


def test_dictionary_removed_mid_read_preserves_progress(plugin, monkeypatch):
    store = make_store(plugin)
    store.capture(miss(), "es-AR")
    before = store.path.read_bytes()
    path = store._dictionary_path()
    calls = []

    def disappearing():
        calls.append(1)
        if len(calls) == 2:
            path.unlink()
        return path

    monkeypatch.setattr(store, "_dictionary_path", disappearing)
    with pytest.raises(ValueError, match="dictionary.*unavailable"):
        store.cards("es-AR")
    assert store.path.read_bytes() == before
    assert not list(store.path.parent.glob("learning.json.corrupt-*"))
