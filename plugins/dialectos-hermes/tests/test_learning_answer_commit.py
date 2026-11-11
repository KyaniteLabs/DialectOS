"""A successful grade must remain observable after its progress is written."""
from test_learning import make_store, miss


def test_dictionary_disappearing_after_grade_commit_still_returns_verdict(plugin, monkeypatch):
    store = make_store(plugin)
    store.capture(miss(), 'es-AR')
    write = store._write
    path = store._dictionary_path()

    def write_then_remove_dictionary(dest, payload):
        write(dest, payload)
        path.unlink()

    monkeypatch.setattr(store, '_write', write_then_remove_dictionary)
    result = store.answer('bus', 'es-AR', 'colectivo')
    assert result['correct'] is True
    assert result['comparison']['term'] == 'colectivo'
    assert result['card']['box'] == 2 and result['card']['due'] == '2026-11-12'
