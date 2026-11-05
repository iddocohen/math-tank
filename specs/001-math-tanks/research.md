# Research: Math Tanks

All decisions below resolve the Technical Context of [plan.md](./plan.md). R6, R7, R8, R19 and R20 were changed, and R21 to R23 added, for [amendment 01](./amendment-01-number-aiming.md) and [amendment 02](./amendment-02-ruler-ranges-and-detail.md). Package versions were read from the npm registry on 2026-11-05.

## R1. Language and build tool

- **Decision**: TypeScript 6.0 (strict mode) with Vite 8 and pnpm. TypeScript 7.0 is the newest release, but `typescript-eslint` 8.72 supports only TypeScript below 6.1 (checked 2026-11-05), so the project pins `typescript@~6.0.3`.
- **Rationale**: The PRD prefers TypeScript and Vite. Strict typing protects the mathematics logic, which must be deterministic and testable. Vite builds a static site that needs no server (FR-050).
- **Alternatives considered**: plain JavaScript (rejected: weaker guarantees for generator constraints); webpack (rejected: slower, no benefit here).

## R2. Game engine

- **Decision**: Phaser 4.2 for rendering, input, tweens, particles, audio and scaling. Terrain, ballistics, damage, enemy aiming and turn order are written as engine-free TypeScript modules in `src/core/`; Phaser only draws their state.
- **Rationale**: The PRD prefers "Phaser 3 or an equivalent mature 2D game engine". Phaser 4 is the current maintained major version of Phaser, with the same scene, game object and input model as Phaser 3. Keeping physics outside Phaser makes it deterministic and unit-testable (FR-028), and avoids fighting the engine's rigid-body physics for a heightmap terrain.
- **Alternatives considered**: Phaser 3.90 (works, but in maintenance only); PixiJS (rendering only, would need custom input, tweens and audio); raw Canvas 2D (smallest bundle, but more custom code for scaling, input and particles); Matter.js physics (rejected: non-deterministic across frame rates and unnecessary for one projectile at a time).

## R3. Menus, settings and progress page

- **Decision**: React 19 for the start screen, the in-battle overlay (challenge text, help button, pause, fullscreen, speaker icon), the parent gate, the settings page and the progress page. The Phaser canvas sits under the React overlay.
- **Rationale**: The PRD prefers React for menus, settings and dashboard. Forms and lists are simpler in React than in a canvas.
- **Alternatives considered**: everything in Phaser (rejected: forms and accessibility are much harder in a canvas).

## R4. Communication between React and Phaser

- **Decision**: A single engine-free `BattleController` (in `src/core/battle/`) holds the round state as a pure state machine. Both React and Phaser subscribe to it. React reads it with `useSyncExternalStore`; Phaser scenes subscribe in `create()` and unsubscribe on shutdown. User actions from either side call controller methods.
- **Rationale**: One source of truth, testable without a browser, and no extra state library.
- **Alternatives considered**: Zustand or Redux (rejected: extra dependency for one store); Phaser's event emitter as the bus (rejected: ties state to the engine).

## R5. Terrain model

- **Decision**: A heightmap: one surface height per horizontal pixel column of a fixed logical world (1600 by 900 logical units). Explosions lower the heightmap inside a circle; the result is clamped to a floor of 40 units. Terrain is generated from a seeded sum of 3 to 4 sine waves with random phases and amplitudes, then smoothed. The renderer redraws the terrain as a filled polygon after each explosion.
- **Rationale**: Side-view artillery games without overhangs only need a heightmap. It is simple, deterministic and fast to update. Circular craters in a heightmap are acceptable visually and avoid floating ground.
- **Alternatives considered**: bitmap mask terrain (allows overhangs, but needs falling-sand settling and is harder to test); polygon clipping (complex).

## R6. Ballistics

- **Decision**: Fixed-step simulation at 120 steps per second with constant gravity and no wind in this release. `simulateShot(angle, power, start, terrain)` returns the full path and the impact point. The renderer replays the path over time. Enemy aiming (R18) and the player's automatic arc (R21) use the same function. Since amendment 01 the player never sets angle or power.
- **Rationale**: Fixed steps give identical results on every device and frame rate, which tests can check. Replaying a precomputed path keeps animation smooth.
- **Alternatives considered**: closed-form parabola (cannot detect terrain hits along the path without sampling anyway); wind (adds difficulty unrelated to the learning goal; deferred).

