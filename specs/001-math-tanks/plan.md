# Implementation Plan: Math Tanks

**Branch**: `001-math-tanks` | **Date**: 2026-11-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-math-tanks/spec.md`, changed by [amendment 01](./amendment-01-number-aiming.md) (number aiming, keyboard-only play) and [amendment 02](./amendment-02-ruler-ranges-and-detail.md) (any range, ruler levels, "read the ruler")

## Summary

A static, offline-capable browser game. A Phaser 4 canvas draws a side-view artillery battle whose horizontal axis is the number line of the configured range (any whole-number range of width 5 to 1000, such as 550 to 780). The child aims by choosing a number with the ruler, the +1 and −1 buttons or the keyboard; the cannon has a fixed angle and the shell lands at that number. A React overlay shows the challenge, help, controls, parent gate, settings and progress page. All learning logic (challenge generation, validation, number-line mapping and ticks, adaptive difficulty, mastery) and all game logic (terrain heightmap, fixed-step ballistics, the automatic arc to a chosen number, damage, enemy aiming, turn state machine, keyboard entry) live in engine-free TypeScript modules under `src/core/`, which are deterministic for a given seed and covered by Vitest. Settings and progress are stored in `localStorage` with Zod validation. A generated service worker precaches the build for offline play.

## Technical Context

**Language/Version**: TypeScript 6.0 (pinned `~6.0.3` because `typescript-eslint` does not yet support 7.0), strict mode, ES2022 target

**Primary Dependencies**: Phaser 4.2 (rendering, input, tweens, particles, audio, scaling); React 19.3 (menus and overlay); Vite 8.3 with `@vitejs/plugin-react`; `vite-plugin-pwa` 2.0 (service worker); Zod 4.6 (stored data validation)

**Storage**: Browser `localStorage`, keys `mathtanks.settings.v1` and `mathtanks.progress.v1` (research R11)

**Testing**: Vitest 5.1 (unit and property-style tests in `src/core/`, a few React component tests with Testing Library and jsdom); Playwright 1.64 (end-to-end against the production build in Chromium, WebKit and Firefox)

**Target Platform**: Current Chrome, Edge, Firefox and Safari on desktop and tablet (iPadOS, Android); screens from 768 by 600 CSS pixels

**Project Type**: Single-page web application (static files, no backend)

**Performance Goals**: 60 frames per second on desktop, at least 30 on a 2020 or later mid-range tablet; battlefield shown within 3 seconds of tapping "Spielen"; terrain update after an explosion within one frame

**Constraints**: Works offline after the first load; no network requests after load; no external fonts, CDNs or analytics; no assets from existing games; all child feedback encouraging; no time limit by default

**Scale/Scope**: One player per browser; 6 screens; 18 challenge kinds; 8 skills; 5 ruler levels; stored data under 1 MB

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is the unfilled spec-kit template, so it defines no project principles. In its place, this plan checks against the binding principles stated in the PRD:

| Principle (PRD source) | How the design satisfies it | Status |
|------------------------|-----------------------------|--------|
| Mathematics separate from game physics (section 12) | `src/core/math` and `src/core/physics` share no imports; the controller composes them | Pass |
| Deterministic, testable mathematics (section 12) | Seeded `Rng` everywhere; no `Math.random` in `src/core` (lint rule) | Pass |
| No impossible exercises (section 12) | Answer-first generation plus `validateChallenge`, property tests over 10,000 seeds per preset | Pass |
| No backend, login, external services or tracking (sections 10, 12) | Static build, localStorage, service worker; Playwright test asserts no requests to other origins | Pass |
| Low frustration (section 7.1) | Forbidden-word test over the translation table; no time limit by default; help always ends in a shown solution | Pass |
| Automated tests for mathematics, number-line mapping and progression (section 12) | Vitest suites per module, see quickstart | Pass |

Post-design re-check: Pass. No violations to justify.

## Project Structure

### Documentation (this feature)

```text
specs/001-math-tanks/
├── source-prd.md        # verbatim user PRD
├── amendment-01-number-aiming.md           # product owner change: number aiming, keyboard play
├── amendment-02-ruler-ranges-and-detail.md # product owner change: any range, ruler levels, read the ruler
├── spec.md
├── plan.md              # this file
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── core-api.md
│   └── ui-flows.md
├── checklists/requirements.md
└── tasks.md             # created by /speckit-tasks
```

### Source Code (repository root)

```text
index.html
package.json
vite.config.ts            # React plugin, PWA plugin, Vitest config
tsconfig.json
playwright.config.ts
eslint.config.js          # includes a rule banning Math.random in src/core
public/
└── icons/                # PWA icons generated as simple SVG/PNG shapes
src/
├── main.tsx              # React root, service worker registration
├── app/                  # React: App, Start screen, overlay, round end, parent gate, settings, progress
│   ├── App.tsx
│   ├── StartScreen.tsx
│   ├── BattleOverlay.tsx
│   ├── RoundEnd.tsx
│   ├── ParentGate.tsx
│   ├── SettingsPage.tsx
│   ├── ProgressPage.tsx
│   ├── useController.ts  # useSyncExternalStore bridge
│   ├── keyboard.ts       # keyToAction: key map per screen (amendment 01)
│   ├── useKeyboard.ts    # window keydown listener
│   └── styles.css
├── game/                 # Phaser: game config and scenes, draws core state only
│   ├── createGame.ts
│   ├── BattleScene.ts
│   ├── TerrainView.ts
│   ├── TankView.ts
│   ├── NumberLineView.ts
│   ├── ProjectileView.ts
│   ├── effects.ts        # explosion particles
│   └── textures.ts       # generated textures
├── audio/
│   ├── sfx.ts            # Web Audio synthesized sounds
│   └── speaker.ts        # speechSynthesis wrapper
├── core/                 # engine-free logic, see contracts/core-api.md
│   ├── rng.ts
│   ├── types.ts
│   ├── settings/         # schema, defaults, validate
│   ├── numberline/       # mapping, ticks (5 ruler levels), help zoom view
│   ├── math/             # generators per family, validate, checkAnswer, stepPath
│   ├── progress/         # classify, adaptive, ladders, mastery, summarize
│   ├── physics/          # terrain, ballistics, damage, aim solver (enemy), arc solver (player)
│   ├── ai/               # enemy shot
│   ├── battle/           # BattleController state machine, keyboard entry reducer
│   └── storage/          # KeyValue, load/save with Zod
└── i18n/
    ├── de.ts
    └── index.ts
