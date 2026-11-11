"""Private, deterministic learning. No submitted text crosses the write boundary.

The host injects its storage/locking helpers. Dictionary reads never install the
CLI or use the network. Address cards use fixed concept IDs and omit the term
field: the regional dictionary describes vocabulary, not tú/vos/usted grammar.
"""
from __future__ import annotations

import json
import os
import hashlib
import re
import unicodedata
import uuid
from datetime import date, datetime, timedelta, timezone
from functools import lru_cache
from pathlib import Path

VARIANTS = frozenset('es-AD es-AR es-BO es-BZ es-CL es-CO es-CR es-CU es-DO es-EC '
                     'es-ES es-GQ es-GT es-HN es-MX es-NI es-PA es-PE es-PH es-PR '
                     'es-PY es-SV es-US es-UY es-VE'.split())
_VOSEO = frozenset('es-AR es-UY es-PY es-GT es-HN es-SV es-NI'.split())
_ADDRESS = {
    'address_singular': ('informal singular address (standard written register)',
                         {v: 'vos' if v in _VOSEO else 'tú' for v in VARIANTS}),
    'address_plural': ('informal plural address',
                       {v: 'vosotros' if v in {'es-ES', 'es-AD'} else 'ustedes' for v in VARIANTS}),
    'address_formal': ('formal singular address', {v: 'usted' for v in VARIANTS}),
}
_ADDRESS_TERMS = {'vos': 'address_singular', 'tú': 'address_singular',
                  'usted': 'address_formal', 'vosotros': 'address_plural', 'ustedes': 'address_plural'}
_MISSING = ('Offline dictionary is unavailable. Install the pinned CLI release first '
            '(or place its verified tarball in plugin-data/dialectos/ and run a CLI tool). '
            'Learn never downloads it.')
INTERVALS = (0, 1, 3, 7, 21)


class DictionaryUnavailable(ValueError):
    """The installed data is absent or unreadable; progress is still valid."""


def _today():
    return datetime.now(timezone.utc).date()


def _normalize(text):
    return ''.join(c for c in unicodedata.normalize('NFD', text.strip().casefold())
                   if not unicodedata.combining(c))


@lru_cache(maxsize=4)
def _dictionary(path: str, modified: int, size: int) -> dict:
    """Cache successful reads only; a missing/replaced release can recover later."""
    entries = json.loads(Path(path).read_text(encoding='utf-8'))
    if not isinstance(entries, list) or not entries:
        raise ValueError(_MISSING)
    result = {}
    for e in entries:
        if not isinstance(e, dict) or not isinstance(e.get('concept'), str) or not isinstance(e.get('englishGloss'), str):
            raise ValueError(_MISSING)
        if e['concept'] in result or e['concept'] in _ADDRESS:
            raise ValueError(_MISSING)
        variants = e.get('variants', {})
        if not isinstance(variants, dict) or any(
            v not in VARIANTS or not isinstance(t, dict) or not isinstance(t.get('term'), str)
            or not t['term'].strip() for v, t in variants.items()
        ) or ('panHispanic' in e and not isinstance(e['panHispanic'], str)):
            raise ValueError(_MISSING)
        result[e['concept']] = e
    return result


