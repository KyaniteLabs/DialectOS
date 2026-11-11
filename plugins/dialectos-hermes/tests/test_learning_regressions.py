"""Regression cases found while reviewing Learn's persistence and quiz flow."""
import json
import random
import string

from test_learning import make_store, miss


def test_answer_fuzz_never_reaches_learning_file(plugin):
    store = make_store(plugin)
    rng = random.Random(23)
    sentences = ['Private answer ' + ''.join(rng.choices(string.ascii_letters + ' ', k=70)) for _ in range(50)]
    for answer in sentences:
        assert store.answer('bus', 'es-AR', answer)['correct'] is False
    raw = store.path.read_text()
    assert all(answer not in raw for answer in sentences)
    assert set(json.loads(raw)['cards'][0]) == {'concept', 'variant', 'term', 'box', 'due'}


def test_forget_recovers_corrupt_rows_before_rewriting(plugin):
    store = make_store(plugin)
    store.capture(miss(), 'es-AR')
    data = json.loads(store.path.read_text())
    data['cards'][0]['answer'] = 'Private text that must not be rewritten'
    store.path.write_text(json.dumps(data))
    store.forget('es-MX', confirm=True)
    assert json.loads(store.path.read_text()) == {'cards': []}
    backups = list(store.path.parent.glob('learning.json.corrupt-*'))
    assert len(backups) == 1 and backups[0].stat().st_mode & 0o777 == 0o600


def test_daily_practice_does_not_offer_a_card_that_is_not_due(plugin):
    store = make_store(plugin)
    daily = store.tip('es-AR')
    store.answer(daily['concept'], 'es-AR', daily['term'])
    quiz = store.quiz('es-AR')
    assert quiz['concept'] is None or quiz['concept'] != daily['concept']
    assert store.stats('es-AR')['due'] == 0


def test_missing_dictionary_preserves_existing_cards(plugin):
    store = make_store(plugin)
    store.capture(miss(), 'es-AR')
    before = store.path.read_bytes()
    store._dictionary_path().unlink()
    import pytest
    with pytest.raises(ValueError, match='dictionary.*unavailable'):
        store.quiz('es-AR')
    assert store.path.read_bytes() == before
    assert not list(store.path.parent.glob('learning.json.corrupt-*'))


def test_prose_plural_address_miss_creates_plural_card(plugin):
    store = make_store(plugin)
    store.capture({'addressForms': {'passed': False, 'violations': [
        'Use ustedes instead of vosotros for this region.']}}, 'es-MX')
    assert [c['concept'] for c in store.cards('es-MX')] == ['address_plural']


def test_direct_address_miss_shape_is_captured(plugin):
    store = make_store(plugin)
    store.capture({'addressForms': {'passed': False, 'expected': 'vos', 'found': 'tú'}}, 'es-AR')
    assert [c['concept'] for c in store.cards('es-AR')] == ['address_singular']