## R7. Mapping between numbers and battlefield

- **Decision**: The playable width of the world (from 80 to 1520 logical units) maps linearly to the configured range `[min, max]`. `numberToX(n) = left + (n - min) / (max - min) * width`. The number line is drawn in the same logical world, under the battlefield, using the same function, so alignment holds at every screen size because Phaser scales the whole world. The same function works for any start, such as 550 to 780 (amendment 02). There is no two-step selection: for wide ranges the child types the number (amendment 05 removed +1, −1 and the arrow keys), and a zoomed sub-line appears only as a help visual; the battlefield mapping does not change.
- **Rationale**: One function for both drawing and tests (SC-004). Scaling the whole world with Phaser's FIT scale mode keeps the number line and battlefield aligned (FR-015, FR-058).

## R8. Tick marks

- **Decision**: Steps follow the width table in spec FR-016 (width up to 20: major 5 or 10, minor 1; 21 to 100: major 10, minor 1; 101 to 400: major 50, minor 10; 401 to 1000: major 100, minor 10). Five ruler levels (FR-017) decide which lines and labels are drawn (R23). Custom ranges place major ticks at multiples of the major step within the range and always label both end points. A unit test checks the table for every width from 5 to 1000, including a range of width 150.
- **Rationale**: Matches PRD section 3.3: consistent intervals and major ticks as reference markers. At 0 to 100 over 1440 units, the unit spacing is 14.4 units, readable on a tablet.

## R9. Random numbers and determinism

- **Decision**: A small seeded generator (mulberry32) wrapped in an `Rng` interface. Each round gets a seed; each challenge derives its own seed from the round seed and turn number. All generators take an `Rng` argument; no module calls `Math.random`.
- **Rationale**: FR-028 requires reproducible challenges. Seeds are stored in each attempt record for debugging.

## R10. Challenge generation strategy

