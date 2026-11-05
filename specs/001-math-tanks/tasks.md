---

description: "Task list for Math Tanks implementation"
---

# Tasks: Math Tanks

**Input**: Design documents from `/specs/001-math-tanks/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/core-api.md](./contracts/core-api.md), [contracts/ui-flows.md](./contracts/ui-flows.md), [quickstart.md](./quickstart.md), [critique report](./critiques/critique-20261105-064803.md)

**Tests**: Requested. PRD section 12 and the spec require automated tests for mathematics, number-line mapping and progression logic (Vitest), plus Playwright end-to-end tests in Chromium, WebKit and Firefox. In every phase, test tasks come before the implementation tasks they cover and must fail before the implementation exists.

**Organization**: Tasks are grouped by user story. Large stories are split into several phases. Each phase is one implementation chunk for one agent: at most about 10 tasks and about 15 files.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task in the same phase)
- **[Story]**: the user story the task belongs to (US1 to US9)
- Each task names its file paths, the FR, SC and AC IDs it covers, and a done condition where the result is not obvious.

## Path Conventions

Single web project at the repository root, as in plan.md: `src/core/` (engine-free logic, unit tests next to modules as `*.test.ts`), `src/game/` (Phaser 4), `src/app/` (React 19), `src/audio/`, `src/i18n/`, `tests/e2e/` (Playwright).

## Decisions made while writing this task list

- **D1**: The core contract has no method for the optional time limit. `BattleController` gets `tick(): void`, which the renderer calls about once a second; it compares `clock()` with the challenge start and shows the next help step when the limit is reached (FR-034).
- **D2**: The two-step selection for ranges over 100 units (FR-020) adds `selectInterval(index: number): void` and `leaveZoom(): void` to `BattleController`.
- **D3**: Before Phase 9, "Spielen" starts a free-play round, so US1 is playable on its own. Phase 9 switches "Spielen" to guided mode and keeps "Freies Spiel" behind the free-play setting (FR-014).
- **D4**: Playwright tests read game state from `data-*` attributes on the React overlay (`data-phase`, `data-turn`, `data-player-health`, `data-enemy-health`, `data-challenge-answerable`), never from a global variable, so the production build exposes no debug API. The `?seed=<n>` query parameter (quickstart.md) fixes the round seed.
- **D5**: Attempts are built from Phase 8 on with `independent = solved && helpLevel === 0 && wrongAnswers === 0` and `guess = false`. Phase 18 replaces this with `classifyAttempt` (FR-038).
- **D6**: Service worker behavior differs across Playwright browsers. `tests/e2e/offline.spec.ts` must pass in Chromium; in WebKit and Firefox it runs and is skipped with a stated reason only where Playwright cannot control the service worker. Manual check on a real iPad covers the gap (Phase 21).

---

## Phase 1: Setup

**Purpose**: Project initialization, pinned tooling, lint rules that protect the core.

- [ ] T001 Create `package.json` (pnpm, `"type": "module"`, `"packageManager": "pnpm@10"`) with exact pinned versions from plan.md and research.md: `typescript@~6.0.3` (not 7.x, because `typescript-eslint` 8.72 supports only TypeScript below 6.1), `phaser@~4.2.0`, `react@~19.3.0`, `react-dom@~19.3.0`, `vite@~8.3.0`, `@vitejs/plugin-react@^6.0.0`, `vite-plugin-pwa@~2.0.0`, `zod@~4.6.0`, `vitest@~5.1.0`, `@playwright/test@~1.64.0`, `typescript-eslint@~8.72.0`, `eslint`, `@testing-library/react`, `jsdom`, `@types/react`, `@types/react-dom`. Scripts: `dev`, `build`, `preview`, `test` (`vitest run`), `e2e` (`playwright test`), `lint`, `typecheck` (`tsc --noEmit`). Done when `pnpm install` succeeds and writes `pnpm-lock.yaml`. Files: `package.json`, `pnpm-lock.yaml`, `.gitignore` (FR-050)
- [ ] T002 [P] Create `tsconfig.json` with `strict: true`, `target: "ES2022"`, `jsx: "react-jsx"`, `moduleResolution: "bundler"`, `noUncheckedIndexedAccess: true`, include `src`, `tests` (FR-028)
- [ ] T003 [P] Create `vite.config.ts` with `@vitejs/plugin-react`, `vite-plugin-pwa` (`registerType: 'prompt'`, `injectRegister: false`, precache glob for `**/*.{js,css,html,svg,png,webmanifest}`, manifest with name "Mathe-Panzer", icons from `public/icons/`), and the Vitest block (`environment: 'node'` by default, `environmentMatchGlobs` mapping `src/app/**` to `jsdom`) (FR-050, FR-051)
- [ ] T004 [P] Create `eslint.config.js` with `typescript-eslint` recommended rules plus: `no-restricted-properties` banning `Math.random` in `src/core/**`; `no-restricted-imports` banning `phaser`, `react`, `react-dom` in `src/core/**`; `no-restricted-imports` banning `src/core/physics` from `src/core/math/**` and `src/core/math` from `src/core/physics/**`. Done when a scratch file `src/core/x.ts` calling `Math.random()` fails `pnpm lint` (then delete it) (FR-028)
- [ ] T005 [P] Create `playwright.config.ts` with projects `chromium`, `webkit`, `firefox`, `testDir: 'tests/e2e'`, `webServer` running `pnpm build && pnpm preview --port 4173`, `baseURL: 'http://localhost:4173'` (FR-050)
- [ ] T006 [P] Create `index.html` (German `lang="de"`, viewport meta, root div, no external fonts or CDNs), `src/main.tsx` (React root rendering `App`), placeholder `src/app/App.tsx`, `src/app/styles.css` (system font stack, full-viewport layout), and simple generated icons `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/icon.svg` (FR-052, FR-056)
- [ ] T007 Add `src/core/sanity.test.ts` with one passing test, then run `pnpm lint && pnpm typecheck && pnpm test && pnpm build`. Done when all four commands succeed on the empty app.

**Checkpoint**: Tooling works; lint blocks `Math.random` and framework imports in `src/core`.

---

## Phase 2: Foundational

**Purpose**: Seeded random numbers, shared types, settings, translation table and storage. Every user story needs these.

**CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T008 [P] Write `src/core/rng.test.ts`: same seed gives the same sequence; `next()` in `[0,1)`; `int(min,max)` inclusive and covers both ends over 10,000 draws; `pick` returns only list items; `normal(mean, sd)` sample mean and spread within 5% over 10,000 draws; `deriveSeed(...parts)` is stable and differs for different parts (FR-028)
- [ ] T009 Implement `src/core/rng.ts`: mulberry32 `createRng(seed): Rng` with `next`, `int`, `pick`, `normal` (Box-Muller), and `deriveSeed(...parts: number[]): number` as a stable 32-bit hash, per research R9 (FR-028)
- [ ] T010 [P] Create `src/core/types.ts` with every type in data-model.md: `Skill`, `ChallengeKind`, `PromptSpec`, `Challenge`, `Attempt`, `RecentOutcome` (`'independent' | 'assisted' | 'unsolved'`), `SkillProgress`, `SessionSummary`, `Progress`, `DifficultyStep`, `Phase`, `RoundState`, `TankState`, `Point`, `Heightmap` (`Float32Array` of surface heights per column). Done when `pnpm typecheck` passes (FR-035, FR-036)
- [ ] T011 [P] Write `src/core/settings/settings.test.ts`: defaults match data-model.md; `validateSettings` rejects `min >= max` (FR-047, US6 scenario 5), rejects all challenge types off with `freePlay: false` (US6 scenario 4), rejects `max - min` outside 5 to 1000, `roundLength` outside 3 to 30, `timeLimitSeconds` outside 10 to 120, `subtraction.maxOperand` above `range.max - range.min`, `addition.maxResult` above `range.max`, and operand limits that allow no exercise in the range; `withRange` clamps `addition.maxResult`, `addition.maxOperand` and `subtraction.maxOperand` so the result passes `validateSettings` for every preset (FR-046, FR-047)
- [ ] T012 Implement `src/core/settings/schema.ts` (Zod 4 schema for `Settings`, `version: 1`) and `src/core/settings/defaults.ts` with the data-model.md defaults: challenge types all `true`; range preset `'0-100'`, min 0, max 100; addition `maxOperand` 10, `maxResult` = `range.max`, `steps` 1; subtraction `maxOperand` 10, `steps` 1; `crossTens: true`; `crossHundreds: false`; `negativeResults: false`; `labelLevel: 1`; `enemyDifficulty: 'easy'`; help all `true`; `beginnerAssist: true`; `aimCorrection: false`; sound effects `true`, music `false`, speech `true`; `roundLength: 10`; `adaptive: true`; `freePlay: false`; `noDamage: false`; `timeLimitSeconds: null`. Range rule verbatim: "Integers; `min < max`; `max - min` between 5 and 1000; preset values fix `min` and `max`"; custom `min` may go down to -1000 (FR-046)
- [ ] T013 Implement `src/core/settings/validate.ts` with `validateSettings(s): { ok: true } | { ok: false; errors: SettingsError[] }` (each error is a translation key plus field path) and `withRange(s, range): Settings`, until `src/core/settings/settings.test.ts` passes (FR-047)
- [ ] T014 [P] Write `src/i18n/i18n.test.ts`: walks every string and every string-returning function (called with sample numbers) in the `de` table and fails when any contains a word from `forbiddenWords` (`'falsch', 'verloren', 'Fehler', 'versagt', 'schlecht', 'dumm'`, case-insensitive, also inside compounds); fails when any entry in `encouragements` has more than 8 words; fails when `encouragements` has fewer than 8 phrases (FR-033, FR-057, SC-006)
- [ ] T015 Implement `src/i18n/de.ts` (typed `Messages` object: start screen, battle overlay, round end, settings labels and errors as initial keys, parameterized functions such as `findNumber(n)`, `encouragements` list of at least 8 reviewed German phrases such as "Versuch eine andere Stelle.") and `src/i18n/index.ts` (`t()`, `encouragements`, `forbiddenWords`, `type Messages = typeof de`), until `src/i18n/i18n.test.ts` passes (FR-033, FR-056)
- [ ] T016 [P] Write `src/core/storage/storage.test.ts` with an in-memory `KeyValue`: settings and progress round trip unchanged (SC-007); missing key gives defaults with `resetReason: 'none'`; damaged JSON or schema-invalid data gives defaults with `resetReason: 'invalid'`; a throwing `KeyValue` gives defaults with `resetReason: 'unavailable'` and `saveSettings` returns `{ ok: false }`; `migrate` turns a `version: 0` fixture into a valid `version: 1` object; keys are exactly `mathtanks.settings.v1` and `mathtanks.progress.v1` (FR-048)
- [ ] T017 Implement `src/core/storage/keyValue.ts` (`KeyValue` interface, `localStorageKeyValue()` wrapped in try/catch, `memoryKeyValue()`), `src/core/storage/progressSchema.ts` (Zod schemas for `Progress`, `Attempt`, `SkillProgress`, `SessionSummary`), `src/core/storage/migrate.ts` and `src/core/storage/storage.ts` (`loadSettings`, `saveSettings`, `loadProgress`, `saveProgress`), until `src/core/storage/storage.test.ts` passes (FR-048)

**Checkpoint**: `pnpm test` passes for rng, settings, i18n and storage.

---

## Phase 3: US1 physics and enemy logic

**Goal (US1, P1)**: Engine-free terrain, ballistics, damage, aim solving and enemy aiming that the battle controller and the Phaser scene use.

**Independent Test**: `pnpm test src/core/physics src/core/ai` passes.

- [ ] T018 [P] [US1] Write `src/core/physics/terrain.test.ts`: `generateTerrain(seed, 1600, 900)` is identical for the same seed and differs for different seeds; heights are within the world and above the floor of 40 units; `carveCrater` lowers heights inside the circle only, returns a new heightmap, and never goes below the floor even when the crater reaches the bottom; `surfaceY` interpolates between columns; a tank settled with `settleY(t, x)` rests on the surface after a crater, never floating or buried (FR-001, FR-005, FR-007)
- [ ] T019 [P] [US1] Write `src/core/physics/ballistics.test.ts`: `simulateShot` uses a fixed step of 1/120 s and constant gravity; identical inputs give identical paths; the impact lies on the terrain surface or on a target; a hit on a target returns its `hitTargetId`; a shell that leaves the left or right edge returns `outOfBounds: true` with the impact clamped to the edge (FR-004, edge case "Shell leaves the screen")
- [ ] T020 [P] [US1] Write `src/core/physics/damage.test.ts`: `damageAt` gives the maximum for a direct hit, decreases strictly with distance, is 0 outside the blast radius; the charged blast radius constant is larger than the normal one (FR-006, FR-011)
- [ ] T021 [P] [US1] Write `src/core/physics/aim.test.ts`: `solveAim` finds a hitting shot (`hits: true`, impact within 10 units) on flat and hilly terrain; when a hill blocks every shot within angle 0 to 90 degrees and power 0 to 100%, it returns the closest shot with `hits: false` and the correct `missDistance` (FR-012)
- [ ] T022 [US1] Implement `src/core/physics/terrain.ts` (`generateTerrain` from a seeded sum of 3 to 4 sine waves plus smoothing, `carveCrater`, `surfaceY`, `settleY`, `FLOOR = 40`), per research R5, until `terrain.test.ts` passes (FR-001, FR-005, FR-007)
- [ ] T023 [US1] Implement `src/core/physics/ballistics.ts` (`simulateShot`), per research R6, until `ballistics.test.ts` passes (FR-004)
- [ ] T024 [US1] Implement `src/core/physics/damage.ts` (`damageAt`, `BLAST_RADIUS`, `CHARGED_BLAST_RADIUS`, `MAX_DAMAGE`), until `damage.test.ts` passes (FR-006, FR-011)
- [ ] T025 [US1] Implement `src/core/physics/aim.ts` (`solveAim`, grid of 1 degree by 1% power), per research R19, until `aim.test.ts` passes. Done also when one `solveAim` call takes under 50 ms in the test run (FR-012)
- [ ] T026 [P] [US1] Write `src/core/ai/enemy.test.ts`: over 500 seeded shots, mean miss distance is largest on `'easy'`, smaller on `'normal'`, smallest on `'challenging'`; on `'easy'`, `shotIndexInRound === 0` always misses by more than the blast radius; `enemyDamageFactor('easy') === 0.5` and `1` otherwise; a type-level test (`expectTypeOf`) confirms the input has no field for attempts, help or challenges (FR-041, FR-042, FR-043)
- [ ] T027 [US1] Implement `src/core/ai/enemy.ts` (`enemyShot`, `enemyDamageFactor`), using `solveAim` plus `rng.normal` error per research R18, until `enemy.test.ts` passes (FR-041, FR-042, FR-043)

**Checkpoint**: All physics and enemy logic is tested without a browser.

---

## Phase 4: US1 battle controller for free play

**Goal (US1, P1)**: A `BattleController` state machine that runs a full free-play round: alternating turns, shots, craters, damage, enemy turns, round end, new round, pause.

**Independent Test**: `pnpm test src/core/battle src/core/numberline` passes, including a scripted full round.

- [ ] T028 [P] [US1] Write `src/core/numberline/mapping.test.ts`: for ranges 0-10, 0-20, 0-50, 0-100, 0-1000 and -20-30, `xToNumber(numberToX(n)) === n` for every integer `n`; equal value steps give equal x steps; `numberToX(min) === 80` and `numberToX(max) === 1520` with the default layout; for every number in ranges up to 0-100, the number-line marker x and the battlefield x differ by less than half a unit width (FR-015, SC-004, AC-02)
- [ ] T029 [US1] Implement `src/core/numberline/mapping.ts` (`Layout` default `{ worldWidth: 1600, left: 80, right: 1520 }`, `numberToX`, `xToNumber` snapping to the nearest integer and clamped to `[min, max]`), until `mapping.test.ts` passes (FR-015, FR-058)
- [ ] T030 [P] [US1] Write `src/core/math/gaps.test.ts`: `minTankGap(min, max) = max(0.08 * (max - min), tankWidthInNumbers)` where `tankWidthInNumbers` is the 60-unit tank width converted to numbers; `minEnemyGap(min, max) = 0.15 * (max - min)` (FR-027, FR-010a)
- [ ] T031 [US1] Implement `src/core/math/gaps.ts` (`minTankGap`, `minEnemyGap`, `TANK_WIDTH = 60`), until `gaps.test.ts` passes (FR-027)
- [ ] T032 [P] [US1] Write `src/core/battle/battleController.test.ts` (free-play part) with a fake clock and in-memory `ProgressStore`: `startRound('freePlay')` creates terrain, places the player at `range.min` or `range.max` and alternates the side on the next round, places the enemy at least `minEnemyGap` away and visible; `setAim` then `fire` moves to `playerShot` and stores the path; `shotAnimationDone` carves the crater, settles tanks, applies damage and stores `lastPlayerPath`; the phase then becomes `enemyTurn` and after `enemyShotAnimationDone` the next player turn starts (turns alternate); the round ends with `playerWon`, `enemyWon`, or `turnsUsed` after `roundLength` player turns; `noDamage` keeps player health at 100; `'easy'` enemy damage is half; a charged shot uses the larger blast radius; `pause` freezes the phase and `resume` returns to it; a new round uses a new terrain seed; subscribers are called on every change (FR-001 to FR-008, FR-011, FR-043, FR-044, FR-054, US1 scenarios 1 to 8)
- [ ] T033 [US1] Implement `src/core/battle/ports.ts` (`ProgressStore` interface with `record(attempt)`, `getProgress()`; `Speaker` interface with `available`, `speak(text)`; `memoryProgressStore()`) and `src/core/battle/round.ts` (`createRound(settings, seed, side)` building `RoundState`, `applyImpact(state, impact, blastRadius)` for craters, settling and damage)
- [ ] T034 [US1] Implement `src/core/battle/controller.ts` (`BattleController` with `constructor`, `getState`, `subscribe`, `startRound`, `setAim`, `fire`, `shotAnimationDone`, `enemyShotAnimationDone`, `pause`, `resume`), using `simulateShot`, `enemyShot` with its own `Rng` derived from the round seed, and a settings snapshot taken at `startRound`, until the free-play part of `battleController.test.ts` passes (FR-002, FR-008, FR-042, FR-049)

**Checkpoint**: A complete free-play round runs in a unit test.

---

## Phase 5: US1 Phaser battle scene

**Goal (US1, P1)**: Phaser 4 draws the battlefield, tanks, shells, trails and explosions from controller state.

**Independent Test**: `pnpm dev`, start a free-play round, aim, fire, and watch arcs, craters, health bars and enemy shots.

- [ ] T035 [US1] Phaser 4 prototype (plan.md risk mitigation, do this first): create `src/game/createGame.ts` (Phaser 4 game config, logical world 1600 by 900, `Scale.FIT`, `Scale.CENTER_BOTH`, transparent background, parent element passed in) and a minimal scene in `src/game/BattleScene.ts` that draws `generateTerrain(seed)` as a filled polygon with a Graphics object and logs pointer-down world coordinates. Check every Phaser call against the installed `phaser` type definitions, not Phaser 3 examples. Done when `pnpm dev` shows the terrain scaled to the window, resizing keeps the aspect ratio, a click or tap logs the correct world x, and `pnpm typecheck` passes (FR-001, FR-058)
- [ ] T036 [P] [US1] Implement `src/game/textures.ts`: generated textures for the tank body, turret, sky gradient, shell and explosion particle, all drawn by code with no image files (FR-001, research R13)
- [ ] T037 [P] [US1] Implement `src/game/TerrainView.ts`: draws the heightmap as a filled polygon and redraws it within one frame after each crater (FR-005)
- [ ] T038 [P] [US1] Implement `src/game/TankView.ts`: tank body, turret rotated by `aim.angleDeg`, health bar, tween down to the new surface after terrain changes, `hidden` and fade in/out states for later phases (FR-006, FR-007)
- [ ] T039 [P] [US1] Implement `src/game/ProjectileView.ts`: replays a precomputed `path` over time at a fixed speed, then calls back; draws the previous player path as a faint dotted trail until the next shot; marks the edge landing point for out-of-bounds shots (FR-004, US1 scenario 6)
- [ ] T040 [P] [US1] Implement `src/game/effects.ts`: explosion particle burst sized by blast radius and a hit flash on a damaged tank (FR-009)
- [ ] T041 [US1] Complete `src/game/BattleScene.ts`: subscribes to the controller in `create()` and unsubscribes on shutdown; composes the views; replays player and enemy paths and then calls `shotAnimationDone` and `enemyShotAnimationDone`; lets the child drag the turret to set the angle (calls `setAim`); stops all tweens and replays while the phase is `paused`. Done when a free-play round can be played to the end by mouse in `pnpm dev` (FR-002, FR-003, FR-004, FR-054)
- [ ] T042 [P] [US1] Implement `src/audio/sfx.ts`: Web Audio synthesized shot, soft boom and soft chime, played only when `settings.sound.effects` is on, with no sound tied to a wrong answer and peak gain capped low; the audio context resumes on the first user tap (FR-009, research R13)

**Checkpoint**: The battle renders and animates from core state.

---

## Phase 6: US1 React screens and battle end-to-end test

**Goal (US1, P1)**: Start screen, battle overlay controls and round end, wired to the controller. US1 is complete.

**Independent Test**: `pnpm e2e tests/e2e/battle.spec.ts` passes in all three browsers.

- [ ] T043 [P] [US1] Write `tests/e2e/battle.spec.ts`: open `/?seed=1`, tap "Spielen" (one tap, SC-001), the canvas appears within 3 seconds; set power with the plus button, tap fire, wait for `data-phase="enemyTurn"` and then a player phase again; health attributes change after a hit; play until `data-phase="roundOver"`; the round end shows encouraging text and no forbidden word; tap "Nochmal" and confirm a new round starts without a page reload (`page.on('load')` fires once) (FR-001 to FR-008, SC-001, AC-01)
- [ ] T044 [US1] Implement `src/app/useController.ts`: a `useSyncExternalStore` bridge to `BattleController.subscribe` and `getState` (research R4)
- [ ] T045 [US1] Implement `src/app/App.tsx`: loads settings with `loadSettings(localStorageKeyValue())`, reads `?seed=` from the URL, creates one `BattleController`, mounts the Phaser game with `createGame` into a container under the React overlay, and switches between start, battle and round end screens (FR-050)
- [ ] T046 [P] [US1] Implement `src/app/StartScreen.tsx`: large "Spielen" button (starts free play until Phase 9, see D3), gear icon placeholder, fullscreen button placeholder; every button at least 48 by 48 CSS pixels (SC-001, FR-053)
- [ ] T047 [P] [US1] Implement `src/app/BattleOverlay.tsx`: angle and power controls (plus and minus buttons and a slider each, all at least 48 px), a large fire button enabled only in phase `aiming`, health bars, and the `data-*` attributes from D4 (FR-003, FR-053)
- [ ] T048 [P] [US1] Implement `src/app/RoundEnd.tsx`: encouraging message chosen by outcome ("Gut gekämpft! Noch eine Runde?" for `enemyWon`, a neutral summary with no winner for `turnsUsed`), "Nochmal" starts a new round, a second button returns to the start screen (FR-008, US1 scenarios 7 and 8)
- [ ] T049 [US1] Add all start screen, overlay and round-end strings to `src/i18n/de.ts`; no German text is written directly in `.tsx` files. Done when `src/i18n/i18n.test.ts` still passes (FR-033, FR-056, FR-057)
- [ ] T050 [US1] Extend `src/app/styles.css`: overlay positions from ui-flows.md (controls bottom right, top bars), minimum target size 48 px with at least 8 px between targets, large clear digits. Then make `tests/e2e/battle.spec.ts` pass in Chromium, WebKit and Firefox (FR-053, FR-058, AC-01)

**Checkpoint**: US1 is a playable game (AC-01).

---

## Phase 7: US2 number line ticks and number-line challenges

**Goal (US2, P1)**: Tick layout, labeling levels and the seven number-line challenge kinds, generated answer-first and validated.

**Independent Test**: `pnpm test src/core/numberline src/core/math` passes, including the property test.

- [ ] T051 [P] [US2] Write `src/core/numberline/ticks.test.ts`: `ticksFor` follows the FR-016 table for every width from 5 to 1000 (including width 150 and a range where width is over 10 and includes a multiple of 10); for the view 30 to 40, 30 and 40 are major and 31 to 39 minor with equal spacing (AC-03); at most 101 ticks per view; level 1 labels all ticks, level 2 only major, level 3 major plus at most half of the minor labels chosen by `seed`, level 4 only the end points; end points are always labeled, including custom ranges such as 15 to 45 (FR-016, FR-017, AC-03)
- [ ] T052 [US2] Implement `src/core/numberline/ticks.ts` (`ticksFor`), until `ticks.test.ts` passes (FR-016, FR-017)
- [ ] T053 [P] [US2] Write `src/core/math/numberLine.test.ts`: for each kind `findNumber`, `after`, `before`, `stepsRight`, `stepsLeft`, `missingBetween`, `midpoint`, the generated challenge has the right prompt key, operands and answer (for example `after` with 49 gives answer 50); `midpoint` is skipped when the range has no two major ticks with a whole midpoint; same seed gives the same challenge (FR-021, FR-028, US2 scenario 4)
- [ ] T054 [P] [US2] Write `src/core/math/validate.test.ts`: `validateChallenge` reports out-of-range answers, operands and steps, and answers closer than `minEnemyGap` to the player; `checkAnswer` accepts only the exact answer (FR-029)
- [ ] T055 [P] [US2] Write `src/core/math/generator.property.test.ts`: for each preset range (0-10, 0-20, 0-50, 0-100, 0-1000), each player side and 10,000 seeds, `validateChallenge(generateChallenge(...))` returns `[]`; with every type turned off except number line it never throws; for range 0-10 with tens crossing off it still returns a valid challenge (fallback to `findNumber`) (FR-029, SC-003, AC-04, edge case "Range too small")
- [ ] T056 [P] [US2] Implement `src/core/math/skills.ts`: `mainSkillOf(kind)` per data-model.md (`findNumber`, `missingBetween`, `midpoint` → `positions`; `after`, `stepsRight` → `countForward`; `before`, `stepsLeft` → `countBackward`; `addition` → `addition`; `subtraction` → `subtraction`; comparison kinds → `comparison`) and `secondarySkills(challenge)` adding `tens` for multiples of ten and `crossTens` for a crossed ten boundary (FR-036)
- [ ] T057 [US2] Implement `src/core/math/numberLine.ts`: answer-first builders for the seven kinds, each taking `(answer, settings, step, rng)` and returning a challenge or `null` when impossible (FR-021, FR-025)
- [ ] T058 [US2] Implement `src/core/math/validate.ts` (`validateChallenge`, `checkAnswer`) until `validate.test.ts` passes (FR-029)
- [ ] T059 [US2] Implement `src/core/math/generate.ts` (`generateChallenge`): picks the answer from allowed positions at least `minEnemyGap` from `playerPosition`, tries the chosen kind, retries up to 50 answers, then another enabled kind, then falls back to `findNumber`; `purpose: 'bonus'` excludes comparison kinds; seed derived with `deriveSeed`; `id` is `${roundSeed}-${turn}`. Done when `numberLine.test.ts` and `generator.property.test.ts` pass (FR-021, FR-025, FR-028, FR-029, SC-003)

**Checkpoint**: Number-line challenges are generated and validated without a browser.

---

## Phase 8: US2 guided turn flow in the controller

**Goal (US2, P1)**: Guided mode in `BattleController`: hidden enemy, preview and confirm, charged cannon, enemy that stays for up to 3 shots, bonus challenges, aim correction.

**Independent Test**: The guided part of `battleController.test.ts` passes.

- [ ] T060 [P] [US2] Add guided tests to `src/core/battle/battleController.test.ts`: `startRound('guided')` begins in `challenge` with `challengePurpose: 'search'` and `enemyFound: false`; `getState()` exposes no enemy coordinates while `enemyFound` is false (the enemy tank is reported with `alive` and `health` only); answers submitted before `answerableAt` (1 s after display) are ignored; `selectNumber` and `nudgeSelection` change only `selection`; `submitSelection` with the right number moves to `aiming` with `charged: true` and `enemyFound: true`; a wrong number keeps `challenge` and does not change health or turn; `fire` does nothing in phase `challenge` (SC-009); after a miss the enemy keeps its position and the next turn offers a bonus challenge, not a search; after a hit or 3 shots at the enemy the next turn starts a new search with a new enemy position (FR-010, FR-010a, FR-011, FR-013, FR-019, SC-009, US2 scenarios 3, 8, 9, edge case "Rapid tapping")
- [ ] T061 [P] [US2] Add aim and bonus tests to `src/core/battle/battleController.test.ts`: with `aimCorrection: false`, a correct answer leaves `aim` unchanged; with `aimCorrection: true`, it sets `aim` to the `solveAim` result for the target; `requestBonusChallenge` in free play generates only number-line, addition or subtraction kinds and a correct answer charges the next shot; the charged flag resets after one shot (FR-011, FR-012, FR-014, US2 scenario 7)
- [ ] T062 [US2] Implement the guided flow in `src/core/battle/guided.ts` and wire it into `src/core/battle/controller.ts`: `selectNumber`, `nudgeSelection`, `submitSelection`, `requestBonusChallenge`, search and bonus challenges via `generateChallenge` with `playerPosition` from the fixed player side, `shotsAtEnemy` counting, enemy hide and move, `answerableAt = clock() + 1000` (FR-010, FR-010a, FR-011, FR-013, FR-014, FR-019, FR-025)
- [ ] T063 [US2] Implement `src/core/battle/attempt.ts`: builds an `Attempt` when a challenge ends (`solved`, `helpLevel`, `wrongAnswers`, `responseMs` from `answerableAt`, `rangeKey` such as `0-100`, `sessionId`, `at`), with the interim `independent` and `guess` rule from D5, and calls `ProgressStore.record` between turns, never during a shot animation. Add a test in `src/core/battle/battleController.test.ts` that one attempt is recorded per finished challenge (FR-035)
- [ ] T064 [US2] Implement aim correction in `src/core/battle/controller.ts` using `solveAim` on the current terrain, until the tests from T061 pass (FR-012)

**Checkpoint**: Guided turns work in unit tests.

---

## Phase 9: US2 number line view and guided screens

**Goal (US2, P1)**: The child views the number line under the battlefield, selects a number by tap or drag, adjusts it with +1 and −1, confirms it, and the enemy appears.

**Independent Test**: `pnpm e2e tests/e2e/guided.spec.ts` passes; in `pnpm dev`, range 0 to 100, number line only, the marker for 37 sits directly under battlefield position 37.

- [ ] T065 [P] [US2] Write `tests/e2e/guided.spec.ts`: with `/?seed=<fixed>` and default settings, tap "Spielen"; the challenge banner shows "Finde N" (read N from the banner); the fire button is disabled; tap the number line at the x of N (computed from the canvas bounding box and `numberToX`), check the large readout shows N, tap the check button; `data-phase="aiming"` and the fire button is enabled. Also: releasing on a wrong number and not tapping check leaves the phase at `challenge` (FR-010, FR-019, SC-009, AC-02)
- [ ] T066 [US2] Implement `src/game/NumberLineView.ts`: draws the line in world y 720 to 820, x 80 to 1520 with `numberToX` and `ticksFor` (major ticks longer and bolder, labels per labeling level); tap and drag on the whole line call `selectNumber(xToNumber(x))`; while dragging shows a vertical guide line up to the battlefield, a target marker, and the number in large digits above the finger; release only previews (FR-015, FR-016, FR-017, FR-019, FR-053, US2 scenarios 1, 2, 5, 6)
- [ ] T067 [US2] Update `src/game/BattleScene.ts` and `src/game/TankView.ts`: during a search nothing is drawn at the enemy position (no marker, shadow or sound cue); when `enemyFound` becomes true the enemy fades in at the answer and the turret glows while `charged`; on a new search the enemy fades out (FR-010, FR-011, US2 scenario 8)
- [ ] T068 [US2] Update `src/app/BattleOverlay.tsx`: challenge banner at top center, +1 and −1 buttons and a check button (each at least 48 px), a "Bonus" button in follow-up turns and in free play, and `data-challenge-answerable` (FR-010a, FR-014, FR-019, FR-053)
- [ ] T069 [US2] Add prompt strings for the seven number-line kinds to `src/i18n/de.ts` (for example `findNumber(n)` "Finde {n}", `after(n)` "Welche Zahl kommt direkt nach {n}?", `before(n)`, `stepsRight(n, k)`, `stepsLeft(n, k)`, `missingBetween(a, b)`, `midpoint(a, b)`), each at most about 8 words (FR-056, FR-057)
- [ ] T070 [US2] Update `src/app/StartScreen.tsx`: "Spielen" starts guided mode; "Freies Spiel" appears next to it only when `settings.freePlay` is true; the free-play bonus button is hidden when no challenge type is enabled. Then make `tests/e2e/guided.spec.ts` pass in all three browsers (FR-010, FR-014, edge case "Free-play with no challenge types enabled", AC-02, AC-03)

**Checkpoint**: US1 and US2 together form the MVP core loop.

---

## Phase 10: US3 addition and subtraction generators

**Goal (US3, P2)**: Addition and subtraction challenges whose result is the enemy position, respecting every parent limit, with step paths.

**Independent Test**: `pnpm test src/core/math` passes, including the 43 − 7 fixture.

- [ ] T071 [P] [US3] Write `src/core/math/crossing.test.ts`: `crossesTen(24, 32)` is true, `crossesTen(24, 29)` false, `crossesTen(43, 36)` true; `crossesHundred(95, 103)` true (FR-022, FR-023)
- [ ] T072 [P] [US3] Write `src/core/math/addition.test.ts`: over 10,000 seeds no operand exceeds `addition.maxOperand` and no result exceeds `addition.maxResult` (US3 scenario 5 with 10 and 20); with `crossTens: false` no exercise crosses a ten (24 + 8 never appears, 24 + 5 can); with `crossHundreds: false` none crosses a hundred; `steps: 2` produces `a + b + c` with every intermediate sum in range (FR-022, FR-025, US3 scenarios 3 and 5)
- [ ] T073 [P] [US3] Write `src/core/math/subtraction.test.ts`: no subtrahend exceeds `subtraction.maxOperand`; with `negativeResults: false` no result is below 0 or below `range.min`; with a custom range -20 to 30 and `negativeResults: true` results may be negative but never below `range.min`; crossing rules hold; `steps: 2` works; the fixture seed in `src/core/math/fixtures.ts` produces 43 − 7 (FR-023, FR-025, US3 scenario 4, AC-05)
- [ ] T074 [P] [US3] Write `src/core/math/stepPath.test.ts`: `stepPath` for 43 − 7 with `beginnerAssist: true` is `[43, 40, 36]`, for 24 + 8 is `[24, 30, 32]`; with `beginnerAssist: false` it is `[43, 36]` and `[24, 32]`; for two-step exercises it passes through the intermediate result (FR-024, US3 scenarios 1 and 2)
- [ ] T075 [US3] Implement `src/core/math/crossing.ts` (`crossesTen`, `crossesHundred`) until `crossing.test.ts` passes
- [ ] T076 [US3] Implement `src/core/math/addition.ts`: answer-first search for `a + b = answer` (and `a + b + c`) within operand, result, crossing and step limits and the current `DifficultyStep` (FR-022, FR-025)
- [ ] T077 [US3] Implement `src/core/math/subtraction.ts`: answer-first search for `a - b = answer` (and `a - b - c`) within limits, plus `src/core/math/fixtures.ts` exporting the seed and settings that produce 43 − 7 (FR-023, FR-025, AC-05)
- [ ] T078 [US3] Implement `src/core/math/stepPath.ts` (`stepPath(c, beginnerAssist)`) until `stepPath.test.ts` passes (FR-024)
- [ ] T079 [US3] Register addition and subtraction in `src/core/math/generate.ts` and `src/core/math/validate.ts` (operand, result, crossing, step and negative-result checks), and extend `src/core/math/generator.property.test.ts` to run with addition and subtraction on. Done when all math tests pass (FR-029, SC-003, AC-04)

**Checkpoint**: Addition and subtraction exercises are generated within all parent limits.

---

## Phase 11: US3 step animation on the number line

**Goal (US3, P2)**: The child taps help on an addition or subtraction challenge and views a marker step along the number line.

**Independent Test**: In `pnpm dev` with only subtraction on and the 43 − 7 fixture seed, tap help and view the marker move 43 → 40 → 36; select 36 and confirm.

- [ ] T080 [P] [US3] Add a test to `src/core/battle/battleController.test.ts`: for an addition or subtraction challenge, `requestHelp` sets `state.stepAnimation` to `stepPath(challenge, settings.beginnerAssist)` and does not change health, turn or charge (FR-024, FR-030)
- [ ] T081 [US3] Implement `requestHelp` for addition and subtraction in `src/core/battle/controller.ts` (sets `stepAnimation`; general help escalation follows in Phase 13) and add `stepAnimation: number[] | null` to `RoundState` in `src/core/types.ts` (FR-024)
- [ ] T082 [US3] Add the step animation to `src/game/NumberLineView.ts`: a small tank icon moves one unit at a time along `stepAnimation`, pausing at each ten boundary when `beginnerAssist` is on, with each step counted on screen (FR-024, US3 scenarios 1 and 2, AC-05)
- [ ] T083 [US3] Add addition and subtraction prompts to `src/i18n/de.ts` (for example "Der Gegner ist bei {a} − {b}"), and show the starting number highlighted on the number line in `src/game/NumberLineView.ts` (FR-056, FR-057, AC-05)

**Checkpoint**: US3 works on its own with only addition or subtraction enabled.

---

## Phase 12: US4 comparison with decoy tanks

**Goal (US4, P2)**: Comparison challenges with numbered decoy tanks standing at their own numbers; tapping the right tank marks the target.

**Independent Test**: With only comparison on and the 47 vs 74 fixture seed, tap the tank labeled 74, fire, and hit only that tank.

- [ ] T084 [P] [US4] Write `src/core/math/comparison.test.ts`: each kind `greater`, `smaller`, `equal`, `order3`, `largest3`, `smallest3`, `closestTo`, `between` has exactly one correct answer, distinct options, all numbers inside the range, every option at least `minTankGap` from every other option and from the player tank; `order3` sets `orderAnswer` ascending; comparison is skipped when the range cannot fit 2 options at `minTankGap` on the side away from the player; the fixture seed produces 47 and 74 with "greater" (FR-026, FR-027, US4 scenario 6, edge case "Comparison options too close together", AC-06)
- [ ] T085 [US4] Implement `src/core/math/comparison.ts` (answer-first builders for the eight kinds) and add the 47 vs 74 fixture to `src/core/math/fixtures.ts` (FR-026, FR-027)
- [ ] T086 [US4] Register comparison in `src/core/math/generate.ts`; extend `src/core/math/validate.ts` (`checkAnswer` accepts a `number[]` for `order3`; gap and single-answer checks) and `src/core/math/validate.test.ts`; extend `src/core/math/generator.property.test.ts` with comparison on. Done when all math tests pass (FR-027, FR-029, SC-003)
- [ ] T087 [P] [US4] Add comparison tests to `src/core/battle/battleController.test.ts`: a comparison turn creates decoy `TankState`s at their own numbers with `label` set and the real enemy at the answer; `tapTank` on the correct tank moves to `aiming` with `charged: true`; on a wrong tank keeps `challenge`; for `order3` taps are collected and a wrong tap resets the sequence; a shot that hits a decoy destroys only the decoy and the enemy keeps its health (FR-026, FR-027, US4 scenarios 1 to 5)
- [ ] T088 [US4] Implement comparison turns in `src/core/battle/controller.ts` and `src/core/battle/round.ts` (`tapTank`, decoy placement and damage, `order3` sequence), until the tests from T087 pass (FR-026, FR-027)
- [ ] T089 [US4] Update `src/game/TankView.ts`: a number plate on each numbered tank, decoys drawn the same as the enemy, tap on a tank calls `tapTank`, order badges 1, 2, 3 for `order3`, target mark on the chosen tank; tap area at least 48 by 48 CSS pixels (FR-026, FR-053)
- [ ] T090 [US4] Update `src/game/BattleScene.ts` to create and remove decoy tank views and play the destroy effect for a hit decoy (FR-027)
- [ ] T091 [US4] Add comparison prompts to `src/i18n/de.ts` ("Welche Zahl ist größer?", "Welche Zahl ist kleiner?", "Welche Zahl ist gleich {n}?", "Tippe die Zahlen von klein nach groß an", "Welche Zahl ist am größten?", "Welche Zahl ist am kleinsten?", "Welche Zahl ist am nächsten an {n}?", "Welche Zahl liegt zwischen {a} und {b}?"), and show the reference number for `equal` in `src/app/BattleOverlay.tsx` (FR-026, FR-056)
- [ ] T092 [US4] Write `tests/e2e/comparison.spec.ts`: with settings stored in `localStorage` before load (only comparison on) and the fixture seed, tap the tank labeled 74, confirm `data-phase="aiming"`, fire. Make it pass in all three browsers (AC-06)

**Checkpoint**: US4 works on its own with only comparison enabled.

---

## Phase 13: US5 help escalation logic

**Goal (US5, P2)**: Help that becomes more explicit with each wrong answer or help request and always ends with the solution, with no penalty.

**Independent Test**: `pnpm test src/core/battle` passes, including three wrong answers in a row.

- [ ] T093 [P] [US5] Write `src/core/battle/help.test.ts`: `nextHelp(challenge, level, settings)` returns step 1 (nearest major tick), step 2 (ten-number interval and count start, or step path for addition and subtraction), step 3 (solution) for position challenges, and the comparison variants (tens digits, number-line markers under options, correct tank or order); a help type turned off by the parent is skipped, but step 3 is always returned (FR-031, FR-032)
- [ ] T094 [US5] Implement `src/core/battle/help.ts` (`nextHelp`, `nearestMajorTick`, `tenInterval`), until `help.test.ts` passes (FR-031, FR-032)
- [ ] T095 [P] [US5] Add help tests to `src/core/battle/battleController.test.ts`: each wrong answer raises `help.level` by one and sets an encouraging message key from `encouragements`; `requestHelp` before answering shows the next step at once; the third wrong answer (or a help request at level 2) shows the solution; `continueAfterSolution` moves to `aiming` with `charged: false`; health, turn count and charge are never reduced by a wrong answer or help; the recorded attempt has `helpLevel: 3`, `solved: false`, `independent: false`; with `timeLimitSeconds: 10`, `tick()` after 10 s shows the next help step with no penalty and without a limit no timer exists (FR-013, FR-030, FR-031, FR-034, SC-005, AC-07, US5 scenarios 1 to 5)
- [ ] T096 [US5] Implement help escalation in `src/core/battle/controller.ts` (`requestHelp` for all kinds, wrong-answer escalation, `continueAfterSolution`, `tick()` per decision D1) and add `help.content` and `message` to `RoundState` in `src/core/types.ts`, until the tests from T095 pass (FR-013, FR-030, FR-031, FR-034)
- [ ] T097 [US5] Add help phrases to `src/i18n/de.ts` ("Versuch eine andere Stelle.", step-count texts, "Weiter"), and extend `src/i18n/i18n.test.ts` so it also checks every text passed to `Speaker.speak` (spoken texts come only from the table) (FR-033, SC-006, US5 scenario 6)

**Checkpoint**: The help ladder is complete and tested.

---

## Phase 14: US5 help visuals and help end-to-end test

**Goal (US5, P2)**: The child views each help step on the number line or the tanks and continues with one tap.

**Independent Test**: `pnpm e2e tests/e2e/help.spec.ts` passes.

- [ ] T098 [P] [US5] Write `tests/e2e/help.spec.ts`: in a guided search, confirm three wrong numbers; after each, an encouraging message is visible and contains no forbidden word; after the third, the solution is shown and a "Weiter" button appears; one tap leads to `data-phase="aiming"` with the fire button enabled; player health is unchanged (AC-07, SC-005, SC-006)
- [ ] T099 [US5] Add help visuals to `src/game/NumberLineView.ts`: step 1 pulsing highlight on the nearest major tick; step 2 zoom into the ten-number interval with numbers popping up one by one from the nearest major tick; step 3 marker animated to the solution with the number shown large (FR-031, US5 scenarios 1 to 3)
- [ ] T100 [US5] Add comparison help visuals to `src/game/TankView.ts` (highlight tens digits on every plate) and `src/game/NumberLineView.ts` (markers under each option's number), and show the correct tank or order at step 3 (FR-031)
- [ ] T101 [US5] Update `src/app/BattleOverlay.tsx`: a help button visible during every challenge, the encouraging message line, the "Weiter" button at step 3, and a time-limit indicator only when the parent set a limit; call `controller.tick()` once a second while a challenge is shown (FR-030, FR-034)
- [ ] T102 [US5] Update `src/audio/sfx.ts` and its callers so a wrong answer plays no sound at all and a correct answer plays the soft chime; then make `tests/e2e/help.spec.ts` pass in all three browsers (FR-009, AC-07)

**Checkpoint**: US5 complete (AC-07).

---

## Phase 15: US6 settings rules, persistence and export

**Goal (US6, P2)**: Settings apply from the next round, survive a browser restart, can be exported and imported, and the game asks for persistent storage.

**Independent Test**: `pnpm test src/core` passes, including export and import and the random-settings property test.

- [ ] T103 [P] [US6] Write `src/core/storage/exportImport.test.ts`: `exportData` produces `{ app: 'math-tanks', exportedAt, settings, progress }`; `importData` of that text returns the same settings and progress; a file with the wrong `app`, broken JSON or invalid settings returns `{ ok: false, reason }` and changes nothing; an older-version file is migrated (FR-048, FR-048a)
- [ ] T104 [US6] Implement `src/core/storage/exportImport.ts` (`exportData`, `importData`, using the schemas and `migrate` from Phase 2), until `exportImport.test.ts` passes (FR-048a)
- [ ] T105 [P] [US6] Add a test to `src/core/battle/battleController.test.ts`: `controller.updateSettings(newSettings)` during a round leaves the current round's range, difficulty and challenge types unchanged and applies them at the next `startRound` (FR-049, US6 scenario 6, edge case "Settings opened mid-round")
- [ ] T106 [US6] Implement `updateSettings` in `src/core/battle/controller.ts` (stores pending settings, used at the next `startRound`), until the test from T105 passes (FR-049)
- [ ] T107 [P] [US6] Extend `src/core/math/generator.property.test.ts` with 200 random valid settings (built with a seeded `Rng`, kept only when `validateSettings` passes, including custom ranges and range 0-20 with every combination of challenge types) and 1000 seeds each; every challenge must validate and every number, operand and intermediate step must be inside the range (FR-029, SC-003, US6 scenario 3, AC-04)
- [ ] T108 [US6] Implement `src/app/persistence.ts`: calls `navigator.storage.persist()` once on first load when available, saves settings with `saveSettings(localStorageKeyValue(), s)`, and reports `resetReason` and save failures so the settings page can show them (FR-048, edge cases "Stored data is missing or damaged" and "Browser storage full or blocked")
- [ ] T109 [US6] Write `tests/e2e/persistence.spec.ts`: change range to 0 to 20 and enemy difficulty to "Leicht" in the settings page, save, close the page and its context after saving `storageState`, open a new context with that state, and confirm both values are shown; repeat 5 times in a loop to cover "100% of runs" (FR-048, SC-007, AC-08, US6 scenario 2)

**Checkpoint**: Settings and progress persist and can be moved between devices.

---

## Phase 16: US6 parent gate and settings page

**Goal (US6, P2)**: A parent opens settings with a 2-second press and changes every option; a child's short tap does nothing.

**Independent Test**: `pnpm test src/app` passes and `tests/e2e/persistence.spec.ts` passes in all three browsers.

- [ ] T110 [P] [US6] Write `src/app/ParentGate.test.tsx` (Testing Library, jsdom, fake timers): a pointer down and up after 500 ms does not open the menu; a pointer down held for 2000 ms opens it and calls `onOpen` (which pauses the game); releasing at 1900 ms cancels; the filling ring progress is shown (FR-045, US6 scenario 1)
- [ ] T111 [US6] Implement `src/app/ParentGate.tsx`: gear button (at least 48 px) with pointer events, a filling ring and a parent menu with "Einstellungen" and "Fortschritt"; opening pauses the controller and closing resumes it (FR-045, FR-054)
- [ ] T112 [P] [US6] Write `src/app/SettingsPage.test.tsx`: a custom range with min 50 and max 20 shows an error next to the field and disables "Speichern"; turning off all challenge types shows the hint that guided mode needs one type and offers free play; changing the preset from 0-100 to 0-20 clamps `addition.maxResult` to 20; the negative-results switch appears only when a custom min is below 0; a reset notice appears when `resetReason` is `'invalid'` (FR-046, FR-047, FR-048, US6 scenarios 4 and 5)
- [ ] T113 [US6] Implement `src/app/SettingsPage.tsx` with every field in FR-046, grouped as Aufgaben, Zahlenraum, Plus und Minus, Zahlenstrahl, Hilfe, Gegner, Ton, Runde; presets 0-10, 0-20, 0-50, 0-100, 0-1000 and custom min and max; validation with `validateSettings`; `withRange` on range change; save via `src/app/persistence.ts` and `controller.updateSettings`, until `SettingsPage.test.tsx` passes (FR-046, FR-047, FR-049)
- [ ] T114 [US6] Add the data section to `src/app/SettingsPage.tsx`: "Daten sichern" downloads `exportData(...)` as `mathe-panzer-<date>.json`; "Daten laden" reads a chosen file with `importData` and shows the result; a short note explains how to add the game to the Home Screen on iPad and Android (FR-048a, edge case "Browser deletes stored data")
- [ ] T115 [US6] Wire the gear into `src/app/StartScreen.tsx` and `src/app/BattleOverlay.tsx`, and add routing for the parent menu and settings page in `src/app/App.tsx` (FR-045)
- [ ] T116 [US6] Add every settings label, group name, error, hint, Home Screen note and notice to `src/i18n/de.ts`, then make `tests/e2e/persistence.spec.ts` pass in Chromium, WebKit and Firefox (FR-056, AC-08)

**Checkpoint**: US6 complete (AC-04, AC-08).

---

## Phase 17: US7 attempt classification, adaptive ladders and mastery

**Goal (US7, P3)**: Engine-free progression logic: guess detection, difficulty ladders, adaptive steps within parent ceilings, mastery and sessions.

**Independent Test**: `pnpm test src/core/progress` passes.

- [ ] T117 [P] [US7] Write `src/core/progress/classify.test.ts`: a correct answer with `responseMs` 1400 is a guess, 1500 is not; a correct answer after 3 wrong answers within 5000 ms before submission is a guess, after 3 wrong answers spread over 6000 ms is not; `independent` is true only when solved with help level 0 and no wrong answer; outcome is `'independent'`, `'assisted'` or `'unsolved'` (FR-038, US7 scenario 3)
- [ ] T118 [P] [US7] Write `src/core/progress/adaptive.test.ts`: each skill starts at step 0; 5 independent of the last 6 non-guess outcomes raise the step by one and clear `recent`; 3 assisted or unsolved of the last 5 lower it by one, never below 0; the step never passes the top of the ladder or a parent limit (for example `addition.maxOperand` 10 caps the ladder's `maxOperand`); guesses never enter `recent`; with `adaptive: false` `effectiveStep` returns the top step clamped by settings (FR-037, US7 scenarios 1, 2 and 6, AC-09)
- [ ] T119 [P] [US7] Write `src/core/progress/mastery.test.ts`: `skillStatus` is `'mastered'` only with `independentCorrect >= 10`, a full `masteryWindow` of 10 and at least 8 `'independent'`; a step change does not clear `masteryWindow`; a skill whose correct answers all needed help is never mastered (FR-039, US7 scenario 4)
- [ ] T120 [P] [US7] Write `src/core/progress/session.test.ts`: `startOrContinueSession` starts a new session on game load, after more than 30 minutes since `lastActiveAt`, and on a new calendar day; otherwise updates `lastActiveAt` (Key Entities "Session")
- [ ] T121 [US7] Implement `src/core/progress/classify.ts` (`classifyAttempt`), until `classify.test.ts` passes (FR-038)
- [ ] T122 [US7] Implement `src/core/progress/ladders.ts`: a fixed ordered `DifficultyStep[]` per skill (for example `positions`: 0.2, 0.5, 1 of the range with label levels 1, 2, 3, 4; `addition`: small operands without crossing, then larger, then crossing tens), and `effectiveStep(p, skill, rangeKey, settings)` clamping every field by the parent settings; only the `positions` ladder sets `labelLevel`, and the result is never easier than the parent's level (FR-018, FR-036, FR-037)
- [ ] T123 [US7] Implement `src/core/progress/adaptive.ts` (`recordAttempt` updating `SkillProgress` for the main skill and further skills: counters, `recent` max 6, `masteryWindow` max 10, step changes per FR-037), until `adaptive.test.ts` passes (FR-035, FR-036, FR-037)
- [ ] T124 [US7] Implement `src/core/progress/mastery.ts` (`skillStatus`), until `mastery.test.ts` passes (FR-039)
- [ ] T125 [US7] Implement `src/core/progress/session.ts` (`startOrContinueSession`), until `session.test.ts` passes
- [ ] T126 [US7] Add a test and the code in `src/core/progress/adaptive.test.ts` and `src/core/progress/adaptive.ts` that `recordAttempt` keeps only the newest 2000 attempts while session summaries keep the totals of older ones (research R11)

**Checkpoint**: Progression logic is complete and tested (AC-09).

---

## Phase 18: US7 adaptive play and progress page

**Goal (US7, P3)**: Challenges follow each skill's step, attempts are classified and saved, and a parent views progress.

**Independent Test**: `pnpm test` passes; in `pnpm dev`, open the parent menu and view per-skill counts after playing a few turns.

- [ ] T127 [P] [US7] Write `src/core/progress/summarize.test.ts`: `summarize(p)` returns per skill and range the attempts, independent correct, with help, current step and status; the skills sorted by help needed; and a session list with date, attempts, independent correct and with help (FR-040, US7 scenario 5)
- [ ] T128 [US7] Implement `src/core/progress/summarize.ts` (`summarize`), until `summarize.test.ts` passes (FR-040)
- [ ] T129 [P] [US7] Add tests to `src/core/battle/battleController.test.ts`: with `adaptive: true` and a skill at step 0, generated challenges use step 0 limits; after 5 independent attempts the next challenge in that skill uses step 1; attempts use `classifyAttempt` (a correct answer 1 s after answerable is stored with `guess: true`); the label level follows the `positions` skill only (FR-018, FR-035, FR-037, FR-038, AC-09)
- [ ] T130 [US7] Update `src/core/battle/controller.ts` and `src/core/battle/attempt.ts`: pass `skillSteps` from `effectiveStep` to `generateChallenge`, classify attempts with `classifyAttempt` (replacing D5), start or continue the session, until the tests from T129 pass (FR-035, FR-037, FR-038)
- [ ] T131 [US7] Implement `src/core/storage/progressStore.ts`: a `ProgressStore` that applies `recordAttempt` and saves with `saveProgress` after each attempt, between turns; use it in `src/app/App.tsx` (FR-035, FR-048)
- [ ] T132 [P] [US7] Write `src/app/ProgressPage.test.tsx`: renders counts from a fixture `Progress`; "with help" is shown separately from accuracy; a skill with only assisted answers shows "noch am Üben" (developing); reset asks for confirmation and only then clears progress (FR-040, US7 scenarios 4 and 5)
- [ ] T133 [US7] Implement `src/app/ProgressPage.tsx` (per-skill table, most-help skills, session list, reset with confirmation), link it from the parent menu in `src/app/ParentGate.tsx`, and add its strings to `src/i18n/de.ts`, until `ProgressPage.test.tsx` passes (FR-040, FR-056)

**Checkpoint**: US7 complete (AC-09).

---

## Phase 19: US8 offline play, pause, fullscreen, speech and touch

**Goal (US8, P3)**: The game works offline after one load, on tablets with touch, with pause, fullscreen and spoken challenges.

**Independent Test**: `pnpm e2e` passes for offline, no-external-requests and touch specs.

- [ ] T134 [P] [US8] Write `tests/e2e/offline.spec.ts`: load `/` against the production build, wait until the service worker controls the page, set the context offline, reload, tap "Spielen" and play until `data-phase="roundOver"` (shorten with stored settings `roundLength: 3`). Must pass in Chromium; see D6 for WebKit and Firefox (FR-051, SC-008, AC-10, US8 scenario 1)
- [ ] T135 [P] [US8] Write `tests/e2e/no-external-requests.spec.ts`: record every request during load and one full round; fail on any request whose origin differs from `baseURL` (FR-052)
- [ ] T136 [P] [US8] Write `tests/e2e/touch.spec.ts` with `hasTouch: true` and viewports 1024 by 768, 768 by 1024 and 768 by 600: every visible button and the number line have a bounding box of at least 48 by 48 CSS pixels and do not overlap; tap the number line, the check button, aim controls and fire by touch; the number-line marker for a chosen number lines up with the battlefield x within half a unit (FR-053, FR-058, SC-004, US8 scenarios 2 and 5)
- [ ] T137 [P] [US8] Write `src/audio/speaker.test.ts` with a mocked `speechSynthesis`: `available` is false when the API or a German voice is missing; `speak` uses `lang: 'de-DE'` and cancels earlier speech; `prime()` speaks a short greeting (FR-055, edge case "Speech not available")
- [ ] T138 [US8] Implement `src/audio/speaker.ts` (`createSpeaker()` implementing the `Speaker` port), call `prime()` and resume Web Audio from the "Spielen" tap in `src/app/StartScreen.tsx`, speak each new challenge when `settings.sound.speech` is on, and show a speaker icon in `src/app/BattleOverlay.tsx` only when `available` (FR-055, US8 scenario 4)
- [ ] T139 [US8] Implement the PWA registration in `src/app/swUpdate.ts` and `src/main.tsx` using `virtual:pwa-register` with `registerType: 'prompt'`: when a new version is waiting, apply it only while the start screen is shown, never during a round. Then make `tests/e2e/offline.spec.ts` pass (FR-051, FR-051a, research R12)
- [ ] T140 [US8] Add pause and resume to `src/app/BattleOverlay.tsx` (pause button at top left, a resume screen) and to `src/game/BattleScene.ts` (pause tweens, particles and path replay on `paused`, continue on resume from the same point) (FR-054, US8 scenario 3)
- [ ] T141 [US8] Add a fullscreen button to `src/app/StartScreen.tsx` and `src/app/BattleOverlay.tsx` using the Fullscreen API on the app root; hide it where the API is missing (FR-054, US8 scenario 5)
- [ ] T142 [US8] Add an optional generated music loop to `src/audio/sfx.ts`, played only when `settings.sound.music` is on (default off), and make `tests/e2e/touch.spec.ts` and `tests/e2e/no-external-requests.spec.ts` pass in all three browsers (FR-009, FR-052, AC-10)

**Checkpoint**: US8 complete (AC-10).

---

## Phase 20: US9 large ranges and two-step zoom

**Goal (US9, P3)**: Ranges 0 to 50, 0 to 1000 and custom ranges, with a two-step selection for ranges over 100 units.

**Independent Test**: Range 0 to 1000, challenge "Finde 437": select the 400s, then 437.

- [ ] T143 [P] [US9] Write `src/core/numberline/zoom.test.ts`: `needsZoom(0, 100)` is false and `needsZoom(0, 1000)` true; `zoomIntervals(0, 1000)` returns ten intervals of 100; the overview of 0 to 1000 has major ticks every 100, minor every 10 and at most 101 ticks; the zoomed view 400 to 500 has major every 10 and minor every 1; for 0 to 150 the overview uses major 50 and minor 10; custom 15 to 45 has major ticks at 20, 30, 40 and labeled end points (FR-016, FR-020, US9 scenarios 1 and 3)
- [ ] T144 [US9] Implement `src/core/numberline/zoom.ts` (`needsZoom`, `zoomIntervals`) and extend `src/core/numberline/ticks.ts` for overview and zoomed views, until `zoom.test.ts` and `ticks.test.ts` pass (FR-016, FR-020)
- [ ] T145 [P] [US9] Add tests to `src/core/battle/battleController.test.ts`: with range 0 to 1000, `selectInterval(4)` sets the zoomed view to 400 to 500; `selectNumber(437)` then `submitSelection` solves "Finde 437"; `leaveZoom` returns to the overview; with range 0 to 100 `selectInterval` does nothing (FR-020, US9 scenario 2, decision D2)
- [ ] T146 [US9] Implement `selectInterval`, `leaveZoom` and `zoomView` state in `src/core/battle/controller.ts` and `src/core/types.ts`, until the tests from T145 pass (FR-020)
- [ ] T147 [US9] Update `src/game/NumberLineView.ts`: overview with tappable intervals, zoomed line for the chosen interval with connector lines from its two ends to the matching part of the battlefield, and a back control (at least 48 px) (FR-020, FR-053)
- [ ] T148 [US9] Extend `src/core/math/generator.property.test.ts` with 0 to 50, 0 to 1000 with `crossHundreds` on and off, custom 15 to 45 and custom -20 to 30 with negative results on and off, 10,000 seeds each (FR-029, SC-003, US9 scenario 3)
- [ ] T149 [US9] Write `tests/e2e/range1000.spec.ts`: with stored settings range 0 to 1000 and a fixed seed, read "Finde N", tap the interval containing N, tap N in the zoomed line, confirm, and reach `data-phase="aiming"`. Make it pass in all three browsers (FR-020, US9 scenario 2)

**Checkpoint**: All user stories complete.

---

## Phase 21: Polish and cross-cutting checks

**Purpose**: Performance, text rules, browser coverage and a final run of every validation scenario.

- [ ] T150 [P] Write `tests/e2e/performance.spec.ts` (Chromium): the battlefield appears within 3 seconds of tapping "Spielen"; during a shot the frame rate measured with `requestAnimationFrame` timestamps averages at least 55 frames per second on desktop (SC-001, SC-002)
- [ ] T151 [P] Write `src/i18n/noHardcodedText.test.ts`: scans `src/app/**/*.tsx` and `src/game/**/*.ts` for German string literals (letters ä, ö, ü, ß or words from a short list such as "Spielen", "Nochmal") outside `src/i18n/`, and fails when it finds one (FR-056)
- [ ] T152 [P] Extend `src/i18n/i18n.test.ts`: every child-facing message key (banner, feedback, help, round end) has at most about 8 words, checked as at most 9 words with an allowlist for prompts that need the numbers (FR-057)
- [ ] T153 Accessibility pass on `src/app/*.tsx`: every icon-only button (gear, help, speaker, pause, fullscreen, +1, −1, check, fire) gets a German `aria-label` from `src/i18n/de.ts`; focus is visible; no text below 18 px on child screens (FR-053, FR-057)
- [ ] T154 Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e` and fix every failure. Done when all pass in Chromium, WebKit and Firefox (FR-050)
- [ ] T155 Walk through every scenario in `specs/001-math-tanks/quickstart.md` (1 to 12) against `pnpm preview`, including scenario 12 on a tablet or with touch emulation at 1024 by 768, and the offline check on a real iPad in Safari for D6. Record any failure as a new task in this file (AC-01 to AC-10, SC-008, SC-010 noted as an evaluation goal for parents and testers, not automated)

---

## Dependencies and Execution Order

### Phase dependencies

- **Phase 1 Setup**: no dependencies.
- **Phase 2 Foundational**: depends on Phase 1. Blocks every user story.
- **Phases 3 to 6 (US1)**: in order; Phase 3 and Phase 4's mapping and gaps tasks have no UI dependency.
- **Phases 7 to 9 (US2)**: Phase 7 depends only on Phase 2 and can run in parallel with Phases 3 to 6. Phase 8 depends on Phases 4 and 7. Phase 9 depends on Phases 6 and 8.
- **Phases 10 and 11 (US3)**: Phase 10 depends on Phase 7. Phase 11 depends on Phases 9 and 10.
- **Phase 12 (US4)**: depends on Phases 7 and 9.
- **Phases 13 and 14 (US5)**: depend on Phase 9; comparison help in Phase 14 needs Phase 12; step-path help needs Phase 11.
- **Phases 15 and 16 (US6)**: Phase 15 depends on Phases 2 and 7 (property test) and Phase 4 (controller); Phase 16 depends on Phases 6 and 15.
- **Phases 17 and 18 (US7)**: Phase 17 depends only on Phase 2. Phase 18 depends on Phases 8, 16 and 17.
- **Phase 19 (US8)**: depends on Phase 9; the speech part needs Phase 6.
- **Phase 20 (US9)**: depends on Phases 9 and 16.
- **Phase 21 Polish**: depends on all earlier phases.

### User story dependencies

- US1 (P1): none beyond Foundational.
- US2 (P1): uses the US1 controller and battle scene.
- US3, US4 (P2): use the US2 generator and number-line view.
- US5 (P2): uses US2; full coverage needs US3 and US4.
- US6 (P2): uses US1 screens; independent of US3 to US5.
- US7 (P3): core logic independent; integration needs US2 and US6.
- US8 (P3): needs a playable guided game (US2).
- US9 (P3): needs US2 and the US6 settings page.

### Within each phase

- Test tasks first, and they must fail before implementation.
- Types and pure functions before the controller, the controller before views, views before end-to-end tests pass.

## Parallel Execution Examples

- **Phase 2**: T008, T010, T011, T014, T016 (tests and types in different files) together; then T009, T012, T015, T017.
- **Phase 3 (US1)**: T018, T019, T020, T021, T026 together; then T022 to T025 and T027.
- **Phase 5 (US1)**: after T035, T036, T037, T038, T039, T040, T042 together; then T041.
- **Phase 7 (US2)**: T051, T053, T054, T055, T056 together.
- **Phase 10 (US3)**: T071, T072, T073, T074 together.
- **Phase 17 (US7)**: T117, T118, T119, T120 together; Phase 17 as a whole can run in parallel with Phases 3 to 16.
- **Phase 19 (US8)**: T134, T135, T136, T137 together.
- **Across phases**: Phase 7 alongside Phases 3 to 6; Phase 17 alongside anything after Phase 2.

## Implementation Strategy

### MVP first (US1 and US2)

1. Phases 1 and 2.
2. Phases 3 to 6 (US1). Stop and validate: a free-play battle is playable (AC-01).
3. Phases 7 to 9 (US2). Stop and validate: guided searches on the number line (AC-02, AC-03). This is the MVP core loop.

### Incremental delivery

4. US3 (Phases 10, 11), US4 (Phase 12), US5 (Phases 13, 14), US6 (Phases 15, 16): each adds one PRD acceptance criterion (AC-05, AC-06, AC-07, AC-04 and AC-08).
5. US7 (Phases 17, 18), US8 (Phase 19), US9 (Phase 20): AC-09, AC-10 and the larger ranges. US9 is the first to cut if time is short (spec Assumptions).
6. Phase 21.

---

## Coverage: requirements and acceptance criteria to tasks

| ID | Tasks |
|----|-------|
| FR-001 | T018, T022, T032, T035, T036, T043 |
| FR-002 | T032, T034, T041, T043 |
| FR-003 | T041, T043, T047 |
| FR-004 | T019, T023, T032, T039, T041 |
| FR-005 | T018, T022, T032, T037 |
| FR-006 | T020, T024, T032, T038 |
| FR-007 | T018, T022, T032, T038 |
| FR-008 | T032, T034, T043, T048 |
| FR-009 | T040, T042, T102, T142 |
| FR-010 | T060, T062, T065, T067, T070 |
| FR-010a | T030, T060, T062, T068 |
| FR-011 | T020, T024, T032, T060, T061, T062, T067 |
| FR-012 | T021, T025, T061, T064 |
| FR-013 | T060, T062, T095, T096 |
| FR-014 | T061, T062, T068, T070 |
| FR-015 | T028, T029, T066 |
| FR-016 | T051, T052, T066, T143, T144 |
| FR-017 | T051, T052, T066 |
| FR-018 | T122, T129 |
| FR-019 | T060, T062, T065, T066, T068 |
| FR-020 | T143, T144, T145, T146, T147, T149 |
| FR-021 | T053, T057, T059 |
| FR-022 | T071, T072, T076 |
| FR-023 | T071, T073, T077 |
| FR-024 | T074, T078, T080, T081, T082 |
| FR-025 | T057, T059, T062, T072, T073, T076, T077 |
| FR-026 | T084, T085, T087, T088, T089, T091 |
| FR-027 | T030, T031, T084, T085, T086, T087, T088, T090 |
| FR-028 | T002, T004, T008, T009, T053, T059 |
| FR-029 | T054, T055, T058, T059, T079, T086, T107, T148 |
| FR-030 | T080, T095, T096, T101 |
| FR-031 | T093, T094, T095, T096, T099, T100 |
| FR-032 | T093, T094 |
| FR-033 | T014, T015, T049, T097 |
| FR-034 | T095, T096, T101 |
| FR-035 | T010, T063, T123, T129, T130, T131 |
| FR-036 | T010, T056, T122, T123 |
| FR-037 | T118, T122, T123, T129, T130 |
| FR-038 | T117, T121, T129, T130 |
| FR-039 | T119, T124 |
| FR-040 | T127, T128, T132, T133 |
| FR-041 | T026, T027 |
| FR-042 | T026, T027, T034 |
| FR-043 | T026, T027, T032 |
| FR-044 | T032 |
| FR-045 | T110, T111, T115 |
| FR-046 | T011, T012, T112, T113 |
| FR-047 | T011, T013, T112, T113 |
| FR-048 | T016, T017, T103, T108, T109, T112, T131 |
| FR-048a | T103, T104, T114 |
| FR-049 | T034, T105, T106, T113 |
| FR-050 | T001, T003, T005, T045, T154 |
| FR-051 | T003, T134, T139 |
| FR-051a | T139 |
| FR-052 | T006, T135, T142 |
| FR-053 | T046, T047, T050, T066, T068, T089, T136, T147, T153 |
| FR-054 | T032, T041, T111, T140, T141 |
| FR-055 | T137, T138 |
| FR-056 | T006, T015, T049, T069, T083, T091, T116, T133, T151 |
| FR-057 | T014, T049, T069, T083, T152, T153 |
| FR-058 | T029, T035, T050, T136 |
| SC-001 | T043, T046, T150 |
| SC-002 | T150 |
| SC-003 | T055, T059, T079, T086, T107, T148 |
| SC-004 | T028, T136 |
| SC-005 | T095, T098 |
| SC-006 | T014, T097, T098 |
| SC-007 | T016, T109 |
| SC-008 | T134 |
| SC-009 | T060, T065 |
| SC-010 | T155 (evaluation goal, not automated) |
| AC-01 | T043, T050, T155 |
| AC-02 | T028, T065, T070 |
| AC-03 | T051, T070 |
| AC-04 | T055, T079, T107 |
| AC-05 | T073, T077, T082, T083 |
| AC-06 | T084, T092 |
| AC-07 | T095, T098, T102 |
| AC-08 | T109, T116 |
| AC-09 | T118, T129 |
| AC-10 | T134, T142 |
