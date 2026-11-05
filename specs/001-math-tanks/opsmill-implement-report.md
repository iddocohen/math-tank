# Implementation report: 001-math-tanks

## 1. Header

| Item | Value |
|------|-------|
| Feature | Math Tanks (001-math-tanks): a number-line tank game for children, in German, for browsers, iPad, iPhone and Fire tablets |
| Spec directory | `specs/001-math-tanks/` |
| Base commit | `8661a98` (implementation start; rewritten SHA of `909579b`) |
| Head commit | `e899393` (branch `001-math-tanks`, pushed) |
| Commits in the run | 98 (`8661a98..e899393`), plus this report |
| Wall-clock time | 2026-11-05, about 06:00Z to 22:20Z (about 16 h 20 min) |
| Tasks | 393 of 394 done (`[X]`); 1 open: T155 |
| Review mode | plugin (pr-review-toolkit) |
| Overall status | **DONE**, with T155 open for the product owner |

T155 is the manual walk-through on real devices. It is open on purpose: only the product owner can do it, with real hardware. No local-pass evidence is missing, and a review ran. So the blocking rules do not mark the run INCOMPLETE.

Final checks on `e899393`:

- Unit tests: "1471 passed" at 22:11:08Z.
- End-to-end tests: "249 passed, 31 skipped" from 22:11:32Z to 22:19:36Z.
- CI parity in a fresh worktree: OK, 22:19:50Z to 22:20:23Z.
- GitHub Actions run 42120708532: success.

## 2. Chunk-by-chunk ledger

SHAs before the history rewrite are mapped to their new values. Outcome counts are OK / partial / failed.

| # | Chunk | Tasks | OK / partial / failed | Commits | Decisions and surprises |
|---|-------|-------|-----------------------|---------|-------------------------|
| 1 | Phase 1 Setup | 7 | 7 / 0 / 0 | `05a8d60` | pnpm 10.34.9 pinned; Vitest projects (node, jsdom); workbox added |
| 2 | Phase 2 Foundational | 10 | 10 / 0 / 0 | `f4d8506` | Settings type from the Zod schema; cross-field rules in `validateSettings` |
| 3 | Phase 3 US1 physics and enemy logic | 10 | 10 / 0 / 0 | `2712f33` | Physics constants chosen; flag: the 50 ms performance test is close to its limit |
| 4 | Phase 4 US1 battle controller | 7 | 7 / 0 / 0 | `7315d06` | `RoundState.shot` and `setSettings` added beyond the contract |
| 5 | Phase 5 US1 Phaser battle scene | 8 | 8 / 0 / 0 | `4cf6ba8` | Drawing math in a tested module; smoke check found a replay stall, fixed with a test |
| 6 | Phase 6 US1 React screens and battle e2e | 8 | 8 / 0 / 0 | `501f30b` | Tests run silent; Phaser game created per battle |
| 7 | Phase 7 US2 number line ticks and challenges | 9 | 9 / 0 / 0 | `8e66139` | 30-40 view follows FR-016, conflicts with T051 text |
| - | Re-plan for amendments 01 and 02 | docs | - | `30bcefb` | Phases 8 to 24; FR-059 to FR-069 |
| 8 | Phase 8 amendment 01 core rework | 9 | 9 / 0 / 0 | `3c634eb` | Typecheck left failing in app code until Phase 9 (per T164) |
| 9 | Phase 9 amendment 01 view and keyboard | 8 | 8 / 0 / 0 | `10d35b7` | `getRoundSettings` added; controls in a bar below the canvas |
| 10 | Phase 10 amendment 02 ruler levels, T184, T185 (amendment 03) | 9 | 9 / 0 / 0 | `9b20f65` | Ruler below the ground; flag: `aim.test.ts` timing flaky |
| 11 | Phase 11 US9 any range | 9 | 8 / 1 / 0 | `af86859` | T181 hit tolerance partial, finished by amendment 04 |
| 11a | Amendment 04 hit rule | 9 | 9 / 0 / 0 | `bc0e161`, `342d0d7` | Body hit and "Volltreffer"; many later tasks rewritten |
| 11b | Amendment 05 no shortcuts, settings early | 9 | 9 / 0 / 0 | `22659cb`, `2367341` | Phases reordered; first search never asks for the number |
| 12 | Phase 12 US6 settings rules, T203 | 8 | 7 / 1 / 0 | `0d9d45e` | T109 settings-page e2e case left as `test.fixme` until Phase 13 |
| 13 | Phase 13 US6 parent gate and settings page | 8 | 8 / 0 / 0 | `0b83cd5` | Hold timing bug found and fixed |
| 13a | Amendment 06 one hit, hearts, score, best | 11 | 11 / 0 / 0 | `4a2bc28`, `110b662` | Settings version 4; flag: two Chromium e2e failures under load |
| 14 | Phase 14 US2 guided turn flow | 5 | 5 / 0 / 0 | `2b48330` | Orchestrator added T215 (hidden enemy must not be revealed by its shell) |
| 15 | Phase 15 US2 guided screens, T215 | 7 | 7 / 0 / 0 | `b0da7f8` | T068 and T215 conflict resolved toward hiding the enemy |
| 16 | Phase 16 US3 addition and subtraction | 9 | 9 / 0 / 0 | `336e801` | Orchestrator added T216 (limit only the added numbers) |
| 17 | Phase 17 US3 step animation, T216 | 5 | 5 / 0 / 0 | `76db68d` | Animation on the game clock; e2e waits up to 40 s |
| 18 | Phase 18 US4 comparison | 9 | 9 / 0 / 0 | `13db9d2` | 2 or 3 tanks by comparison kind |
| 18a | Ruler preview and level 1 labels | 3 | 3 / 0 / 0 | `51665d6` | Crowded-ruler test moved to 0-1000 |
| 18b | Amendment 07 visible enemy, return fire | 8 | 8 / 0 / 0 | `284a14e`, `b673a63` | Hidden-enemy code and tests deleted |
| 19 | Phase 19 US5 help escalation logic | 5 | 5 / 0 / 0 | `9a38b09` | Each miss raises the help level by one |
| 20 | Phase 20 US5 help visuals | 5 | 5 / 0 / 0 | `9f96608` | Orchestrator screenshot review produced polish items P1 to P3 |
| 21 | Phase 21 US7 classification, ladders, mastery | 10 | 10 / 0 / 0 | `2cd50ba` | Flag: tests not written first |
| 22 | Phase 22 US7 adaptive play, progress page, T232 (amendment 08) | 8 | 8 / 0 / 0 | `27603df`, `fe3656f` | Adaptive play on by default; flag: `progressStore.ts` before its test |
| 22a | Amendment 09 comparison with one enemy | 7 | 7 / 0 / 0 | `36dcf6d`, `daa6036` | Fixed a gap: saved progress with `readPosition` may not have loaded |
| - | Repository, README, license, Pages CI (orchestrator) | - | - | `a658958` | Public repo `iddocohen/math-tank`; Pages workflow |
| 22b | UI polish | 8 | 8 / 0 / 0 | `83c4072` | One message line; help chips dropped when they overlap |
| 22c | Amendment 10 decoys without plates | 8 | 8 / 0 / 0 | `61cf205`, `f8da85a` | `aim.test.ts` failed in 2 of 4 full runs |
| 22d, 22e | Amendment 11 tank garage | 13 | 13 / 0 / 0 | `8662692`, `5632f75`, `6670656` | Stars in their own storage key; settings version 5 |
| 22f | Amendment 13 enemy zeroes in, new hills | 7 | 7 / 0 / 0 | `c2dec4a`, `d8eb19f` | Closest miss 35 units |
| 22g, 22h | Amendment 12 iPad, phone, number pad | 9 | 9 / 0 / 0 | `adc8212`, `0254174`, `6cf984a` | Device projects added; settings version 6 |
| 23 | Bugs B1, B2 and Phase 23 US8 | 14 | 14 / 0 / 0 | `326fc90`, `5c5af96` | Flag: four tests not written first; speech greeting not checked on a real iPad |
| - | History rewrite (product owner) | - | - | `97f2d69` | `.specify/` and `.claude/` removed from history |
| 22i | Amendment 14 visual upgrade | 10 | 10 / 0 / 0 | `165fd80`, `62404d8` | CC0 dirt texture; frame-rate check uses the best 1 s sample |
| 22j | Amendment 15 QR transfer | 7 | 7 / 0 / 0 | `e68b72d`, `b9609f5` | `uqr` bundled, `jsqr` for tests only; flag: dense QR may be hard to scan |
| 24 | Phase 24 polish, P5, P6, P11, P12 | 10 | 9 / 0 / 0, 1 not done | `06acbee` | T155 not done (product owner); transfer version 2 shortens links |
| - | Bug: iPhone rotation in Safari (T306) | 1 | 1 / 0 / 0 | `6692763` | Not checked on a real iPhone |
| - | Phase 6 review fixes (T307 to T326) | 20 | 20 / 0 / 0 | `5994514`, `66e9c49`, `a05f1e3`, `d71f924` | L5 deferred to T155 |
| 24a | Amendment 17 play modes, faster adaptive | 15 | 15 / 0 / 0 | `ccdc2ff`, `90d494b` | Settings version 8; keys 1, 2, 3 start a mode |
| 24b | Amendment 16 Fire tablets and Silk | 6 | 6 / 0 / 0 | `d549d8e`, `ca96ea2` | T346 (light graphics) not needed; no game code changed |
| - | /simplify (T348) | 1 | 1 / 0 / 0 | `40d941a`, `e74efea`, `e0564fd`, `e47aa8d` | Entry bundle 1891 kB to 469 kB; `e74efea` does not type-check alone |
| 24c | Amendment 18 point after full help | 8 | 8 / 0 / 0 | `bfe0c2e`, `c0522eb` | Settings version 9; `enemiesHit` added |
| - | /code-review high --fix (T357) | 1 | 1 / 0 / 0 | `168932c` | Miss text no longer shows the enemy number |
| 24d | Amendment 19 star shop, aiming cross | 10 | 10 / 0 / 0 | `d52c41d`, `1863f69` | Price list set; settings version 10 |
| - | Bug: iPhone rotation in Chrome, fast updates (T368, T369) | 2 | 2 / 0 / 0 | `ba485bf` | Layout from media queries; `?debug=screen`; not checked on a real iPhone |
| 24e | Amendment 20 ruler always shows its lines | 8 | 8 / 0 / 0 | `808d89e`, `9bee47d` | CI typecheck failed on `9bee47d` (see section 6) |
| 24f, 24g | Amendment 21 enemy waves and curved lines | 14 | 14 / 0 / 0 | `df0e8a4`, `199ff2d`, `efe0aba` | `199ff2d` also fixes CI; T385 to T390 later removed by the product owner |
| - | "Keine Linien", curves removed, e2e stability (T392, T393) | 2 | 2 / 0 / 0 | `e2ea884` | Settings version 12; frame-rate check moved to a serial project |
| - | /code-review medium --fix (T394) | 1 | 1 / 0 / 0 | `e899393` | Known items left: import cycle, two nearest-tank rules |

