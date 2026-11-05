---

description: "Task list for Math Tanks implementation"
---

# Tasks: Math Tanks

**Input**: Design documents from `/specs/001-math-tanks/`

**Prerequisites**: [amendment-01-number-aiming.md](./amendment-01-number-aiming.md), [amendment-02-ruler-ranges-and-detail.md](./amendment-02-ruler-ranges-and-detail.md), [amendment-03-new-scene-button.md](./amendment-03-new-scene-button.md), [amendment-04-hit-rule.md](./amendment-04-hit-rule.md), [amendment-05-no-shortcuts-settings-early.md](./amendment-05-no-shortcuts-settings-early.md), [amendment-06-one-hit-lives.md](./amendment-06-one-hit-lives.md), [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/core-api.md](./contracts/core-api.md), [contracts/ui-flows.md](./contracts/ui-flows.md), [quickstart.md](./quickstart.md), [critique report](./critiques/critique-20261105-064803.md)

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
- **D2**: *Removed by amendment 02.* There is no two-step selection, so `selectInterval` and `leaveZoom` are not built. Wide ranges are reached by typing (FR-020); the +1 and −1 buttons and the arrow keys were removed by amendment 05.
- **D3**: Before Phase 15, "Spielen" (and Enter on the start screen) starts a free-play round, so US1 is playable on its own. Phase 15 switches "Spielen" to guided mode and keeps "Freies Spiel" behind the free-play setting (FR-014).
- **D4**: Playwright tests read game state from `data-*` attributes on the React overlay (`data-phase`, `data-turn`, `data-lives`, `data-enemies-destroyed`, `data-shots-since-enemy-fire`, `data-outcome`, `data-challenge-answerable`; amendment 06 replaced `data-player-health` and `data-enemy-health`), never from a global variable, so the production build exposes no debug API. The `?seed=<n>` query parameter (quickstart.md) fixes the round seed.
- **D5**: Attempts are built from Phase 14 on with `independent = solved && helpLevel === 0 && wrongAnswers === 0` (the exact number on the first shot without help; since amendment 06 every hit is exact and `exact` is always `true`) and `guess = false`. Phase 22 replaces this with `classifyAttempt` (FR-038).
- **D6**: Service worker behavior differs across Playwright browsers. `tests/e2e/offline.spec.ts` must pass in Chromium; in WebKit and Firefox it runs and is skipped with a stated reason only where Playwright cannot control the service worker. Manual check on a real iPad covers the gap (Phase 24).
- **D7**: Amendments 01 and 02 arrived after Phases 1 to 7 were built. Phases 8 to 10 rework the built code; Phase 11 (US9, raised to P2) follows at once. Unchecked tasks T060 to T155 keep their IDs but were rewritten and moved to new phase numbers; new tasks start at T156. Removed requirements FR-011 and FR-012 have no tasks.
- **D8**: Phases: `challenge` is a guided search in which every fire is an answer; `aiming` is free play, in which the child chooses a number and fires at a visible enemy. `RoundState` loses `aim`, `charged`, `shotsAtEnemy` and `challengePurpose`, and gains `entry`, `orderTaps`, `rulerLevel` and `lastShot` (data-model.md).
- **D9**: The player's arc comes from `solveArcToX` (research R21): 65 degrees, raised in 5-degree steps to 85, power by bisection, lifted fallback arc. `solveAim` stays for the enemy only.
- **D10**: Damage from the player's shell follows the tank-body rule of amendment 04 (`shotKind` in `src/core/battle/hitRule.ts`): a shell within 30 world units (half the 60-unit tank width) of the enemy's center costs it `MAX_DAMAGE`; the exact number is a Volltreffer and costs `2 * MAX_DAMAGE`; with `exactHit` only the Volltreffer does damage. A decoy at the fired number is destroyed; a shell inside the blast radius that does no damage makes the enemy shake (`lastShot.nearMiss`). `hitTolerance` no longer exists. The player's own shell never damages the player. Enemy shells keep the distance-based damage. *(Superseded by amendment 06, see D18: only the exact number hits and destroys the enemy; there is no damage.)*
- **D11**: Keyboard: `keyToAction` in `src/app/keyboard.ts` and `applyKey` in `src/core/battle/entry.ts` are pure and unit-tested; `useKeyboard` listens on `window`; the app root gets focus on load and on screen changes; keys with Ctrl, Alt or Meta, and repeated Enter or Space, are ignored; the gear ignores keys (research R22).
- **D12**: Miss display: guided misses show the landing number large and, from help step 1, the direction; the step count from the landing number appears at help step 2. Free play shows a distance bracket with the step count after every miss. After each free-play hit the enemy moves to a new visible position.
- **D13**: Settings become version 2 in one migration (Phase 10): drop `aimCorrection`, replace `labelLevel` with `rulerLevelStart` and `rulerLevelMax`. The storage keys keep their names.
- **D14**: Free play uses only `readPosition` and records no attempts. *(The level 5 tolerance note is superseded by amendment 04: there is no read-the-ruler tolerance.)*
- **D16**: Amendment 04 arrived after Phase 11. Phase 11a builds the hit rule, the Volltreffer, the pointer line, the `exactHit` setting (settings version 3) and the `'close'` outcome type, and finishes T181. Later unchecked tasks that assumed exact-only hits or the read-the-ruler tolerance were rewritten in place; new tasks start at T186.
- **D15**: Comparison typing: a typed number that matches a tank's label acts like a tap on that tank. In single-choice comparisons any other typed number is fired like any number (a miss); in `order3` it places no badge and shows a hint.
- **D17**: Amendment 05 arrived after Phase 11a. Phase 11b removes `nudge`, the arrow keys and the −1 and +1 buttons, hides every number while pointing, tracks `RoundState.inputMethod` so that keyboard input skips `findNumber`, and builds the clear tank identity. The settings phases moved directly after Phase 11b and were renumbered 12 and 13 (they keep task IDs T103 to T116 and T182); the guided phases that followed became Phases 14 to 20. The progress page stays in Phase 22, because it needs the attempt records of guided mode; until then the parent menu shows "Fortschritt" disabled with "kommt bald". Phase 12 works on free play alone: `updateSettings` applies at the next `startRound` in either mode. New tasks start at T194.
- **D18**: Amendment 06 arrived after Phase 13. Phase 13a builds it on free play: `shotKind` returns `'hit'` (exact number, the enemy is destroyed and replaced), `'near'` (on the body, the enemy shakes, a miss) or `'miss'`; `TankState.health`, `MAX_DAMAGE`, `damageAt`, `enemyDamage`, `enemyDamageFactor`, `exactHit` and the outcome `'close'` are removed from new code (a stored `'close'` still loads). `RoundState` gains `lives` (3), `enemiesDestroyed`, `shotsSinceEnemyFire`, `elapsedMs` and `lastEnemyHit`; `outcome` becomes `'goalReached' | 'heartsGone'`. The enemy fires after every 2 shots of the child, misses included, in both modes; this changes the amendment 01 rule that a miss never gives the enemy a turn (FR-013, SC-005). Settings become version 4 (`roundType`, `showClock`, `showRecords`; `roundLength` 1 to 20 counts enemies). Personal bests live in `src/core/records/records.ts` under the storage key `mathtanks.records.v1` and are part of the export file. Later unchecked tasks that assumed health, damage values, the Volltreffer, `'close'`, `exactHit` or rounds counted in turns were rewritten in place; new tasks start at T204.

---

## Phase 1: Setup

**Purpose**: Project initialization, pinned tooling, lint rules that protect the core.

- [X] T001 Create `package.json` (pnpm, `"type": "module"`, `"packageManager": "pnpm@10"`) with exact pinned versions from plan.md and research.md: `typescript@~6.0.3` (not 7.x, because `typescript-eslint` 8.72 supports only TypeScript below 6.1), `phaser@~4.2.0`, `react@~19.3.0`, `react-dom@~19.3.0`, `vite@~8.3.0`, `@vitejs/plugin-react@^6.0.0`, `vite-plugin-pwa@~2.0.0`, `zod@~4.6.0`, `vitest@~5.1.0`, `@playwright/test@~1.64.0`, `typescript-eslint@~8.72.0`, `eslint`, `@testing-library/react`, `jsdom`, `@types/react`, `@types/react-dom`. Scripts: `dev`, `build`, `preview`, `test` (`vitest run`), `e2e` (`playwright test`), `lint`, `typecheck` (`tsc --noEmit`). Done when `pnpm install` succeeds and writes `pnpm-lock.yaml`. Files: `package.json`, `pnpm-lock.yaml`, `.gitignore` (FR-050)
- [X] T002 [P] Create `tsconfig.json` with `strict: true`, `target: "ES2022"`, `jsx: "react-jsx"`, `moduleResolution: "bundler"`, `noUncheckedIndexedAccess: true`, include `src`, `tests` (FR-028)
- [X] T003 [P] Create `vite.config.ts` with `@vitejs/plugin-react`, `vite-plugin-pwa` (`registerType: 'prompt'`, `injectRegister: false`, precache glob for `**/*.{js,css,html,svg,png,webmanifest}`, manifest with name "Mathe-Panzer", icons from `public/icons/`), and the Vitest block (`environment: 'node'` by default, `environmentMatchGlobs` mapping `src/app/**` to `jsdom`) (FR-050, FR-051)
- [X] T004 [P] Create `eslint.config.js` with `typescript-eslint` recommended rules plus: `no-restricted-properties` banning `Math.random` in `src/core/**`; `no-restricted-imports` banning `phaser`, `react`, `react-dom` in `src/core/**`; `no-restricted-imports` banning `src/core/physics` from `src/core/math/**` and `src/core/math` from `src/core/physics/**`. Done when a scratch file `src/core/x.ts` calling `Math.random()` fails `pnpm lint` (then delete it) (FR-028)
- [X] T005 [P] Create `playwright.config.ts` with projects `chromium`, `webkit`, `firefox`, `testDir: 'tests/e2e'`, `webServer` running `pnpm build && pnpm preview --port 4173`, `baseURL: 'http://localhost:4173'` (FR-050)
- [X] T006 [P] Create `index.html` (German `lang="de"`, viewport meta, root div, no external fonts or CDNs), `src/main.tsx` (React root rendering `App`), placeholder `src/app/App.tsx`, `src/app/styles.css` (system font stack, full-viewport layout), and simple generated icons `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/icon.svg` (FR-052, FR-056)
- [X] T007 Add `src/core/sanity.test.ts` with one passing test, then run `pnpm lint && pnpm typecheck && pnpm test && pnpm build`. Done when all four commands succeed on the empty app.

**Checkpoint**: Tooling works; lint blocks `Math.random` and framework imports in `src/core`.

---

## Phase 2: Foundational

**Purpose**: Seeded random numbers, shared types, settings, translation table and storage. Every user story needs these.

**CRITICAL**: No user story work can begin until this phase is complete.

- [X] T008 [P] Write `src/core/rng.test.ts`: same seed gives the same sequence; `next()` in `[0,1)`; `int(min,max)` inclusive and covers both ends over 10,000 draws; `pick` returns only list items; `normal(mean, sd)` sample mean and spread within 5% over 10,000 draws; `deriveSeed(...parts)` is stable and differs for different parts (FR-028)
- [X] T009 Implement `src/core/rng.ts`: mulberry32 `createRng(seed): Rng` with `next`, `int`, `pick`, `normal` (Box-Muller), and `deriveSeed(...parts: number[]): number` as a stable 32-bit hash, per research R9 (FR-028)
- [X] T010 [P] Create `src/core/types.ts` with every type in data-model.md: `Skill`, `ChallengeKind`, `PromptSpec`, `Challenge`, `Attempt`, `RecentOutcome` (`'independent' | 'assisted' | 'unsolved'`), `SkillProgress`, `SessionSummary`, `Progress`, `DifficultyStep`, `Phase`, `RoundState`, `TankState`, `Point`, `Heightmap` (`Float32Array` of surface heights per column). Done when `pnpm typecheck` passes (FR-035, FR-036)
- [X] T011 [P] Write `src/core/settings/settings.test.ts`: defaults match data-model.md; `validateSettings` rejects `min >= max` (FR-047, US6 scenario 5), rejects all challenge types off with `freePlay: false` (US6 scenario 4), rejects `max - min` outside 5 to 1000, `roundLength` outside 3 to 30, `timeLimitSeconds` outside 10 to 120, `subtraction.maxOperand` above `range.max - range.min`, `addition.maxResult` above `range.max`, and operand limits that allow no exercise in the range; `withRange` clamps `addition.maxResult`, `addition.maxOperand` and `subtraction.maxOperand` so the result passes `validateSettings` for every preset (FR-046, FR-047)
- [X] T012 Implement `src/core/settings/schema.ts` (Zod 4 schema for `Settings`, `version: 1`) and `src/core/settings/defaults.ts` with the data-model.md defaults: challenge types all `true`; range preset `'0-100'`, min 0, max 100; addition `maxOperand` 10, `maxResult` = `range.max`, `steps` 1; subtraction `maxOperand` 10, `steps` 1; `crossTens: true`; `crossHundreds: false`; `negativeResults: false`; `labelLevel: 1`; `enemyDifficulty: 'easy'`; help all `true`; `beginnerAssist: true`; `aimCorrection: false`; sound effects `true`, music `false`, speech `true`; `roundLength: 10`; `adaptive: true`; `freePlay: false`; `noDamage: false`; `timeLimitSeconds: null`. Range rule verbatim: "Integers; `min < max`; `max - min` between 5 and 1000; preset values fix `min` and `max`"; custom `min` may go down to -1000 (FR-046)
- [X] T013 Implement `src/core/settings/validate.ts` with `validateSettings(s): { ok: true } | { ok: false; errors: SettingsError[] }` (each error is a translation key plus field path) and `withRange(s, range): Settings`, until `src/core/settings/settings.test.ts` passes (FR-047)
- [X] T014 [P] Write `src/i18n/i18n.test.ts`: walks every string and every string-returning function (called with sample numbers) in the `de` table and fails when any contains a word from `forbiddenWords` (`'falsch', 'verloren', 'Fehler', 'versagt', 'schlecht', 'dumm'`, case-insensitive, also inside compounds); fails when any entry in `encouragements` has more than 8 words; fails when `encouragements` has fewer than 8 phrases (FR-033, FR-057, SC-006)
- [X] T015 Implement `src/i18n/de.ts` (typed `Messages` object: start screen, battle overlay, round end, settings labels and errors as initial keys, parameterized functions such as `findNumber(n)`, `encouragements` list of at least 8 reviewed German phrases such as "Versuch eine andere Stelle.") and `src/i18n/index.ts` (`t()`, `encouragements`, `forbiddenWords`, `type Messages = typeof de`), until `src/i18n/i18n.test.ts` passes (FR-033, FR-056)
- [X] T016 [P] Write `src/core/storage/storage.test.ts` with an in-memory `KeyValue`: settings and progress round trip unchanged (SC-007); missing key gives defaults with `resetReason: 'none'`; damaged JSON or schema-invalid data gives defaults with `resetReason: 'invalid'`; a throwing `KeyValue` gives defaults with `resetReason: 'unavailable'` and `saveSettings` returns `{ ok: false }`; `migrate` turns a `version: 0` fixture into a valid `version: 1` object; keys are exactly `mathtanks.settings.v1` and `mathtanks.progress.v1` (FR-048)
- [X] T017 Implement `src/core/storage/keyValue.ts` (`KeyValue` interface, `localStorageKeyValue()` wrapped in try/catch, `memoryKeyValue()`), `src/core/storage/progressSchema.ts` (Zod schemas for `Progress`, `Attempt`, `SkillProgress`, `SessionSummary`), `src/core/storage/migrate.ts` and `src/core/storage/storage.ts` (`loadSettings`, `saveSettings`, `loadProgress`, `saveProgress`), until `src/core/storage/storage.test.ts` passes (FR-048)

**Checkpoint**: `pnpm test` passes for rng, settings, i18n and storage.

---

## Phase 3: US1 physics and enemy logic

**Goal (US1, P1)**: Engine-free terrain, ballistics, damage, aim solving and enemy aiming that the battle controller and the Phaser scene use.

**Independent Test**: `pnpm test src/core/physics src/core/ai` passes.

