"""Dictionary comparisons and date-based Leitner practice without text retention."""
import json
from datetime import date, timedelta

import pytest

from test_learning import make_store, miss


def test_bus_comparison_uses_dictionary_contrasts(plugin):
    store = make_store(plugin)
    card = store.compare('bus', 'es-AR')
    assert card['term'] == 'colectivo' and card['englishGloss'] == 'public transit vehicle'
    assert 3 <= len(card['contrasts']) <= 5
    terms = {c['variant']: c['term'] for c in card['contrasts']}
    assert terms['es-MX'] == 'camión' and terms['es-CU'] == 'guagua' and terms['es-ES'] == 'autobús'
    assert 'es-AR' not in terms


def test_daily_tip_is_deterministic_without_cards_or_writes(plugin):
    store = make_store(plugin)
    one = store.tip('es-AR')
    assert store.tip('es-AR') == one
    assert one['variant'] == 'es-AR' and one['term']
    assert not store.path.exists()
    other = make_store(plugin)
    assert other.tip('es-AR') == one
    days = []
    for n in range(5):
        store.clock = lambda n=n: date(2026, 11, 11) + timedelta(days=n)
        days.append(store.tip('es-AR')['concept'])
    assert len(set(days)) > 1


def test_quiz_due_card_hides_answer_and_is_read_only(plugin):
    store = make_store(plugin)
    store.capture(miss(), 'es-AR')
    before = store.path.read_bytes()
    quiz = store.quiz('es-AR')
    assert quiz['concept'] == 'bus' and 'bus' in quiz['question'] and 'es-AR' in quiz['question']
    assert 'colectivo' not in json.dumps(quiz)
    assert store.path.read_bytes() == before


def test_quiz_with_no_cards_offers_daily_practice(plugin):
    store = make_store(plugin)
    quiz = store.quiz('es-AR')
    assert quiz['practice'] is True
    assert quiz['concept'] == store.tip('es-AR')['concept']
    assert not store.path.exists()


def test_leitner_promotes_through_five_boxes_and_resets_on_miss(plugin):
    today = [date(2026, 11, 11)]
    store = make_store(plugin, clock=lambda: today[0])
    store.capture(miss(), 'es-AR')
    for box, days in [(2, 1), (3, 3), (4, 7), (5, 21), (5, 21)]:
        result = store.answer('bus', 'es-AR', 'colectivo')
        assert result['correct'] is True and result['card']['box'] == box
        assert result['card']['due'] == (today[0] + timedelta(days=days)).isoformat()
        assert store.stats('es-AR')['due'] == 0
        with pytest.raises(ValueError, match='not due'):
            store.answer('bus', 'es-AR', 'colectivo')
        today[0] += timedelta(days=days)
    result = store.answer('bus', 'es-AR', 'Private wrong sentence')
    assert result['correct'] is False and result['card']['box'] == 1
    assert result['card']['due'] == today[0].isoformat()
    assert 'Private wrong sentence' not in store.path.read_text()
    store.capture(miss(), 'es-AR')
    assert store.stats('es-AR')['boxes']['1'] == 1


@pytest.mark.parametrize('answer', ['CAMION', 'camión', '  CaMiO\u0301N  '])
def test_answers_ignore_accents_case_and_outer_whitespace(plugin, answer):
    store = make_store(plugin)
    result = store.answer('bus', 'es-MX', answer)
    assert result['correct'] is True
    assert result['card']['term'] == 'camión'


def test_accepts_only_explicit_dictionary_alternates(plugin):
    store = make_store(plugin)
    entries = json.loads(store._dictionary_path().read_text())
    bus = next(e for e in entries if e['concept'] == 'bus')
    bus['variants']['es-MX']['alternates'] = ['autobús']
    bus['alternates'] = {'es-MX': ['bus']}
    store._dictionary_path().write_text(json.dumps(entries))
    assert store.answer('bus', 'es-MX', 'AUTOBUS')['correct'] is True
    store.clock = lambda: date(2026, 11, 12)
    assert store.answer('bus', 'es-MX', 'BUS')['correct'] is True


def test_unknown_concepts_and_unconfirmed_forget_leave_store_alone(plugin):
    store = make_store(plugin)
    store.capture(miss(), 'es-AR')
    before = store.path.read_bytes()
    with pytest.raises(ValueError):
        store.answer('arbitrary private sentence', 'es-AR', 'private answer')
    with pytest.raises(ValueError, match='confirm'):
        store.forget('es-AR')
    assert store.path.read_bytes() == before
    store.capture(miss(), 'es-MX')
    assert store.forget('es-AR', confirm=True) == 1
    assert store.stats('es-MX')['total'] == 1


def test_address_card_quiz_uses_fixed_form_without_persisting_prose(plugin):
    store = make_store(plugin)
    store.capture({'addressForms': [{'expectedTerm': 'vos', 'foundTerm': 'tú'}]}, 'es-AR')
    quiz = store.quiz('es-AR')
    assert 'address' in quiz['question'] and quiz['concept'] == 'address_singular'
    assert store.answer(quiz['concept'], 'es-AR', 'VOS')['correct'] is True
    assert all(set(c) == {'concept', 'variant', 'box', 'due'} for c in store.cards())
