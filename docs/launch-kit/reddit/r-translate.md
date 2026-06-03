> Status: draft, not approved for publication. Do not publish until `docs/plans/2026-05-10-launch-remediation-plan.md` final launch gates pass.
>
# Reddit Post: r/translate

**Title:** 25 Spanish dialects your translation API probably doesn't support

**Body:**

Most translation APIs have one "Spanish" option. Some have 2-5. Here's why that's a problem:

**Same word, different countries:**

| English | Spain | Mexico | Argentina | Puerto Rico | Chile |
|---------|-------|--------|-----------|-------------|-------|
| car | coche | carro | auto | carro | auto |
| orange juice | jugo de naranja | jugo de naranja | jugo de naranja | **jugo de china** | jugo de naranja |
| bus | autobús | camión | colectivo | **guagua** | micro |
| cool | guay | chido | cheto | **chévere** | bacán |
| kid | chaval | chavo | pibe | **chama** | cabro |

**Grammar differences:**
- **Voseo** (Argentina): "vos podés" not "tú puedes"
- **Vosotros** (Spain): "vosotros podéis" — doesn't exist in Latin America
- **Leísmo** (Spain colloquial): "le vi" instead of "lo vi"

**The business impact:**

We shipped Spain Spanish to Mexico. Users thought we were being rude. Generic Spanish sounds foreign — or worse, culturally tone-deaf.

**I built DialectOS to fix this:**

- 25 Spanish dialects with regional vocabulary
- Structure-preserving translation (markdown, tables, code)
- Quality gates that catch semantic drift
- Works with any translation API (OpenAI, DeepL, LibreTranslate)
- open-source, automated tests

**Supported dialects:** es-ES, es-MX, es-AR, es-CO, es-CL, es-PE, es-VE, es-UY, es-PR, es-CU, es-DO, es-PA, es-CR, es-GT, es-HN, es-SV, es-NI, es-EC, es-BO, es-PY, es-GQ, es-US, es-PH, es-BZ, es-AD

Repo: https://github.com/KyaniteLabs/DialectOS

What's the most confusing Spanish regional word you've encountered?