- [X] T018 [P] [US1] Write `src/core/physics/terrain.test.ts`: `generateTerrain(seed, 1600, 900)` is identical for the same seed and differs for different seeds; heights are within the world and above the floor of 40 units; `carveCrater` lowers heights inside the circle only, returns a new heightmap, and never goes below the floor even when the crater reaches the bottom; `surfaceY` interpolates between columns; a tank settled with `settleY(t, x)` rests on the surface after a crater, never floating or buried (FR-001, FR-005, FR-007)
- [X] T019 [P] [US1] Write `src/core/physics/ballistics.test.ts`: `simulateShot` uses a fixed step of 1/120 s and constant gravity; identical inputs give identical paths; the impact lies on the terrain surface or on a target; a hit on a target returns its `hitTargetId`; a shell that leaves the left or right edge returns `outOfBounds: true` with the impact clamped to the edge (FR-004, edge case "Shell leaves the screen")
- [X] T020 [P] [US1] Write `src/core/physics/damage.test.ts`: `damageAt` gives the maximum for a direct hit, decreases strictly with distance, is 0 outside the blast radius; the charged blast radius constant is larger than the normal one (FR-006, FR-011)
- [X] T021 [P] [US1] Write `src/core/physics/aim.test.ts`: `solveAim` finds a hitting shot (`hits: true`, impact within 10 units) on flat and hilly terrain; when a hill blocks every shot within angle 0 to 90 degrees and power 0 to 100%, it returns the closest shot with `hits: false` and the correct `missDistance` (FR-012)
- [X] T022 [US1] Implement `src/core/physics/terrain.ts` (`generateTerrain` from a seeded sum of 3 to 4 sine waves plus smoothing, `carveCrater`, `surfaceY`, `settleY`, `FLOOR = 40`), per research R5, until `terrain.test.ts` passes (FR-001, FR-005, FR-007)
- [X] T023 [US1] Implement `src/core/physics/ballistics.ts` (`simulateShot`), per research R6, until `ballistics.test.ts` passes (FR-004)
- [X] T024 [US1] Implement `src/core/physics/damage.ts` (`damageAt`, `BLAST_RADIUS`, `CHARGED_BLAST_RADIUS`, `MAX_DAMAGE`), until `damage.test.ts` passes (FR-006, FR-011)
- [X] T025 [US1] Implement `src/core/physics/aim.ts` (`solveAim`, grid of 1 degree by 1% power), per research R19, until `aim.test.ts` passes. Done also when one `solveAim` call takes under 50 ms in the test run (FR-012)
- [X] T026 [P] [US1] Write `src/core/ai/enemy.test.ts`: over 500 seeded shots, mean miss distance is largest on `'easy'`, smaller on `'normal'`, smallest on `'challenging'`; on `'easy'`, `shotIndexInRound === 0` always misses by more than the blast radius; `enemyDamageFactor('easy') === 0.5` and `1` otherwise; a type-level test (`expectTypeOf`) confirms the input has no field for attempts, help or challenges (FR-041, FR-042, FR-043)
- [X] T027 [US1] Implement `src/core/ai/enemy.ts` (`enemyShot`, `enemyDamageFactor`), using `solveAim` plus `rng.normal` error per research R18, until `enemy.test.ts` passes (FR-041, FR-042, FR-043)

**Checkpoint**: All physics and enemy logic is tested without a browser.

---

## Phase 4: US1 battle controller for free play

**Goal (US1, P1)**: A `BattleController` state machine that runs a full free-play round: alternating turns, shots, craters, damage, enemy turns, round end, new round, pause.

**Independent Test**: `pnpm test src/core/battle src/core/numberline` passes, including a scripted full round.

- [X] T028 [P] [US1] Write `src/core/numberline/mapping.test.ts`: for ranges 0-10, 0-20, 0-50, 0-100, 0-1000 and -20-30, `xToNumber(numberToX(n)) === n` for every integer `n`; equal value steps give equal x steps; `numberToX(min) === 80` and `numberToX(max) === 1520` with the default layout; for every number in ranges up to 0-100, the number-line marker x and the battlefield x differ by less than half a unit width (FR-015, SC-004, AC-02)
- [X] T029 [US1] Implement `src/core/numberline/mapping.ts` (`Layout` default `{ worldWidth: 1600, left: 80, right: 1520 }`, `numberToX`, `xToNumber` snapping to the nearest integer and clamped to `[min, max]`), until `mapping.test.ts` passes (FR-015, FR-058)
- [X] T030 [P] [US1] Write `src/core/math/gaps.test.ts`: `minTankGap(min, max) = max(0.08 * (max - min), tankWidthInNumbers)` where `tankWidthInNumbers` is the 60-unit tank width converted to numbers; `minEnemyGap(min, max) = 0.15 * (max - min)` (FR-027, FR-010a)
- [X] T031 [US1] Implement `src/core/math/gaps.ts` (`minTankGap`, `minEnemyGap`, `TANK_WIDTH = 60`), until `gaps.test.ts` passes (FR-027)
- [X] T032 [P] [US1] Write `src/core/battle/battleController.test.ts` (free-play part) with a fake clock and in-memory `ProgressStore`: `startRound('freePlay')` creates terrain, places the player at `range.min` or `range.max` and alternates the side on the next round, places the enemy at least `minEnemyGap` away and visible; `setAim` then `fire` moves to `playerShot` and stores the path; `shotAnimationDone` carves the crater, settles tanks, applies damage and stores `lastPlayerPath`; the phase then becomes `enemyTurn` and after `enemyShotAnimationDone` the next player turn starts (turns alternate); the round ends with `playerWon`, `enemyWon`, or `turnsUsed` after `roundLength` player turns; `noDamage` keeps player health at 100; `'easy'` enemy damage is half; a charged shot uses the larger blast radius; `pause` freezes the phase and `resume` returns to it; a new round uses a new terrain seed; subscribers are called on every change (FR-001 to FR-008, FR-011, FR-043, FR-044, FR-054, US1 scenarios 1 to 8)
- [X] T033 [US1] Implement `src/core/battle/ports.ts` (`ProgressStore` interface with `record(attempt)`, `getProgress()`; `Speaker` interface with `available`, `speak(text)`; `memoryProgressStore()`) and `src/core/battle/round.ts` (`createRound(settings, seed, side)` building `RoundState`, `applyImpact(state, impact, blastRadius)` for craters, settling and damage)
- [X] T034 [US1] Implement `src/core/battle/controller.ts` (`BattleController` with `constructor`, `getState`, `subscribe`, `startRound`, `setAim`, `fire`, `shotAnimationDone`, `enemyShotAnimationDone`, `pause`, `resume`), using `simulateShot`, `enemyShot` with its own `Rng` derived from the round seed, and a settings snapshot taken at `startRound`, until the free-play part of `battleController.test.ts` passes (FR-002, FR-008, FR-042, FR-049)

**Checkpoint**: A complete free-play round runs in a unit test.

---

## Phase 5: US1 Phaser battle scene

**Goal (US1, P1)**: Phaser 4 draws the battlefield, tanks, shells, trails and explosions from controller state.

**Independent Test**: `pnpm dev`, start a free-play round, aim, fire, and watch arcs, craters, health bars and enemy shots.

- [X] T035 [US1] Phaser 4 prototype (plan.md risk mitigation, do this first): create `src/game/createGame.ts` (Phaser 4 game config, logical world 1600 by 900, `Scale.FIT`, `Scale.CENTER_BOTH`, transparent background, parent element passed in) and a minimal scene in `src/game/BattleScene.ts` that draws `generateTerrain(seed)` as a filled polygon with a Graphics object and logs pointer-down world coordinates. Check every Phaser call against the installed `phaser` type definitions, not Phaser 3 examples. Done when `pnpm dev` shows the terrain scaled to the window, resizing keeps the aspect ratio, a click or tap logs the correct world x, and `pnpm typecheck` passes (FR-001, FR-058)
- [X] T036 [P] [US1] Implement `src/game/textures.ts`: generated textures for the tank body, turret, sky gradient, shell and explosion particle, all drawn by code with no image files (FR-001, research R13)
- [X] T037 [P] [US1] Implement `src/game/TerrainView.ts`: draws the heightmap as a filled polygon and redraws it within one frame after each crater (FR-005)
- [X] T038 [P] [US1] Implement `src/game/TankView.ts`: tank body, turret rotated by `aim.angleDeg`, health bar, tween down to the new surface after terrain changes, `hidden` and fade in/out states for later phases (FR-006, FR-007)
- [X] T039 [P] [US1] Implement `src/game/ProjectileView.ts`: replays a precomputed `path` over time at a fixed speed, then calls back; draws the previous player path as a faint dotted trail until the next shot; marks the edge landing point for out-of-bounds shots (FR-004, US1 scenario 6)
- [X] T040 [P] [US1] Implement `src/game/effects.ts`: explosion particle burst sized by blast radius and a hit flash on a damaged tank (FR-009)
- [X] T041 [US1] Complete `src/game/BattleScene.ts`: subscribes to the controller in `create()` and unsubscribes on shutdown; composes the views; replays player and enemy paths and then calls `shotAnimationDone` and `enemyShotAnimationDone`; lets the child drag the turret to set the angle (calls `setAim`); stops all tweens and replays while the phase is `paused`. Done when a free-play round can be played to the end by mouse in `pnpm dev` (FR-002, FR-003, FR-004, FR-054)
- [X] T042 [P] [US1] Implement `src/audio/sfx.ts`: Web Audio synthesized shot, soft boom and soft chime, played only when `settings.sound.effects` is on, with no sound tied to a wrong answer and peak gain capped low; the audio context resumes on the first user tap (FR-009, research R13)

**Checkpoint**: The battle renders and animates from core state.

---

## Phase 6: US1 React screens and battle end-to-end test

**Goal (US1, P1)**: Start screen, battle overlay controls and round end, wired to the controller. US1 is complete.

**Independent Test**: `pnpm e2e tests/e2e/battle.spec.ts` passes in all three browsers.

- [X] T043 [P] [US1] Write `tests/e2e/battle.spec.ts`: open `/?seed=1`, tap "Spielen" (one tap, SC-001), the canvas appears within 3 seconds; set power with the plus button, tap fire, wait for `data-phase="enemyTurn"` and then a player phase again; health attributes change after a hit; play until `data-phase="roundOver"`; the round end shows encouraging text and no forbidden word; tap "Nochmal" and confirm a new round starts without a page reload (`page.on('load')` fires once) (FR-001 to FR-008, SC-001, AC-01)
- [X] T044 [US1] Implement `src/app/useController.ts`: a `useSyncExternalStore` bridge to `BattleController.subscribe` and `getState` (research R4)
- [X] T045 [US1] Implement `src/app/App.tsx`: loads settings with `loadSettings(localStorageKeyValue())`, reads `?seed=` from the URL, creates one `BattleController`, mounts the Phaser game with `createGame` into a container under the React overlay, and switches between start, battle and round end screens (FR-050)
- [X] T046 [P] [US1] Implement `src/app/StartScreen.tsx`: large "Spielen" button (starts free play until Phase 9, see D3), gear icon placeholder, fullscreen button placeholder; every button at least 48 by 48 CSS pixels (SC-001, FR-053)
- [X] T047 [P] [US1] Implement `src/app/BattleOverlay.tsx`: angle and power controls (plus and minus buttons and a slider each, all at least 48 px), a large fire button enabled only in phase `aiming`, health bars, and the `data-*` attributes from D4 (FR-003, FR-053)
- [X] T048 [P] [US1] Implement `src/app/RoundEnd.tsx`: encouraging message chosen by outcome ("Gut gekämpft! Noch eine Runde?" for `enemyWon`, a neutral summary with no winner for `turnsUsed`), "Nochmal" starts a new round, a second button returns to the start screen (FR-008, US1 scenarios 7 and 8)
- [X] T049 [US1] Add all start screen, overlay and round-end strings to `src/i18n/de.ts`; no German text is written directly in `.tsx` files. Done when `src/i18n/i18n.test.ts` still passes (FR-033, FR-056, FR-057)
- [X] T050 [US1] Extend `src/app/styles.css`: overlay positions from ui-flows.md (controls bottom right, top bars), minimum target size 48 px with at least 8 px between targets, large clear digits. Then make `tests/e2e/battle.spec.ts` pass in Chromium, WebKit and Firefox (FR-053, FR-058, AC-01)

**Checkpoint**: US1 is a playable game (AC-01).

---

## Phase 7: US2 number line ticks and number-line challenges

**Goal (US2, P1)**: Tick layout, labeling levels and the seven number-line challenge kinds, generated answer-first and validated.

**Independent Test**: `pnpm test src/core/numberline src/core/math` passes, including the property test.

- [X] T051 [P] [US2] Write `src/core/numberline/ticks.test.ts`: `ticksFor` follows the FR-016 table for every width from 5 to 1000 (including width 150 and a range where width is over 10 and includes a multiple of 10); for the view 30 to 40, 30 and 40 are major and 31 to 39 minor with equal spacing (AC-03); at most 101 ticks per view; level 1 labels all ticks, level 2 only major, level 3 major plus at most half of the minor labels chosen by `seed`, level 4 only the end points; end points are always labeled, including custom ranges such as 15 to 45 (FR-016, FR-017, AC-03)
- [X] T052 [US2] Implement `src/core/numberline/ticks.ts` (`ticksFor`), until `ticks.test.ts` passes (FR-016, FR-017)
- [X] T053 [P] [US2] Write `src/core/math/numberLine.test.ts`: for each kind `findNumber`, `after`, `before`, `stepsRight`, `stepsLeft`, `missingBetween`, `midpoint`, the generated challenge has the right prompt key, operands and answer (for example `after` with 49 gives answer 50); `midpoint` is skipped when the range has no two major ticks with a whole midpoint; same seed gives the same challenge (FR-021, FR-028, US2 scenario 4)
- [X] T054 [P] [US2] Write `src/core/math/validate.test.ts`: `validateChallenge` reports out-of-range answers, operands and steps, and answers closer than `minEnemyGap` to the player; `checkAnswer` accepts only the exact answer (FR-029)
- [X] T055 [P] [US2] Write `src/core/math/generator.property.test.ts`: for each preset range (0-10, 0-20, 0-50, 0-100, 0-1000), each player side and 10,000 seeds, `validateChallenge(generateChallenge(...))` returns `[]`; with every type turned off except number line it never throws; for range 0-10 with tens crossing off it still returns a valid challenge (fallback to `findNumber`) (FR-029, SC-003, AC-04, edge case "Range too small")
- [X] T056 [P] [US2] Implement `src/core/math/skills.ts`: `mainSkillOf(kind)` per data-model.md (`findNumber`, `missingBetween`, `midpoint` → `positions`; `after`, `stepsRight` → `countForward`; `before`, `stepsLeft` → `countBackward`; `addition` → `addition`; `subtraction` → `subtraction`; comparison kinds → `comparison`) and `secondarySkills(challenge)` adding `tens` for multiples of ten and `crossTens` for a crossed ten boundary (FR-036)
- [X] T057 [US2] Implement `src/core/math/numberLine.ts`: answer-first builders for the seven kinds, each taking `(answer, settings, step, rng)` and returning a challenge or `null` when impossible (FR-021, FR-025)
- [X] T058 [US2] Implement `src/core/math/validate.ts` (`validateChallenge`, `checkAnswer`) until `validate.test.ts` passes (FR-029)
- [X] T059 [US2] Implement `src/core/math/generate.ts` (`generateChallenge`): picks the answer from allowed positions at least `minEnemyGap` from `playerPosition`, tries the chosen kind, retries up to 50 answers, then another enabled kind, then falls back to `findNumber`; `purpose: 'bonus'` excludes comparison kinds; seed derived with `deriveSeed`; `id` is `${roundSeed}-${turn}`. Done when `numberLine.test.ts` and `generator.property.test.ts` pass (FR-021, FR-025, FR-028, FR-029, SC-003)

**Checkpoint**: Number-line challenges are generated and validated without a browser.

---

## Phase 8: Amendment 01 rework of the built battle for number aiming and keyboard play

**Goal (US1, amendment 01)**: Rework the built core so the player aims by choosing a number: a fixed cannon with an automatic arc, exact-number damage, free-play shots by number, and keyboard entry of digits. No angle, power, aim correction or charged shots remain in `src/core`.

**Independent Test**: `pnpm test src/core/physics src/core/battle` passes, including a scripted free-play round fired only with `fireAt` and `typeDigit` plus `confirm`.

