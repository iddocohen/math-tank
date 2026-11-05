# Quickstart: validate Math Tanks

## Prerequisites

- Node.js 22 or later, pnpm 10 or later.
- Chromium for Playwright: `pnpm exec playwright install chromium`.

## Setup and run

```bash
pnpm install
pnpm dev            # development server, open the printed URL
pnpm test           # Vitest unit tests (core logic)
pnpm build          # production build into dist/
pnpm preview        # serve the production build
pnpm e2e            # Playwright tests against the production build
pnpm lint && pnpm typecheck
```

## Validation scenarios

Each scenario maps to a PRD acceptance criterion. Automated coverage is named where it exists.

| # | Scenario | Steps | Expected | Automated |
|---|----------|-------|----------|-----------|
| 1 | AC-01 playable battle | Settings: free-play on. Start, aim, fire several times | Visible arcs, craters, health changes, enemy fires back, round end, "Nochmal" starts a new landscape | `e2e/battle.spec.ts`, `src/core/physics/*.test.ts` |
| 2 | AC-02 number line | Range 0 to 100, number line only. Drag to 37 | Guide line and marker at battlefield position 37 | `src/core/numberline/*.test.ts` (mapping round trip) |
| 3 | AC-03 ticks | Look at the line between 30 and 40 | Major ticks at 30 and 40, nine equal minor ticks, 37 selectable | `ticks.test.ts` |
| 4 | AC-04 range 0 to 20 | Set range 0 to 20, play 10 turns | No number above 20 anywhere | `generator.property.test.ts` (10,000 seeds per preset) |
| 5 | AC-05 subtraction | Only subtraction on; seed producing 43 − 7 (see `fixtures.ts`); tap help | Marker moves 43 → 40 → 36; selecting 36 solves | `subtraction.test.ts`, `stepPath` test |
| 6 | AC-06 comparison | Only comparison; seed producing 47 vs 74 greater | Tapping 74 marks the target and charges the cannon | `comparison.test.ts`, `battleController.test.ts` |
| 7 | AC-07 help | Answer wrong 3 times | Help steps 1, 2, 3; solution shown; "Weiter" continues to aiming; attempt stored as "with help" | `battleController.test.ts` |
| 8 | AC-08 persistence | Change settings, close browser, reopen | Settings kept | `e2e/persistence.spec.ts`, `storage.test.ts` |
| 9 | AC-09 adaptive | Run the adaptive unit tests | Step rises after 5 of 6 independent, falls after 3 of 5 assisted, guesses ignored, limits respected | `adaptive.test.ts` |
| 10 | AC-10 offline | `pnpm build && pnpm preview`, load once, set browser offline, reload, play a round | Game loads and plays | `e2e/offline.spec.ts` |
| 11 | Low-frustration text | Run the i18n test | No forbidden word in any child-facing string | `i18n.test.ts` |
| 12 | Tablet | Open on a tablet or with touch emulation at 1024 by 768 | All controls usable by touch; targets at least 48 px | manual |

A debug query parameter `?seed=<n>` fixes the round seed so manual scenarios 5 and 6 are reproducible.
