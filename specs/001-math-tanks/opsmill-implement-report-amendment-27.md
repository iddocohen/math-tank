# Implementation report: amendment 27, "Plus und Minus" and "Zahlen-Rätsel" instead of "Nur Rechnen"

**Status: DONE**

- **Feature**: [amendment 27](./amendment-27-split-math-mode.md) in `specs/001-math-tanks`. The play mode "Nur Rechnen" is replaced by:
  - "Plus und Minus" (key 3): only addition and subtraction, never another kind
  - "Zahlen-Rätsel" (key 4): the number-line and comparison kinds that need no ruler
- **Spec directory**: `/Users/iddo/orca/workspaces/math-tank/anchovy/specs/001-math-tanks`
- **Base commit**: `43b1190` (end of preparation)
- **Head commit**: `0fb9011` before this report
- **Branch**: `iddocohen/split-math-mode`
- **Wall-clock time**: about 80 minutes for the implementation, review and fixes, 2026-11-21 07:08 to 08:37 UTC

This report is separate from the reports of the first implementation and of amendment 26.

## Chunk ledger

| # | Chunk (tasks.md Phase 24m) | Tasks | ✅ / ⚠️ / ❌ | Commit | Notes from the chunk |
|---|---|---|---|---|---|
| 1 | Settings version 14 and the mode switches | T417, T418 | 2 / 0 / 0 | `b98574e` | Keys 1 to 4 and the four switches on the settings page were done early, in this chunk. Test settings with only "Zahlenstrahl", or only "Plus" and "Minus", now turn off the mode they cannot play, because otherwise they load as the defaults. |
| 2 | Mode table, exercise search, generator and the exercise check | T419 to T422 | 4 / 0 / 0 | `14012eb`, `bd66292` | Stage 3 is a safety net that valid settings do not reach. `memo` in `twoNumbers.ts` is exported for reuse. The exercise check is skipped while any range, plus or minus field has an error. |
| 3 | Records and progress page | T423, T424 | 2 / 0 / 0 | `3e9693e` | The label key is `progressPage.legacyMathMode`, because `de.ts` has no `progress` section. |
| 4 | Start screen, keyboard and settings page | T425, T426 | 2 / 0 / 0 | `9ec2c36` | The start screen was measured at 13 screen sizes: every button is inside the screen with no scrolling. The garage button is 72 px tall on phones held sideways. |
| 5 | Settings changed during a round and "Nochmal" | T427, T428 | 2 / 0 / 0 | `2fc93f2` | The app test for "the mode can no longer play" mocks `modeCanPlay`, because valid stored settings cannot reach that case. |
| 6 | End-to-end test, Playwright projects and README | T429, T430 | 2 / 0 / 0 | `67405b8` | Fixed 7 chromium e2e tests: the settings in `src/core/math/fixtures.ts` failed the new mode checks, so the game loaded the defaults. In "Plus und Minus", before any miss, one press of H goes straight to help step 2; quickstart row 38 says so. |

Commit after the chunks: `0fb9011`, the review fixes.

## Tasks not completed

None. T417 to T430 are `[X]`.

## Local-pass evidence

The tests below ran on macOS (Darwin 25.6.0) with Node 25.6.1 and no extra environment, except where the table names a browser or device.

