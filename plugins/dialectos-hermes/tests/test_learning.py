"""Offline learning: private persistence, recovery and capture boundaries."""
from __future__ import annotations

import importlib
import json
import random
import shutil
import string
from concurrent.futures import ThreadPoolExecutor
from datetime import date

import pytest

from conftest import PLUGIN_DIR

DICTIONARY = PLUGIN_DIR.parents[1] / 'packages/types/src/dialectal-dictionary.json'


def make_store(plugin, clock=lambda: date(2026, 11, 11)):
    module = importlib.import_module(plugin.__name__ + '.learning')
    path = plugin._release_dir() / 'package/node_modules/@dialectos/types/dist/dialectal-dictionary.json'
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        shutil.copyfile(DICTIONARY, path)
    return module.LearningStore(plugin._data_dir, plugin._atomic_write_json, plugin._locked,
                                lambda: path, clock=clock)


@pytest.fixture
def store(plugin):
    return make_store(plugin)


def miss(concept='bus', expected='colectivo', found='autobús'):
    return {'valid': True, 'dialectCompliance': {'violations': [
        {'concept': concept, 'expectedTerm': expected, 'foundTerm': found}]}}


def test_capture_deduplicates_and_refreshes_only_dictionary_cards(store):
    assert store.capture(miss(), 'es-AR') == 1
    assert store.capture(miss(), 'es-AR') == 1
    cards = store.cards('es-AR')
    assert cards == [{'concept': 'bus', 'variant': 'es-AR', 'term': 'colectivo',
                      'box': 1, 'due': '2026-11-11'}]
    assert store.capture(miss('unknown'), 'es-AR') == 0
    assert store.capture(miss(), 'es-ZZ') == 0


def test_store_never_contains_user_text_fuzz(store, plugin):
    rng = random.Random(17)
    sentences = ['Private sentence ' + ''.join(rng.choices(string.ascii_letters + ' ', k=80)) for _ in range(80)]
    for sentence in sentences:
        report = miss(expected=sentence, found=sentence)
        report.update(source=sentence, translated=sentence)
        store.capture(report, 'es-AR')
        store.capture(miss(sentence), 'es-AR')
        store.capture(report, sentence)
    raw = (plugin._data_dir() / 'learning.json').read_text()
    assert all(s not in raw for s in sentences)
    assert json.loads(raw) == {'cards': [{'concept': 'bus', 'variant': 'es-AR',
        'term': 'colectivo', 'box': 1, 'due': '2026-11-11'}]}
    assert (plugin._data_dir() / 'learning.json').stat().st_mode & 0o777 == 0o600


@pytest.mark.parametrize('broken', ['{oops', '[]', '{"cards": "bad"}',
    '{"cards": [{"concept": "bus", "variant": "es-AR", "term": "private text", "box": 1, "due": "2026-11-11"}]}'])
def test_corrupt_store_is_backed_up_and_recovers(store, plugin, broken):
    path = plugin._data_dir() / 'learning.json'
    path.write_text(broken)
    path.chmod(0o644)
    assert store.cards('es-AR') == []
    backups = list(path.parent.glob('learning.json.corrupt-*'))
    assert len(backups) == 1 and backups[0].read_text() == broken
    assert backups[0].stat().st_mode & 0o777 == 0o600
    assert json.loads(path.read_text()) == {'cards': []}
    assert path.stat().st_mode & 0o777 == 0o600


def test_concurrent_capture_does_not_lose_updates(store):
    variants = ['es-AR', 'es-MX', 'es-CU', 'es-ES', 'es-CL', 'es-CO']
    with ThreadPoolExecutor(max_workers=6) as pool:
        list(pool.map(lambda v: store.capture(miss(), v), variants * 3))
    assert len(store.cards()) == 6


def test_missing_dictionary_is_clear_and_never_downloads(plugin, monkeypatch):
    monkeypatch.setattr(plugin, '_ensure_release', lambda *a: pytest.fail('Learn must stay offline'))
    module = importlib.import_module(plugin.__name__ + '.learning')
    store = module.LearningStore(plugin._data_dir, plugin._atomic_write_json, plugin._locked,
                                lambda: plugin._data_dir() / 'missing.json')
    with pytest.raises(ValueError, match='dictionary.*unavailable'):
        store.cards()


def test_cross_process_capture_uses_host_lock(store):
    import multiprocessing
    if 'fork' not in multiprocessing.get_all_start_methods():
        pytest.skip('fork not available on this platform')
    ctx = multiprocessing.get_context('fork')
    jobs = [ctx.Process(target=store.capture, args=(miss(), v))
            for v in ['es-AR', 'es-MX', 'es-CU', 'es-ES', 'es-CL', 'es-CO']]
    for p in jobs:
        p.start()
    for p in jobs:
        p.join(10)
        assert p.exitcode == 0
    assert len(store.cards()) == 6