## 3. Tasks not completed

| Task | Reason |
|------|--------|
| T155 | Manual walk-through of every scenario in `quickstart.md` on real devices. The product owner owns it. It needs a real iPad, iPhone and Fire tablet, which the run did not have. |

Deferred items that T155 or later work should cover:

- **L5, iOS audio (review finding)**: the speaker button stays visible after a `not-allowed` speech error, and an `AudioContext` in the iOS `interrupted` state stays silent. Test browsers have audio silenced on purpose, so a fix could not be observed. Deferred to T155.
- **iPhone rotation fixes (T306, T368)**: tested with emulation only. Real Safari and Chrome on an iPhone are not checked. For Chrome, the ledger notes that the cause "Chrome cached an old build" (hypothesis H1) is not ruled out.
- **Known items from the medium code review (`e899393`)**:
  - an import cycle between the guided and wave modules;
  - two different rules for "nearest tank" in the code.
- **Real-device checks not done**: Fire tablet (quickstart scenario 33), speech greeting on an iPad, QR scanning of dense codes with a camera.

## 4. Local-pass evidence

### Final runs that cover every test file at `e899393`

| Run | Type | Run command | Passed at | Environment | Pass line |
|-----|------|-------------|-----------|-------------|-----------|
| Full unit suite | unit, integration | `pnpm test` | 2026-11-05T22:11:08Z | local macOS; Vitest projects node and jsdom | "1471 passed" |
| Full e2e suite | e2e | `pnpm e2e` | 2026-11-05T22:11:32Z to 22:19:36Z | local Playwright, 8 browser and device projects plus the serial performance project | "249 passed, 31 skipped" |
| CI parity, fresh worktree | install, lint, typecheck, unit, build | install, `lint`, `typecheck`, `test`, `build` | 2026-11-05T22:19:50Z to 22:20:23Z | fresh git worktree at `e899393` | "CI parity OK" (ledger wording) |
| GitHub Actions run 42120708532 | lint, typecheck, unit, build, Pages deploy | `.github/workflows/pages.yml` (lint, typecheck, `test --retry=2`, `build --base=/math-tank/`, deploy-pages) | 2026-11-05T22:20:50Z to 22:22:25Z | GitHub Actions, head `e899393` | conclusion: success |
| GitHub Actions run 42115062331 | same | same | 2026-11-05T21:43:45Z (finished) | head `e2ea884` | conclusion: success |
| GitHub Actions run 42103435300 | same | same | 2026-11-05T20:28:09Z (finished) | head `efe0aba` | conclusion: success |
| GitHub Actions run 42096722098 | same | same | 2026-11-05T19:44:38Z (finished) | head `9bee47d` | conclusion: **failure** (typecheck), fixed in `199ff2d` |
| GitHub Actions run 42093936311 | same | same | 2026-11-05T19:28:11Z (finished) | head `ba485bf` | conclusion: success |