| Test id | Type | Run command | Passed at (ISO 8601) | Environment | Verbatim pass line |
|---|---|---|---|---|---|
| `settings.test.ts`, `storage.test.ts`, `exportImport.test.ts` and `transfer.test.ts`: version 14, the mode errors and the migration (8 new tests) | unit | `pnpm vitest run src/core/settings/settings.test.ts src/core/storage/storage.test.ts src/core/storage/exportImport.test.ts src/core/transfer/transfer.test.ts` | 2026-11-21T07:17:55Z | n/a | `Tests  202 passed (202)` |
| `modes.test.ts` (new), `arithmetic.test.ts` (new), `generate.test.ts`, `generator.property.test.ts`, `wave.test.ts`, `help.test.ts`, `battleController.test.ts`, `settings.test.ts`, `storage.test.ts`, `exportImport.test.ts`, `transfer.test.ts` | unit | `pnpm exec vitest run` with these 11 files | 2026-11-21T07:34:15Z | n/a | `Tests  608 passed (608)` |
| `records.test.ts` | unit | `pnpm vitest run src/core/records/records.test.ts` | 2026-11-21T07:38:23Z | n/a | `Tests  13 passed (13)` |
| `summarize.test.ts` | unit | `pnpm vitest run src/core/progress/summarize.test.ts` | 2026-11-21T07:38:25Z | n/a | `Tests  11 passed (11)` |
| `ProgressPage.test.tsx` | unit | `pnpm vitest run src/app/ProgressPage.test.tsx` | 2026-11-21T07:38:27Z | n/a | `Tests  14 passed (14)` |
| `StartScreen.test.tsx` | unit | `pnpm exec vitest run src/app/StartScreen.test.tsx` | 2026-11-21T07:44:10Z | jsdom | `Tests  12 passed (12)` |
| `keyboard.test.ts` | unit | `pnpm exec vitest run src/app/keyboard.test.ts` | 2026-11-21T07:44:10Z | jsdom | `Tests  24 passed (24)` |
| `SettingsPage.test.tsx` | unit | `pnpm exec vitest run src/app/SettingsPage.test.tsx` | 2026-11-21T07:44:10Z | jsdom | `Tests  63 passed (63)` |
| `BattleOverlay.test.tsx` | unit | `pnpm exec vitest run src/app/BattleOverlay.test.tsx` | 2026-11-21T07:44:10Z | jsdom | `Tests  61 passed (61)` |
| `battleController.test.ts` (4 new tests) | unit | `pnpm vitest run src/core/battle/battleController.test.ts` | 2026-11-21T07:48:23Z | n/a | `Tests  176 passed (176)` |
| `App.test.tsx` (3 new tests) | unit | `pnpm vitest run src/app/App.test.tsx` | 2026-11-21T07:48:23Z | jsdom | `Tests  13 passed (13)` |
| Review fixes: `arithmetic.test.ts` (a rejected draft moves on to the next answer) | unit | `pnpm vitest run src/core/math/arithmetic.test.ts` | 2026-11-21T08:33:36Z | n/a | `Tests  57 passed (57)` |
| Review fixes: `transfer.test.ts` (four modes and four new bests stay under 2300 bytes) | unit | `pnpm vitest run src/core/transfer/transfer.test.ts` | 2026-11-21T08:33:38Z | n/a | `Tests  53 passed (53)` |
| Review fixes: `help.test.ts` (renamed tests) | unit | `pnpm vitest run src/core/battle/help.test.ts` | 2026-11-21T08:33:44Z | n/a | `Tests  31 passed (31)` |
| All unit tests after the review fixes, including `fixtures.test.ts` (new in chunk 6) | unit | `pnpm test` | 2026-11-21T08:33:46Z | n/a | `Tests  1747 passed (1747)` |
| `modes.spec.ts` (3 new tests) and `twoNumbers.spec.ts`, from a fresh build | e2e | `pnpm exec playwright test tests/e2e/modes.spec.ts tests/e2e/twoNumbers.spec.ts` with the 13 projects chromium, webkit, firefox, ipad-landscape, ipad-portrait, iphone-landscape, iphone-portrait, fire-7-landscape, fire-7-portrait, fire-hd-8-landscape, fire-hd-8-portrait, fire-hd-10-landscape, fire-hd-10-portrait | 2026-11-21T08:31:27Z | 13 Playwright projects | `98 passed (6.8m)` |
| Every e2e test, as a regression check, from a fresh build | e2e | `pnpm exec playwright test --project=chromium --reporter=line` | 2026-11-21T08:35:47Z | Playwright Chromium | `1 skipped` / `78 passed (4.3m)` |
| `modes.spec.ts` on the build with the review fixes | e2e | `pnpm exec playwright test tests/e2e/modes.spec.ts --project=chromium --project=iphone-portrait --project=fire-7-landscape --reporter=line` | 2026-11-21T08:37:23Z | Chromium, iPhone upright, Fire 7 sideways | `21 passed (1.4m)` |

Notes on the e2e runs:

- **Stale server:** a preview server left on port 4173 by a chunk subagent was stopped before the e2e runs above. Playwright reuses a running server without rebuilding, so the runs inside chunk 6 may have tested an older build. The three runs above each built the game first.
- **Flaky test:** `guided.spec.ts:37` timed out once inside chunk 6, while reading the encouragement text, which fades out. It then passed 3 times with `--repeat-each=3`, and in the full chromium run above.
- **Timing tests:** the 50 ms timing test in `twoNumbers.test.ts` (from amendment 26) failed in 2 of 4 full unit runs during chunk 2 because of machine load, and passed alone. CI runs the unit tests with `--retry=2`.

## Review findings

Review mode: plugin (pr-review-toolkit)

Five agents reviewed `43b1190..0fb9011`: code-reviewer, pr-test-analyzer, silent-failure-hunter, type-design-analyzer and comment-analyzer. None reported a high finding. `code-simplifier` ran afterwards. Its edits became low findings and were discarded, and the untracked build file `tsconfig.tsbuildinfo` was left alone.