class LearningStore:
    def __init__(self, data_dir, atomic_write_json, locked, dictionary_path, *, clock=_today):
        self._data_dir = data_dir
        self._write = atomic_write_json
        self._locked = locked
        self._dictionary_path = dictionary_path
        self.clock = clock

    @property
    def path(self):
        return self._data_dir() / 'learning.json'

    def dictionary(self):
        try:
            path = self._dictionary_path()
            stat = path.stat()
            return _dictionary(str(path.resolve()), stat.st_mtime_ns, stat.st_size)
        except (OSError, ValueError, TypeError) as exc:
            raise DictionaryUnavailable(_MISSING) from exc

    def _term(self, concept, variant):
        if variant not in VARIANTS:
            raise ValueError('Unknown learning variant; use a supported es-XX code.')
        if concept in _ADDRESS:
            return _ADDRESS[concept][1][variant]
        e = self.dictionary().get(concept)
        if not e:
            raise ValueError('Unknown dictionary concept.')
        term = e.get('variants', {}).get(variant, {}).get('term') or e.get('panHispanic')
        if not term:
            raise ValueError('This concept has no term for that variant.')
        return term

    def _card(self, concept, variant, box=1, due=None):
        term = self._term(concept, variant)
        card = {'concept': concept, 'variant': variant, 'box': box,
                'due': due or self.clock().isoformat()}
        if concept not in _ADDRESS:
            card['term'] = term
        return card

    def _read(self):
        """Called under the host lock, including recovery and permission repair."""
        if not self.path.exists():
            return []
        os.chmod(self.path, 0o600)
        try:
            data = json.loads(self.path.read_text(encoding='utf-8'))
            if not isinstance(data, dict) or set(data) != {'cards'} or not isinstance(data['cards'], list):
                raise ValueError('Invalid store')
            seen = set()
            for c in data['cards']:
                if not isinstance(c, dict) or type(c.get('box')) is not int or not 1 <= c['box'] <= 5:
                    raise ValueError('Invalid card')
                if not isinstance(c.get('concept'), str) or not isinstance(c.get('variant'), str):
                    raise ValueError('Invalid identity')
                due = date.fromisoformat(c['due']).isoformat()
                if c != self._card(c['concept'], c['variant'], c['box'], due):
                    raise ValueError('Invalid fields')
                key = c['concept'], c['variant']
                if key in seen:
                    raise ValueError('Duplicate card')
                seen.add(key)
            return data['cards']
        except DictionaryUnavailable:
            raise
        except (ValueError, TypeError, KeyError):
            backup = self.path.with_name('learning.json.corrupt-' + uuid.uuid4().hex)
            os.replace(self.path, backup)
            self._save([])
            return []

    def _save(self, cards):
        # Only constructed dictionary identities/terms and scheduling fields enter here.
        self._write(self.path, {'cards': cards})  # host mkstemp + replace writes 0600

    def cards(self, variant=None):
        self.dictionary()  # missing dictionary must not turn valid cards into corrupt backups
        if variant is not None and variant not in VARIANTS:
            raise ValueError('Unknown learning variant; use a supported es-XX code.')
        with self._locked(self.path):
            return sorted([c for c in self._read() if variant is None or c['variant'] == variant],
                          key=lambda c: (c['due'], c['variant'], c['concept']))

    def capture(self, report, variant):
        if not isinstance(variant, str) or variant not in VARIANTS or not isinstance(report, dict):
            return 0
        dictionary = self.dictionary()
        concepts = set()
        compliance = report.get('dialectCompliance')
        violations = compliance.get('violations', []) if isinstance(compliance, dict) else report.get('violations', [])
        if isinstance(violations, list):
            for v in violations:
                if (isinstance(v, dict) and isinstance(v.get('concept'), str)
                        and v['concept'] in dictionary and 'expectedTerm' in v and 'foundTerm' in v):
                    concepts.add(v['concept'])
        # Address reports may carry strings or structured violations. Their prose
        # is never copied: map only known forms into our small grammar concept set.
        address = report.get('addressForms')
        if isinstance(address, dict):
            if address.get('passed') is True:
                address = []
            else:
                direct = [address] if 'expected' in address or 'expectedTerm' in address else []
                address = address.get('violations', address.get('issues', direct))
        if isinstance(address, list):
            for v in address:
                if isinstance(v, dict):
                    if (isinstance(v.get('concept'), str) and v['concept'] in dictionary
                            and 'expectedTerm' in v and 'foundTerm' in v):
                        concepts.add(v['concept'])
                    expected = v.get('expectedTerm', v.get('expected'))
                    if isinstance(expected, str) and expected in _ADDRESS_TERMS:
                        concept = _ADDRESS_TERMS[expected]
                        if self._term(concept, variant) == expected:
                            concepts.add(concept)
                elif isinstance(v, str):
                    words = set(re.findall(r'\w+', v.casefold()))
                    concept = ('address_plural' if words & {'vosotros', 'ustedes'} else
                               'address_formal' if 'usted' in words else 'address_singular')
                    concepts.add(concept)
        fresh = []
        for concept in sorted(concepts):
            try:
                fresh.append(self._card(concept, variant))
            except ValueError:
                continue
        if not fresh:
            return 0
        with self._locked(self.path):
            cards = {(c['concept'], c['variant']): c for c in self._read()}
            for c in fresh:
                key = c['concept'], c['variant']
                # Reprocessing the same result from validate and post_tool_call
                # is idempotent. A fresh miss always returns the card to box 1.
                cards[key] = c
            self._save(list(cards.values()))
        return len(fresh)

    def compare(self, concept, variant):
        term = self._term(concept, variant)
        if concept in _ADDRESS:
            gloss, forms = _ADDRESS[concept]
            entry = {}
        else:
            entry = self.dictionary()[concept]
            gloss = entry['englishGloss']
            forms = {v: e['term'] for v, e in entry.get('variants', {}).items()}
            if entry.get('panHispanic'):
                forms = {**dict.fromkeys(VARIANTS, entry['panHispanic']), **forms}
        # Start with familiar contrasts, then pick distinct terms before filling
        # the remaining slots. Universal vocabulary still compares variant codes.
        order = list(dict.fromkeys(['es-MX', 'es-AR', 'es-CU', 'es-ES', 'es-CL', 'es-CO'] + sorted(forms)))
        selected, seen = [], {_normalize(term)}
        for v in order:
            if v != variant and v in forms and _normalize(forms[v]) not in seen:
                selected.append(v)
                seen.add(_normalize(forms[v]))
                if len(selected) == 5:
                    break
        for v in order:
            if len(selected) >= 3:
                break
            if v != variant and v in forms and v not in selected:
                selected.append(v)
        details = entry.get('variants', {}).get(variant, {})
        return {'concept': concept, 'variant': variant, 'term': term, 'englishGloss': gloss,
                'contrasts': [{'variant': v, 'term': forms[v]} for v in selected],
                'register': details.get('register', 'universal'), 'notes': details.get('notes', '')}

    def tip(self, variant):
        if variant not in VARIANTS:
            raise ValueError('Unknown learning variant; use a supported es-XX code.')
        entries = self.dictionary()
        concepts, contrasting = [], []
        for concept, e in entries.items():
            try:
                term = self._term(concept, variant)
            except ValueError:
                continue
            concepts.append(concept)
            if any(_normalize(v['term']) != _normalize(term) for v in e.get('variants', {}).values()):
                contrasting.append(concept)
        candidates = sorted(contrasting or concepts)
        if not candidates:
            raise ValueError('No dictionary terms for this variant.')
        seed = hashlib.sha256(f'{self.clock().isoformat()}:{variant}'.encode()).digest()
        return self.compare(candidates[int.from_bytes(seed, 'big') % len(candidates)], variant)

    def quiz(self, variant):
        today = self.clock().isoformat()
        cards = self.cards(variant)
        due = [c for c in cards if c['due'] <= today]
        c = due[0] if due else self.tip(variant)
        concept = c['concept']
        if not due and any(card['concept'] == concept for card in cards):
            return {'concept': None, 'variant': variant, 'practice': False,
                    'question': 'All caught up. Come back when you feel like it.'}
        gloss = _ADDRESS[concept][0] if concept in _ADDRESS else self.dictionary()[concept]['englishGloss']
        label = concept.replace('_', ' ') if concept not in _ADDRESS else gloss
        return {'concept': concept, 'variant': variant, 'englishGloss': gloss,
                'question': f'In {variant}, what do you call “{label}” ({gloss})?',
                'practice': not bool(due), 'box': c.get('box', 1)}

    def _accepted(self, concept, variant):
        accepted = [self._term(concept, variant)]
        if concept not in _ADDRESS:
            e = self.dictionary()[concept]
            alternates = e.get('alternates', {})
            for source in (e.get('variants', {}).get(variant, {}).get('alternates', []),
                           alternates.get(variant, []) if isinstance(alternates, dict) else alternates):
                if isinstance(source, list):
                    accepted.extend(t for t in source if isinstance(t, str) and t.strip())
        return {_normalize(t) for t in accepted}

    def answer(self, concept, variant, answer):
        self.dictionary()
        if not isinstance(concept, str) or not isinstance(variant, str):
            raise ValueError('answer requires a dictionary concept and variant.')
        if not isinstance(answer, str) or not answer.strip() or len(answer) > 500:
            raise ValueError('Provide a typed answer of 1–500 characters.')
        correct = _normalize(answer) in self._accepted(concept, variant)
        comparison = self.compare(concept, variant)
        today = self.clock()
        with self._locked(self.path):
            cards = {(c['concept'], c['variant']): c for c in self._read()}
            key = concept, variant
            old = cards.get(key, self._card(concept, variant))
            if old['due'] > today.isoformat():
                raise ValueError('Card is not due until ' + old['due'] + '.')
            box = min(5, old['box'] + 1) if correct else 1
            card = self._card(concept, variant, box, (today + timedelta(days=INTERVALS[box - 1])).isoformat())
            cards[key] = card
            self._save(list(cards.values()))
        return {'correct': correct, 'card': card, 'term': comparison['term'],
                'box': box, 'due': card['due'], 'comparison': comparison}

    def stats(self, variant):
        cards = self.cards(variant)
        return {'variant': variant, 'total': len(cards),
                'due': sum(c['due'] <= self.clock().isoformat() for c in cards),
                'boxes': {str(b): sum(c['box'] == b for c in cards) for b in range(1, 6)}}

    def forget(self, variant, *, confirm=False):
        if confirm is not True:
            raise ValueError('forget requires explicit confirm=true.')
        if variant not in VARIANTS:
            raise ValueError('Unknown learning variant; use a supported es-XX code.')
        try:
            self.dictionary()
            dictionary_available = True
        except ValueError:
            dictionary_available = False
        with self._locked(self.path):
            if dictionary_available:
                cards = self._read()
                kept = [c for c in cards if c['variant'] != variant]
                self._save(kept)
                return len(cards) - len(kept)
            # A whole-file erasure needs no dictionary. Partial erasure needs
            # canonical validation before rewriting another variant's terms.
            if not self.path.exists():
                return 0
            os.chmod(self.path, 0o600)
            try:
                data = json.loads(self.path.read_text(encoding='utf-8'))
                cards = data['cards']
                if not isinstance(cards, list) or not all(isinstance(c, dict) for c in cards):
                    raise ValueError('Invalid cards')
            except (ValueError, TypeError, KeyError):
                backup = self.path.with_name('learning.json.corrupt-' + uuid.uuid4().hex)
                os.replace(self.path, backup)
                self._save([])
                return 0
            kept = [c for c in cards if c.get('variant') != variant]
            if kept:
                raise ValueError(_MISSING + ' Restore the dictionary before forgetting one of several variants.')
            self._save([])
            return len(cards)
