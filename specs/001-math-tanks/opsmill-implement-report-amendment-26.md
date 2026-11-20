# Implementation report: amendment 26, plus and minus with two larger numbers

**Status: DONE**

- **Feature**: [amendment 26](./amendment-26-two-number-arithmetic.md) in `specs/001-math-tanks`. Plus and minus get "Zahlengröße" with "Zwei Zahlen":
  - a range for the first number and a range for the second number
  - a carry switch for plus and one for minus
  - place-value help
  - a 4-step adaptive ladder
- **Spec directory**: `/Users/iddo/orca/workspaces/math-tank/anchovy/specs/001-math-tanks`
- **Base commit**: `f3f592c` (end of preparation)
- **Head commit**: `77d39ab` before this report
- **Branch**: `iddocohen/anchovy`
- **Wall-clock time**: about 50 minutes for the implementation, simplify, review and fixes, 2026-11-20 19:03 to 19:56 UTC

This report is separate from `opsmill-implement-report.md`, which covers the feature's first implementation.

## Chunk ledger

| # | Chunk (tasks.md Phase 24l) | Tasks | ✅ / ⚠️ / ❌ | Commit | Notes from the chunk |
|---|---|---|---|---|---|
| 1 | Settings version 13 | T403, T404 | 2 / 0 / 0 | `dc01ed9` | First `twoNumbers.ts` with `carries`, `borrows` and `twoNumberFit`. New `twoNumberDefaults()`. Notes are returned as `{ key, path: '<kind>.size', value }`. |
| 2 | Pairs, answer list, generator, validation | T405 to T408 | 4 / 0 / 0 | `d67a72a` | One pair check shared by generation and validation. The 1 to 999 worst case takes about 5 ms. The `crossTens` skill credit counts only when the ones column carries or borrows. |
| 3 | Place-value help | T409, T410 | 2 / 0 / 0 | `3256652` | A single part leaves out the sum line (40 + 20 shows only "Zehner: 40 + 20 = 60"). A minus with one borrowing jump still begins with "Erst die". |
| 4 | Ladders | T411, T412 | 2 / 0 / 0 | `b7c346d` | With carrying off, steps 3 and 4 equal the parent's settings, so the child never drops back to the lower half after a raise. The fallback is `playableStep`. |
| 5 | Settings page and banner | T413, T414 | 2 / 0 / 0 | `8f77e5b` | "Plus und Minus" is split into a "Plus" group and a "Minus" group. The lines sit under the help hint in the status line. Speech for the lines was dropped on the product owner's request. |
| 6 | e2e and README | T415, T416 | 2 / 0 / 0 | `071453a` | `twoNumbers.spec.ts` runs in the desktop and device projects. The README "Tutorial for parents" and "Status" sections are updated. |

Other commits after the chunks:

- `dff85bd`: the spec records that the lines are not read aloud (product owner: "No reading out loud needed").
- `a414c37`: `/simplify` fixes.
- `77d39ab`: review fixes.

## Tasks not completed

None. T403 to T416 are `[X]`.

## Local-pass evidence

Every test below ran on macOS with no extra environment, except where the table names a browser or device.

| Test id | Type | Run command | Passed at (ISO 8601) | Environment | Verbatim pass line |
|---|---|---|---|---|---|
| `settings.test.ts` "Zwei Zahlen" settings (9 tests), defaults; `storage.test.ts` migrate 12 → 13 and the version checks; `exportImport.test.ts` (2 tests); `transfer.test.ts` (5 tests); `twoNumbers.test.ts` carries, borrows and twoNumberFit (6 tests) | unit | `npx vitest run src/core/settings/settings.test.ts src/core/storage/storage.test.ts src/core/storage/exportImport.test.ts src/core/transfer/transfer.test.ts src/core/math/twoNumbers.test.ts --reporter=verbose` | 2026-11-20T19:08:06Z | n/a | `Tests  198 passed (198)` |
| `twoNumbers.test.ts` rules, pairs and answers (27 tests); `generate.test.ts` "Zwei Zahlen" (6 tests); `validate.test.ts` arithmeticErrors "Zwei Zahlen" (6 tests) | unit | `pnpm vitest run src/core/math/twoNumbers.test.ts src/core/math/generate.test.ts src/core/math/validate.test.ts --reporter=verbose` | 2026-11-20T19:13:27Z | n/a | `Tests  68 passed (68)` |
| `placeValue.test.ts` (19 tests); `help.test.ts` nextHelp "Zwei Zahlen" (5 tests); `i18n.test.ts` helpLines (5 tests) | unit | `pnpm vitest run src/core/math/placeValue.test.ts src/core/battle/help.test.ts src/i18n/i18n.test.ts --reporter=verbose` | 2026-11-20T19:17:06Z | n/a | `Tests  72 passed (72)` |
| `ladders.test.ts` "Zwei Zahlen" ladders (8 tests); `adaptive.test.ts` (4 tests); `summarize.test.ts` (1 test) | unit | `pnpm vitest run src/core/progress/ladders.test.ts src/core/progress/adaptive.test.ts src/core/progress/summarize.test.ts --reporter=verbose` | 2026-11-20T19:20:34Z | n/a | `Tests  45 passed (45)` |
| `SettingsPage.test.tsx` "Zahlengröße" (7 tests); `BattleOverlay.test.tsx` place-value help (2 tests); `battleController.test.ts` "Zwei Zahlen" mid-round (1 test) | unit | `pnpm vitest run src/app/SettingsPage.test.tsx src/app/BattleOverlay.test.tsx src/core/battle/battleController.test.ts -t "Zahlengröße\|place-value help\|Zwei Zahlen" --reporter=verbose` | 2026-11-20T19:28:15Z | n/a | `Tests  10 passed \| 274 skipped (284)` |
| Review fixes: `settings.test.ts` (2 tests); `SettingsPage.test.tsx` (2 tests); `generate.test.ts` "when the enemy gap leaves no answer at the playable step, a harder step gives the plus challenge" | unit | `pnpm test` | 2026-11-20T19:53:45Z | n/a | `Tests  1616 passed (1616)` |
| All unit tests after the review fixes | unit | `pnpm test` | 2026-11-20T19:55:30Z | n/a | `Tests  1616 passed (1616)` |
| `twoNumbers.spec.ts:35` "Zwei Zahlen" plus without carrying: 5 banners with two two-digit numbers, place-value help, 550 to 780 blocks saving | e2e | `pnpm exec playwright test tests/e2e/twoNumbers.spec.ts --project=chromium --project=webkit --project=firefox --project=ipad-landscape --project=ipad-portrait --project=iphone-landscape --project=iphone-portrait --reporter=list` | 2026-11-20T19:54:02Z | 7 Playwright projects: Chromium, WebKit, Firefox, iPad and iPhone emulation | `7 passed (1.2m)` |
| The whole e2e suite, as a regression check | e2e | `pnpm exec playwright test --project=chromium --reporter=list` | 2026-11-20T19:55:44Z | Playwright Chromium | `75 passed (3.7m)` |