tests/
└── e2e/                  # Playwright: battle, persistence, offline, no-external-requests
```

Unit tests sit next to their modules as `*.test.ts`.

**Structure Decision**: Single web project. `src/core` is the testable heart and has no framework imports. `src/game` (Phaser) and `src/app` (React) are thin views over `BattleController`.

## Key design decisions

1. **Answer-first generation** (research R10): the generator chooses the target position first, then builds a question with that answer. This ties every challenge to aiming (FR-025) and makes impossible exercises unreachable (FR-029).
2. **One mapping function** (research R7): `numberToX` drives both the number line and the battlefield, so the alignment (FR-015) is exact by construction and testable (SC-004).
3. **Engine-free physics with fixed timestep** (R5, R6): a heightmap terrain and precomputed shot paths make every shot reproducible; Phaser replays the path.
4. **Controller as the single state owner** (R4): React and Phaser subscribe; neither mutates state directly.
5. **Comparison tanks stand at their own numbers**: keeps one consistent number-to-position mapping everywhere, as PRD section 3.1 requires.
6. **Hidden enemy in guided searches**: nothing marks the enemy's position until it is hit or the solution is shown, so the math tells the child where to aim. A search is one player turn: every fired number is an answer, misses never give the enemy a turn, and help escalates with each miss (amendment 01). The player's tank keeps its side for the whole round.
7. **Preview, then fire**: releasing on the number line or typing only previews a number; the fire button or Enter fires it, so a finger slip never counts as a miss.
8. **Storage that survives Safari**: persistent storage request, Home Screen instructions, export and import, versioned data with migrations.
9. **Aim by number** (amendment 01, research R21): the cannon has a fixed angle of 65 degrees; `solveArcToX` computes the power so the shell lands at the chosen number and raises the angle in 5-degree steps up to 85 degrees when a hill blocks the arc. Only the exact number damages the enemy. Angle and power controls, cannon dragging, aim correction, charged shots and bonus challenges are removed.
10. **Keyboard-only play** (amendment 01, research R22): a pure key map in `src/app/keyboard.ts` and a pure entry reducer in `src/core/battle/entry.ts`; one window listener; focus on the app root at load; no text field; the parent gate ignores keys.
11. **Ruler detail levels and any range** (amendment 02, research R23): five ruler levels replace the four label levels; the parent sets a starting and a hardest level, and adaptive difficulty moves the level within them through the positions skill. Any range of width 5 to 1000 works; typing replaces the two-step zoom selection, and zoom stays only as a help visual. "Read the ruler" is a new challenge kind and the only kind in free play.

## Phasing (maps to spec priorities)

1. **Foundation**: tooling, Rng, settings schema and defaults, i18n table, storage.
2. **US1 (P1)**: terrain, ballistics, damage, enemy AI, controller (free-play path), Phaser battle scene, start screen, round end. Playable game.
3. **US2 (P1)**: number-line mapping, ticks, label levels, number-line view, find/after/before/steps/missing/midpoint generators, guided turn flow.
4. **US3, US4 (P2)**: addition and subtraction generators with step paths; comparison generators with decoy tanks.
5. **US5 (P2)**: help escalation, encouraging phrases, forbidden-word test.
6. **US6 (P2)**: parent gate, settings page, validation, persistence.
7. **US7 (P3)**: attempt classification, adaptive ladders, mastery, progress page.
8. **US8 (P3)**: PWA offline, pause, fullscreen, speech, touch sizing, keyboard-only end-to-end check.
9. **US9 (P2 since amendment 02)**: any range of width 5 to 1000, ruler for those ranges, "read the ruler" in free play. Scheduled right after the amendment reworks, see tasks.md.

Amendments 01 and 02 arrived after US1 and the number-line generators were built (tasks.md Phases 1 to 7). tasks.md Phases 8 to 10 rework that code first; the later phases were rewritten to match.
10. **Polish**: e2e tests, performance check, accessibility pass.

## Risks

| Risk | Mitigation |
|------|-----------|
| Phaser 4 API differences from Phaser 3 examples | Start the US1 work with a small Phaser 4 prototype task (scene, Graphics terrain, Scale FIT, pointer input) before the full battle scene; use only core APIs and check against the installed package types |
| Safari deletes stored data after 7 days without a visit | Persistent storage request, Home Screen instructions, export and import (FR-048, FR-048a) |
| Number line unreadable on small tablets at 0 to 100 | Unit spacing 14.4 logical units scales to about 9 CSS px at 1024 width; labels only on major ticks below level 1 when spacing is under 12 px; zoom help step |
| Comparison is visually trivial because larger numbers stand further right | Accepted, see spec Assumptions: it reinforces the number line concept and keeps one mapping everywhere |
| Speech voices missing on some devices | Feature-detect and hide the speaker icon |
| A hill blocks every arc from 65 to 85 degrees | `solveArcToX` falls back to a lifted 85-degree arc that ends at the chosen number; tested on seeded terrains |
| Keyboard focus lost to a browser control (address bar, devtools) or to an iframe host | Listener on `window`, focus moved to the app root on load and after every screen change; tested in all three browsers |
| A held Enter key fires several times | Keys ignored while a shell is in flight; `keydown` with `repeat: true` ignored for Enter and Space |
| Read-the-ruler tolerance on level 5 is ambiguous in amendment 02 | Major step used; flagged in spec Assumptions for the product owner |
| Width 1000 gives 1.44 logical units per number, too small to tap exactly | Typing, +1 and −1 and arrow keys reach every number (FR-020) |

## Complexity Tracking

No constitution violations.
