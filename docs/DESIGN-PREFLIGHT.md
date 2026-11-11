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

`branding/dialectos-512.png`: teal-blue apatite Ñ and É, with copper veins and a copper vine. The page shows the mark at 48 px on a pale mist tile set into the apatite header slab.

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

**Correction, 2026-11-10 (Simon):** "make it reflect the stone blue apatite." The Walnut sand ground is withdrawn. It was the one open assumption, and it borrowed Selenite's ground instead of this stone's. Every colour below now comes from blue apatite as material-realism describes it: "deep saturated petrol-blue to teal depths, genuinely opaque, with fine granular and fibrous internal structure, natural mottling".

- **Ground:** pale apatite mist `#e3edef`, the light end of the stone's mottling. Cards are `#f4f8f9` and inputs `#fbfdfd`. All neutrals lean toward the stone's petrol hue, and none of them is warm.
- **Ink:** deep petrol `#12303a` for text (11.7:1 on the ground), with `#2a4752` (8.3:1) and `#3d5a65` (6.2:1) as the second and third levels. The page has no pure black.
- **Identity slab:** the header is an opaque apatite slab, drawn as a gradient from petrol `#0c3d50` through `#145a6a` to teal `#1a6c76` and back, with one teal highlight (`#1a6c76`, no lighter). Fine granular noise and soft fibrous mottling sit on top of it, and a petrol band darkens the side where the text sits. The gradient runs at an angle because blue apatite is pleochroic: its colour changes with the viewing angle (see section 2). Text was measured on the rendered slab with the text hidden, against the brightest pixel inside each text box: the title `#f3fafb` is at least 7.7:1 and the tagline `#eaf5f6` at least 6.4:1, at 1200, 760, 360 and 320 px. Below 760 px a 40% petrol scrim sits under the title block to keep that margin.
- **Facts strip:** solid `#0a3344` with the same grain. Labels `#9fc9cf` (7.5:1), values `#f3fafb`, and a setting that is off `#f6d6d6` (9.9:1). The strip wraps its values below 760 px.
- **Mark on the slab:** the mark is dark teal, so it sits on a pale mist specimen tile set into the slab. On the bare slab it would disappear.
- **Accent:** apatite petrol `#135668` (6.9:1 on the ground, 7.7:1 on cards). It marks focus rings, links and the pass share of each bar. The selected variant is a solid slab chip (`#0c3d50`, text `#eaf5f6`, 10.5:1).
- **Borders:** inputs `#6b8993` and chips `#76929b` (3.1:1 on cards, 3.2:1 on inputs, which meets WCAG 1.4.11). The old `#aec4ca` and `#d8e4e7` outlines failed at 1.7:1 and 1.2:1.
- **Ground grain:** the mist ground carries a 5% petrol grain so it reads as the stone's light face, not a flat template grey.
- **Translucency:** none. Every surface is solid, because the stone is opaque (Simon's lock: "not translucent").
- **Copper:** the copper of the veins appears only inside the mark and is not a UI colour. This follows the standing rule of no brown or orange, and material-realism treats the veins as an artistic device.
- **States:** each state also has a text label, so colour is never the only signal. Pass is green `#2f6337` (6.0:1 on the ground). Blocking is red `#992e2e` (6.3:1). Advisory is slate `#46596a` (6.1:1), which replaces the old sand `#6b5f54` because that colour read as brown. The check history splits the three: a check that failed on advisory issues alone is counted and painted as advisory, not blocked.
- All ratios were measured on 2026-11-10 against the WCAG 2 relative-luminance formula.
- **Type and shape:** sizes are 11, 12, 13, 14, 16 and 26 px, with no half pixels. Radii are 12 (slab and cards), 8 (results, notes, tile) and 6 (controls).
- **Assumption:** the slab treatment and the mist ground are right for DialectOS. This goes to Simon's eye-gate.