CI does not run the e2e suite. Only the local runs above cover e2e.

### Unit and integration test files

The ledger records environments as "node", "jsdom" or "n/a". Chunk 1 records macOS, Node 25.6.1, pnpm 10.34.9, Vitest 5.1.0. Where the ledger has only a count, the last column says "count only". Where a file is not named in the ledger, the row says so and points to the full-suite run that covers it.

| Test file | Type | Run command | Passed at (last per-file record) | Environment | Pass line or record |
|-----------|------|-------------|----------------------------------|-------------|---------------------|
| `src/core/sanity.test.ts` | unit | `pnpm test --reporter=verbose` | 2026-11-05T06:02:35Z | macOS, Node 25.6.1, pnpm 10.34.9, Vitest 5.1.0, node | "✓ \|node\| src/core/sanity.test.ts > toolchain sanity > runs a Vitest test in the node environment 1ms" |
| `src/core/rng.test.ts` | unit | `pnpm vitest run --reporter=verbose` | 2026-11-05T06:07:34Z | node | count only: 9 passed; suite "Tests  57 passed (57)" |
| `src/core/settings/settings.test.ts` | unit | `pnpm vitest run <file>` | 2026-11-05T12:36:17Z | not recorded | count only: storage, settings and rewards files "123" passed |
| `src/core/storage/storage.test.ts` | unit | `pnpm vitest run <file>` | 2026-11-05T12:36:17Z | not recorded | count only: same "123" run |
| `src/core/storage/exportImport.test.ts` | unit | `pnpm vitest run --reporter=verbose` | 2026-11-05T09:02:34Z | node | count only: 24; suite "Tests 628 passed (628)" |
| `src/core/storage/progressStore.test.ts` | unit | `pnpm vitest run <file>` | 2026-11-05T11:17:25Z | not recorded | count only: 4; full "904 passed" |
| `src/core/records/records.test.ts` | unit | `pnpm vitest run --reporter=verbose` | 2026-11-05T09:02:34Z | node | count only: 10; suite "Tests 628 passed (628)" |
| `src/core/rewards/garage.test.ts` | unit | `pnpm vitest run <file>` | 2026-11-05T12:35:01Z | not recorded | count only: "rewards 22" (file names not split in the ledger) |
| `src/core/rewards/looks.test.ts` | unit | `pnpm vitest run <file>` | 2026-11-05T12:35:01Z | not recorded | count only: same "rewards 22" run |
| `src/core/transfer/transfer.test.ts` | unit | `pnpm vitest run <file>` | 2026-11-05T15:05:37Z | not recorded | count only: 33 |
| `src/core/transfer/qr.test.ts` | unit | `pnpm vitest run <file>` | 2026-11-05T14:35:16Z | not recorded | count only: 4; group "100 passed" |
| `src/core/physics/terrain.test.ts` | unit | `pnpm vitest run <file>` | 2026-11-05T07:33:56Z | n/a | count only: 11 |
| `src/core/physics/ballistics.test.ts` | unit | `pnpm vitest run src/core/physics src/core/ai --reporter=verbose` | 2026-11-05T06:12:45Z | n/a | count only: 6; group "Tests  31 passed (31)" |
| `src/core/physics/arc.test.ts` | unit | `pnpm vitest run <file>` | 2026-11-05T15:05:37Z | not recorded | count only: 7 |
| `src/core/physics/timing.testutil.test.ts` | unit | `pnpm vitest run <file>` | 2026-11-05T15:05:37Z | not recorded | count only: 3 |
| `src/core/ai/enemy.test.ts` | unit | `pnpm vitest run <file>` | 2026-11-05T10:26:18Z | n/a | count only: 10 |
| `src/core/numberline/mapping.test.ts` | unit | `pnpm vitest run src/core/numberline src/core/math src/core/battle` | 2026-11-05T06:18:20Z | n/a | "✓ mapping.test.ts (31 tests)" |
| `src/core/numberline/ticks.test.ts` | unit | `pnpm vitest run <file>` | 2026-11-05T11:58Z | not recorded | count only: 128; full unit "956 passed" |
| `src/core/numberline/zoom.test.ts` | unit | `pnpm vitest run <file>` | about 07:43Z (chunk 11, exact time not recorded) | not recorded | count only: 4 |
| `src/core/math/gaps.test.ts` | unit | `pnpm vitest run src/core/numberline src/core/math src/core/battle` | 2026-11-05T06:18:20Z | n/a | "✓ gaps.test.ts (14 tests)" |
| `src/core/math/numberLine.test.ts` | unit | `pnpm vitest run <file>` | 2026-11-05T07:33:56Z | n/a | count only: 23 |
| `src/core/math/validate.test.ts` | unit | `pnpm vitest run <file>` | 2026-11-05T06:49:30Z | n/a | count only: 13 (later +5 in chunk 18) |
| `src/core/math/generator.property.test.ts` | unit (property) | `pnpm vitest run <file>` | 2026-11-05T11:17:25Z | not recorded | count only: 6 new; full "904 passed" |
| `src/core/math/readPosition.test.ts` | unit | `pnpm vitest run <files>` | 2026-11-05T07:58:36Z | n/a | count only: 47; group "171 passed" |
| `src/core/math/readPositionCache.test.ts` | unit | not recorded | not recorded (chunk 24e) | not recorded | count only: 2; full unit "1435 passed" |
| `src/core/math/inputMethod.test.ts` | unit | `pnpm vitest run <file>` | 2026-11-05T08:13:39Z | n/a | count only: 8 |
| `src/core/math/crossing.test.ts` | unit | `pnpm vitest run <file>` | 2026-11-05T09:31:59Z | n/a | count only: 3; group "128 passed" |
| `src/core/math/addition.test.ts` | unit | `pnpm vitest run <files>` | 2026-11-05T09:44:08Z | n/a | count only: 11; group "205 passed" |
| `src/core/math/subtraction.test.ts` | unit | `pnpm vitest run <file>` | 2026-11-05T09:31:59Z | n/a | count only: 9; group "128 passed" |
| `src/core/math/stepPath.test.ts` | unit | `pnpm vitest run <file>` | 2026-11-05T09:31:59Z | n/a | count only: 6; group "128 passed" |
| `src/core/math/comparison.test.ts` | unit | `pnpm vitest run <file>` | 2026-11-05T09:57:09Z | not recorded | count only: 39; group "265 passed" (51 in chunk 24e, no time) |
| `src/core/battle/battleController.test.ts` | integration | `pnpm vitest run <file>` | 2026-11-05T11:17:25Z | not recorded | count only: 121; first record "✓ battleController.test.ts (23 tests)" at 06:18:20Z |
| `src/core/battle/entry.test.ts` | unit | `npx vitest run --project node <file>` | 2026-11-05T07:13:06Z | n/a | count only: 10; full "Tests  302 passed (302)" |
| `src/core/battle/hitRule.test.ts` | unit | `pnpm vitest run <file>` | 2026-11-05T10:26:18Z | n/a | count only: 12 |
| `src/core/battle/help.test.ts` | unit | `pnpm vitest run ...` | 2026-11-05 (time not recorded) | n/a | count only: 16; full "Tests 818 passed (818)" |
| `src/core/battle/aimCross.test.ts` | unit | not named in the ledger | covered by full unit 2026-11-05T18:32:52Z | not recorded | full unit "1396 passed" |
| `src/core/battle/wave.test.ts` | unit | not named per file | failed first 21:49:02Z; covered by full unit 2026-11-05T22:11:08Z | not recorded | full unit "1471 passed" |
| `src/core/progress/classify.test.ts` | unit | `pnpm vitest run src/core/progress` | 2026-11-05T10:53:39Z | node | count only: 9; group "41 passed" |
| `src/core/progress/adaptive.test.ts` | unit | `pnpm vitest run src/core/progress` | 2026-11-05T10:53:39Z | node | count only: 19 (23 in chunk 24a, no time); group "41 passed" |
| `src/core/progress/mastery.test.ts` | unit | `pnpm vitest run src/core/progress` | 2026-11-05T10:53:39Z | node | count only: 7; group "41 passed" |
| `src/core/progress/session.test.ts` | unit | `pnpm vitest run src/core/progress` | 2026-11-05T10:53:39Z | node | count only: 6; group "41 passed" |
| `src/core/progress/summarize.test.ts` | unit | `pnpm vitest run <file>` | 2026-11-05T11:17:25Z | not recorded | count only: 7 |
| `src/core/util.test.ts` | unit | not named in the ledger | covered by /simplify full unit (time not recorded) | not recorded | full unit 1320 passed |
| `src/core/view/geometry.test.ts` | unit | `pnpm vitest run ...` | 2026-11-05T07:21:02Z | not recorded | count only: 14; full "Tests 314 passed (314)" |
| `src/core/view/layout.test.ts` | unit | `pnpm vitest run <file>` | 2026-11-05T09:10:46Z | not recorded | count only: 4 |
| `src/core/view/pointerLine.test.ts` | unit | `pnpm vitest run <files>` | 2026-11-05T07:58:36Z | n/a | count only: 4; group "171 passed" |
| `src/core/view/stepFrames.test.ts` | unit | `pnpm vitest run <files>` | 2026-11-05T09:44:08Z | n/a | count only: 6; group "205 passed" |
| `src/core/view/tankStyle.test.ts` | unit | `pnpm vitest run <file>` | 2026-11-05T08:13:39Z | n/a | count only: 6 |
| `src/core/view/rulerText.test.ts` | unit | `pnpm vitest run <file>` | 2026-11-05T11:58Z | not recorded | count only: 34 |
| `src/core/view/screen.test.ts` | unit | not recorded per file | covered by full unit 2026-11-05T19:18:29Z | not recorded | count only: 22 (failed first); full unit "1412 passed" |
| `src/core/view/shade.test.ts` | unit | not named in the ledger | 2026-11-05T14:20:13Z (chunk 22i) | not recorded | chunk 22i recorded "6 files 82 passed" without file names |
| `src/core/view/groundArt.test.ts` | unit | not named in the ledger | 2026-11-05T14:20:13Z (chunk 22i) | not recorded | same "6 files 82 passed" note |
| `src/core/view/hitFeedback.test.ts` | unit | not named in the ledger | covered by /simplify full unit (time not recorded) | not recorded | full unit 1320 passed |
| `src/core/view/motion.test.ts` | unit | not named in the ledger | 2026-11-05T14:20:13Z (chunk 22i) | not recorded | same "6 files 82 passed" note |
| `src/core/view/tankDrawing.test.ts` | unit | not named in the ledger | 2026-11-05T14:20:13Z (chunk 22i) | not recorded | same "6 files 82 passed" note |
| `src/audio/sfx.test.ts` | unit | `pnpm vitest run src/core/view/geometry.test.ts src/audio/sfx.test.ts` | 2026-11-05T06:35:01Z | n/a | count only: 5 (6 in chunk 20); group "Tests  22 passed (22)" |
| `src/audio/speaker.test.ts` | unit | not named per file | covered by full unit 2026-11-05T15:57:44Z | not recorded | full unit "1275 passed" |
| `src/i18n/i18n.test.ts` | unit | `pnpm vitest run <file>` | 2026-11-05T15:05:37Z | not recorded | count only: 18 |
| `src/i18n/noHardcodedText.test.ts` | unit | `pnpm vitest run <file>` | 2026-11-05T15:05:37Z | not recorded | count only: 2 |
| `src/app/BattleOverlay.test.tsx` | unit (jsdom) | `pnpm vitest run <file>` | 2026-11-05T11:58Z | not recorded | count only: 34 |
| `src/app/Garage.test.tsx` | unit (jsdom) | not named in the ledger | covered by app and core run 2026-11-05T12:46:12Z | not recorded | "223" passed; full "1035 passed" |
| `src/app/NumberPad.test.tsx` | unit (jsdom) | not named in the ledger | 2026-11-05T13:26:10Z (chunk 22g, 22h) | not recorded | chunk recorded "9 files 196 passed" without file names |
| `src/app/RotateScreen.test.tsx` | unit (jsdom) | not named in the ledger | 2026-11-05T13:26:10Z (chunk 22g, 22h) | not recorded | same "9 files 196 passed" note |
| `src/app/ParentGate.test.tsx` | unit (jsdom) | `pnpm vitest run <file>` | 2026-11-05T14:35:16Z | not recorded | count only: 10; group "100 passed" |
| `src/app/ProgressPage.test.tsx` | unit (jsdom) | `pnpm vitest run <file>` | 2026-11-05T11:17:25Z | not recorded | count only: 9 |
| `src/app/RoundEnd.test.tsx` | unit (jsdom) | `pnpm vitest run --reporter=verbose` | 2026-11-05T09:02:34Z | node and jsdom | count only: 7; suite "Tests 628 passed (628)" |
| `src/app/RulerPreview.test.tsx` | unit (jsdom) | `pnpm vitest run <file>` | 2026-11-05T10:10:15Z | not recorded | count only: 8 (12 in chunk 24e, no time); group "129 passed" |
| `src/app/ScreenDebug.test.tsx` | unit (jsdom) | not named in the ledger | covered by full unit 2026-11-05T19:18:29Z | not recorded | full unit "1412 passed" |
| `src/app/SettingsPage.test.tsx` | unit (jsdom) | `pnpm vitest run <file>` | 2026-11-05T15:05:37Z | not recorded | count only: 30 (43 in chunk 24e, no time) |
| `src/app/StartScreen.test.tsx` | unit (jsdom) | `pnpm vitest run <file>` | 2026-11-05T09:22:32Z | not recorded | count only: 3 (9 in chunk 24a, no time); group "111 passed" |
| `src/app/TankPreview.test.tsx` | unit (jsdom) | not named in the ledger | covered by app and core run 2026-11-05T12:46:12Z | not recorded | "223" passed |
| `src/app/TransferDialog.test.tsx` | unit (jsdom) | `pnpm vitest run <file>` | 2026-11-05T14:35:16Z | not recorded | count only: 7 |
| `src/app/keyboard.test.ts` | unit (jsdom) | `pnpm vitest run <file>` | 2026-11-05T08:13:39Z | jsdom | count only: 16 |
| `src/app/persistence.test.ts` | unit | `pnpm vitest run <file>` | 2026-11-05T14:35:16Z | not recorded | count only: 25 |
| `src/app/safeArea.test.ts` | unit | not named in the ledger | covered by full unit 2026-11-05T15:57:44Z | not recorded | full unit "1275 passed" |
| `src/app/swUpdate.test.ts` | unit | not recorded per file | covered by full unit 2026-11-05T19:18:29Z | not recorded | count only: 13 (failed first); full unit "1412 passed" |
| `src/app/useAutoPause.test.ts` | unit | not named in the ledger | covered by full unit 2026-11-05T15:57:44Z | not recorded | full unit "1275 passed" |
| `src/app/useKeyboard.test.tsx` | unit (jsdom) | not recorded per file | failed first 21:11:43Z; full unit 2026-11-05T21:16:56Z | not recorded | full unit "1469 passed" |
| `src/app/useScreen.test.ts` | unit (jsdom) | not recorded per file | failed first 21:50:17Z; full unit 2026-11-05T22:11:08Z | not recorded | count only: 7 (chunk T368); full unit "1471 passed" |