- [X] T156 [P] [US1] Write `src/core/physics/arc.test.ts`: `solveArcToX` starts at `FIXED_ANGLE_DEG` 65 toward the enemy side for both player sides; for every integer in ranges 0-10, 0-100 and 0-1000 and 5 seeded terrains, `xToNumber(impact.x)` equals the chosen number and `|impact.x - numberToX(n)| <= 0.25 * unitWidth`; with a tall hill built into a test heightmap, the angle rises in 5-degree steps and never above 85; when a wall blocks every angle, the result has `lifted: true`, ends on the surface at the target x, and every path point lies above the terrain; identical input gives identical output; one call takes under 20 ms (FR-004, FR-065, SC-012, edge case "Hill blocks the fixed arc")
- [X] T157 [P] [US1] Write `src/core/battle/entry.test.ts` for the pure `applyKey`: digits append and `selection` follows at once (3 then 7 gives 37); Backspace removes the last character and an empty entry keeps the last selection; digits past the length of the longest number in the range are ignored; `minus` is accepted only as the first character and only when `range.min < 0`; typing 150 in range 0-100 gives `selection` 100 and `outOfRange: true`; typing -25 in range -20 to 30 gives -20 and `outOfRange: true` (FR-060, FR-063, edge cases "Typed number outside the range" and "Minus key")
- [X] T158 [P] [US1] Rewrite the free-play part of `src/core/battle/battleController.test.ts`: remove every use of `setAim`, `fire`, `aim` and `charged`; `fireAt(n)` in phase `aiming` moves to `playerShot` with a path from `solveArcToX` that lands at `numberToX(n)`; `typeDigit`, `backspace`, `nudge(±1, ±10)` and `selectNumber` change only `selection` and `entry`; `confirm()` fires at the selection and does nothing when `entry.outOfRange` is true or no selection exists; digits and `confirm` are ignored in `playerShot` and `enemyTurn`; after `shotAnimationDone` the crater is at the chosen x, the enemy loses `MAX_DAMAGE` only when `n === enemy.position`, a shot inside the blast radius sets `lastShot.nearMiss` with no damage, the player's own shell never changes player health, and `lastShot.landed === n`; every free-play shot is followed by `enemyTurn`; after a hit the enemy moves to a new visible position at least `minEnemyGap` from the player; round end, side alternation, `noDamage`, easy damage factor, pause and resume still pass (FR-002 to FR-008, FR-014, FR-061, FR-063, FR-066, SC-012, US1 scenarios 1 to 9)
- [X] T159 [P] [US1] Update `src/core/physics/damage.test.ts`: remove the charged blast radius check; `damageAt` keeps its distance rule for enemy shells (FR-006, FR-011 removed)
- [X] T160 [US1] Implement `src/core/physics/arc.ts` (`FIXED_ANGLE_DEG`, `MAX_ARC_ANGLE_DEG`, `ARC_ANGLE_STEP_DEG`, `solveArcToX`) using `simulateShot` with no tank targets, per research R21, until `arc.test.ts` passes (FR-004, FR-065)
- [X] T161 [US1] Implement `src/core/battle/entry.ts` (`applyKey`, `emptyEntry`), until `entry.test.ts` passes (FR-060, FR-063)
- [X] T162 [US1] Update `src/core/physics/damage.ts` (remove `CHARGED_BLAST_RADIUS`) and `src/core/battle/round.ts` (remove `blastRadiusFor`; `applyImpact` takes the fired number and applies the exact-number rule of decision D10 for the player's shell and the distance rule for enemy shells; sets `lastShot`), until `damage.test.ts` passes (FR-006, FR-066)
- [X] T163 [US1] Update `src/core/types.ts` (`RoundState` per decision D8: remove `aim`, `charged`, `shotsAtEnemy`, `challengePurpose`; add `entry`, `orderTaps`, `rulerLevel`, `lastShot`) and `src/core/battle/controller.ts` (remove `setAim` and `fire`; add `selectNumber`, `nudge`, `typeDigit`, `typeMinus`, `backspace`, `confirm`, `fireAt`; player shots from `solveArcToX`; free-play enemy moves after a hit), until the free-play part of `battleController.test.ts` passes. Done when `grep -rn "setAim\|charged\|angleDeg" src/core/battle` finds nothing (FR-002, FR-003, FR-014, FR-059 to FR-061, FR-065, FR-066)
- [X] T164 [US1] Run `pnpm lint && pnpm typecheck && pnpm test` and fix every failure inside `src/core`. `src/game` and `src/app` may fail typecheck until Phase 9; list those errors in the task note for Phase 9 (FR-028)
  - Note for Phase 9 (typecheck errors left after Phase 8, all outside `src/core`): `src/app/BattleOverlay.tsx` lines 25 to 28 and 74 read `state.aim` and call `controller.setAim` and `controller.fire`; `src/game/BattleScene.ts` line 111 reads `s.aim.angleDeg` for the player cannon and line 186 calls `controller.setAim` from cannon dragging. `pnpm build` succeeds (Vite does not type-check), but the battle screen fails at run time on `state.aim`, so `tests/e2e/battle.spec.ts` (angle and power controls) fails until Phase 9 replaces them. Lint and `pnpm test` pass. Settings still carry `labelLevel` and `aimCorrection` until Phase 10, so `RoundState.rulerLevel` is fixed at 1 in `createRound` until the version 2 settings add `rulerLevelStart`.

**Checkpoint**: A free-play round runs in unit tests by choosing numbers only.

---

## Phase 9: Amendment 01 rework of the battle view and keyboard input

**Goal (US1 and US8, amendment 01)**: Remove angle and power controls and cannon dragging, add a minimal number line view with tap, drag and keyboard digit entry, and make free play work by number with the keyboard alone.

**Independent Test**: `pnpm e2e tests/e2e/battle.spec.ts` passes in all three browsers using only `page.keyboard`.

- [X] T165 [P] [US1] Rewrite `tests/e2e/battle.spec.ts` to use only the keyboard (no `click`, `tap` or mouse call): open `/?seed=1` with stored settings `freePlay: true`; press Enter on the start screen, the canvas appears within 3 seconds; read the enemy's number from `data-enemy-number` (set only while the enemy is visible); type a wrong number digit by digit and check `data-selection`, press Enter, wait for `data-last-landing` to equal it, enemy health unchanged, then `data-phase="enemyTurn"` and back to `aiming`; type the enemy's number and Enter, enemy health drops; play until `data-phase="roundOver"`; the round end shows encouraging text and no forbidden word; press Enter and confirm a new round starts without a page reload (FR-001 to FR-008, FR-059 to FR-062, FR-066, SC-001, AC-01)
- [X] T166 [P] [US8] Write `src/app/keyboard.test.ts` for the pure `keyToAction(event, screen)`: digits 0 to 9 (main row and numpad) map to digit actions in `battle`; `-` to minus; Backspace; Enter to `confirm` in `battle`, `start` on `start`, `newRound` on `roundEnd`, `resume` on `paused`; Space to `start`, `newRound`, `resume` and, in `battle` only at help level 3, `confirm`; arrows to nudges of ±1 and ±10; `h` and `H` to `help`; Escape to `pause` and `resume`; keys with Ctrl, Alt or Meta and repeated Enter or Space return `null`; no key returns an action that opens the parent gate (FR-059 to FR-062, FR-045)
- [X] T167 [US8] Implement `src/app/keyboard.ts` (`keyToAction`) until `keyboard.test.ts` passes, and `src/app/useKeyboard.ts` (one `keydown` listener on `window`, `preventDefault` for handled keys, dispatches to controller methods or screen callbacks) (FR-059 to FR-062)
- [X] T168 [US1] Implement a first `src/game/NumberLineView.ts`: draws the ruler in world y 720 to 820, x 80 to 1520 with `numberToX` and `ticksFor` (current label levels; Phase 10 switches to ruler levels); tap and drag on the whole line call `selectNumber(xToNumber(x))`; a vertical guide line and a target marker at `selection` on the battlefield; release only previews; after each shot a landing marker with the landing number in large digits; in free play a bracket from the landing number to the enemy's number with the step count (FR-004, FR-014, FR-015, FR-019, FR-053, US2 scenarios 1 and 6)
- [X] T169 [US1] Update `src/game/BattleScene.ts`, `src/game/TankView.ts`, `src/core/view/geometry.ts` and `src/core/view/geometry.test.ts`: remove cannon dragging, pointer aiming and `aimAngleFromPointer` (with its tests); the player turret shows the fixed 65-degree angle and turns to the arc's launch angle (`launchAngle(path)`) just before a lifted or raised shot; the enemy tank shakes on `lastShot.nearMiss`; compose `NumberLineView` (FR-003, FR-065, FR-066)
- [X] T170 [US1] Update `src/app/BattleOverlay.tsx` and `src/app/styles.css`: remove the angle and power controls; add the large number readout of `selection` (typed digits shown as typed), −1 and +1 buttons, a large fire button calling `confirm` (enabled in `aiming` and `challenge`), the out-of-range hint "Zahlen von {min} bis {max}", and the attributes `data-selection`, `data-last-landing`, and `data-enemy-number` only while the enemy is visible; every button at least 48 px (FR-003, FR-019, FR-053, FR-063)
- [X] T171 [US8] Update `src/app/App.tsx`, `src/app/StartScreen.tsx` and `src/app/RoundEnd.tsx`: mount `useKeyboard` with the current screen; Enter or Space on the start screen does what "Spielen" does (free play until Phase 15, decision D3); Enter or Space on the round end starts a new round; the app root has `tabIndex={-1}` and receives focus on load and on every screen change, so typing works without a click; there is no text field (FR-059, FR-062, US8 scenario 6)
- [X] T172 [US1] Update `src/i18n/de.ts`: remove the angle, power and aim-correction strings that are no longer used; add fire, landing number ("Gelandet bei {n}"), free-play distance ("{n} Schritte"), and the range hint; `src/i18n/i18n.test.ts` still passes. Then make `tests/e2e/battle.spec.ts` pass in Chromium, WebKit and Firefox, and run `pnpm lint && pnpm typecheck` (FR-033, FR-056, FR-057, AC-01)

**Checkpoint**: Free play works by number, with mouse, touch or the keyboard alone (AC-01 under amendment 01).

---

## Phase 10: Amendment 02 rework of the ruler, settings and challenge kinds

**Goal (US2 and US9, amendment 02)**: Replace the four label levels built in Phase 7 with the five ruler levels, move settings to version 2 (no `aimCorrection`, no `labelLevel`), allow any range start, add the `readPosition` challenge kind, and remove the bonus purpose from the generator.

**Independent Test**: `pnpm test src/core/numberline src/core/settings src/core/storage src/core/math` passes.

- [X] T173 [P] [US9] Rewrite `src/core/numberline/ticks.test.ts` for `ticksFor(view, level, seed, opts)`: steps follow the amended FR-016 table for every width from 5 to 1000 (width 230 as in 550 to 780 gives major 50 and minor 10, majors at 550, 600, 650, 700, 750); at most 101 ticks per view; level 1 draws major and minor lines and labels all of them when the label spacing is at least 28 logical units, otherwise sets `labelsNearPreview`; level 2 labels only major lines; level 3 labels a seed-chosen subset of major lines and always both end points; level 4 has no visible minor lines; level 5 draws only the end points; end points are always visible and labeled; `allLines: true` makes every line visible and labeled; `smallestVisibleStep` returns the minor step on levels 1 to 3 and the major step on 4 and 5; the view 30 to 40 at level 1 still has majors at 30 and 40 and nine equal minors (FR-016, FR-017, FR-018, FR-068, AC-03, US2 scenario 5, US9 scenario 4)
- [X] T174 [US9] Rewrite `src/core/numberline/ticks.ts` (`ticksFor` with the `RulerLevel` type, `smallestVisibleStep`), until `ticks.test.ts` passes (FR-016, FR-017)
- [X] T175 [P] [US9] Update `src/core/settings/settings.test.ts` and `src/core/storage/storage.test.ts`: defaults have `version: 2`, `rulerLevelStart: 1`, `rulerLevelMax: 5`, no `aimCorrection`, no `labelLevel`; `validateSettings` rejects `rulerLevelStart > rulerLevelMax`, accepts custom 550 to 780 and -20 to 30, rejects a width below 5 or above 1000 and a minimum outside -1000 to 9000; `withRange` still clamps the linked limits; `migrate` turns a version 1 fixture with `labelLevel: 4` and `aimCorrection: true` into a valid version 2 object with `rulerLevelStart: 5`, `rulerLevelMax: 5` (start must not exceed max) and no `aimCorrection`, and `labelLevel: 2` into start 2, max 5 (FR-018, FR-046, FR-047, FR-048, US9 scenario 4, decision D13)
- [X] T176 [US9] Update `src/core/settings/schema.ts`, `src/core/settings/defaults.ts`, `src/core/settings/validate.ts` and `src/core/storage/migrate.ts` for settings version 2, until `settings.test.ts` and `storage.test.ts` pass (FR-046, FR-047, FR-048)
- [X] T177 [P] [US9] Write `src/core/math/readPosition.test.ts`: the builder places the answer on a multiple of the minor step on levels 1 to 3 and on any whole number on levels 4 and 5, always inside the range and at least `minEnemyGap` from the player; `hitTolerance` is 0 when the answer is on a visible line and half of `smallestVisibleStep` otherwise; `checkAnswer` accepts a fired number within the tolerance; main skill is `positions`; with range 550 to 780 and level 2 every answer is a multiple of 10; `generateChallenge` with `kindsAllowed: ['readPosition']` returns only that kind; same seed gives the same challenge (FR-021, FR-067, FR-068, US9 scenario 5)
- [X] T178 [US9] Implement `src/core/math/readPosition.ts` (builder and `hitTolerance`); add `readPosition` and the `rulerLevel` and `hitTolerance` fields to `src/core/types.ts`; register it in `src/core/math/generate.ts` (part of the number-line type; new `rulerLevel` input; remove the `purpose: 'search' | 'bonus'` input), `src/core/math/skills.ts` and `src/core/math/validate.ts` (`checkAnswer` with tolerance), until `readPosition.test.ts`, `numberLine.test.ts`, `validate.test.ts` and `generator.property.test.ts` pass (FR-014, FR-021, FR-029, FR-067, FR-068)
- [X] T179 [US9] Update `src/i18n/de.ts`: settings labels "Lineal: Startstufe" and "Lineal: schwerste Stufe" replace the label-level and aim-correction labels; add the `readPosition` prompt ("Wo steht der Gegner?") and the hit feedback "Treffer! Der Gegner stand bei {n}."; `src/i18n/i18n.test.ts` still passes. Then run `pnpm lint && pnpm typecheck && pnpm test` (FR-056, FR-057, FR-068)

- [X] T184 [US1] Keep the ground and tanks above the ruler (product owner request): write `src/core/view/layout.test.ts` first (for many seeds, after generation and after many craters anywhere, also repeated at one spot and at the tank positions, every surface height is at least `FLOOR`, and the screen y of the surface and of every tank's bottom is at least 12 units above `RULER_TOP`); move the ruler band constants to `src/core/view/layout.ts` and use them in `src/game/NumberLineView.ts`; raise `FLOOR` in `src/core/physics/terrain.ts` to 200 and lift the terrain generator's base so hills still vary above it; draw a flat bedrock strip from the floor line to the bottom of the world in `src/game/TerrainView.ts`, with the ruler on it (FR-015, FR-058)
- [X] T185 [US1] New scene button, [amendment 03](./amendment-03-new-scene-button.md): add `newScene()` tests to `src/core/battle/battleController.test.ts` (new round in the same mode with a different seed and terrain, full health, turn 0, the other side, no attempt recorded, ignored during `playerShot`, `enemyTurn` and `paused`), a `keyToAction` test that no key starts a new scene during battle or pause, and an e2e test in `tests/e2e/battle.spec.ts` that clicks the button and reads the restart from `data-*` attributes; then implement `BattleController.newScene()` and the "Neue Landschaft" button with a refresh icon at the right side of `src/app/BattleOverlay.tsx` (at least 48 by 48 CSS pixels, disabled while a shell is in flight or paused, `tabIndex` -1, no key) (FR-070)

**Checkpoint**: Ruler levels, settings version 2 and "read the ruler" work without a browser.

---

## Phase 11: US9 any number range and read-the-ruler free play

**Goal (US9, P2 since amendment 02)**: Any range of width 5 to 1000, such as 550 to 780, plays end to end; free play is "read the ruler"; the zoomed view exists only as a help visual.

**Independent Test**: `pnpm e2e tests/e2e/range.spec.ts` passes: range 550 to 780, free play, read the ruler, type the number, hit.

- [X] T180 [P] [US9] Add free-play read-the-ruler tests to `src/core/battle/battleController.test.ts`: each free-play turn has a `readPosition` challenge with the enemy visible at its answer; a shot at the enemy's number hits (Phase 11a T190 replaces the tolerance cases) and `lastShot` carries the exact enemy number for the feedback; free play records no attempt; `state.rulerLevel` equals `rulerLevelStart`; with range 550 to 780 the player stands at 550 or 780 and the enemy on a multiple of 10 at level 2 (FR-014, FR-067, FR-068, US9 scenarios 4 and 5, decision D14)
- [X] T143 [P] [US9] Write `src/core/numberline/zoom.test.ts`: `helpZoomView(437, 0, 1000)` is 430 to 440; `helpZoomView(637, 550, 780)` is 630 to 640; `helpZoomView(3, 0, 10)` is 0 to 10; a view at a range end is clamped to the range (for example 775 to 780 or the ten 770 to 780); `ticksFor(helpZoomView(...), level, seed, { allLines: true })` has every unit line visible and labeled (FR-018, FR-020, FR-031, US9 scenario 6)
- [X] T144 [US9] Implement `src/core/numberline/zoom.ts` (`helpZoomView`), until `zoom.test.ts` passes. Do not build `needsZoom`, `zoomIntervals`, `selectInterval` or `leaveZoom` (decision D2) (FR-020)
- [X] T145 [P] [US9] Add range tests to `src/core/battle/battleController.test.ts`: with range 0 to 1000, typing 4, 3, 7 and `confirm` fires at 437 and the shell lands at 437; `nudge(1)` from 436 reaches 437; `selectNumber` from a pointer x snaps to the nearest whole number; with range -20 to 30, `typeMinus` then 5 gives -5; with range 0 to 100, `typeMinus` is ignored (FR-020, FR-060, FR-064, US9 scenario 2)
- [X] T146 [US9] Make the tests from T145 pass in `src/core/battle/controller.ts` and `src/core/battle/entry.ts` (FR-020, FR-060, FR-064)
- [X] T147 [US9] Update `src/game/NumberLineView.ts` for ruler levels: draw only visible ticks and labels from `ticksFor(view, state.rulerLevel, seed)`; when `labelsNearPreview` is set, label the minor lines next to the preview marker; add `showZoom(view)` that draws a zoomed ten above the ruler with all lines and labels and connector lines from its two ends to the matching part of the battlefield, for the help steps in Phase 20 (FR-016, FR-017, FR-018, FR-020, FR-053, US2 scenario 5)
- [X] T148 [US9] Extend `src/core/math/generator.property.test.ts` with 0 to 50, 0 to 1000 with `crossHundreds` on and off, custom 15 to 45, custom 550 to 780, custom -20 to 30 with negative results on and off, and `readPosition` at all 5 ruler levels, 10,000 seeds each (FR-029, FR-067, SC-003, SC-013, US9 scenarios 3 and 4)
- [X] T149 [US9] Write `tests/e2e/range.spec.ts`: with stored settings range 550 to 780, `freePlay: true`, ruler level 2, and a fixed seed, start free play with Enter, read the enemy's number from `data-enemy-number`, type it and press Enter, and confirm the enemy's health drops and the feedback shows the exact number; also check that the ruler's first and last labels read 550 and 780. Make it pass in all three browsers (FR-014, FR-016, FR-067, US9 scenarios 2 and 4)

**Checkpoint**: Any range plays in free play; US9 is complete except the guided searches, which Phase 15 adds for every range. T181 moved to Phase 11a.

---

## Phase 11a: Amendment 04 hit rule, Volltreffer and pointer line

**Goal (US1, US2, US6, US9, [amendment 04](./amendment-04-hit-rule.md))**: A shell on the enemy tank's body is a hit in every mode; the exact number is a Volltreffer with double damage, a larger explosion and the message "Volltreffer!"; a body hit that is not exact shows "Du: N · Gegner: M · K Schritte"; a pointer line connects each visible tank to the ruler; settings version 3 adds `exactHit` ("Genau treffen"); progress types gain the outcome `'close'` and `Attempt.exact`.

**Independent Test**: `pnpm test` passes, and `pnpm e2e tests/e2e/battle.spec.ts tests/e2e/range.spec.ts` passes in all three browsers: in 550 to 780 a shot 1 away hits and shows both numbers, the exact number is a Volltreffer, and with `exactHit` a shot 1 away shows "Ganz knapp!" without damage.

- [X] T186 [P] [US1] Write `src/core/battle/hitRule.test.ts`: `bodyHalfWidth` is `30 / 1440 * (max - min)` (about 2.08 in 0 to 100, 4.79 in 550 to 780, 20.8 in 0 to 1000); `shotKind(n, n, r)` is `'bullseye'` for every range; in 0 to 100, 31 against 30 and 32 against 30 are `'body'`, 33 against 30 is `'miss'`; in 0 to 10, 4 against 5 is `'miss'`; in 0 to 1000, 457 against 437 is `'body'` and 459 is `'miss'`; in 550 to 780, 4 away is `'body'` and 5 away is `'miss'`; `enemyDamage` gives `2 * MAX_DAMAGE` for `'bullseye'`, `MAX_DAMAGE` for `'body'` (0 with `exactHit`), 0 for `'miss'` (FR-066, FR-071, FR-074)
- [X] T187 [US1] Implement `src/core/battle/hitRule.ts` (`bodyHalfWidth`, `shotKind`, `enemyDamage`, using `TANK_WIDTH` from `src/core/math/gaps.ts` and `numberToX`); remove `hitTolerance` from `src/core/math/readPosition.ts`, `src/core/math/numberLine.ts`, `src/core/types.ts` and `src/core/math/validate.ts` (`checkAnswer` is exact for every kind); update `src/core/math/readPosition.test.ts` (the placement tests stay, the tolerance tests go, `checkAnswer` accepts only the answer), until `hitRule.test.ts`, `readPosition.test.ts`, `validate.test.ts` and `generator.property.test.ts` pass (FR-066, FR-068)
- [X] T188 [P] [US6] Update `src/core/settings/settings.test.ts` and `src/core/storage/storage.test.ts`: defaults have `version: 3` and `exactHit: false`; the schema rejects a non-boolean `exactHit`; `migrate` turns a version 2 fixture into version 3 with `exactHit: false` and every other field unchanged, and version 0 and 1 fixtures into valid version 3 objects; the progress schema accepts `'close'` in `recent` and `masteryWindow`, and attempts with and without `exact` (missing becomes `true`) (FR-046, FR-074, FR-075, decision D13)
- [X] T189 [US6] Update `src/core/settings/schema.ts`, `src/core/settings/defaults.ts`, `src/core/storage/migrate.ts`, `src/core/storage/progressSchema.ts` and `src/core/types.ts` (`Settings.exactHit`, `RecentOutcome` with `'close'`, `Attempt.exact`), until `settings.test.ts` and `storage.test.ts` pass (FR-046, FR-074, FR-075)
- [X] T190 [P] [US1] Rewrite the player-shot tests in `src/core/battle/battleController.test.ts` for the hit rule: in 0 to 100 free play, a shot 1 away from the enemy costs it `MAX_DAMAGE` with `lastShot` `{ hit: true, bodyHit: true, bullseye: false, nearMiss: false, hitTankId: enemy id, distance: 1 }`; the exact number costs `2 * MAX_DAMAGE` with `bullseye: true`; a shot 3 away is a miss with `nearMiss: true`; with `exactHit: true` a shot 1 away does no damage and sets `bodyHit: true`, `hit: false`, `nearMiss: true`, and the enemy stays at its number for the next turn; in 550 to 780 a shot 4 away hits; after any damaging hit the enemy moves; free play records no attempt (FR-014, FR-066, FR-068, FR-071, FR-074)
- [X] T181 [US9] Finish read-the-ruler free play with the amendment 04 hit rule: in `src/core/battle/round.ts`, `applyImpact` uses `shotKind` and `enemyDamage` with `exactHit` from `DamageRules` and sets `lastShot.bodyHit` and `lastShot.bullseye`; in `src/core/battle/controller.ts`, pass `settings.exactHit` and move the enemy after every damaging hit; no attempt; until the tests from T180 and T190 pass (FR-014, FR-066, FR-067, FR-068, FR-071, FR-074)
- [X] T191 [P] [US1] Add to `src/i18n/de.ts`: `battle.bullseye` "Volltreffer!", `battle.bodyHit` "Treffer!", `battle.close` "Ganz knapp!", `battle.compare(you, enemy)` "Du: 30 · Gegner: 31 · 1 Schritt" (with "Schritte" for more than one), `battle.enemyStoodAt(n)` "Der Gegner stand bei {n}."; settings label `exactHit` "Genau treffen" and hint "Nur die genaue Zahl trifft."; `src/i18n/i18n.test.ts` still passes (FR-033, FR-056, FR-057, FR-071, FR-072, FR-074)
- [X] T192 [US1] Update the battle view: `src/app/BattleOverlay.tsx` shows the status line of the hit feedback table in contracts/ui-flows.md and sets `data-last-shot` (`bullseye`, `body`, `close`, `miss`); `src/game/NumberLineView.ts` draws the bracket from the child's number to `lastShot.enemyNumber` with the compare text after a body hit that is not exact, and a thin dashed pointer line from the center of every visible tank (enemy and decoys) down to the ruler, ending in a small triangle on the ruler line, with no number drawn and no ruler label highlighted (geometry in `src/core/view/pointerLine.ts`, tested first in `src/core/view/pointerLine.test.ts`, which also asserts the shape carries no number or label), and writes the pointer-line numbers to the canvas attribute `data-pointer-lines` for the tests only (decision D4); `src/game/BattleScene.ts` plays a larger explosion at the enemy after a Volltreffer and shakes it on `nearMiss`; `src/game/TankView.ts` gets `setBullseye(on)`, drawn on the enemy when the round's settings have `exactHit`; `src/game/effects.ts` gets the larger burst (FR-066, FR-071, FR-072, FR-073, FR-074)
- [X] T193 [US9] Update `tests/e2e/range.spec.ts` and `tests/e2e/battle.spec.ts`: in 550 to 780 at ruler level 2 with a fixed seed, `data-pointer-lines` equals the enemy's number and `data-ruler-labels` stays exactly the level 2 labels (no number added for the pointer line); typing the enemy's number + 1 drops the enemy's health by 40, sets `data-last-shot="body"` and shows "Du: N+1 · Gegner: N · 1 Schritt"; on the next turn the exact number sets `data-last-shot="bullseye"`, shows "Volltreffer!" and drops the health by 80 (or ends the round); with stored `exactHit: true`, a shot 1 away shows "Ganz knapp!", sets `data-last-shot="close"` and leaves the health unchanged; any existing assertion that assumed exact-only damage is rewritten. Then run `pnpm lint && pnpm typecheck && pnpm test && pnpm build` and make both specs pass in Chromium, WebKit and Firefox (FR-014, FR-066, FR-068, FR-071, FR-072, FR-073, FR-074)

**Checkpoint**: Free play uses the amendment 04 hit rule; guided searches (Phase 14) and progress (Phase 21) build on `shotKind`, `exactHit` and `'close'`.

---

## Phase 11b: Amendment 05 no shortcuts and clear tanks

**Goal (US1, US2, US8, [amendment 05](./amendment-05-no-shortcuts-settings-early.md))**: The child can no longer step toward the answer: the arrow keys do nothing, the −1 and +1 buttons are gone, and no number is shown while pointing on the ruler. The game records whether the child answers with the keyboard or the pointer, and keyboard input never gets a "Finde N" search. The child's tank and the enemy tank differ by color, shape and flag, a "Du" arrow points at the child's tank for 3 seconds at every round start, and each health bar sits above its tank. The pointer line of FR-073 stays as built in T192.

**Independent Test**: `pnpm test` passes, and `pnpm e2e tests/e2e/battle.spec.ts tests/e2e/range.spec.ts` passes in all three browsers: ArrowLeft and ArrowRight leave `data-selection` unchanged, and while dragging on the ruler the readout shows no number and the canvas attribute `data-preview-text` is empty.

- [X] T194 [P] [US8] Update `src/app/keyboard.test.ts`: ArrowLeft, ArrowRight, ArrowUp and ArrowDown return `null` on every screen and at every help level; the action type `nudge` no longer exists (remove it from the allowed list); in `battle` exactly these keys return an action: digits 0 to 9 (main row and numpad), `-`, Backspace, Enter, Space (only at help level 3), `h` and `H`, Escape; every other key in a list of all printable characters, F-keys, Tab, Home, End, PageUp, PageDown and Delete returns `null` (FR-061, FR-062)
- [X] T195 [P] [US2] Update `src/core/battle/battleController.test.ts`: remove every call to `nudge` (the T145 case "nudge(1) from 436 reaches 437" becomes "`selectNumber(437)` after typing 436 selects 437 and clears the typed digits"); `controller.nudge` is `undefined`; `state.inputMethod` is `null` in the first round; `typeDigit`, `typeMinus` and `backspace` set it to `'keyboard'`; `selectNumber` sets it to `'pointer'`; `confirm()` fires and sets `'keyboard'`; `confirm('pointer')` fires at the same number and sets `'pointer'`; calls ignored in `playerShot`, `enemyTurn` and `paused` do not change it; the value is kept by `startRound` and `newScene` (FR-019, FR-061, FR-076)
- [X] T196 [P] [US2] Write `src/core/math/inputMethod.test.ts`: over 2000 seeds with default settings, `generateChallenge` with `inputMethod: 'keyboard'` never returns `findNumber` and returns at least 3 other number-line kinds; with `inputMethod: 'pointer'` and with no `inputMethod`, `findNumber` appears; with `kindsAllowed: ['findNumber']` and `inputMethod: 'keyboard'` every challenge is `readPosition`, and with `'pointer'` every challenge is `findNumber`; with `inputMethod: 'keyboard'` in ranges 0 to 10, 0 to 1000, 550 to 780 and -20 to 30 every challenge passes `validateChallenge`; same seed and input give the same challenge (FR-029, FR-076)
- [X] T197 [US2] Implement the input method and remove the nudge: add `InputMethod` and `RoundState.inputMethod` to `src/core/types.ts` and `src/core/battle/round.ts` (`createRound` sets `null`); in `src/core/battle/controller.ts` remove `nudge`, set `inputMethod` in `typeDigit`, `typeMinus`, `backspace`, `selectNumber` and `confirm(method = 'keyboard')`, and keep it across `startRound` and `newScene`; in `src/core/math/generate.ts` add `inputMethod?: InputMethod` to `GenerateInput`, drop `findNumber` from the kinds when it is `'keyboard'`, and fall back to `readPosition` instead of `findNumber` for keyboard input; remove the `nudge` action from `src/app/keyboard.ts` and `src/app/useKeyboard.ts`; until `keyboard.test.ts`, `battleController.test.ts`, `inputMethod.test.ts` and `generator.property.test.ts` pass. Done when `grep -rn "nudge" src` finds nothing outside the test that asserts `nudge` is gone (FR-019, FR-029, FR-061, FR-062, FR-076)
- [X] T198 [P] [US1] Write `src/core/view/tankStyle.test.ts` for a pure `tankStyle(kind)`: the player and the enemy differ in `color`, `body` (`'rounded'` and `'angular'`) and `flag` (`'yellowStar'` and `'black'`); the player's color is blue and the enemy's red (hue checks on the hex value); the enemy's body color is darker than the player's (lower luminance); `tankStyle('decoy')` equals `tankStyle('enemy')`; `barColor` equals `color` for every kind; `YOU_MARKER_MS` is 3000 (FR-077, FR-078)
- [X] T199 [P] [US1] Write `src/app/BattleOverlay.test.tsx` (Testing Library, jsdom) with a real `BattleController` in free play: no button named "+1", "−1", "Eins mehr" or "Eins weniger" exists; no element with the class `top-bars` or `health-label` and no text "Dein Panzer" or "Gegner" exists; after `controller.selectNumber(n)` the readout shows "?" and no element contains the text of `n` except the `data-selection` attribute; after typing 4 and 2 the readout shows "42"; clicking the fire button fires and sets `state.inputMethod` to `'pointer'` (FR-019, FR-053, FR-076, FR-078)
- [X] T200 [US1] Implement the tank identity until `tankStyle.test.ts` passes: `src/core/view/tankStyle.ts` (`tankStyle`, `YOU_MARKER_MS`); `src/game/textures.ts` adds an angular enemy body texture; `src/game/TankView.ts` draws the body texture and color from `tankStyle`, an antenna with a yellow star flag on the player and a black flag on the enemy and decoys, the health bar directly above the tank in `barColor` with a dark outline and no text, and `showYouMarker(ms)`, a large bouncing arrow with the text from `battle.you` ("Du") above the player's tank; `src/game/BattleScene.ts` calls `showYouMarker(YOU_MARKER_MS)` on every new round (which covers "Neue Landschaft") and sets the canvas attribute `data-you-marker` to `on` while the arrow is shown and `off` after it, for the tests only (decision D4); add `battle.you` "Du" to `src/i18n/de.ts` (FR-070, FR-077, FR-078)
- [X] T201 [US1] Update the battle overlay and the ruler until `BattleOverlay.test.tsx` passes: `src/app/BattleOverlay.tsx` removes the −1 and +1 buttons and the corner health bars (the `data-player-health` and `data-enemy-health` attributes stay), the readout shows only typed digits (otherwise "?"), and the fire button calls `confirm('pointer')`; `src/app/styles.css` drops the `top-bars`, `health-*`, `nudge-row` and `step-button` rules; `src/game/NumberLineView.ts` removes the large number above the finger, draws the level 1 labels next to the preview marker only for a typed number (never while pointing), and sets the canvas attribute `data-preview-text` to the text drawn next to the marker ('' when none), for the tests only; `src/i18n/de.ts` drops `plusOne`, `minusOne`, `plusOneLabel`, `minusOneLabel`, `playerHealth` and `enemyHealth` when no code uses them; `src/i18n/i18n.test.ts` still passes (FR-017, FR-019, FR-053, FR-078)
- [X] T202 [US8] Update `tests/e2e/battle.spec.ts` and `tests/e2e/range.spec.ts`: remove any use of the arrow keys, −1 or +1; add to `battle.spec.ts` that after typing a number, ArrowLeft and ArrowRight leave `data-selection` unchanged; that while the mouse is held down and moved along the ruler, `data-selection` changes, the readout shows "?" and the canvas `data-preview-text` is empty, and after release and Enter the landing number appears; that no −1 or +1 button exists; and that `data-you-marker` is `on` right after the round starts and `off` after 3 seconds, and `on` again after "Neue Landschaft". Then run `pnpm lint && pnpm typecheck && pnpm test && pnpm build`, make both specs pass in Chromium, WebKit and Firefox, and check the tank identity on a muted headless Chromium screenshot (FR-019, FR-061, FR-062, FR-077, FR-078)

**Checkpoint**: No shortcut to the answer remains; the child can tell their own tank from the enemy at a glance. The parent settings phases (12 and 13) follow.

---

## Phase 12: US6 settings rules, persistence and export

**Goal (US6, P2)**: Settings apply from the next round, survive a browser restart, can be exported and imported, and the game asks for persistent storage.

**Independent Test**: `pnpm test src/core` passes, including export and import and the random-settings property test.

- [X] T103 [P] [US6] Write `src/core/storage/exportImport.test.ts`: `exportData` produces `{ app: 'math-tanks', exportedAt, settings, progress }`; `importData` of that text returns the same settings and progress; a file with the wrong `app`, broken JSON or invalid settings returns `{ ok: false, reason }` and changes nothing; a version 1 or version 2 settings file is migrated to version 3 (FR-048, FR-048a)
- [X] T104 [US6] Implement `src/core/storage/exportImport.ts` (`exportData`, `importData`, using the schemas and `migrate` from Phases 2 and 10), until `exportImport.test.ts` passes (FR-048a)
- [X] T105 [P] [US6] Add a test to `src/core/battle/battleController.test.ts`: `controller.updateSettings(newSettings)` during a round leaves the current round's range, ruler level, difficulty and challenge types unchanged and applies them at the next `startRound` (FR-049, US6 scenario 6, edge case "Settings opened mid-round")
- [X] T106 [US6] Implement `updateSettings` in `src/core/battle/controller.ts` (stores pending settings, used at the next `startRound`), until the test from T105 passes (FR-049)
- [X] T107 [P] [US6] Extend `src/core/math/generator.property.test.ts` with 200 random valid settings (built with a seeded `Rng`, kept only when `validateSettings` passes, including custom ranges with any start, range 0-20 with every combination of challenge types, and every ruler level) and 1000 seeds each; every challenge must validate and every number, operand and intermediate step must be inside the range (FR-029, SC-003, SC-013, US6 scenario 3, AC-04)
- [X] T108 [US6] Implement `src/app/persistence.ts`: calls `navigator.storage.persist()` once on first load when available, saves settings with `saveSettings(localStorageKeyValue(), s)`, and reports `resetReason` and save failures so the settings page can show them (FR-048, edge cases "Stored data is missing or damaged" and "Browser storage full or blocked")
- [X] T109 [US6] Write `tests/e2e/persistence.spec.ts`: change range to 0 to 20, enemy difficulty to "Leicht" and the ruler starting level to 3 in the settings page, save, close the page and its context after saving `storageState`, open a new context with that state, and confirm the values are shown; repeat 5 times in a loop to cover "100% of runs" (FR-048, SC-007, AC-08, US6 scenario 2). *Status after Phase 12: the spec is written; a second case that writes stored settings directly passes now in all three browsers, and the settings-page case is marked `test.fixme` until T116 removes the mark and makes it pass.*
- [X] T203 [US9] Fix overlapping labels next to the marker (bug from the product owner): at ruler level 1 on a crowded ruler (0 to 100), typing 4 drew the labels of the neighbouring minor lines 3, 4 and 5 about 14 units apart, and they ran together into "345". In `src/core/numberline/ticks.ts` rename `labelsNearPreview` to `labelTypedNumber` and add a pure `typedNumberLabels(r, selection, typed)` that returns only the typed number (none when its line already has a label, none while pointing, none on levels 2 to 5); write the test first in `src/core/numberline/ticks.test.ts`. `src/game/NumberLineView.ts` draws that one label under the marker on a small dark rounded chip. Add a check to `tests/e2e/battle.spec.ts` (typing 4 gives `data-preview-text` "4", 45 gives "45", 40 gives ""), update FR-017, US2 scenario 5, amendment 02 item 4, data-model.md, research.md and contracts/core-api.md to "otherwise only the typed number is labeled, under the marker", and check it on a muted headless screenshot at 0 to 100 typing 4 and 45. Other ruler levels do not change (FR-017, FR-019)

**Checkpoint**: Settings and progress persist and can be moved between devices.

---

## Phase 13: US6 parent gate and settings page

**Goal (US6, P2)**: A parent opens settings with a 2-second press and changes every option, with a ruler preview; a child's short tap or any key does nothing.

**Independent Test**: `pnpm test src/app` passes and `tests/e2e/persistence.spec.ts` passes in all three browsers.

- [X] T110 [P] [US6] Write `src/app/ParentGate.test.tsx` (Testing Library, jsdom, fake timers): a pointer down and up after 500 ms does not open the menu; a pointer down held for 2000 ms opens it and calls `onOpen` (which pauses the game); releasing at 1900 ms cancels; the filling ring progress is shown; with the gear focused, Enter, Space or holding any key for 3 s does not open it (FR-045, FR-062, US6 scenario 1, US8 scenario 9)
- [X] T111 [US6] Implement `src/app/ParentGate.tsx`: gear button (at least 48 px) with pointer events only, `tabIndex={-1}` and keyboard activation blocked, a filling ring and a parent menu with "Einstellungen" and "Fortschritt" ("Fortschritt" disabled with "kommt bald" until Phase 22 builds the progress page, decision D17); opening pauses the controller and closing resumes it (FR-045, FR-054, FR-062, FR-079)
- [X] T182 [P] [US6] Write `src/app/RulerPreview.test.tsx` and implement `src/app/RulerPreview.tsx`: an SVG ruler drawn from `ticksFor(range, level, 0)` and `numberToX` scaled to the preview width; for 550 to 780 at level 2 it shows labels 550, 600, 650, 700, 750, 780 and minor lines; at level 5 only the two end points; it updates when range or level props change (FR-017, FR-069)
- [X] T112 [P] [US6] Write `src/app/SettingsPage.test.tsx`: a custom range with min 50 and max 20 shows an error next to the field and disables "Speichern"; custom 550 to 780 is accepted; turning off all challenge types shows the hint that guided mode needs one type and offers free play; changing the preset from 0-100 to 0-20 clamps `addition.maxResult` to 20; the negative-results switch appears only when a custom min is below 0; a ruler starting level above the hardest level shows an error; the ruler preview shows the chosen range and starting level; the "Genau treffen" switch is off by default and saves `exactHit`; no aim-correction or label-level field exists; a reset notice appears when `resetReason` is `'invalid'`; every field of FR-046 is present, and a field whose feature is not built yet (from a list `COMING_SOON` in `src/app/comingSoon.ts`: at the time of writing addition and subtraction limits, comparison, help types, beginner assistance, speech, music, adaptive difficulty and time limit) is rendered disabled with the text "kommt bald" and keeps its stored value on save (FR-046, FR-047, FR-048, FR-069, FR-074, FR-079, US6 scenarios 4 and 5). *Status after Phase 13: on the product owner's request (amendment 06, announced), the page does not show "Genau treffen" and keeps a stored `exactHit` value on save; the round length is labeled "Gegner pro Runde" and the page accepts 3 to 20 until amendment 06 changes the schema.*
- [X] T113 [US6] Implement `src/app/SettingsPage.tsx` with every field in FR-046, grouped as Aufgaben, Zahlenraum, Plus und Minus, Zahlenstrahl (ruler starting and hardest level with `RulerPreview`), Hilfe, Gegner (with the "Genau treffen" switch and its hint), Ton, Runde; presets 0-10, 0-20, 0-50, 0-100, 0-1000 and custom min and max; validation with `validateSettings`; `withRange` on range change; fields listed in `src/app/comingSoon.ts` disabled with "kommt bald" (each later phase that builds a feature removes its entry); save via `src/app/persistence.ts` and `controller.updateSettings`, until `SettingsPage.test.tsx` passes (FR-046, FR-047, FR-049, FR-069, FR-074, FR-079)
- [X] T114 [US6] Add the data section to `src/app/SettingsPage.tsx`: "Daten sichern" downloads `exportData(...)` as `mathe-panzer-<date>.json`; "Daten laden" reads a chosen file with `importData` and shows the result; a short note explains how to add the game to the Home Screen on iPad and Android (FR-048a, edge case "Browser deletes stored data")
- [X] T115 [US6] Wire the gear into `src/app/StartScreen.tsx` and `src/app/BattleOverlay.tsx`, and add routing for the parent menu and settings page in `src/app/App.tsx`; while settings are open, `useKeyboard` sends no game actions (FR-045)
- [X] T116 [US6] Add every settings label, group name, error, hint, Home Screen note, notice and the "kommt bald" note to `src/i18n/de.ts`, then make `tests/e2e/persistence.spec.ts` pass in Chromium, WebKit and Firefox (FR-056, AC-08)

**Checkpoint**: US6 complete (AC-04, AC-08).

---

## Phase 13a: Amendment 06 one hit, hearts, score and personal best

**Goal (US1, US2, US6, US9, [amendment 06](./amendment-06-one-hit-lives.md))**: Only the exact number, under the pointer line, destroys the enemy; one hit destroys it and a new enemy appears; a shell on the tank body but not at the number shakes the enemy and shows "Ganz knapp! Triff die Linie."; the enemy has no health bar; the child has 3 hearts; the enemy fires once after every 2 shots of the child; a round ends when the hearts are gone or after the parent's number of enemies; the end screen shows the score and the time and the personal best. Built on free play; guided mode (Phase 14) uses the same rules.

**Independent Test**: `pnpm test` passes, and every spec in `tests/e2e/` passes in Chromium, WebKit and Firefox: in 550 to 780 a shot 1 away sets `data-last-shot="near"` and shows "Ganz knapp! Triff die Linie." with both numbers, the exact number sets `data-last-shot="hit"` and `data-enemies-destroyed="1"`, and with stored `roundType: 'enemyCount'` and `roundLength: 1` the end screen shows "1 Panzer getroffen in m:ss".

- [X] T204 [P] [US1] Rewrite `src/core/battle/hitRule.test.ts` for amendment 06: `shotKind(n, n, r)` is `'hit'` for every range; in 0 to 100, 31 and 32 against 30 are `'near'`, 33 is `'miss'`; in 0 to 10, 4 against 5 is `'miss'`; in 0 to 1000, 457 against 437 is `'near'` and 459 is `'miss'`; in 550 to 780, 4 away is `'near'` and 5 away is `'miss'`; `enemyHitsPlayer` is true for `hitTargetId` equal to the player's id, true for an impact 30 world units beside the player's x and false at 31; `enemyDamage` and `MAX_DAMAGE` no longer exist; delete `src/core/physics/damage.test.ts` (FR-006, FR-066)
- [X] T205 [P] [US6] Update `src/core/settings/settings.test.ts`, `src/core/storage/storage.test.ts` and `src/core/storage/exportImport.test.ts`: defaults have `version: 4`, `roundType: 'untilHearts'`, `roundLength: 5`, `showClock: false`, `showRecords: true` and no `exactHit`; `validateSettings` rejects `roundLength` 0, 21 and 2.5 and accepts 1 and 20, and rejects `roundType: 'untilHearts'` with `noDamage: true` (key `roundTypeNoDamage`); `migrate` turns a version 3 fixture into version 4 with `exactHit` gone, `roundType: 'untilHearts'` (or `'enemyCount'` when `noDamage` is true), `roundLength` 10 kept and 30 clamped to 20, `showClock: false`, `showRecords: true`, every other field unchanged, and version 0, 1 and 2 fixtures into valid version 4 objects; `loadRecords` and `saveRecords` round trip under the key `mathtanks.records.v1`, damaged data loads empty records with `resetReason: 'invalid'`; `exportData` writes `records`; `importData` returns them, gives empty records for a file without `records`, and refuses invalid records with `reason: 'invalidRecords'`; a version 3 settings file imports as version 4 (FR-046, FR-048, FR-048a, FR-082, FR-086)
- [X] T206 [P] [US1] Write `src/core/records/records.test.ts`: `recordKey` is `550-780|2|untilHearts` for that range, level and round type and differs when any of the three differs; `submitResult` on empty records with 3 enemies is a new record and stores it; then 2 is not a new record and keeps 3 as `best`; 3 again is not a new record; 4 is; 0 enemies is never a new record and stores nothing; the input records are not changed; `formatTime(0)` is `0:00`, `formatTime(372000)` is `6:12`, `formatTime(59999)` is `0:59`, `formatTime(3665000)` is `61:05` (FR-084, FR-085, FR-086)
- [X] T207 [US6] Implement settings version 4 and records storage: `src/core/settings/schema.ts`, `src/core/settings/defaults.ts` (`ROUND_LENGTH_MIN` 1, `ROUND_LENGTH_MAX` 20), `src/core/settings/validate.ts` (`roundTypeNoDamage`), `src/core/storage/migrate.ts` (version 3 to 4), `src/core/records/records.ts` (`emptyRecords`, `recordKey`, `submitResult`, `formatTime`, Zod `recordsSchema`), `src/core/storage/storage.ts` (`RECORDS_KEY`, `loadRecords`, `saveRecords`), `src/core/storage/exportImport.ts` (records in the file); remove `exactHit` everywhere; until `settings.test.ts`, `storage.test.ts`, `exportImport.test.ts` and `records.test.ts` pass (FR-046, FR-048, FR-048a, FR-082, FR-086)
- [X] T208 [P] [US1] Rewrite the free-play part of `src/core/battle/battleController.test.ts` for amendment 06: a new round has `lives: 3`, `enemiesDestroyed: 0`, `shotsSinceEnemyFire: 0`, `elapsedMs: 0`; the exact number sets `lastShot.hit`, adds 1 to `enemiesDestroyed`, moves the enemy to a new number, resets `shotsSinceEnemyFire` and returns to `aiming` with no `enemyTurn`; a shot 1 away in 0 to 100 sets `lastShot.nearMiss`, keeps the enemy and its number, and counts as a shot; the first shot that is not a hit returns to `aiming` and the second goes to `enemyTurn`; an enemy shell that hits the player removes one life and sets `lastEnemyHit`, one next to the player removes none; with `noDamage` lives never drop; three lost lives end the round with `outcome: 'heartsGone'`; with `roundType: 'enemyCount'` and `roundLength: 2` the second destroyed enemy ends the round with `'goalReached'` before any enemy shot; with `'untilHearts'` ten destroyed enemies do not end it; `elapsedMs()` follows the fake clock, stops while paused, continues after `resume`, and is frozen once the round is over; `startRound` and `newScene` reset lives, score and time; free play records no attempt. Add to `src/core/ai/enemy.test.ts`: on `easy`, over 200 seeded rounds (50 seeded terrains with 4 enemy random seeds each, so the test stays fast next to the `solveAim` timing test), fewer than half of the enemy shots satisfy `enemyHitsPlayer` (FR-006, FR-008, FR-043, FR-044, FR-066, FR-070, FR-080, FR-081, FR-082, FR-083, FR-084)
- [X] T209 [US1] Implement the amendment 06 battle rules until the tests from T204 and T208 pass: `src/core/battle/hitRule.ts` (`shotKind` with `'hit' | 'near' | 'miss'`, `enemyHitsPlayer`, `LIVES`, `ENEMY_FIRE_EVERY`); `src/core/battle/round.ts` (`applyImpact` without damage; enemy destroyed on `'hit'`; one life per enemy hit unless `noDamage`); `src/core/battle/controller.ts` (fire rhythm, new enemy after a hit, round end by `roundType`, `elapsedMs()` with pause and resume); `src/core/types.ts` (`RoundState.lives`, `enemiesDestroyed`, `shotsSinceEnemyFire`, `elapsedMs`, `lastEnemyHit`, `outcome`; `LastShot` without `bodyHit` and `bullseye`; `TankState` without `health`); remove `MAX_DAMAGE` and `damageAt` from `src/core/physics/damage.ts` and `enemyDamageFactor` from `src/core/ai/enemy.ts`; tune the easy spread in `enemy.ts` only if the T208 rate fails (FR-006, FR-008, FR-043, FR-044, FR-066, FR-080 to FR-084)
- [X] T210 [P] [US1] Write `src/app/RoundEnd.test.tsx` and update `src/app/BattleOverlay.test.tsx` and `src/app/persistence.test.ts` (Testing Library, jsdom): the end screen shows "Gut gekämpft! Noch eine Runde?" for `heartsGone` and "Super! Alle Gegner getroffen." for `goalReached`, then "9 Panzer getroffen in 6:12" (and "1 Panzer getroffen in 0:42"); with a new record "Neuer Rekord!"; otherwise "Dein Rekord: 12" in the element with the class `record` and no comparison word; with `showRecords: false` neither; no text on the end screen contains a forbidden word or "nicht geschafft"; the overlay shows a tank counter with the number of destroyed enemies and no text, a clock `m:ss` only with `showClock: true`, the status "Getroffen! Der Gegner stand bei N." after a hit and "Ganz knapp! Triff die Linie." with the compare text after a near miss, and the attributes `data-lives`, `data-enemies-destroyed`, `data-last-shot` (`hit`, `near`, `miss`) and no `data-enemy-health`; `persistence.submitResult` saves records and `exportText` contains them (FR-078, FR-083, FR-084, FR-085, FR-086)
- [X] T211 [US1] Implement the screens until the tests from T210 pass: `src/app/RoundEnd.tsx` (result, time, record, "Neuer Rekord!" with a short CSS pop and sparkle, none under `prefers-reduced-motion`); `src/app/BattleOverlay.tsx` (tank counter, optional clock refreshed once a second, hit and near-miss status, data attributes); `src/app/persistence.ts` (`records()`, `submitResult`, records in export and import); `src/app/App.tsx` (submits the result once per finished round with the round's settings snapshot, pauses the battle while the tab is hidden and resumes only what it paused); `src/i18n/de.ts` (battle `hit`, `near`, `score`, `clock`; `roundEnd.goalReached`, `heartsGone`, `result`, `newRecord`, `yourRecord`; settings labels for `roundType`, `showClock`, `showRecords`; errors `roundLength` and `roundTypeNoDamage`; remove `bullseye`, `bodyHit`, `close`, `exactHit`, `exactHitHint`); `src/app/styles.css`; `src/i18n/i18n.test.ts` still passes (FR-033, FR-056, FR-057, FR-083 to FR-086)
- [X] T212 [US1] Update the canvas: `src/game/TankView.ts` draws 3 hearts above the child's tank (full red, lost ones as an outline) and no bar on the enemy, removes `setBullseye`, and draws a small target ring where the pointer line meets the enemy tank; `src/game/BattleScene.ts` plays a large explosion when the enemy is destroyed, fades the new enemy in at its new number, shakes the enemy on a near miss and flashes the child's tank when a heart is lost; `src/game/NumberLineView.ts` shows the compare bracket after a near miss; `src/game/effects.ts` keeps the large burst for the destroyed enemy (FR-066, FR-072, FR-073, FR-078, FR-080)
- [X] T213 [P] [US6] Update `src/app/SettingsPage.test.tsx` and then `src/app/SettingsPage.tsx` and `src/app/comingSoon.ts`: the Runde group has "Rundenende" with "Bis alle Herzen weg" (default) and "Gegner pro Runde", the number of enemies (1 to 20, errors for 0 and 21) only with "Gegner pro Runde", and the switches "Uhr beim Spielen zeigen" (off) and "Rekord zeigen" (on); turning on "Ohne Schaden spielen" removes "Bis alle Herzen weg" from the choices and switches to "Gegner pro Runde"; no "Genau treffen" field exists and a saved settings object has no `exactHit`; `SETTING_FIELDS` lists `roundType`, `showClock` and `showRecords`; the page uses `ROUND_LENGTH_MIN` and `ROUND_LENGTH_MAX` from `src/core/settings/defaults.ts` (FR-044, FR-046, FR-079, FR-082, FR-084, FR-086)
- [X] T214 [US1] Update `tests/e2e/battle.spec.ts`, `tests/e2e/range.spec.ts` and `tests/e2e/persistence.spec.ts`: replace every health assertion with `data-lives` and `data-enemies-destroyed`; in 550 to 780 at level 2, a shot 1 away sets `data-last-shot="near"`, shows "Ganz knapp! Triff die Linie." and the compare text and keeps `data-enemy-number`; the exact number sets `data-last-shot="hit"`, `data-enemies-destroyed="1"` and a new `data-enemy-number`; the "Genau treffen" case is removed; with stored `roundType: 'enemyCount'` and `roundLength: 1` one exact hit ends the round and the end screen shows "1 Panzer getroffen in" a time and "Neuer Rekord!", and a second such round shows "Dein Rekord: 1"; two misses in a row lead to `enemyTurn`; the settings-page case saves and reloads `roundType`. Then run `pnpm lint && pnpm typecheck && pnpm test && pnpm build`, make every e2e spec pass in Chromium, WebKit and Firefox, and check the hearts, the tank counter and the end screen on a muted headless Chromium screenshot (FR-066, FR-072, FR-080 to FR-086, AC-01, AC-08)

**Checkpoint**: Free play follows amendment 06: one exact hit per enemy, 3 hearts, enemy fire after every 2 shots, score, time and personal best. Guided mode (Phase 14) builds on the same controller rules.

---

## Phase 14: US2 guided turn flow in the controller

**Goal (US2, P1)**: Guided mode in `BattleController`: hidden enemy, every fire is an answer, misses escalate help, the enemy fires after every 2 shots (amendment 06), an exact hit destroys the enemy, then a new search with a new hidden enemy.

**Independent Test**: The guided part of `battleController.test.ts` passes.

- [X] T060 [P] [US2] Add guided tests to `src/core/battle/battleController.test.ts`: `startRound('guided')` begins in `challenge` with `enemyFound: false`, 3 lives and score 0; `getState()` exposes no enemy coordinates while `enemyFound` is false (the enemy tank is reported with `alive` only); fires before `answerableAt` (1 s after display) are ignored; `selectNumber` and `typeDigit` change only `selection`, `entry` and `inputMethod`; with `inputMethod` `'keyboard'` (or null) no search is `findNumber`, and after a pointer answer `findNumber` can follow (FR-076); `confirm` fires at the selection and moves to `playerShot`; a first miss returns to `challenge` with `lastShot.landed` set, `help.level` 1, `help.wrongAnswers` 1 and `shotsSinceEnemyFire` 1, and no change to lives; a near miss on the body (`shotKind` `'near'`) counts the same way and sets `lastShot.nearMiss`; the second shot that is not a hit goes to `enemyTurn` and then back to `challenge` in the same search; the exact number sets `enemyFound: true`, destroys the enemy (`enemiesDestroyed + 1`), resets `shotsSinceEnemyFire` and starts a new search with a new hidden enemy at least `minEnemyGap` from the player, with no `enemyTurn` (FR-002, FR-010, FR-010a, FR-013, FR-019, FR-066, FR-075, FR-076, FR-081, SC-009, US2 scenarios 3, 7, 8, 9, edge case "Rapid tapping or typing")
- [X] T061 [P] [US2] Add miss-path tests to `src/core/battle/battleController.test.ts`: in three misses in one search the enemy fires exactly once (after the second) and help still reaches level 3; after the third miss `selection` equals the answer and `confirm` fires at it and destroys the enemy; with `roundType: 'enemyCount'` and `roundLength: 3` the round ends with `goalReached` after the third destroyed enemy; with `'untilHearts'` it ends only when the lives are gone; a guided `readPosition` search starts with the enemy visible (`enemyFound: true`) and only the exact number hits; no method or state for bonus challenges exists (FR-010a, FR-013, FR-014, FR-067, FR-081, FR-082, SC-005)
- [X] T062 [US2] Implement the guided flow in `src/core/battle/guided.ts` and wire it into `src/core/battle/controller.ts`: search challenges via `generateChallenge` with `playerPosition` from the fixed player side, the round's `rulerLevel` and `inputMethod: state.inputMethod ?? 'keyboard'` (FR-076); fire as answer with `shotKind` from `src/core/battle/hitRule.ts` (only `'hit'` ends the search; `'near'` and `'miss'` are misses); miss handling (help level and wrong answers) and the fire rhythm of Phase 13a (enemy turn after every 2 shots, back to the same search); a hit destroys the enemy, then a new hidden enemy and a new search; `answerableAt = clock() + 1000`, until the tests from T060 and T061 pass (FR-010, FR-010a, FR-013, FR-019, FR-025, FR-066, FR-075, FR-081)
- [X] T063 [US2] Implement `src/core/battle/attempt.ts`: builds an `Attempt` when a search ends with a hit or a shot at the shown solution (`solved`, `exact: true`, `helpLevel`, `wrongAnswers` = misses including near misses on the body, `responseMs` from `answerableAt`, `rangeKey` such as `550-780`, `sessionId`, `at`), with the interim `independent` and `guess` rule from D5, and calls `ProgressStore.record` between turns, never during a shot animation. Add a test in `src/core/battle/battleController.test.ts` that one attempt is recorded per finished search and none in free play, and that a near miss on the body followed by the exact number is stored with `wrongAnswers: 1` and `independent: false` (FR-035, FR-075, decisions D5 and D14)
- [X] T064 [US2] Add the round's ruler level to `src/core/battle/round.ts`: `state.rulerLevel` is `rulerLevelStart` (Phase 22 replaces this with the adaptive level), and add a test in `src/core/battle/battleController.test.ts` that settings with `rulerLevelStart: 3` give `state.rulerLevel` 3 in both modes (FR-018)

**Checkpoint**: Guided searches work in unit tests.

---

## Phase 15: US2 guided screens

**Goal (US2, P1)**: The child views the challenge, chooses a number on the ruler or by typing, fires, and views a hit or the landing number of a miss.

**Independent Test**: `pnpm e2e tests/e2e/guided.spec.ts` passes; in `pnpm dev`, range 0 to 100, number line only, the marker for 37 sits directly under battlefield position 37.

- [X] T065 [P] [US2] Write `tests/e2e/guided.spec.ts`: with `/?seed=<fixed>` and default settings, tap "Spielen", then tap the ruler once so the input method is pointer (FR-076); the challenge banner shows "Finde N" (read N from the banner, retry seeds until a `findNumber` challenge); tap the ruler at the x of a wrong number (computed from the canvas bounding box and `numberToX`), check `data-selection` and that no number is shown in the readout or at the marker (amendment 05), tap fire; `data-last-landing` shows that number, `data-phase` returns to `challenge` without passing `enemyTurn` (first shot), an encouraging message is visible; releasing on a number without firing leaves the phase at `challenge`; then tap N and fire; `data-enemies-destroyed` becomes 1 and a new search starts (FR-010, FR-013, FR-019, FR-081, FR-083, SC-009, AC-02)
- [X] T066 [US2] Update `src/game/NumberLineView.ts` for guided searches: nothing on the ruler hints at the hidden enemy; the landing marker of a miss stays with its number in large digits until the next fire; after a hit, a short pulse at the enemy's number; the free-play distance bracket is not shown in guided mode (decision D12); no pointer line while the enemy is hidden, and the pointer line appears once it is revealed (FR-073) (FR-004, FR-010, FR-013, FR-073)
- [X] T067 [US2] Update `src/game/BattleScene.ts` and `src/game/TankView.ts`: during a position search nothing is drawn at the enemy position (no marker, shadow, target ring or sound cue); on a hit the enemy fades in at its number and is destroyed with the large explosion of Phase 13a; the new enemy stays hidden for the new search; for `readPosition` it is visible from the start (FR-010, FR-066, FR-067, FR-073, US2 scenario 8)
- [X] T068 [US2] Update `src/app/BattleOverlay.tsx`: challenge banner at top center, the hit feedback of the table in contracts/ui-flows.md ("Getroffen!", and "Ganz knapp! Triff die Linie." with both numbers after a near miss; built for free play in T211), the message line for misses, and the attributes `data-challenge-answerable` and `data-help-level`; the fire button stays the only submit control (FR-010, FR-019, FR-053, FR-066, FR-068, FR-072)
- [X] T069 [US2] Add prompt strings for the seven number-line kinds to `src/i18n/de.ts` (for example `findNumber(n)` "Finde {n}", `after(n)` "Welche Zahl kommt direkt nach {n}?", `before(n)`, `stepsRight(n, k)`, `stepsLeft(n, k)`, `missingBetween(a, b)`, `midpoint(a, b)`), each at most about 8 words (FR-056, FR-057)
- [X] T070 [US2] Update `src/app/StartScreen.tsx`, `src/app/App.tsx` and `tests/e2e/battle.spec.ts`: "Spielen" and Enter or Space start guided mode; "Freies Spiel" appears next to it only when `settings.freePlay` is true; `App.tsx` reads a `?mode=free` query parameter (like `?seed=`, decision D4) so that Enter starts free play when free play is allowed, and `battle.spec.ts` uses it to stay keyboard-only. Then make `tests/e2e/guided.spec.ts` and `tests/e2e/battle.spec.ts` pass in all three browsers (FR-010, FR-014, FR-062, AC-02, AC-03)
- [X] T215 [US2] Hidden enemy stays hidden while it fires (FR-010, amendment 06): while a guided search hides the enemy, the enemy still fires after every 2 shots of the child, but its shell must not give away its position. Test first in `src/core/battle/hiddenShell.test.ts` and `src/core/battle/battleController.test.ts`: while the enemy is hidden, its shell enters from the top edge of the world at an x taken from the round seed and the enemy's shot index, within `HIDDEN_SHELL_SPREAD` of the child's tank, and falls onto the impact the enemy's aim computed; once the enemy is visible it fires from its tank as before; during a hidden search nothing in `getState()` (enemy, shell path, `lastShot.enemyNumber`, `lastShot.distance`) gives the enemy's x or number, except the challenge itself. Then implement `src/core/battle/hiddenShell.ts`, `publicState` in `src/core/battle/round.ts` (`lastShot.enemyNumber` and `distance` are null after a miss while the enemy is hidden; `LastShot.enemyNumber` becomes `number | null`) and the enemy shot in `src/core/battle/controller.ts`. Views never render `challenge.answer` or `lastShot.enemyNumber` during a search: a near miss on a hidden enemy shows "Ganz knapp!" and the landing number, with no compare text and no bracket (FR-010, FR-072, FR-073)

**Checkpoint**: US1 and US2 together form the MVP core loop.

---

## Phase 16: US3 addition and subtraction generators

**Goal (US3, P2)**: Addition and subtraction challenges whose result is the enemy position, respecting every parent limit, with step paths.

**Independent Test**: `pnpm test src/core/math` passes, including the 43 − 7 fixture.

- [X] T071 [P] [US3] Write `src/core/math/crossing.test.ts`: `crossesTen(24, 32)` is true, `crossesTen(24, 29)` false, `crossesTen(43, 36)` true; `crossesHundred(95, 103)` true (FR-022, FR-023)
- [X] T072 [P] [US3] Write `src/core/math/addition.test.ts`: over 10,000 seeds no operand exceeds `addition.maxOperand` and no result exceeds `addition.maxResult` (US3 scenario 5 with 10 and 20); with `crossTens: false` no exercise crosses a ten (24 + 8 never appears, 24 + 5 can); with `crossHundreds: false` none crosses a hundred; `steps: 2` produces `a + b + c` with every intermediate sum in range; with range 550 to 780 every operand and result stays in range or is a valid addend (FR-022, FR-025, US3 scenarios 3 and 5)
- [X] T073 [P] [US3] Write `src/core/math/subtraction.test.ts`: no subtrahend exceeds `subtraction.maxOperand`; with `negativeResults: false` no result is below 0 or below `range.min`; with a custom range -20 to 30 and `negativeResults: true` results may be negative but never below `range.min`; crossing rules hold; `steps: 2` works; the fixture seed in `src/core/math/fixtures.ts` produces 43 − 7 (FR-023, FR-025, US3 scenario 4, AC-05)
- [X] T074 [P] [US3] Write `src/core/math/stepPath.test.ts`: `stepPath` for 43 − 7 with `beginnerAssist: true` is `[43, 40, 36]`, for 24 + 8 is `[24, 30, 32]`; with `beginnerAssist: false` it is `[43, 36]` and `[24, 32]`; for two-step exercises it passes through the intermediate result (FR-024, US3 scenarios 1 and 2)
- [X] T075 [US3] Implement `src/core/math/crossing.ts` (`crossesTen`, `crossesHundred`) until `crossing.test.ts` passes
- [X] T076 [US3] Implement `src/core/math/addition.ts`: answer-first search for `a + b = answer` (and `a + b + c`) within operand, result, crossing and step limits and the current `DifficultyStep` (FR-022, FR-025)
- [X] T077 [US3] Implement `src/core/math/subtraction.ts`: answer-first search for `a - b = answer` (and `a - b - c`) within limits, plus `src/core/math/fixtures.ts` exporting the seed and settings that produce 43 − 7 (FR-023, FR-025, AC-05)
- [X] T078 [US3] Implement `src/core/math/stepPath.ts` (`stepPath(c, beginnerAssist)`) until `stepPath.test.ts` passes (FR-024)
- [X] T079 [US3] Register addition and subtraction in `src/core/math/generate.ts` and `src/core/math/validate.ts` (operand, result, crossing, step and negative-result checks), and extend `src/core/math/generator.property.test.ts` to run with addition and subtraction on. Done when all math tests pass (FR-029, SC-003, AC-04)

**Checkpoint**: Addition and subtraction exercises are generated within all parent limits.

---

## Phase 17: US3 step animation on the number line

**Goal (US3, P2)**: The child presses H or taps help on an addition or subtraction challenge and views a marker step along the ruler.

**Independent Test**: In `pnpm dev` with only subtraction on and the 43 − 7 fixture seed, press H and view the marker move 43 → 40 → 36; type 36 and press Enter; the enemy is hit.

- [X] T080 [P] [US3] Add a test to `src/core/battle/battleController.test.ts`: for an addition or subtraction challenge, `requestHelp` sets `state.stepAnimation` to `stepPath(challenge, settings.beginnerAssist)` and does not change lives, `turn` or `shotsSinceEnemyFire` (FR-024, FR-030, FR-081)
- [X] T081 [US3] Implement `requestHelp` for addition and subtraction in `src/core/battle/controller.ts` (sets `stepAnimation`; general help escalation follows in Phase 19) and add `stepAnimation: number[] | null` to `RoundState` in `src/core/types.ts` (FR-024)
- [X] T082 [US3] Add the step animation to `src/game/NumberLineView.ts`: a small tank icon moves one unit at a time along `stepAnimation`, pausing at each ten boundary when `beginnerAssist` is on, with each step counted on screen and all lines of the passed area shown (FR-018, FR-024, US3 scenarios 1 and 2, AC-05)
- [X] T083 [US3] Add addition and subtraction prompts to `src/i18n/de.ts` (for example "Der Gegner ist bei {a} − {b}"), and show the starting number highlighted on the ruler in `src/game/NumberLineView.ts` (FR-056, FR-057, AC-05)

- [X] T216 [US3] Addition limit applies only to the added numbers (FR-022, amendment 02): `addition.maxOperand` limits every operand after the first, like `subtraction.maxOperand`; the starting number can be any number in the range, so in ranges such as 550 to 780 addition is no longer skipped. Tests first in `src/core/math/addition.test.ts` (550 to 780 with `maxOperand` 10 generates exercises such as 560 + 5 and finds an addition for every allowed answer; US3 scenario 5 with range 0 to 20, `maxOperand` 10, `maxResult` 20: no added number above 10, no result above 20) and `src/core/math/generator.property.test.ts`; then `src/core/math/arithmetic.ts`, spec FR-022 and data-model.md

**Checkpoint**: US3 works on its own with only addition or subtraction enabled.

---

## Phase 18: US4 comparison with decoy tanks

**Goal (US4, P2)**: Comparison challenges with numbered decoy tanks standing at their own numbers; tapping a tank or typing its number fires at it.

**Independent Test**: With only comparison on and the 47 vs 74 fixture seed, type 74 and press Enter; the enemy is hit. Tapping 47 destroys only the decoy.

- [X] T084 [P] [US4] Write `src/core/math/comparison.test.ts`: each kind `greater`, `smaller`, `equal`, `order3`, `largest3`, `smallest3`, `closestTo`, `between` has exactly one correct answer, distinct options, all numbers inside the range, every option at least `minTankGap` from every other option and from the player tank; `order3` sets `orderAnswer` ascending and `answer` to the largest number; comparison is skipped when the range cannot fit 2 options at `minTankGap` on the side away from the player; the fixture seed produces 47 and 74 with "greater" (FR-026, FR-027, US4 scenario 6, edge case "Comparison options too close together", AC-06)
- [X] T085 [US4] Implement `src/core/math/comparison.ts` (answer-first builders for the eight kinds) and add the 47 vs 74 fixture to `src/core/math/fixtures.ts` (FR-026, FR-027)
- [X] T086 [US4] Register comparison in `src/core/math/generate.ts`; extend `src/core/math/validate.ts` (`checkAnswer` accepts a `number[]` for `order3`; gap and single-answer checks) and `src/core/math/validate.test.ts`; extend `src/core/math/generator.property.test.ts` with comparison on. Done when all math tests pass (FR-027, FR-029, SC-003)
- [X] T087 [P] [US4] Add comparison tests to `src/core/battle/battleController.test.ts`: a comparison search creates decoy `TankState`s at their own numbers with `label` set and the real enemy at the answer; `tapTank` on the correct tank fires at its number and destroys the enemy (`enemiesDestroyed + 1`, amendment 06); `tapTank` on a decoy fires at it, destroys only the decoy, does not change `enemiesDestroyed`, and counts as a miss with `help.level` 1 and `shotsSinceEnemyFire` 1; typing a tank's number and `confirm` acts like `tapTank` on it; typing another number fires at it, which is a miss (a near miss when it lands on the enemy tank's body); for `order3`, taps or typed numbers with `confirm` place badges in `orderTaps` without firing (no shot is counted), a typed number on no tank places no badge, a wrong order resets `orderTaps` and counts as a miss, and the correct third badge fires at the enemy (FR-026, FR-027, FR-064, FR-066, FR-081, FR-083, US4 scenarios 1 to 5, decision D15)
- [X] T088 [US4] Implement comparison searches in `src/core/battle/controller.ts` and `src/core/battle/round.ts` (`tapTank`, typed tank numbers in `confirm`, decoy placement and destruction, `order3` badges), until the tests from T087 pass (FR-026, FR-027, FR-064)
- [X] T089 [US4] Update `src/game/TankView.ts`: a number plate on each numbered tank, decoys drawn the same as the enemy, a tap on a tank calls `tapTank`, order badges 1, 2, 3 for `order3`, a destroy effect for a hit decoy; a pointer line from every numbered tank's center to the ruler (FR-073); tap area at least 48 by 48 CSS pixels (FR-026, FR-053, FR-073)
- [X] T090 [US4] Update `src/game/BattleScene.ts` to create and remove decoy tank views and play the destroy effect for a hit decoy (FR-027)
- [X] T091 [US4] Add comparison prompts to `src/i18n/de.ts` ("Welche Zahl ist größer?", "Welche Zahl ist kleiner?", "Welche Zahl ist gleich {n}?", "Tippe die Zahlen von klein nach groß an", "Welche Zahl ist am größten?", "Welche Zahl ist am kleinsten?", "Welche Zahl ist am nächsten an {n}?", "Welche Zahl liegt zwischen {a} und {b}?") and the hint for a typed number on no tank, and show the reference number for `equal` in `src/app/BattleOverlay.tsx` (FR-026, FR-056)
- [X] T092 [US4] Write `tests/e2e/comparison.spec.ts`: with settings stored in `localStorage` before load (only comparison on) and the fixture seed, tap the tank labeled 47 and confirm the decoy is gone, `data-enemies-destroyed` is still 0 and there is no `enemyTurn` after this first shot; then type 74 and press Enter and confirm `data-enemies-destroyed` becomes 1. Make it pass in all three browsers (AC-06)

**Checkpoint**: US4 works on its own with only comparison enabled.

---

## Phase 19: US5 help escalation logic

**Goal (US5, P2)**: Help that appears after each miss and becomes more explicit, always ending with a solution the child fires at, with no penalty; the enemy's fire still follows the every-2-shots rhythm (amendment 06).

**Independent Test**: `pnpm test src/core/battle` passes, including three misses in a row.

- [ ] T093 [P] [US5] Write `src/core/battle/help.test.ts`: `nextHelp(challenge, level, landed, settings)` returns step 1 (direction from the landing number to the answer, "right" or "left", none when `landed` is null, and the nearest major line to the answer), step 2 (the ten from `helpZoomView` and a count from the landing number to the answer, or from the nearest major line when `landed` is null; the step path for addition and subtraction), step 3 (solution) for position challenges, and the comparison variants (tens digits, ruler markers under options, correct tank or order); a help type turned off by the parent is skipped, but step 3 is always returned (FR-031, FR-032)
- [ ] T094 [US5] Implement `src/core/battle/help.ts` (`nextHelp`, `nearestMajorTick`, `directionTo`), until `help.test.ts` passes (FR-031, FR-032)
- [ ] T095 [P] [US5] Add help tests to `src/core/battle/battleController.test.ts`: each miss raises `help.level` by one and sets an encouraging message key from `encouragements`; `requestHelp` (help button or H) before firing shows the next step at once and is not counted as a shot; the third miss (or a help request at level 2) shows the solution and sets `selection` to the answer; `confirm` then fires at the solution, which destroys the enemy; a miss itself never changes lives, and over three misses the enemy fires exactly once (after the second shot, amendment 06); the recorded attempt has `helpLevel: 3`, `solved: false`, `independent: false`, `wrongAnswers: 3`; a near miss on the body raises `help.level` like a miss and sets the message "Ganz knapp! Triff die Linie."; with `timeLimitSeconds: 10`, `tick()` after 10 s shows the next help step with no penalty, and without a limit no timer exists (FR-013, FR-030, FR-031, FR-034, FR-066, FR-081, SC-005, AC-07, US5 scenarios 1 to 5 and 7)
- [ ] T096 [US5] Implement help escalation in `src/core/battle/controller.ts` (`requestHelp` for all kinds, miss-driven escalation, solution step with `selection` set to the answer, `tick()` per decision D1) and add `help.content` and `message` to `RoundState` in `src/core/types.ts`, until the tests from T095 pass (FR-013, FR-030, FR-031, FR-034)
- [ ] T097 [US5] Add help phrases to `src/i18n/de.ts` ("Versuch eine andere Stelle.", "Weiter nach rechts", "Weiter nach links", step-count texts), and extend `src/i18n/i18n.test.ts` so it also checks every text passed to `Speaker.speak` (spoken texts come only from the table) (FR-033, SC-006, US5 scenario 6)

**Checkpoint**: The help ladder is complete and tested.

---

## Phase 20: US5 help visuals and help end-to-end test

**Goal (US5, P2)**: The child views each help step on the ruler or the tanks and fires at the solution with one tap or Enter.

**Independent Test**: `pnpm e2e tests/e2e/help.spec.ts` passes.

- [ ] T098 [P] [US5] Write `tests/e2e/help.spec.ts`: in a guided search, type and fire three wrong numbers; after each, the landing number and an encouraging message are visible and contain no forbidden word; `data-phase` passes `enemyTurn` only after the second shot; after the first, the direction text is shown; after the third, the solution is shown; one press of Enter fires at it and `data-enemies-destroyed` rises; a miss alone never lowers `data-lives` (only an enemy hit does); press H in a new search and confirm `data-help-level` rises and `data-shots-since-enemy-fire` does not (AC-07, SC-005, SC-006, FR-062, FR-081)
- [ ] T099 [US5] Add help visuals to `src/game/NumberLineView.ts`: step 1 a direction arrow from the landing marker and a pulsing highlight on the nearest major line; step 2 `showZoom(helpZoomView(...))` with all lines shown whatever the ruler level, and numbers popping up one by one from the landing number to the answer; step 3 a marker animated to the solution with the number shown large (FR-018, FR-031, US5 scenarios 1 to 3, US9 scenario 6)
- [ ] T100 [US5] Add comparison help visuals to `src/game/TankView.ts` (highlight tens digits on every plate) and `src/game/NumberLineView.ts` (markers under each option's number), and show the correct tank or order at step 3 (FR-031)
- [ ] T101 [US5] Update `src/app/BattleOverlay.tsx`: a help button visible during every challenge, the encouraging message line, the direction text, a label on the fire button at step 3 ("Feuer auf {n}"), and a time-limit indicator only when the parent set a limit; call `controller.tick()` once a second while a challenge is shown (FR-030, FR-031, FR-034)
- [ ] T102 [US5] Update `src/audio/sfx.ts` and its callers so a miss plays only the same soft boom as every explosion, never an extra or negative sound, and a hit plays the soft chime; then make `tests/e2e/help.spec.ts` pass in all three browsers (FR-009, AC-07)

**Checkpoint**: US5 complete (AC-07).

---

## Phase 21: US7 attempt classification, adaptive ladders and mastery

**Goal (US7, P3)**: Engine-free progression logic: guess detection, difficulty ladders including the ruler level, adaptive steps within parent limits, mastery and sessions.

**Independent Test**: `pnpm test src/core/progress` passes.

- [ ] T117 [P] [US7] Write `src/core/progress/classify.test.ts`: a hit with `responseMs` 1400 is a guess, 1500 is not; a hit after 3 misses within 5000 ms before the hit is a guess, after 3 misses spread over 6000 ms is not; `independent` is true only for the exact number on the first shot with help level 0; a hit after a near miss on the body is `'assisted'` (the near miss is a miss, amendment 06); a hit after help is `'assisted'`; outcome is `'independent'`, `'assisted'` or `'unsolved'`, never `'close'` (FR-038, FR-075)
- [ ] T118 [P] [US7] Write `src/core/progress/adaptive.test.ts`: each skill starts at step 0; 5 independent of the last 6 non-guess outcomes raise the step by one and clear `recent`; 3 assisted or unsolved of the last 5 lower it by one, never below 0; the step never passes the top of the ladder or a parent limit (for example `addition.maxOperand` 10 caps the ladder's `maxOperand`, and the `positions` ladder's ruler level stays within `rulerLevelStart` and `rulerLevelMax`); equal start and hardest levels lock the ruler level; guesses never enter `recent`; a stored `'close'` from before amendment 06 counts neither toward raising nor toward lowering; with `adaptive: false` `effectiveStep` returns the top step clamped by settings and the ruler level `rulerLevelStart` (FR-018, FR-037, FR-075, US7 scenarios 1, 2 and 6, AC-09)
- [ ] T119 [P] [US7] Write `src/core/progress/mastery.test.ts`: `skillStatus` is `'mastered'` only with `independentCorrect >= 10`, a full `masteryWindow` of 10 and at least 8 `'independent'`; a step change does not clear `masteryWindow`; a skill whose correct answers all needed help is never mastered; a stored `'close'` never counts toward mastery (FR-039, FR-075, US7 scenario 4)
- [ ] T120 [P] [US7] Write `src/core/progress/session.test.ts`: `startOrContinueSession` starts a new session on game load, after more than 30 minutes since `lastActiveAt`, and on a new calendar day; otherwise updates `lastActiveAt` (Key Entities "Session")
- [ ] T121 [US7] Implement `src/core/progress/classify.ts` (`classifyAttempt`), until `classify.test.ts` passes (FR-038, FR-075)
- [ ] T122 [US7] Implement `src/core/progress/ladders.ts`: a fixed ordered `DifficultyStep[]` per skill (for example `positions`: 0.2, 0.5, 1 of the range with ruler levels 1 to 5; `addition`: small operands without crossing, then larger, then crossing tens), and `effectiveStep(p, skill, rangeKey, settings)` clamping every field by the parent settings; only the `positions` ladder sets `rulerLevel`, clamped to `[rulerLevelStart, rulerLevelMax]` (FR-018, FR-036, FR-037)
- [ ] T123 [US7] Implement `src/core/progress/adaptive.ts` (`recordAttempt` updating `SkillProgress` for the main skill and further skills: counters, `recent` max 6, `masteryWindow` max 10, step changes per FR-037), until `adaptive.test.ts` passes (FR-035, FR-036, FR-037, FR-075)
- [ ] T124 [US7] Implement `src/core/progress/mastery.ts` (`skillStatus`), until `mastery.test.ts` passes (FR-039)
- [ ] T125 [US7] Implement `src/core/progress/session.ts` (`startOrContinueSession`), until `session.test.ts` passes
- [ ] T126 [US7] Add a test and the code in `src/core/progress/adaptive.test.ts` and `src/core/progress/adaptive.ts` that `recordAttempt` keeps only the newest 2000 attempts while session summaries keep the totals of older ones (research R11)

**Checkpoint**: Progression logic is complete and tested (AC-09).

---

## Phase 22: US7 adaptive play and progress page

**Goal (US7, P3)**: Challenges and the ruler level follow each skill's step, attempts are classified and saved, and a parent views progress.

**Independent Test**: `pnpm test` passes; in `pnpm dev`, open the parent menu and view per-skill counts after playing a few searches.

- [ ] T127 [P] [US7] Write `src/core/progress/summarize.test.ts`: `summarize(p, records)` returns per skill and range the attempts, independent correct, with help, current step and status; the skills sorted by help needed; a session list with date, attempts, independent correct and with help; and the personal bests from `records` per range, ruler starting level and round type with their time (FR-040, FR-087, US7 scenarios 5 and 8)
- [ ] T128 [US7] Implement `src/core/progress/summarize.ts` (`summarize`, including the personal bests), until `summarize.test.ts` passes (FR-040, FR-087)
- [ ] T129 [P] [US7] Add tests to `src/core/battle/battleController.test.ts`: with `adaptive: true` and a skill at step 0, generated challenges use step 0 limits; after 5 independent attempts the next challenge in that skill uses step 1; attempts use `classifyAttempt` (a hit 1 s after answerable is stored with `guess: true`); `state.rulerLevel` follows the `positions` skill only and stays within the parent's two limits (FR-018, FR-035, FR-037, FR-038, AC-09)
- [ ] T130 [US7] Update `src/core/battle/controller.ts`, `src/core/battle/round.ts` and `src/core/battle/attempt.ts`: pass `skillSteps` from `effectiveStep` and the adaptive `rulerLevel` to `generateChallenge`, classify attempts with `classifyAttempt` (replacing D5), start or continue the session, until the tests from T129 pass (FR-018, FR-035, FR-037, FR-038)
- [ ] T131 [US7] Implement `src/core/storage/progressStore.ts`: a `ProgressStore` that applies `recordAttempt` and saves with `saveProgress` after each attempt, between turns; use it in `src/app/App.tsx` (FR-035, FR-048)
- [ ] T132 [P] [US7] Write `src/app/ProgressPage.test.tsx`: renders counts from a fixture `Progress`; "with help" is shown separately from accuracy; a skill with only assisted answers shows "noch am Üben" (developing); the personal bests are listed per range with "Bis alle Herzen weg" or "Gegner pro Runde", the starting level, the number of enemies and the time, with no ranking; reset asks for confirmation and only then clears progress (FR-040, FR-087, US7 scenarios 4, 5 and 8)
- [ ] T133 [US7] Implement `src/app/ProgressPage.tsx` (per-skill table, most-help skills, session list, personal bests per range from `persistence.records()`, reset with confirmation), link it from the parent menu in `src/app/ParentGate.tsx`, and add its strings to `src/i18n/de.ts`, until `ProgressPage.test.tsx` passes (FR-040, FR-087, FR-056)

**Checkpoint**: US7 complete (AC-09).

---

## Phase 23: US8 offline play, pause, fullscreen, speech, touch and keyboard

**Goal (US8, P3)**: The game works offline after one load, on tablets with touch, with the keyboard alone, with pause, fullscreen and spoken challenges.

**Independent Test**: `pnpm e2e` passes for offline, no-external-requests, touch and keyboard specs.

- [ ] T134 [P] [US8] Write `tests/e2e/offline.spec.ts`: load `/` against the production build, wait until the service worker controls the page, set the context offline, reload, press Enter to start and play until `data-phase="roundOver"` (shorten with stored settings `roundType: 'enemyCount'` and `roundLength: 3`, reading the answer of each `findNumber` search from the banner). Must pass in Chromium; see D6 for WebKit and Firefox (FR-051, SC-008, AC-10, US8 scenario 1)
- [ ] T135 [P] [US8] Write `tests/e2e/no-external-requests.spec.ts`: record every request during load and one full round; fail on any request whose origin differs from `baseURL` (FR-052)
- [ ] T136 [P] [US8] Write `tests/e2e/touch.spec.ts` with `hasTouch: true` and viewports 1024 by 768, 768 by 1024 and 768 by 600: every visible button and the ruler have a bounding box of at least 48 by 48 CSS pixels and do not overlap; tap the ruler and the fire button by touch, and check that no −1 or +1 button exists (amendment 05); no on-screen keyboard field is focused; the ruler marker for a chosen number lines up with the battlefield x within half a unit (FR-053, FR-058, SC-004, US8 scenarios 2 and 5)
- [ ] T183 [P] [US8] Write `tests/e2e/keyboard.spec.ts` using only `page.keyboard` (no click, tap or mouse call, checked by a helper that fails on any pointer event reaching the page): load `/?seed=<fixed>` and press Enter without clicking; in a `findNumber` search type a wrong number and Enter; press H and check `data-help-level`; fire two more wrong numbers; at the solution press Enter and confirm the hit; type 150 in range 0 to 100 and press Enter, nothing fires and the range hint shows; press Escape to pause and again to resume; in a comparison search (stored settings, fixture seed) type 74 and Enter; in an `order3` search type the three numbers with Enter after each; play to the round end and press Enter for a new round; hold Enter with the gear focused by script and confirm settings never open; the arrow keys change nothing, and with typed answers no search is "Finde N" (amendment 05). Run in Chromium, WebKit and Firefox (FR-059 to FR-064, FR-076, SC-011, US8 scenarios 6 to 10)
- [ ] T137 [P] [US8] Write `src/audio/speaker.test.ts` with a mocked `speechSynthesis`: `available` is false when the API or a German voice is missing; `speak` uses `lang: 'de-DE'` and cancels earlier speech; `prime()` speaks a short greeting (FR-055, edge case "Speech not available")
- [ ] T138 [US8] Implement `src/audio/speaker.ts` (`createSpeaker()` implementing the `Speaker` port), call `prime()` and resume Web Audio from the "Spielen" tap or the starting Enter key in `src/app/StartScreen.tsx`, speak each new challenge when `settings.sound.speech` is on, and show a speaker icon in `src/app/BattleOverlay.tsx` only when `available` (FR-055, US8 scenario 4)
- [ ] T139 [US8] Implement the PWA registration in `src/app/swUpdate.ts` and `src/main.tsx` using `virtual:pwa-register` with `registerType: 'prompt'`: when a new version is waiting, apply it only while the start screen is shown, never during a round. Then make `tests/e2e/offline.spec.ts` pass (FR-051, FR-051a, research R12)
- [ ] T140 [US8] Add pause and resume to `src/app/BattleOverlay.tsx` (pause button at top left, a resume screen; Escape pauses and resumes through `useKeyboard`, Enter and Space resume) and to `src/game/BattleScene.ts` (pause tweens, particles and path replay on `paused`, continue on resume from the same point) (FR-054, FR-062, US8 scenarios 3 and 9)
- [ ] T141 [US8] Add a fullscreen button to `src/app/StartScreen.tsx` and `src/app/BattleOverlay.tsx` using the Fullscreen API on the app root; hide it where the API is missing; after leaving fullscreen, focus returns to the app root (FR-054, FR-059, US8 scenario 5)
- [ ] T142 [US8] Add an optional generated music loop to `src/audio/sfx.ts`, played only when `settings.sound.music` is on (default off), and make `tests/e2e/touch.spec.ts`, `tests/e2e/keyboard.spec.ts` and `tests/e2e/no-external-requests.spec.ts` pass in all three browsers (FR-009, FR-052, SC-011, AC-10)

**Checkpoint**: US8 complete (AC-10).

---

## Phase 24: Polish and cross-cutting checks

**Purpose**: Performance, text rules, browser coverage and a final run of every validation scenario.

- [ ] T150 [P] Write `tests/e2e/performance.spec.ts` (Chromium): the battlefield appears within 3 seconds of pressing Enter on the start screen; during a shot the frame rate measured with `requestAnimationFrame` timestamps averages at least 55 frames per second on desktop (SC-001, SC-002)
- [ ] T151 [P] Write `src/i18n/noHardcodedText.test.ts`: scans `src/app/**/*.tsx` and `src/game/**/*.ts` for German string literals (letters ä, ö, ü, ß or words from a short list such as "Spielen", "Nochmal") outside `src/i18n/`, and fails when it finds one (FR-056)
- [ ] T152 [P] Extend `src/i18n/i18n.test.ts`: every child-facing message key (banner, feedback, help, round end, range hint) has at most about 8 words, checked as at most 9 words with an allowlist for prompts that need the numbers (FR-057)
- [ ] T153 Accessibility pass on `src/app/*.tsx`: every icon-only button (gear, help, speaker, pause, fullscreen, new scene, fire) gets a German `aria-label` from `src/i18n/de.ts`; focus is visible on the app root; the readout of typed digits is announced with `aria-live="polite"` (it shows no number while pointing, amendment 05); no text below 18 px on child screens (FR-053, FR-057, FR-059)
- [ ] T154 Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e` and fix every failure. Done when all pass in Chromium, WebKit and Firefox, and `grep -rni "setAim\|aimCorrection\|charged\|labelLevel\|selectInterval\|nudge" src tests` finds nothing (FR-050)
- [ ] T155 Walk through every scenario in `specs/001-math-tanks/quickstart.md` (1 to 21) against `pnpm preview`, including scenario 12 on a tablet or with touch emulation at 1024 by 768, scenario 13 with the keyboard only, and the offline check on a real iPad in Safari for D6. Record any failure as a new task in this file (AC-01 to AC-10, SC-008, SC-010 noted as an evaluation goal for parents and testers, not automated)

---

## Dependencies and Execution Order

### Phase dependencies

- **Phase 1 Setup**: no dependencies.
- **Phase 2 Foundational**: depends on Phase 1. Blocks every user story.
- **Phases 3 to 6 (US1)**: done; the angle and power parts are reworked in Phases 8 and 9.
- **Phase 7 (US2 generators)**: done; label levels are reworked in Phase 10.
- **Phase 8 (amendment 01, core)**: depends on Phases 4 and 7. Blocks every later phase.
- **Phase 9 (amendment 01, view and keyboard)**: depends on Phase 8.
- **Phase 10 (amendment 02, ruler, settings, challenge kinds)**: depends on Phase 8; can run in parallel with Phase 9 except for `src/i18n/de.ts` (run T179 after T172).
- **Phase 11 (US9, P2)**: depends on Phases 9 and 10.
- **Phase 11a (amendment 04)**: depends on Phase 11. Blocks Phases 11b, 12 to 15, 18, 19 and 21, which use `shotKind` (`exactHit` and `'close'` were removed again by Phase 13a).
- **Phase 11b (amendment 05)**: depends on Phase 11a. Blocks every later phase that touches keyboard input, the battle overlay, the ruler view or the tank view.
- **Phases 12 and 13 (US6, moved before guided mode by amendment 05)**: Phase 12 depends on Phases 10 and 11b; Phase 13 depends on Phases 9 and 12.
- **Phase 13a (amendment 06)**: depends on Phase 13. Blocks Phases 14 to 23, which use the one-hit rule, the hearts, the fire rhythm and settings version 4.
- **Phases 14 and 15 (US2)**: Phase 14 depends on Phases 8, 10 and 11b; Phase 15 depends on Phases 9, 11 and 14.
- **Phases 16 and 17 (US3)**: Phase 16 depends on Phase 10. Phase 17 depends on Phases 15 and 16.
- **Phase 18 (US4)**: depends on Phases 10 and 15.
- **Phases 19 and 20 (US5)**: depend on Phase 15; Phase 20 needs Phase 11 (`showZoom`); comparison help needs Phase 18; step-path help needs Phase 17.
- **Phases 21 and 22 (US7)**: Phase 21 depends on Phase 10 (ruler level settings). Phase 22 depends on Phases 13, 14 and 21.
- **Phase 23 (US8)**: depends on Phase 15; the keyboard spec T183 needs Phases 18 and 20; speech needs Phase 9.
- Each later phase that builds a feature with a setting removes that setting from `src/app/comingSoon.ts` (FR-079), so the settings page enables it.
- **Phase 24 Polish**: depends on all earlier phases.

### User story dependencies

- US1 (P1): none beyond Foundational; reworked by amendment 01 in Phases 8 and 9.
- US2 (P1): uses the reworked US1 controller, the ruler from Phase 10 and the battle scene.
- US9 (P2, raised by amendment 02): uses the reworked US1 and the amendment 02 core; runs before the other P2 stories.
- US3, US4 (P2): use the US2 generator and number-line view.
- US5 (P2): uses US2 and the US9 zoom view; full coverage needs US3 and US4.
- US6 (P2): uses US1 screens and the version 3 settings; independent of US2 to US5; built before US2's guided mode by amendment 05.
- US7 (P3): core logic independent; integration needs US2 and US6.
- US8 (P3): needs a playable guided game (US2); the keyboard spec needs US4 and US5.

### Within each phase

- Test tasks first, and they must fail before implementation.
- Types and pure functions before the controller, the controller before views, views before end-to-end tests pass.

## Parallel Execution Examples

- **Phase 8**: T156, T157, T158, T159 together; then T160, T161, T162; then T163.
- **Phase 9**: T165 and T166 together; then T167 to T171; T172 last.
- **Phase 10**: T173, T175, T177 together; then T174, T176, T178.
- **Phase 11**: T180, T143, T145 together.
- **Phase 11a**: T186, T188, T190, T191 together; then T187, T189, T181; then T192; T193 last.
- **Phase 11b**: T194, T195, T196, T198, T199 together; then T197; then T200 and T201; T202 last.
- **Phase 13a**: T204, T205, T206, T208, T210, T213 together; then T207 and T209; then T211 and T212; T214 last.
- **Phase 16 (US3)**: T071, T072, T073, T074 together.
- **Phase 21 (US7)**: T117, T118, T119, T120 together; Phase 21 as a whole can run in parallel with Phases 11 to 20.
- **Phase 23 (US8)**: T134, T135, T136, T183, T137 together.
- **Across phases**: Phase 10 alongside Phase 9; Phase 21 alongside anything after Phase 10.

## Implementation Strategy

### MVP first (US1 and US2, under amendments 01 to 06)

1. Phases 1 to 7 (done).
2. Phases 8 and 9. Stop and validate: free play works by choosing numbers, with mouse, touch or keyboard alone (AC-01).
3. Phase 10, then Phase 11 (US9), Phase 11a (amendment 04) and Phase 11b (amendment 05). Stop and validate: range 550 to 780 plays in free play with the ruler levels; no stepping shortcut; the child's tank is easy to tell apart.
4. Phases 12 and 13 (US6, moved forward by amendment 05), then Phase 13a (amendment 06). Stop and validate: the product owner configures the game through the parent gate (AC-04, AC-08); one exact hit destroys the enemy, the child has 3 hearts, and the end screen shows the score, the time and the personal best.
5. Phases 14 and 15 (US2). Stop and validate: guided searches on the ruler (AC-02, AC-03). This is the MVP core loop.

### Incremental delivery

6. US3 (Phases 16, 17), US4 (Phase 18), US5 (Phases 19, 20): each adds one PRD acceptance criterion (AC-05, AC-06, AC-07).
7. US7 (Phases 21, 22) and US8 (Phase 23): AC-09, AC-10 and the keyboard-only check (SC-011).
8. Phase 24.

---

## Coverage: requirements and acceptance criteria to tasks

Removed requirements have no tasks. Amendment 05 removed the arrow-key and ±1 parts of FR-019, FR-020 and FR-061; the done tasks that built them (T145, T146, T166, T167, T170) were reworked by T194 to T197 and T201. Tasks in Phases 3 to 7 that named them (T020, T021, T024, T025, T032) are done and were reworked by T158, T159 and T162.

| ID | Tasks |
|----|-------|
| FR-001 | T018, T022, T032, T035, T036, T043, T165 |
| FR-002 | T032, T034, T041, T043, T060, T158, T163, T165, T208, T209 |
| FR-003 | T032, T041, T043, T047, T158, T163, T165, T169, T170 |
| FR-004 | T019, T023, T032, T039, T041, T043, T066, T156, T158, T160, T165, T168 |
| FR-005 | T018, T022, T032, T037, T043, T158, T165 |
| FR-006 | T020, T024, T032, T038, T043, T158, T159, T162, T165, T181, T186, T204, T208, T209 |
| FR-007 | T018, T022, T032, T038, T043, T158, T165 |
| FR-008 | T032, T034, T043, T048, T158, T165, T208, T209, T214 |
| FR-009 | T040, T042, T102, T142 |
| FR-010 | T060, T062, T065, T066, T067, T068, T070 |
| FR-010a | T030, T060, T061, T062 |
| FR-011 | Removed by amendment 01 |
| FR-012 | Removed by amendment 01 |
| FR-013 | T060, T061, T062, T065, T066, T095, T096, T208 |
| FR-014 | T061, T070, T149, T158, T163, T168, T178, T180, T181, T190, T193, T214 |
| FR-015 | T028, T029, T168, T184 |
| FR-016 | T051, T052, T147, T149, T173, T174 |
| FR-017 | T051, T052, T147, T173, T174, T182, T201 |
| FR-018 | T064, T082, T099, T118, T122, T129, T130, T143, T147, T173, T175 |
| FR-019 | T060, T062, T065, T068, T168, T170, T195, T197, T199, T201, T202 |
| FR-020 | T143, T144, T145, T146, T147 |
| FR-021 | T053, T057, T059, T177, T178 |
| FR-022 | T071, T072, T076 |
| FR-023 | T071, T073, T077 |
| FR-024 | T074, T078, T080, T081, T082 |
| FR-025 | T057, T059, T062, T072, T073, T076, T077 |
| FR-026 | T084, T085, T087, T088, T089, T091 |
| FR-027 | T030, T031, T084, T085, T086, T087, T088, T090 |
| FR-028 | T002, T004, T008, T009, T053, T059, T164 |
| FR-029 | T054, T055, T058, T059, T079, T086, T107, T148, T178, T196, T197 |
| FR-030 | T080, T095, T096, T101 |
| FR-031 | T093, T094, T095, T096, T099, T100, T101, T143 |
| FR-032 | T093, T094 |
| FR-033 | T014, T015, T049, T097, T172 |
| FR-034 | T095, T096, T101 |
| FR-035 | T010, T063, T123, T129, T130, T131 |
| FR-036 | T010, T056, T122, T123 |
| FR-037 | T118, T122, T123, T129, T130 |
| FR-038 | T117, T121, T129, T130 |
| FR-039 | T119, T124 |
| FR-040 | T127, T128, T132, T133 |
| FR-041 | T026, T027 |
| FR-042 | T026, T027, T034 |
| FR-043 | T026, T027, T032, T208, T209 |
| FR-044 | T032, T208, T209, T213 |
| FR-045 | T110, T111, T115, T166 |
| FR-046 | T011, T012, T112, T113, T175, T176, T188, T189, T205, T207, T213 |
| FR-047 | T011, T013, T112, T113, T175, T176 |
| FR-048 | T016, T017, T103, T108, T109, T112, T131, T175, T176, T205, T207 |
| FR-048a | T103, T104, T114, T205, T207, T210, T211 |
| FR-049 | T034, T105, T106, T113 |
| FR-050 | T001, T003, T005, T045, T154 |
| FR-051 | T003, T134, T139 |
| FR-051a | T139 |
| FR-052 | T006, T135, T142 |
| FR-053 | T046, T047, T050, T068, T089, T136, T147, T153, T168, T170, T199, T201 |
| FR-054 | T032, T041, T111, T140, T141 |
| FR-055 | T137, T138 |
| FR-056 | T006, T015, T049, T069, T083, T091, T116, T133, T151, T172, T179 |
| FR-057 | T014, T049, T069, T083, T152, T153, T172, T179 |
| FR-058 | T029, T035, T050, T136, T184 |
| FR-059 | T141, T153, T163, T165, T166, T167, T171, T183 |
| FR-060 | T145, T146, T157, T161, T163, T165, T166, T167, T183 |
| FR-061 | T158, T163, T165, T166, T167, T183, T194, T195, T197, T202 |
| FR-062 | T070, T098, T110, T111, T140, T165, T166, T167, T171, T183, T194, T197, T202 |
| FR-063 | T157, T158, T161, T170, T183 |
| FR-064 | T087, T088, T145, T146, T183 |
| FR-065 | T156, T160, T163, T169 |
| FR-066 | T060, T062, T067, T158, T162, T163, T165, T169, T181, T186, T187, T190, T192, T193, T204, T208, T209, T212, T214 |
| FR-067 | T061, T067, T148, T149, T177, T178, T180, T181 |
| FR-068 | T068, T173, T177, T178, T179, T180, T181, T187, T190, T193, T214 |
| FR-069 | T112, T113, T182 |
| FR-070 | T185, T200, T208 |
| FR-071 | Removed by amendment 06 (built in T186 to T193, removed in T204, T209, T211, T214) |
| FR-072 | T068, T191, T192, T193, T210, T212, T214 |
| FR-073 | T066, T089, T192, T193, T212 |
| FR-074 | Removed by amendment 06 (built in T186 to T193, removed in T205, T207, T213, T214) |
| FR-075 | T060, T062, T063, T117, T118, T119, T121, T123, T188, T189, T205 |
| FR-076 | T060, T062, T065, T183, T195, T196, T197, T199 |
| FR-077 | T198, T200, T202 |
| FR-078 | T198, T199, T200, T201, T202, T210, T212 |
| FR-079 | T111, T112, T113, T116, T213 |
| FR-080 | T208, T209, T212, T214 |
| FR-081 | T060, T061, T062, T087, T095, T098, T208, T209, T214 |
| FR-082 | T061, T205, T207, T208, T209, T213, T214 |
| FR-083 | T208, T209, T210, T211, T214 |
| FR-084 | T206, T208, T209, T210, T211, T213, T214 |
| FR-085 | T206, T210, T211, T214 |
| FR-086 | T205, T206, T207, T210, T211, T213, T214 |
| FR-087 | T127, T128, T132, T133 |
| SC-001 | T043, T046, T150, T165 |
| SC-002 | T150 |
| SC-003 | T055, T059, T079, T086, T107, T148 |
| SC-004 | T028, T136 |
| SC-005 | T061, T095, T098, T208 |
| SC-006 | T014, T097, T098 |
| SC-007 | T016, T109 |
| SC-008 | T134, T155 |
| SC-009 | T060, T065 |
| SC-010 | T155 (evaluation goal, not automated) |
| SC-011 | T142, T183 |
| SC-012 | T156, T158 |
| SC-013 | T107, T148 |
| AC-01 | T043, T050, T155, T165, T172, T214 |
| AC-02 | T028, T065, T070, T155 |
| AC-03 | T051, T070, T155, T173 |
| AC-04 | T055, T079, T107, T155 |
| AC-05 | T073, T077, T082, T083, T155 |
| AC-06 | T084, T092, T155 |
| AC-07 | T095, T098, T102, T155 |
| AC-08 | T109, T116, T155, T214 |
| AC-09 | T118, T129, T155 |
| AC-10 | T134, T142, T155 |
