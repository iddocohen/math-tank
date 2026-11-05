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

Each scenario maps to a PRD acceptance criterion or to [amendment 01](./amendment-01-number-aiming.md), [amendment 02](./amendment-02-ruler-ranges-and-detail.md), [amendment 04](./amendment-04-hit-rule.md), [amendment 05](./amendment-05-no-shortcuts-settings-early.md), [amendment 06](./amendment-06-one-hit-lives.md) and [amendment 07](./amendment-07-visible-enemy-return-fire.md). Automated coverage is named where it exists.

| # | Scenario | Steps | Expected | Automated |
|---|----------|-------|----------|-----------|
| 1 | AC-01 playable battle | Settings: free-play on. Start "Freies Spiel", read the ruler under the enemy, choose numbers and fire several times | Fixed cannon; every shell lands at the chosen number; only the exact number destroys the enemy and a new enemy appears; a shell on the body but not at the number makes it shake; craters; the enemy fires back after every shot that does not destroy it (amendment 07); each enemy hit removes one of 3 hearts; round end when the hearts are gone; "Nochmal" starts a new landscape | `e2e/battle.spec.ts`, `src/core/physics/*.test.ts` |
| 2 | AC-02 number line | Range 0 to 100, number line only. Drag to 37, or type 3 and 7 | Guide line and marker at battlefield position 37; while dragging no number is shown, typed digits are shown; Enter fires and the shell lands at 37 | `mapping.test.ts`, `arc.test.ts` |
| 3 | AC-03 ticks | Look at the line between 30 and 40 at ruler level 1 | Major lines at 30 and 40, nine equal minor lines, 37 selectable | `ticks.test.ts` |
| 4 | AC-04 range 0 to 20 | Set range 0 to 20, play 10 searches | No number above 20 anywhere | `generator.property.test.ts` (10,000 seeds per preset) |
| 5 | AC-05 subtraction | Only subtraction on; seed producing 43 − 7 (see `fixtures.ts`); press H twice | Marker moves 43 → 40 → 36; firing at 36 hits | `subtraction.test.ts`, `stepPath.test.ts` |
| 6 | AC-06 comparison | Only comparison; seed producing "Der Gegner steht bei der größeren Zahl: 47 oder 74" | Two identical tanks with no number plates stand at 47 and 74; firing at 47 (typing it, or tapping that tank) bursts the decoy like a cardboard dummy, is a miss, shows help, and the enemy's shell comes from the top edge; typing 74 and Enter fires at 74 and destroys the enemy (amendment 10) | `comparison.test.ts`, `battleController.test.ts`, `e2e/comparison.spec.ts` |
| 7 | AC-07 help | Fire at 3 wrong numbers in one search | Landing number shown each time; the step count to the enemy after each miss (amendment 07); help steps 1 (direction), 2 (zoom), 3 (solution); the enemy fires back after each miss (amendment 07) and the help steps continue; Enter fires at the solution; attempt stored as "with help" | `battleController.test.ts`, `e2e/help.spec.ts` |
| 8 | AC-08 persistence | Change settings, close browser, reopen | Settings kept | `e2e/persistence.spec.ts`, `storage.test.ts` |
| 9 | AC-09 adaptive | Run the adaptive unit tests | Step rises after 5 of 6 independent, falls after 3 of 5 assisted, guesses ignored, limits respected; ruler level moves only between the parent's start and hardest level | `adaptive.test.ts` |
| 10 | AC-10 offline | `pnpm build && pnpm preview`, load once, set browser offline, reload, play a round | Game loads and plays | `e2e/offline.spec.ts` |
| 11 | Low-frustration text | Run the i18n test | No forbidden word in any child-facing string | `i18n.test.ts` |
| 12 | Tablet | Open on a tablet or with touch emulation at 1024 by 768 | All controls usable by touch; targets at least 48 px | manual, `e2e/touch.spec.ts` |
| 13 | Keyboard only | Load `/?seed=1`, do not click. Enter starts; type the answer digits and Enter; fire one wrong number; press H; at the solution press Enter; press Escape twice; play to the round end; Enter starts a new round | Every step works without mouse or touch; no key opens the parent settings | `e2e/keyboard.spec.ts` |
| 14 | Typed number out of range | Range 0 to 100; type 150 and press Enter | Nothing fires; the preview stays at 100; a hint shows "0 bis 100" | `entry.test.ts`, `e2e/keyboard.spec.ts` |
| 15 | Any range (amendment 02) | Custom range 550 to 780, free play | Battlefield spans 550 to 780; ruler majors at 550, 600, 650, 700, 750 and minors every 10; at levels 1 to 3 the enemy stands on a minor line; typing its number destroys the enemy and the feedback shows the exact number; typing a number 1 away is a near miss: the tank shakes and the ruler shows "Ganz knapp! Triff die Linie." with "Du: … · Gegner: … · 1 Schritt" (amendment 06) | `ticks.test.ts`, `readPosition.test.ts`, `e2e/range.spec.ts` |
| 16 | Ruler levels | Settings: starting level 1 to 5 in turn, view the ruler preview and the game | Levels 1 to 5 show lines and labels as in FR-017; help step 2 shows all lines of the zoomed ten | `ticks.test.ts`, `SettingsPage.test.tsx` |
| 17 | Hit the line (amendment 06, replaces amendment 04's body hit) | Range 0 to 100, free play; fire at a number 1 or 2 away from the enemy, then 5 away, then at its number | One or two away: "Ganz knapp! Triff die Linie.", the tank shakes, ruler shows "Du: … · Gegner: … · N Schritte", nothing destroyed. Five away: a plain miss. Exact: "Getroffen!", a large explosion, the tank counter shows 1, a new enemy appears. A thin dashed line runs from the enemy tank's center to a small triangle on the ruler, with a target ring on the tank and no number next to it | `hitRule.test.ts`, `battleController.test.ts`, `e2e/battle.spec.ts`, `e2e/range.spec.ts` |
| 18 | Hearts, round types, score, time and record (amendment 06; replaces the removed "Genau treffen" scenario) | Free play, default settings; fire a miss and watch the enemy fire back; play until the hearts are gone; then set "Gegner pro Runde" 2 and play again; then turn on "Uhr beim Spielen zeigen" | 3 hearts above the child's tank, one goes out per enemy hit; the enemy fires after every shot that does not destroy it (amendment 07); the end screen shows "N Panzer getroffen in m:ss" and "Neuer Rekord!" the first time, "Dein Rekord: N" otherwise; with "Gegner pro Runde" 2 the round ends after the second destroyed enemy; the clock counts up at the top only when turned on, and stops while paused | `round.test.ts`, `battleController.test.ts`, `records.test.ts`, `RoundEnd.test.tsx`, `e2e/battle.spec.ts`, `e2e/range.spec.ts` |
| 19 | No shortcuts (amendment 05) | Free play; press the arrow keys; drag on the ruler without releasing; look for −1 and +1 buttons | Arrow keys change nothing; while dragging, the marker and guide line move but no number appears near the marker or in the readout; there are no −1 and +1 buttons; after firing, the landing number is shown | `keyboard.test.ts`, `BattleOverlay.test.tsx`, `e2e/battle.spec.ts` |
| 20 | Clear tanks (amendment 05) | Start a round, then press "Neue Landschaft" | The child's tank is blue with a yellow star flag; the enemy is red, angular, with a black flag; a bouncing "Du" arrow points at the child's tank for 3 seconds after each start; 3 hearts sit above the child's tank and the enemy has no health bar (amendment 06); no health bars in the corners | `tankStyle.test.ts`, `BattleOverlay.test.tsx`, `e2e/battle.spec.ts` |
| 21 | "Finde N" only for pointer input (amendment 05) | Guided mode (after Phase 15); type answers for several searches, then answer with the mouse | While typing, no "Finde N" search appears; after a mouse answer it can appear again | `inputMethod.test.ts`, `battleController.test.ts` |
| 22 | Visible enemy and return fire (amendment 07) | Guided mode, only subtraction, `?seed=` producing 43 − 7; fire at 30, then reload the page; repeat with "Leicht", "Normal" and "Herausfordernd" | The enemy and its dashed pointer line are visible from the start of every search and after a reload; after the miss the ruler shows the bracket from 30 to 36 with "6 Schritte"; right after the child's shell lands the enemy fires from its own tank and its shell lands just beside the child's tank; the first enemy shot of a round never takes a heart; over many shots the enemy hits about 1 in 6, 1 in 4 or 1 in 3 shots | `enemy.test.ts`, `battleController.test.ts`, `e2e/guided.spec.ts` |

A debug query parameter `?seed=<n>` fixes the round seed so manual scenarios 5, 6, 13 and 15 are reproducible.