Test files added during the run and later deleted (not in the tree at `e899393`):

- `damage.test.ts`: deleted by amendment 06 (chunk 13a).
- `hiddenShell` test (3 tests, chunk 15) and the hidden-enemy tests: removed with amendment 07 and later.
- `topShell` test: deleted in chunk 22a, restored in 22c, not in the tree at `e899393`.
- `src/core/physics/aim.test.ts`: deleted in `d71f924` with the unused `aim.ts`.
- `src/core/view/pointerCurve.test.ts`: deleted in `e2ea884` when the product owner removed curved lines.

### End-to-end test files

Browsers and projects grew during the run. Chunks 6 to 22f used Chromium, WebKit and Firefox. Chunk 22g added iPad landscape, iPad portrait and iPhone landscape (WebKit). Chunk 24 used 8 projects; the ledger does not list their names. `e2ea884` added a serial performance project.

| Test file | Type | Run command | Passed at (last per-file record) | Environment | Pass line or record |
|-----------|------|-------------|----------------------------------|-------------|---------------------|
| `tests/e2e/battle.spec.ts` | e2e | `pnpm exec playwright test tests/e2e/battle.spec.ts --reporter=list` | 2026-11-05T06:41:38Z (first); later in every full run | chromium, webkit, firefox | "✓ 1 [chromium] › ... (38.6s)", "✓ 3 [webkit] › ... (33.0s)", "✓ 2 [firefox] › ... (34.3s)", "3 passed (39.1s)" |
| `tests/e2e/range.spec.ts` | e2e | `pnpm exec playwright test <spec>` | 2026-11-05T07:43:20Z | chromium, webkit, firefox | "3 passed (11.3s)" |
| `tests/e2e/persistence.spec.ts` | e2e | `pnpm exec playwright test <specs>` | 2026-11-05T08:21:15Z | chromium, webkit, firefox | with battle.spec: "15 passed (27.1s), 3 skipped (fixme)"; the fixme case was enabled in Phase 13 |
| `tests/e2e/guided.spec.ts` | e2e | `pnpm e2e` | 2026-11-05T09:18:57Z | chromium, webkit, firefox | suite "39 passed (1.3m)" |
| `tests/e2e/steps.spec.ts` | e2e | `pnpm e2e` | 2026-11-05T09:42:41Z | chromium, webkit, firefox | suite "42 passed (1.3m)"; also passed `--repeat-each=6` |
| `tests/e2e/comparison.spec.ts` | e2e | `pnpm e2e` | 2026-11-05T13:31:40Z | chromium, webkit, firefox | with enemyZeroIn: "18 passed" |
| `tests/e2e/rulerPreview.spec.ts` | e2e | `pnpm e2e` | failed first 19:34:04Z; full run 2026-11-05T19:35:37Z | 8 projects | suite "237 passed (7.6m), 30 skipped" |
| `tests/e2e/help.spec.ts` | e2e | `pnpm exec playwright test <spec>` | 2026-11-05T10:48:13Z | chromium, webkit, firefox | "3 passed (27.1s)" |
| `tests/e2e/garage.spec.ts` | e2e | `pnpm exec playwright test <spec>` | failed first 18:31:32Z; full run 2026-11-05T18:33:09Z | 8 projects | suite "209 passed (7.2m), 28 skipped"; earlier "6 passed" 12:45:24Z |
| `tests/e2e/enemyZeroIn.spec.ts` | e2e | `pnpm exec playwright test <specs>` | 2026-11-05T13:31:40Z | chromium, webkit, firefox | with comparison: "18 passed" |
| `tests/e2e/devices.spec.ts` | e2e | `pnpm e2e` | 2026-11-05T13:23:57Z | 6 projects | "10 passed, 2 skipped"; suite "82 passed (2.1m), 2 skipped" |
| `tests/e2e/keyboard.spec.ts` | e2e | `pnpm e2e` | 2026-11-05T13:50:31Z | 6 projects | no per-file line; suite "118 passed (2.8m), 2 skipped" |
| `tests/e2e/touch.spec.ts` | e2e | `pnpm e2e` | 2026-11-05T13:50:31Z | 6 projects | no per-file line; suite "118 passed (2.8m), 2 skipped" |
| `tests/e2e/offline.spec.ts` | e2e | `pnpm exec playwright test <specs>` | 2026-11-05T13:44:46Z | chromium, webkit, firefox | with no-external-requests and speech: "12 passed" |
| `tests/e2e/no-external-requests.spec.ts` | e2e | same | 2026-11-05T13:44:46Z | same | same "12 passed" |
| `tests/e2e/speech.spec.ts` | e2e | `pnpm exec playwright test <spec>` | 2026-11-05T15:47Z | not recorded | "9 passed" (one failed run, 3 later passes) |
| `tests/e2e/pause.spec.ts` | e2e | `pnpm exec playwright test <spec>` | 2026-11-05T13:45:24Z | not recorded | "6 passed" |
| `tests/e2e/visuals.spec.ts` | e2e | `pnpm e2e` | 2026-11-05T14:17:14Z | 6 projects | no per-file line; suite "127 passed (2.9m), 5 skipped"; frame-rate check moved to the serial project in `e2ea884` |
| `tests/e2e/transfer.spec.ts` | e2e | `pnpm exec playwright test <spec>` | 2026-11-05T15:43:02Z | not recorded | "24 passed" |
| `tests/e2e/performance.spec.ts` | e2e | `pnpm e2e` (runs last, alone, with GPU) | not recorded per file | Metal GPU locally; skipped with a reason on software rendering | no per-file line in the ledger |
| `tests/e2e/accessibility.spec.ts` | e2e | not named in the ledger | covered by full e2e 2026-11-05T22:19:36Z | 8 projects | suite "249 passed, 31 skipped" |
| `tests/e2e/basePath.spec.ts` | e2e | not named in the ledger | covered by full e2e 2026-11-05T22:19:36Z | 8 projects | suite "249 passed, 31 skipped" |
| `tests/e2e/rotation.spec.ts` | e2e | `pnpm exec playwright test <spec> --repeat-each=4` | 2026-11-05T19:17:09Z | not recorded | "28/28 over 4 repeats"; first version "4 passed (12.9s)" 15:13:07Z |
| `tests/e2e/modes.spec.ts` | e2e | `pnpm exec playwright test <spec>` | 2026-11-05T16:31:02Z (failed first 16:23:52Z) | not recorded | "18 passed" |
| `tests/e2e/fire.spec.ts` | e2e | `pnpm exec playwright test <spec>` | 2026-11-05T16:44:02Z | Fire tablet sizes | "12 passed, 12 skipped" |
| `tests/e2e/firePerformance.spec.ts` | e2e | `pnpm exec playwright test <spec>` | 2026-11-05T16:45:21Z | 4x CPU throttle | "passed" (ledger wording) |
| `tests/e2e/fullHelp.spec.ts` | e2e | `pnpm exec playwright test <spec>` | 2026-11-05T17:43:18Z | not recorded | "3 passed" |
| `tests/e2e/gameChunk.spec.ts` | e2e | `pnpm e2e` | 2026-11-05T18:12:13Z | 8 projects | no per-file line; suite "196 passed, 29 skipped" |
| `tests/e2e/aimCross.spec.ts` | e2e | `pnpm e2e` | failed first 18:31:32Z; full run 2026-11-05T18:33:09Z | 8 projects | suite "209 passed (7.2m), 28 skipped" |
| `tests/e2e/pauseResume.spec.ts` | e2e | `pnpm e2e` | 2026-11-05T19:25:55Z | chromium, webkit, firefox | failed first, then passed in 3 browsers; suite "215 passed (7.2m), 31 skipped" |
| `tests/e2e/update.spec.ts` | e2e | `pnpm e2e` | 2026-11-05T19:25:55Z | chromium, webkit, firefox | failed first, then passed in 3 browsers; suite "215 passed (7.2m), 31 skipped" |
| `tests/e2e/wave.spec.ts` | e2e | `pnpm exec playwright test <spec>` | 2026-11-05 (time not recorded, chunk T394) | not recorded | "18 passed"; first version "3 passed" 20:00:37Z |
| `tests/e2e/lineStyles.spec.ts` | e2e | `pnpm e2e` | failed first 20:58:26Z; 3 full runs 21:17Z to 21:41Z | 8 projects plus the performance project | suite "246 passed, 31 skipped" in each of 3 runs |