## Review findings

Review mode: command (`/code-review high`), as the product owner asked. `/simplify` ran first.

The `/simplify` pass had four reviewers: reuse, simplification, efficiency and altitude. Its fixes are in `a414c37`:

- **One rule each**: one carry and borrow rule, one pair rule, one cache key and memo helper, and one "Zwei Zahlen" guard.
- **Shared limits**: `lowestResult`, `highestResult` and `isTwoNumbers` moved to `src/core/settings/limits.ts`.
- **One ladder**: plus and minus share `TWO_NUMBER_STEPS`.
- **One status helper**: `twoNumberStatus` serves both the errors and the notes.
- **Settings page**: the errors and notes are computed once per draft with `useMemo`.
- **Cache**: the oldest entry is dropped, instead of clearing the whole cache.

Simplify suggestions that were not applied:

- a type union for `Challenge` (too broad a change)
- ladders that own their clamping (too broad a change)
- the step fallback for the "Kleine Schritte" ladders (changes behavior)
- debouncing the settings checks (the memo is enough)
- a change to the transfer base (not verified)
- computing the playable step once instead of twice: no double computation exists in the app

`/code-review high` findings:

| Severity | File | Summary | Outcome |
|---|---|---|---|
| important | `src/core/settings/validate.ts`, `src/app/SettingsPage.tsx` | A cleared "Zwei Zahlen" range field could be saved as `null` after switching back to "Kleine Schritte", and the settings then failed to load. | Fixed in `77d39ab`. Changing "Zahlengröße" resets an incomplete range to 10 to 99. The ranges must always hold whole numbers. |
| important | `src/app/SettingsPage.tsx` | Errors on the hidden largest operand blocked "Speichern" with no visible reason. | Fixed in `77d39ab`. The "Kleine Schritte" operand checks are skipped for "Zwei Zahlen", and an empty operand is reset when the size changes. |
| important | `src/core/progress/ladders.ts`, `src/core/math/generate.ts` | The step fallback ignored the gap around the player, so plus could be dropped for a turn. | Fixed in `77d39ab`. The generator tries harder steps, up to the parent's settings, when the gap empties the answer list. |
| nit | `src/core/settings/validate.ts` | The note names the smallest or largest answer, even when the real limit is the first number on the battlefield. | Deferred. |
| nit | `src/app/BattleOverlay.tsx` | The lines sit in the status live region, so screen readers announce them. The code comment said they are not read aloud. | The comment now says the rule covers the game's "Vorlesen" speech. Behavior is unchanged. |

## Autonomous decisions

- **Specify, plan and tasks skills not run**: they were done by hand as amendment files and edits in `specs/001-math-tanks`, following the repo's amendment convention. `speckit-specify` would have made a new feature folder and branch.
- **How the "overflow with X digits" request was read**: as separate ranges for the first and the second number. First number 10 to 99 and second number 1 to 9 with carrying gives 45 + 6. Please confirm this reading.
- **Reviewer choice**: the product owner asked for `/simplify` and `/code-review high`, so these replaced the `pr-review-toolkit` agents.
- **Place-value line rules**:
  - A line shows only for a place where the second number has a digit other than 0.
  - A single part leaves out the sum line.
  - A minus with borrowing shows jumps instead of columns.
- **Settings defaults**: the carry switches default to off, and "Größtes Ergebnis" still applies to plus in "Zwei Zahlen".
- **Skill credit**: a "Zwei Zahlen" exercise counts toward the "crossing tens" skill only when its ones column carries or borrows.
- **Changing "Zahlengröße" resets incomplete hidden fields**: an incomplete hidden range goes to 10 to 99, and an empty largest operand goes to 10. Saving is not blocked.
- **Review test example replaced**: the example from the review brief for the enemy-gap fallback could not happen. The test uses first 1 to 9, second 1 to 9, carrying on, and the player at 0.

## Suggested next steps

1. Play "Zwei Zahlen" with the child (quickstart row 37), and confirm the reading of "overflow with X digits".
2. Decide on the deferred nit: whether the settings note should name the first-number limit when that is the cause.
3. Run `/speckit.opsmill.extract` when ready, then open a PR from `iddocohen/anchovy`.
