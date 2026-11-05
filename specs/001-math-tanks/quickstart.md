# Quickstart: validate Math Tanks

## Prerequisites

- Node.js 22 or later, pnpm 10 or later.
- Browsers for Playwright: `pnpm exec playwright install chromium webkit firefox`.
- Offline mode needs HTTPS or localhost (`pnpm preview` serves on localhost).

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

Each scenario maps to a PRD acceptance criterion or to [amendment 01](./amendment-01-number-aiming.md), [amendment 02](./amendment-02-ruler-ranges-and-detail.md) and [amendment 04](./amendment-04-hit-rule.md). Automated coverage is named where it exists.

| # | Scenario | Steps | Expected | Automated |
|---|----------|-------|----------|-----------|
| 1 | AC-01 playable battle | Settings: free-play on. Start "Freies Spiel", read the ruler under the enemy, choose numbers and fire several times | Fixed cannon; every shell lands at the chosen number; a shell on the enemy tank's body damages it, the exact number is a Volltreffer with double damage; a shell off the body inside the blast radius makes it shake; craters; enemy fires back after every shot; round end; "Nochmal" starts a new landscape | `e2e/battle.spec.ts`, `src/core/physics/*.test.ts` |
| 2 | AC-02 number line | Range 0 to 100, number line only. Drag to 37, or type 3 and 7 | Guide line and marker at battlefield position 37; Enter fires and the shell lands at 37 | `mapping.test.ts`, `arc.test.ts` |
| 3 | AC-03 ticks | Look at the line between 30 and 40 at ruler level 1 | Major lines at 30 and 40, nine equal minor lines, 37 selectable | `ticks.test.ts` |
| 4 | AC-04 range 0 to 20 | Set range 0 to 20, play 10 searches | No number above 20 anywhere | `generator.property.test.ts` (10,000 seeds per preset) |
| 5 | AC-05 subtraction | Only subtraction on; seed producing 43 − 7 (see `fixtures.ts`); press H twice | Marker moves 43 → 40 → 36; firing at 36 hits | `subtraction.test.ts`, `stepPath.test.ts` |
| 6 | AC-06 comparison | Only comparison; seed producing 47 vs 74 greater | Tapping 74, or typing 74 and Enter, fires at 74 and hits the enemy; tapping 47 destroys the decoy and shows help, with no enemy turn | `comparison.test.ts`, `battleController.test.ts`, `e2e/comparison.spec.ts` |
| 7 | AC-07 help | Fire at 3 wrong numbers in one search | Landing number shown each time; help steps 1 (direction), 2 (steps from the landing number), 3 (solution); no enemy turn and no health change between misses; Enter fires at the solution; attempt stored as "with help" | `battleController.test.ts`, `e2e/help.spec.ts` |
| 8 | AC-08 persistence | Change settings, close browser, reopen | Settings kept | `e2e/persistence.spec.ts`, `storage.test.ts` |
| 9 | AC-09 adaptive | Run the adaptive unit tests | Step rises after 5 of 6 independent, falls after 3 of 5 assisted, guesses ignored, limits respected; ruler level moves only between the parent's start and hardest level | `adaptive.test.ts` |
| 10 | AC-10 offline | `pnpm build && pnpm preview`, load once, set browser offline, reload, play a round | Game loads and plays | `e2e/offline.spec.ts` |
| 11 | Low-frustration text | Run the i18n test | No forbidden word in any child-facing string | `i18n.test.ts` |
| 12 | Tablet | Open on a tablet or with touch emulation at 1024 by 768 | All controls usable by touch; targets at least 48 px | manual, `e2e/touch.spec.ts` |
| 13 | Keyboard only | Load `/?seed=1`, do not click. Enter starts; type the answer digits and Enter; fire one wrong number; press H; at the solution press Enter; press Escape twice; play to the round end; Enter starts a new round | Every step works without mouse or touch; no key opens the parent settings | `e2e/keyboard.spec.ts` |
| 14 | Typed number out of range | Range 0 to 100; type 150 and press Enter | Nothing fires; the preview stays at 100; a hint shows "0 bis 100" | `entry.test.ts`, `e2e/keyboard.spec.ts` |
| 15 | Any range (amendment 02) | Custom range 550 to 780, free play | Battlefield spans 550 to 780; ruler majors at 550, 600, 650, 700, 750 and minors every 10; at levels 1 to 3 the enemy stands on a minor line; typing its number is a Volltreffer and the feedback shows the exact number; typing a number 1 away still hits and shows "Du: … · Gegner: … · 1 Schritt" | `ticks.test.ts`, `readPosition.test.ts`, `e2e/range.spec.ts` |
| 16 | Ruler levels | Settings: starting level 1 to 5 in turn, view the ruler preview and the game | Levels 1 to 5 show lines and labels as in FR-017; help step 2 shows all lines of the zoomed ten | `ticks.test.ts`, `SettingsPage.test.tsx` |
| 17 | Tank-body hit and Volltreffer (amendment 04) | Range 0 to 100, free play; fire at the enemy's number, then at a number 1 or 2 away, then 5 away | Exact: "Volltreffer!", larger explosion, health drops by 80. One or two away: "Treffer!", health drops by 40, ruler shows "Du: … · Gegner: … · N Schritte". Five away: a miss, the enemy shakes. A thin dashed line runs from the enemy tank's center to a small triangle on the ruler, with no number next to it | `hitRule.test.ts`, `battleController.test.ts`, `e2e/battle.spec.ts`, `e2e/range.spec.ts` |
| 18 | "Genau treffen" (amendment 04) | Store settings with `exactHit: true`, free play; fire 1 away from the enemy, then at its number | One away: "Ganz knapp!", step count, no damage, the tank shakes; exact: Volltreffer. The enemy shows a bullseye | `battleController.test.ts`, `e2e/range.spec.ts` |

A debug query parameter `?seed=<n>` fixes the round seed so manual scenarios 5, 6, 13 and 15 are reproducible.