All e2e files above also passed in the final full run at 22:11:32Z to 22:19:36Z ("249 passed, 31 skipped"). No row is `MISSING`.

## 5. Review findings

Review mode: plugin (pr-review-toolkit)

The Phase 6 review covered `8661a98..06acbee`. Agents: code-reviewer, pr-test-analyzer, silent-failure-hunter, type-design-analyzer, comment-analyzer and code-simplifier. The code-simplifier edits were saved as a patch and turned into low findings. That patch was applied later in `d71f924`.

| Severity | ID | File | Summary | Status |
|----------|----|------|---------|--------|
| high | H1 | `src/app/SettingsPage.tsx`, `src/app/persistence.ts` | A save that fails during play is never shown to the parent | fixed `5994514` |
| high | H2 | `src/app/persistence.ts` | A later small save clears an earlier save failure | fixed `5994514` |
| medium | M1 | `src/app/App.tsx` | "Übernehmen" ignores a failed `applyTransfer` | fixed `66e9c49` |
| medium | M2, P1 | `src/core/storage/storage.ts`, `progressStore.ts` | Damaged or newer-version data is replaced and then overwritten | fixed `66e9c49` |
| medium | M3 | `src/i18n/de.ts`, `SettingsPage.tsx` | Reset notice does not name the data that was reset | fixed `66e9c49` |
| medium | M4, P2 | `src/app/persistence.ts` | Import and transfer writes are not all-or-nothing | fixed `66e9c49` |
| medium | M5 | `src/app/SettingsPage.tsx` | A failed transfer build leaves no QR and no message | fixed `66e9c49` |
| medium | C1 | `src/core/battle/controller.ts` | Header still describes seeded random hits | fixed `d71f924` |
| medium | C2 | `hitRule.ts`, `round.ts` | Comment describes an unused hit circle | fixed `d71f924` |
| medium | C3 | `src/core/physics/aim.ts` | Angle aim solver is dead code | fixed `d71f924` (file deleted) |
| medium | C4 | `src/core/transfer/transfer.ts` | Comment says `v1.`; codes are `v2.` | fixed `d71f924` |
| medium | T1, P4 | `src/core/transfer/transfer.ts` | Version 2 codes depend on live defaults | fixed `66e9c49` |
| medium | T2 | `src/core/types.ts` | `Challenge` optional fields not tied to the kind | not named in any fix commit or task |
| medium | T3 | `src/core/types.ts` | `RoundState` validity by phase not enforced | not named in any fix commit or task |
| medium | P3 | `src/app/App.tsx` | Hidden-tab pause untested | fixed `66e9c49` |
| medium | P5 | `transfer.test.ts` | Round trips only 2 settings shapes | fixed `66e9c49` |
| medium | P6 | `src/app/App.tsx` | Save link through `hashchange` untested | fixed `66e9c49` |
| medium | R1 | `App.tsx`, `ParentGate.tsx` | Parent menu breaks when the phone turns | fixed `66e9c49` |
| medium | R2 | `App.tsx` | Update can reload while settings are open | fixed `66e9c49` |
| low | L1, L2 | `App.tsx`, `SettingsPage.tsx` | Decode rejection unhandled; contradictory import messages | fixed `66e9c49` |
| low | L3 | `SettingsPage.tsx` | Export has no error handling; URL revoked at once | fixed `d71f924` |
| low | L4 | `src/app/swUpdate.ts` | Update failure dropped | fixed `d71f924` |
| low | L5 | `src/audio/speaker.ts`, `sfx.ts` | No speech error handling; iOS audio may stay silent | **deferred to T155** |
| low | C5 to C8 | several | Stale comments | fixed `d71f924` |
| low | T4 | settings validation | Rules scattered; no whole-number checks | fixed `d71f924` |
| low | T5 to T10 | types | Schema bounds, `LastShot` union, string keys, transfer doc, readonly state, legacy types | not named in any fix commit or task (T8 doc part fixed with C4) |
| low | P7 | `App.tsx` | Record once per round untested | not named in any fix commit or task |
| low | P8, R3 | `transfer.ts` | No size limit when unpacking | fixed `66e9c49` |
| low | P9, P10 | `guided.spec`, `help.spec` | Fixed sleeps and a hard-coded wait | fixed `d71f924` |
| low | P11 | `performance.spec.ts` | Skipped on software rendering, never runs in CI | not named in any fix commit or task |
| low | P12 | controller tests | Fixed seeds couple the tests | not named in any fix commit or task |
| low | R4 | `App.tsx` | Transfer dialog does not pause; stale unlock list | fixed `66e9c49` (unlock-list part untested) |
| low | R5 | `validate.ts` | `addition.maxOperand` unbounded | fixed `66e9c49` |
| low | R6, R7 | `SettingsPage.tsx`, `speaker.ts` | UTC date in file name; network voice may be picked | fixed `d71f924` |
| low | S1 to S5 | several | Code-simplifier patch: dead code, shared helpers, nested ternaries | applied `d71f924` |
| product owner | PO1 | settings | Reading aloud off by default | fixed `a05f1e3` |
| product owner | PO2 | CSS | Phone landscape keeps out of the safe-area insets | fixed `a05f1e3` (CSS rule test only) |
| product owner | PO3 | `src/i18n/de.ts`, `numberLine.ts` | Step prompts reworded; illogical step counts removed | fixed `a05f1e3` |

