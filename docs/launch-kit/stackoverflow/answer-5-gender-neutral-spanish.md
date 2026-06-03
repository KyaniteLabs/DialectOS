> Status: draft, not approved for publication. Do not publish until `docs/plans/2026-05-10-launch-remediation-plan.md` final launch gates pass.
>
# Stack Overflow Answer: Gender-neutral Spanish in software

**Question to search for:** "gender neutral spanish translation software" or "spanish inclusive language elles latine programming"

**Tags to target:** `spanish`, `gender-neutral`, `i18n`, `localization`, `inclusive-language`

---

Spanish is a heavily gendered language. Most translation tools default to masculine forms ("todos", "los usuarios"). For inclusive software, you need gender-neutral alternatives:

| Traditional | Gender-Neutral | Used In |
|-------------|----------------|---------|
| todos | todes / todas las personas | Progressive/regional |
| el usuario | la persona usuaria | Formal inclusive |
| bienvenidos | bienvenides | Progressive |
| latino | latine | U.S. Latinx communities |
| amigos | amigues | Progressive |

**[DialectOS](https://github.com/KyaniteLabs/DialectOS)** has a dedicated `apply_gender_neutral` tool:

```bash
dialectos i18n apply-gender-neutral ./locales/es-MX.json --style inclusive
```

**Styles supported:**
- `inclusive` — uses -e endings (todes, amigues)
- `neutral` — avoids gendered terms entirely ("la persona" instead of "el/la usuario")
- `formal` — defaults to feminine when gender unknown ("la paciente")

**MCP tool:**
```json
{
  "tool": "apply_gender_neutral",
  "text": "Bienvenidos todos los usuarios",
  "style": "inclusive"
}
// → "Bienvenides todes las personas usuarias"
```

**Also checks:**
- Formality consistency (inclusive language + tú vs usted)
- Dialect appropriateness (some regions resist -e endings)
- Glossary enforcement (brand terms stay unchanged)

open-source, automated tests.