- **Decision**: "Answer first, then build the question." The generator picks the target position (the answer) from the allowed positions, then builds a challenge of the chosen type that produces this answer under the settings (for example, for subtraction it searches for operands `a - b = answer` that satisfy the operand limit, the crossing rules and the range). If no valid question exists for that type and answer, it tries another answer (up to 50 tries), then another enabled type, then falls back to "find N". A validator function checks every produced challenge against the settings; tests run it over 10,000 seeds per configuration (SC-003).
- **Rationale**: This guarantees that the answer is a reachable battlefield position (FR-025) and never generates impossible exercises (FR-029).
- **Alternatives considered**: generate the exercise first, then move the enemy (rejected: the result could be too close to the player's tank or outside the playable range).

## R11. Persistence

- **Decision**: `localStorage` with two keys, `mathtanks.settings.v1` and `mathtanks.progress.v1`, each holding versioned JSON validated by a Zod 4 schema on load. Invalid or unreadable data falls back to defaults and sets a flag the settings page shows (FR-048). Each stored object has a `version`; `migrate(raw)` upgrades older versions before validation. Attempt history is capped at the most recent 2000 attempts (about 400 KB); per-session summaries are kept without a cap. Saves happen between turns, not during animations. On first load the game calls `navigator.storage.persist()`. Parents can export and import a JSON file (FR-048a).
- **Safari note**: Safari deletes script-written storage and service worker caches for sites not visited in 7 days, unless the site was added to the Home Screen. Persistent storage requests, Home Screen instructions and export/import cover this.
- **Rationale**: The data is small (well under 1 MB). `localStorage` is synchronous and available in every target browser. A schema version allows later migrations.
- **Alternatives considered**: IndexedDB (rejected: more code for no benefit at this size).

## R12. Offline support

- **Decision**: `vite-plugin-pwa` 2.0 with a generated service worker that precaches all build output (HTML, JS, CSS, audio, fonts). Registration happens on first load with `registerType: 'prompt'`; when a new version is waiting, the start screen applies it (FR-051a), never during a round. Offline mode needs HTTPS or localhost. All assets are bundled locally; no CDN or external font is loaded.
- **Rationale**: AC-10 and FR-051 require play without a network after the first load. Precaching the whole bundle is the simplest way.

## R13. Graphics and sound

- **Decision**: All graphics are drawn by code with Phaser Graphics objects and generated textures (tanks, terrain, sky gradient, explosion particles). Sound effects are generated at runtime with the Web Audio API (short synthesized booms and soft chimes), so there are no external asset files and no licensing questions. Music is a simple generated loop, off by default.
- **Rationale**: Original assets, small bundle, works offline, and no negative sounds (FR-009).

## R14. Speech

- **Decision**: The browser's `speechSynthesis` API with a German voice (`lang: 'de-DE'`), wrapped in a `Speaker` module that reports whether speech is available. If no voice is available, the speaker icon is hidden. Safari on iPad only speaks after a user tap, so the "Spielen" tap speaks a short greeting to unlock speech for the session. Web Audio is resumed on the same tap.
- **Rationale**: FR-055; no external service (FR-052).

## R15. Localization

- **Decision**: A typed translation table `src/i18n/de.ts` exporting a `Messages` object, with keys for every string and functions for parameterized strings (for example `findNumber(n)`). A `t` accessor reads the active table. The encouraging-feedback phrases live in their own list in the table. A unit test checks that no child-facing string contains a forbidden word (FR-033, SC-006).
- **Rationale**: FR-056: adding English means adding `en.ts` with the same type.

## R16. Testing

- **Decision**: Vitest 5 for unit tests of everything in `src/core/` (generators, validator, number-line mapping and ticks, adaptive rules, mastery, guess detection, terrain, ballistics, damage, enemy AI, settings validation, storage). Property-style tests loop over many seeds. React components get a small number of tests with Testing Library where logic lives in them (parent gate timing, settings validation display). Playwright 1.64 runs end-to-end smoke tests in Chromium, WebKit and Firefox: start a round and fire, settings persistence across reload (AC-08), offline play against the production build (AC-10), and no requests to other origins. Generator property tests run over every preset and over 200 randomly generated valid settings, 1000 seeds each.
- **Rationale**: The PRD requires automated tests for mathematics, number-line mapping and progression logic. Keeping that logic engine-free makes it fast to test.

## R17. Parent gate

- **Decision**: Press and hold the gear icon for 2 seconds, with a filling ring as visual feedback. Releasing early cancels. Implemented with pointer events so it works with mouse and touch.
- **Rationale**: Needs no reading, is hard to trigger by accident, common in apps for young children.

## R18. Enemy AI

- **Decision**: The enemy computes an ideal shot to the player's tank by searching angle and power with `simulateShot`, then adds random error from a normal distribution whose spread depends on difficulty (large on Easy, medium on Normal, small on Challenging). Easy also halves enemy damage and forces the first enemy shot of a round to miss (FR-043). The enemy's random generator is separate from the challenge generator and is never given any attempt data (FR-042).
- **Rationale**: Simple, testable, and visibly improving with difficulty.
- **Changed by amendment 07**: the enemy no longer adds random error to an ideal shot. For each shot a seeded draw (`deriveSeed(roundSeed, 6, shotIndex)`) decides whether it hits, with probability 1/6, 1/4 or 1/3 by difficulty and never on the first shot of a round; a shot that does not hit aims 40 to 100 world units beside the child's tank. The path is the `solveArcToX` arc from the enemy's muzzle (R21), so the shell lands where the draw aimed. The draw reads only the round seed, the shot index and the difficulty (FR-042). Damage halving was already removed by amendment 06.

## R19. Aim solver for the enemy (aim correction removed)

- **Decision**: `solveAim` searches a grid of angles (every 1 degree) and powers (every 1%) with `simulateShot` on the current terrain and returns the shot whose impact is closest to the target, flagging whether it hits. Only the enemy (R18) uses it. Aim correction (FR-012) was removed by amendment 01, because the player's shell always lands at the chosen number (R21).
- **Rationale**: Takes hills into account; the search is about 9000 short simulations, done once per enemy turn, a few milliseconds of work.
- **Changed by amendment 07**: the enemy no longer uses `solveAim`; it uses `solveArcToX` (R21) toward the x its draw chose. `solveAim` stays in `src/core/physics/aim.ts` with its tests and has no caller in the game.

## R20. Critique follow-up

The critique report [critiques/critique-20261105-064803.md](./critiques/critique-20261105-064803.md) led to: hidden enemy during a search with no marker; fixed player side per round and an enemy that stays for up to 3 shots; preview-then-confirm selection with +1/−1 buttons; minimum tank gaps; a mastery record kept separate from the adaptive record; persistent storage, export and import, and WebKit tests; plus the smaller changes listed in spec FR-014, FR-016, FR-020, FR-031, FR-034, FR-036 to FR-039, FR-047, FR-048, FR-051a, FR-055 and SC-009. Amendment 01 later replaced the "enemy stays for 3 shots" rule and the check button; amendment 02 replaced the two-step selection.

## R21. Fixed cannon and automatic arc (amendment 01)

- **Decision**: `solveArcToX` in `src/core/physics/arc.ts`. The cannon points at 65 degrees toward the enemy side. For a chosen number, the target x is `numberToX(n)`. For the angle 65, the function finds the power by bisection over `simulateShot` (with no tank targets, so only terrain stops the shell) until the impact is within a quarter of one unit's width of the target x. When the terrain stops the shell before the target and no power reaches it, it tries 70, 75, 80 and 85 degrees. When no angle works, it returns a lifted 85-degree arc: a parabola from the muzzle over the highest terrain point between muzzle and target plus a margin, ending on the surface at the target x. The last path point is set to exactly the target x, so the landing number always equals the chosen number.
- **Rationale**: The product owner wants the child to learn the ruler, not ballistics. A steep fixed angle clears most hills; bisection is fast (about 20 simulations) and deterministic. Ignoring tanks in flight means a decoy in the way never takes a shot meant for another number; damage follows the number, not the path.
- **Alternatives considered**: closed-form power for flat ground (rejected: ignores hills); keeping `solveAim` for the player (rejected: it changes the angle, which the amendment forbids, and it may miss).

## R22. Keyboard input (amendment 01)

- **Decision**: one `keydown` listener on `window` (in `src/app/useKeyboard.ts`) calls the pure `keyToAction(key, screen)` from `src/app/keyboard.ts`, which returns an action such as a digit, confirm, help, pause, start, or nothing (the nudge for the arrow keys was removed by amendment 05). Battle actions go to controller methods (`typeDigit`, `typeMinus`, `backspace`, `confirm`, `requestHelp`, `pause`, `resume`); typed digits live in `RoundState.entry` and are handled by the pure reducer `applyKey` in `src/core/battle/entry.ts`. The app root has `tabIndex={-1}` and receives focus on load and after each screen change. Keys with Ctrl, Alt or Meta are ignored so browser shortcuts keep working; handled keys call `preventDefault`. Enter and Space with `repeat: true` are ignored. The gear button handles only pointer events, so no key opens the parent gate.
- **Rationale**: No visible text field means nothing to click and no on-screen keyboard on tablets. Pure functions keep the key rules testable without a browser. Playwright drives the keyboard-only test with `page.keyboard` only.
- **Alternatives considered**: a hidden `<input>` (rejected: focus is easy to lose, and tablets open the on-screen keyboard); Phaser keyboard input (rejected: start and round-end screens are React).

## R23. Ruler levels, any range and "read the ruler" (amendment 02)

- **Decision**: `ticksFor(view, level, seed, { allLines })` returns every tick with `visible` and `labeled` flags per the five levels of FR-017. Level 1 labels minor lines only when the label spacing is at least 28 logical units; otherwise it sets `labelTypedNumber` and the view labels only a typed number, once, under the preview marker on a dark chip, never its neighbouring lines (T203). Help steps call it with `allLines: true`. Settings version 2 replaces `labelLevel` with `rulerLevelStart` and `rulerLevelMax` (migration in data-model.md). The `positions` ladder carries `rulerLevel` values from 1 to 5, clamped to the parent's limits. `readPosition` places the enemy on a minor-step multiple at levels 1 to 3 and on any whole number at levels 4 and 5, with `hitTolerance` per FR-068. Custom ranges accept a minimum from -1000 to 9000 and a width from 5 to 1000.
- **Rationale**: One function draws the game ruler, the help zoom and the settings preview, so the parent sees exactly what the child sees. Keeping the tolerance on the challenge makes the hit rule testable in the controller.
- **Alternatives considered**: separate settings for lines and labels (rejected: the amendment ties them into one level); keeping two-step selection for wide ranges (rejected: typing reaches every number, and the amendment asks to drop it).