The orchestrator reports "all items fixed except L5". The fix commits and tasks T307 to T326 do not name T2, T3, T5 to T10, P7, P11 and P12, so the table marks them as not named.

### /simplify (user-requested quality pass, T348)

Range `8661a98..ca96ea2`. Commits `40d941a` (e2e helpers), `e74efea` (core helpers, dead code), `e0564fd` (mode traits, phases), `e47aa8d` (efficiency).

- Applied: U1 to U12; most of S1 to S14; A1 to A6 and A8 to A12; E1 to E4, E6, E7 and E9 to E14.
- Partly applied: A4. `createRound` still places the enemy for test fixtures.
- Skipped:
  - A7: replace the `useScreen` timers. It needs a real iPhone check against T306.
  - A13: a probe helper for 45 `canvas.dataset` writes. Low value.
  - E5: one Phaser game for all battles. A larger change with pause and resume risk.
  - E8: build the transfer link lazily. The QR is expected without a click.
  - `page.clock` for hold presses, as briefed.
  - `ArcResult` test-only fields, `fireAt` (108 test calls), a cap on stored sessions.
- Result: entry bundle 1891.50 kB (519.82 kB gzip) to 469.03 kB (145.70 kB gzip). Phaser loads in its own chunk.
- Note: `e74efea` does not type-check alone. Only `e47aa8d` was verified.

