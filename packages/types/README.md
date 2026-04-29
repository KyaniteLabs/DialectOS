# @dialectos/types

Shared TypeScript types and schemas for DialectOS.

## Exports

- `TranslationProvider` — Provider interface with optional `getCapabilities()`
- `ProviderCapability` — Capability metadata (languages, payload limits, features)
- `TranslationResult` — Standardized translation output
- `TranslateOptions` — Translation options (dialect, formality, context)
- `SpanishDialect` — Union type of all 25 supported dialects
- `ALL_SPANISH_DIALECTS` — Array of all dialect codes

## Dialectal Dictionary

833 concepts across 14 semantic fields, covering all 25 Spanish dialects. 333 entries have genuine dialect variation (3–17 distinct terms per concept); the remaining 500 are pan-Hispanic (same term across all dialects).

### Dictionary data

- `DICTIONARY` — Full concept array (`DictionaryEntry[]`)
- `DictionaryEntry` — `{ field, concept, englishGloss, panHispanic?, variants? }`
- `Variant` — `{ term, frequency, register, notes? }`
- `SemanticField` — 14 fields: food, transport, technology, household, clothing, actions, social, people, education, body_parts, nature, medicine_health, family, finance

### Vocabulary query functions

- `getVocabularyForDialect(dialect)` — All terms for a dialect, sorted by frequency
- `getVocabularyByField(dialect, field)` — Filter terms by semantic field
- `getForbiddenTerms(dialect)` — Terms to avoid for a given dialect
- `validateDialectCompliance(source, translated, dialect)` — Check translation uses correct dialect terms
- `buildDialectVocabularyPrompt(dialect)` — Prompt fragment for LLM providers
- `buildConjugationPrompt(dialect)` — Voseo/verb prompt fragment

### Verb conjugations

- `VERB_CONJUGATIONS` — 37 verb entries with dialect-specific forms
- `VerbConjugation` — Lemma-changing and conjugation-pattern verbs with regional variants

### Dialect regions

- 11 regions: peninsular, mexican, caribbean, centralAmerica, rioplatense, andean, chilean, northernSouthAmerica, usLatino, african, heritage
- Derived lists: `ALL_AMERICAN_DIALECTS`, `FULL_VOSEO_DIALECTS`, `REGIONAL_VOSEO_DIALECTS`, `CONTACT_PHENOMENA_DIALECTS`, etc.

### Syntactic rules

- `SYNTACTIC_RULES` — 21 rules covering voseo, leísmo, tense preferences, clitic placement, etc.
- `getSyntacticRules(dialect)` — Rules applicable to a given dialect

### Fallback chain

When resolving a term for a dialect: `variants[dialect]` → `panHispanic` → `variants["es-ES"]` → `undefined`
