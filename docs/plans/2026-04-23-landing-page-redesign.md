# DialectOS landing page redesign — 2026-04-23

## Goal
Make the public DialectOS landing page look like a serious 2026 product surface, not an AI-generated SaaS template. The page must keep the real full-app translator as the center of the experience and make trust evidence visible without hype.

## Design direction
- **Tone:** quiet premium, technical, editorial, evidence-first.
- **Avoid:** generic neon AI gradients, glassmorphism cards everywhere, vague claims, mascot-ish icons, bloated marketing sections.
- **Use:** restrained off-black / parchment palette, sharp typography, clear hierarchy, measured motion, product receipts, and visible runtime/proof metadata.

## Information architecture
1. Top navigation with product identity, proof links, and direct demo anchor.
2. Hero with a specific promise: Spanish dialect translation with regional judgment, not generic localization.
3. Trust rail: provider-backed, output judged, no static fallback, test count.
4. Full-app translator as the main interactive object.
5. Dialect stress matrix showing concrete lexical traps rather than fluffy feature blurbs.
6. Dialect coverage grid that lets testers jump to a target locale.
7. Launch/audit proof section showing how this is validated.

## Implementation constraints
- Single static `docs/index.html`; no new dependency.
- Preserve `/api/status` and `/api/translate` integration.
- Preserve demo contract test anchors: `Full-app translator`, `Translate with full app`, `fetch('/api/translate'`, `browser to backend, backend to provider registry`, and `No static translation fallback was used`.
- Responsive at mobile, tablet, desktop.

## Verification
- Screenshot desktop and mobile locally.
- Visual QA against anti-slop criteria.
- Run `node --test docs/__tests__/*.test.mjs scripts/__tests__/*.test.mjs` and full build/test/audit before PR.