### /code-review high --fix (user-requested, T357, `168932c`)

- A failed Phaser chunk load returns to the start screen (`gameChunk.spec.ts`).
- A ruler tap on the typed number clears the typed digits.
- `SOLUTION_HELP_LEVEL` replaces the literal 3.
- No chime on a hit that does not count.
- "Nur Rechnen" never generates ruler kinds; it falls back to after and before.
- Settings explanations linked with `aria-describedby`.
- `readPosition` answers cached per range and level.
- Product owner: miss feedback shows only the child's number and the steps ("Du: 30 · 1 Schritt"); FR-072 updated.
- Flag: the math-mode property test and the plain-miss check passed before the fix, so they add coverage but were not seen failing.

### /code-review medium --fix (user-requested, T394, `e899393`)

Range `168932c..e2ea884`.

- Review fixed: the `ENEMY_ID` tank was lost after a wave retarget; comparison answers now use the drawn lines.
- Orchestrator decisions:
  - misses and help in a wave go with the next destroyed enemy;
  - the last wreck of a wave stays during its explosion;
  - cleanups: `Tick.visible` and the unused `ticksFor` seed removed, `useScreen` reuses its `MediaQueryList` objects.
- Known and left open: an import cycle between the guided and wave modules; two different nearest-tank rules.

## 6. Autonomous decisions

### Product-owner amendments

Each amendment changed the spec during the run. The orchestrator re-planned tasks for each one.

