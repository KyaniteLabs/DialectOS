# Design preflight: DialectOS Hermes desktop page

This receipt covers the DialectOS page in the Hermes desktop app (`plugins/dialectos-hermes/desktop/plugin.js`) and its web dashboard tab. It does not change the mark. The mark is the round-16 C mark Simon picked on 2026-11-10. Its own receipt is `branding/DESIGN-PREFLIGHT.md`, which is on Forgejo main (#45, #46) and reaches this branch with the Forgejo↔GitHub reconcile.

## 1. Purpose

DialectOS translates into 25 regional Spanish variants and shows a receipt for every translation. In Hermes, the page answers one question: can I trust this translation for this region? It shows what the plugin is set up to do, lets a person try detect, translate and validate, and lists the QA verdicts the agent has recorded.

## 2. Title, stone and purpose

| Item | Value | Evidence class |
|---|---|---|
| Title | DialectOS | Product name |
| Stone | Opaque blue apatite with copper veins | Simon's lock; v27 approved 2026-11-08; r16 C picked 2026-11-10 |
| Mineral fact | Apatite, Ca₅(PO₄)₃(F,Cl,OH), Mohs 5. The name is from Greek *apatáō*, "to deceive", because "apatite is often mistaken for other minerals". Blue stones are strongly pleochroic: they change colour with the viewing angle. | Wikipedia (Apatite), fetched 2026-11-10 |
| Product fit | Dialects are easy to mistake for one another, and one sentence reads differently from each region. The page names the variant on every result, and it never presents a pass as proof. | Our metaphor, built on the fact above. **Assumption**, open to Simon's eye-gate. |

## 3. Rejected metaphors

- The speech-bubble globe (removed in #46).
- Flags or maps for the dialects. A country flag misstates a dialect region, so variants are named by code and name only.

## 4. Material reference

`branding/dialectos-512.png`: teal-blue apatite Ñ and É, with copper veins and a copper vine. The page shows the mark at 48 px on the sand ground.

## 5. Family icon law and form

There is no new icon. The page and sidebar row reuse the landed mark. The sidebar uses a host codicon (`globe`), because the nav row takes only codicons.

## 6. Typography

The page title and section labels use Chakra Petch, the family display face, embedded as the same OFL Latin subset the Selenite page ships. Body text, rows and controls use the host fonts.

## 7. Platform conventions

| Item | Requirement | Source |
|---|---|---|
| Desktop half | `desktop/plugin.js`, plain ESM, imports only `@hermes/plugin-sdk` and `react` | desktop plugin SDK; Selenite |
| Page | `ROUTES_AREA` at `/dialectos`, a `SIDEBAR_NAV_AREA` row and a ⌘K command | desktop plugin SDK |
| Backend | `dashboard/plugin_api.py`, mounted at `/api/plugins/dialectos/` | memory-wiki, Selenite |
| Dashboard tab | `dashboard/manifest.json` and `dashboard/dist/index.js` | memory-wiki, Selenite |
| Risky behaviour | Translate from the page sends text to the named provider. This is disclosed in the README and the catalog entry. | catalog rule 13 |

## 8. UI colour

- The ground is Walnut light sand `#f3ebdf`, with Walnut ink `#3b342e` for text. This is the family page ground Simon approved for Selenite on 2026-11-10 ("no black", solid, no translucency), and his Hermes runs the Walnut skin.
- The identity accent comes from the stone: deep apatite teal `#1d5e66` (6.2:1 on the sand ground, 6.8:1 on cards; measured 2026-11-10), used for the title rule, links and focus.
- The copper of the veins is not used as a UI colour (standing rule: no brown or orange).
- States use ink-weight Walnut pastels, each with a text label: pass is green `#46622a`, blocking is red `#8f3a33` and advisory is mid sand `#6b5f54`. Measured on the sand ground: pass 5.8:1, blocking 6.3:1, advisory 5.2:1, tertiary text 6.6:1, all above WCAG AA.
- **Assumption:** using the Selenite sand ground for DialectOS is right for the family. Pending Simon's eye.