| Severity | File | Summary | Outcome |
|---|---|---|---|
| medium | `src/core/math/generate.ts` | Stage 3 checked only the first draft and threw when it was rejected. Amendment 27 item 8 says stage 3 tries every answer. | Fixed in `0fb9011`. The error text now names the kinds, the range and the tank position. |
| medium | `src/core/transfer/transfer.test.ts` | The planned test with four modes and four new bests under the 2300-byte limit was missing. | Fixed in `0fb9011`. |
| medium | `src/app/App.tsx`, `src/core/battle/help.test.ts` | The App header said "Nochmal" always repeats the mode. Three test names still said "Nur Rechnen". | Fixed in `0fb9011`. |
| medium | `src/core/math/generate.ts` | `onlyArithmetic` can be passed with non-arithmetic kinds in `kindsAllowed`. Only `playModeKinds` sets it, and a test checks that it agrees with the mode table. | Deferred. |
| medium | `src/core/modes.ts` | `ModeTraits` lets `kinds`, `fallbackKinds` and `showsRuler` disagree. A test ties them together. | Deferred. |
| medium | `src/core/math/generate.ts`, `src/core/battle/controller.ts` | A throw from the generator has no error boundary, and `controller.startRound` does not check `modeCanPlay` itself. Every entry point today goes through checked settings or the App check. | Deferred. |
| medium | `generate.test.ts`, `battleController.test.ts` | No test for a "Zahlen-Rätsel" round after "Zahlenstrahl" and "Vergleichen" are turned off, or for "Neue Landschaft" with only "Vergleichen" on. The round then asks only "after" and "before". | Deferred. FR-160 allows the fallback. The spec could state this case. |
| low | `src/core/battle/help.ts`, `src/core/math/generate.ts` | The help header did not say step 1 is skipped before a miss. One comment was not rewrapped. | Fixed in `0fb9011`. |
| low | `src/core/settings/schema.ts` | `PLAY_MODES` was not checked against the keys of `playModes`. | Fixed in `0fb9011` with a compile-time check. |
| low | `src/core/modes.ts` | `modeCanPlay` checks only the two ends of the range. This is correct because the child's tank only stands at either end, but no comment says so. | Deferred. |
| low | `src/core/storage/migrate.ts` | The version 14 step turns "Plus und Minus" off without telling the parent (critique P5). | Accepted. Reported to the product owner. |
| low | `src/app/SettingsPage.tsx` | The "no exercise" error shows at "Spielarten" and the range, not at "Größtes Ergebnis" or the operand fields. | Deferred. |
| low | `arithmetic.test.ts`, `storage.test.ts` | The wall-clock limits (50 ms and 100 ms) can fail on a busy machine. | Deferred. |
| low | `src/app/ProgressPage.tsx` | The literal `'math'` could be a named constant. | Deferred. |
| low (simplifier) | `src/core/math/generate.ts` 116 to 129 | `playModeKinds` could use one `switch` instead of three `if` checks. | Discarded (simplifier edits are not kept). |
| low (simplifier) | `src/core/math/arithmetic.ts` 201 to 204 | `turnedOnKinds` could be one filter. | Discarded. |

## Autonomous decisions

- **Reading of the request**: "what is between numbers" was read as every number question without a ruler:
  - before and after
  - steps
  - the missing number
  - the midpoint
  - all comparison kinds

  The narrower reading would be only "between", "middle", "before" and "after". The product owner should confirm the wider reading.
- **Labels**: "Plus und Minus" and "Zahlen-Rätsel". Not confirmed by the product owner.
- **Specify, plan and tasks skills not run**: written by hand as amendment files in `specs/001-math-tanks`, as for amendment 26, because `speckit-specify` would make a new feature folder.
- **Migration**: old "Nur Rechnen" turns on each new mode only when that mode can play with the stored settings. When no mode is left, "Gemischt" is turned on. The parent gets no notice.
- **Records**: old "Nur Rechnen" bests stay and show as "Nur Rechnen" on the progress page. They do not count for either new mode.
- **Running round after a reload**: no mapping was needed, because the game does not save a running round.
- **Review fixes beyond high severity**: no finding was high. Three cheap medium findings that close gaps to the spec were fixed anyway.
- **Stale preview server**: stopped, and the e2e tests were run again from fresh builds.

## Suggested next steps

1. Confirm the reading of "what is between numbers" and the two labels.
2. Play both modes on a phone held upright and a Fire tablet (quickstart row 38).
3. Decide on the deferred findings, mainly the "Zahlen-Rätsel" round after its switches are turned off.
4. Open a PR from `iddocohen/split-math-mode` when ready. Run `/speckit.opsmill.extract` if wanted.