| Amendment | Change |
|-----------|--------|
| 01 | The child aims by typing a number, not by setting an angle |
| 02 | Any number range, reading the ruler, ruler detail levels |
| 03 | A "Neue Landschaft" (new scene) button |
| 04 | A hit is what the child sees; "Volltreffer" for the exact number |
| 05 | No shortcuts to the answer; parent settings available early |
| 06 | One hit destroys the enemy; the child has 3 lives; score and personal best |
| 07 | The enemy is always visible and fires back after every shot |
| 08 | "Neue Landschaft" keeps the round going |
| 09 | Comparison with one enemy, question in the banner |
| 10 | Decoy tanks return, without number plates |
| 11 | Tank garage with looks earned by playing |
| 12 | iPad and phone screens with an on-screen number pad |
| 13 | The enemy zeroes in on repeated misses; new hills after each destroyed enemy |
| 14 | Visual upgrade of tanks, terrain and effects |
| 15 | Move a save to another browser with a QR code or link |
| 16 | Amazon Fire tablets with the Silk browser |
| 17 | Three play modes on the start screen; faster adaptive difficulty |
| 18 | Parent setting: a point after the full help |
| 19 | Spend stars in the garage; setting for the aiming cross |
| 20 | The ruler always shows all lines; harder levels show fewer numbers |
| 21 | Waves of 1 to 4 enemies in the ruler modes; curved line styles added, then removed by the product owner and replaced by "Keine Linien" |

### Decisions made without asking

- Added tasks during the run: T215 (a hidden enemy's shell must not reveal it), T216 (limit only the added numbers in addition).
- Resolved the T068 and T215 conflict toward hiding the enemy.
- Chose physics constants, hit sizes, the closest-miss distance (35 units) and the star price list.
- Added fields and methods beyond the data model and contract (`RoundState.shot`, `LastShot.enemyNumber`, `getRoundSettings`). The ledger calls this doc drift.
- Bundled `uqr` (MIT) and used `jsqr` (Apache-2.0) for tests only; both credited in the README.
- Used a CC0 dirt texture by Drummyfish from OpenGameArt.
- Picked Fire tablet sizes from Amazon device specs, with 128 px browser bars assumed. The Fire Max 11 is not tested.
- Ran the frame-rate check only with a GPU, last and alone. It is skipped with a reason on software rendering, so CI never runs it.
- Kept `--retry=2` in CI and 4 Playwright workers locally.
- Triage of /simplify and the code reviews as listed in section 5.
- Created the public GitHub repository, published to GitHub Pages from the feature branch, and set the Pages environment to allow `001-math-tanks`.

### Tests not written test-first (flagged in the ledger)

- Chunk 21: classification, ladder and mastery tests written together with the modules.
- Chunk 22: `progressStore.ts` written before its test.
- Chunk 22b: `rulerText.test.ts` helpers drafted before the test ran.
- Chunk 22c: 2 view tests passed before the view code existed.
- Chunk 23: the B1 new-scene unit test and `touch.spec.ts` already passed; `pause.spec.ts` written after the code; `devices.spec.ts` overlap checks added after the CSS fix.
- Review fixes: P5 and P6 tests passed before the fixes; PO2 has only a CSS rule test; the R4 unlock-list part is untested.
- Chunk 24b: Fire tests passed on the current code (coverage only; a mutation check showed they can fail).
- Chunk 24d: the garage-off e2e passed before, because behavior did not change.
- `168932c`: the math-mode property test and the plain-miss check passed before the fix.
- Chunk 22j: transfer while offline is not e2e-tested.

### Flaky tests seen during the run

- `aim.test.ts` "<50 ms" timing failed several times under load. Timing tests moved to a CPU-time median in chunk 24. `aim.ts` and its test were deleted in `d71f924`.
- `arc.test.ts` "<20 ms" failed once or twice.
- E2E failures under parallel load in single runs (Chromium first shot stalls, WebKit "new scene", WebKit `garage.spec`, `steps.spec`, `range.spec`, `speech.spec`). Each passed alone. `e2ea884` moved the keyboard listener into a layout effect, added a `startRound` helper and moved the frame-rate check to a serial project. After that, three full runs passed.

### History rewrite

The product owner asked to remove `.specify/` and `.claude/` from the history. The orchestrator ran `git filter-repo` on `main` and `001-math-tanks` and force-pushed. Old heads were `5f96cc6` (main) and `dd05ce6` (feature). New heads were `b4844ae` and `5c5af96`. `97f2d69` then added the folders to `.gitignore`. All SHAs in this report are new SHAs.

### CI typecheck failure on `9bee47d`

- `9bee47d` (amendment 20) failed the typecheck step in GitHub Actions. `rulerPreview.spec.ts` used `process`, and a clean install has no Node types for that file.
- Local runs did not catch it, because the local tree had extra state.
- The orchestrator found the failure afterwards. The Pages site stayed on `ba485bf` until the fix.
- `199ff2d` fixed it. Since then, each chunk runs a CI parity check in a fresh worktree, and the orchestrator watches CI after every push.

### iPhone rotation fixes not checked on a real device

- `6692763` (T306, Safari): iOS fires rotation events while the window still reports the old size. The fix also listens to `visualViewport`, media queries, `pageshow` and `visibilitychange`, and measures again on later frames.
- `ba485bf` (T368, Chrome on iOS): emulation reproduced a stale size with no resize events. The layout now comes from media queries, with the window size as a fallback. `?debug=screen` shows what the app measures.
- Both fixes pass in Playwright emulation only. A real iPhone check is part of T155.

## 7. Suggested next steps

1. **T155 manual walk-through.** Go through `quickstart.md` scenarios on real devices:
   - an iPad in Safari, including the offline check;
   - an iPhone in Safari and in Chrome, with `?debug=screen`, turning the phone both ways;
   - a Fire tablet in Silk (scenario 33);
   - listen for sound and speech on iOS (review finding L5);
   - scan a large QR code with a camera from a screen.
   Record any failure as a new task in `tasks.md`.
2. **Merge `001-math-tanks` into `main`** when T155 passes. `main` holds only `README`, `LICENSE` and `.gitignore`. The Pages workflow publishes from the feature branch, so update its branch rules after the merge.
3. **Optional: run `/speckit.opsmill.extract`** to move the spec's decisions and guidelines into the project documentation.
4. **Known items to plan:**
   - remove the import cycle between the guided and wave modules;
   - use one nearest-tank rule;
   - decide on review items T2, T3, T5 to T10, P7, P11 and P12, which no fix commit names;
   - the skipped /simplify items A7 and E5;
   - the frame-rate check that never runs in CI;
   - the 100 ms frame stall on the first shot of a battle, recorded in chunk 24.
