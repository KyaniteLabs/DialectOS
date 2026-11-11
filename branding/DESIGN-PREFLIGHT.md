# Design preflight: DialectOS brand surfaces

This receipt covers the site logo, favicon, touch icon and social card. It does not change the icon's design: the icon is the round-16 C mark that Simon picked on 2026-11-10 and that landed in #45.

## 1. Purpose

DialectOS translates into 25 regional Spanish variants and shows a receipt for every translation. A visitor should be able to tell at a glance which translations are trustworthy for their region.

## 2. Title, stone and purpose

| Item | Value | Evidence |
|---|---|---|
| Stone | Opaque blue apatite with copper veins | Simon's lock; v27 approved 2026-11-08; r16 C picked 2026-11-10 |
| Form | Ñ and É glyphs in stone, with a copper vine | `branding/dialectos.png` on main (#45) |
| Purpose fit | Regional letters carry the dialect | Simon's brief |

## 3. Rejected metaphors

- The speech-bubble globe SVG (`docs/assets/dialectos-logo.svg`). It isn't the family mark, so it was removed.

## 4. Material reference

The master is `branding/dialectos.png`. A grey cutout patch between the Ñ and the vine was cleared. Glyph pixels are unchanged; Simon's eye-gate covers this cleanup.

## 5. Family icon law and form

The landed mark is unchanged. The small sizes sit on a warm-paper tile (`#F4EFE6`) so the dark stone holds against dark tabs and the dark nav:

- favicon: 64 px, radius 12/64
- nav: 44×48
- apple-touch: 180 px, opaque

## 6. Typography

The lockup and headings use Chakra Petch, the family display face. Body text stays in the system sans.

## 7. Platform conventions

| Surface | File |
|---|---|
| Open Graph card 1200×630 | `docs/assets/og-image.png` |
| Favicon | `docs/assets/favicon-64.png` |
| Apple touch icon | `docs/assets/apple-touch-icon.png` |
| Nav mark | `docs/assets/dialectos-mark.png` (also listed in `scripts/demo-server.mjs`) |

## 8. UI colour

The existing dark UI and gold accent are unchanged. Muted text is raised to `#8b8b94` for 4.5:1 contrast on `#0a0a0b`.

**Assumption:** the nav and favicon tile colour (`#F4EFE6`) has not been reviewed by Simon.
