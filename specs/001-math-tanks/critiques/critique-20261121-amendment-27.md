# Critique Report: Amendment 27, "Plus und Minus" and "Zahlen-Rätsel" instead of "Nur Rechnen"

**Date**: 2026-11-21
**Feature**: [spec.md](../spec.md) (US11 scenarios 7 to 14, FR-158 to FR-166, the amendment 27 notes on FR-046, FR-047, FR-062, FR-086, FR-121, FR-122, FR-123, FR-155), [amendment 27](../amendment-27-split-math-mode.md)
**Plan**: [plan.md](../plan.md) decision 13, [research.md](../research.md) R25, [data-model.md](../data-model.md), [core-api.md](../contracts/core-api.md), [quickstart.md](../quickstart.md) row 38
**Verdict**: ⚠️ PROCEED WITH UPDATES

---

## Executive Summary

The amendment splits "Nur Rechnen" into two play modes through the existing `MODE_TRAITS` table. Help, the number pad, speech and the overlay read the traits, so most of the game needs no change. The wave size stays 1 in both modes, because `wave.ts` uses `enemiesAtOnce` only for "Gemischt" and the `readPosition` trait (verified). Two gaps block implementation:

- The new settings check runs only while "Plus und Minus" is offered. A running round and "Nochmal" keep the mode after the parent changes the settings, so the generator can reach settings with no exercise and throw.
- The version 14 migration runs the exercise search on raw, unchecked data from storage, export files and transfer codes, before the schema check and before the operand limits are clamped. A large `maxOperand` in a damaged or crafted file makes the search loop for a very long time.

Four smaller risks should be covered:

- the memoized search takes an rng
- the start screen layout with four buttons
- the e2e projects that run `modes.spec.ts`
- the error location on the settings page

The project constitution is an unfilled template, so no principle applies.

---

## Product Lens Findings 🎯

### Problem Validation
| ID | Severity | Finding | Suggestion |
|----|----------|---------|------------|
| P1 | 🤔 | The request "one with what is between numbers" is read as every other kind without a ruler, including "stepsRight", "stepsLeft", "greater" and "smaller" (Decision 1). A narrower reading is possible: only the kinds that ask about a number between others ("missingBetween", "midpoint", "between", "middle3", "after", "before"). The labels "Plus und Minus" and "Zahlen-Rätsel" are not confirmed by the product owner (Decision 2). | Keep the reading. Report both the reading and the labels in the run summary so the product owner can correct them. |

### User Value Assessment
| ID | Severity | Finding | Suggestion |
|----|----------|---------|------------|
| P2 | 💡 | A "Nur Rechnen" best is not carried to either new mode (Decision 7). The first round of each new mode shows "Neuer Rekord!". This is a fair choice, because the old round mixed both kinds of questions. | None. |

### Alternative Approaches
| ID | Severity | Finding | Suggestion |
|----|----------|---------|------------|
| P3 | 💡 | Falling back to "after" and "before" in "Plus und Minus" would avoid the new settings check and the exact search. The amendment rejects it because the product owner asked for a mode with only addition and subtraction. | None. The rejection is stated in R25. |

### Edge Cases & UX
| ID | Severity | Finding | Suggestion |
|----|----------|---------|------------|
| P4 | 💡 | The error `arithmeticModeNoExercise` shows in the group "Spielarten", but the cause is in the range, "Größtes Ergebnis" or the "Zwei Zahlen" fields. A parent who changes the range sees an error in another group. `withRange` (FR-047, the automatic limit adjustment) does not fix this error. | Show the error text also at the range group, or scroll to "Spielarten" when saving is blocked. Add a settings page test for a range change that causes the error. |
| P5 | 💡 | The migration turns "Plus und Minus" off without telling the parent when the stored settings fail the new check, and can turn "Gemischt" on when it was off (amendment 27 item 9). The parent then sees a different start screen with no reason given. | Accept for now, because it affects only settings with no exercise far enough from the tank. Note it in the release notes or the run summary. |

### Success Measurement
| ID | Severity | Finding | Suggestion |
|----|----------|---------|------------|
| P6 | 💡 | The amendment has no success criterion of its own. The PRD measures success by whether the child plays another round, and that covers both modes. | None needed. Quickstart row 38 gives the manual check. |

---

## Engineering Lens Findings 🔬

### Architecture Soundness
| ID | Severity | Finding | Suggestion |
|----|----------|---------|------------|
| E1 | 💡 | Two new trait values (`'arithmetic'`, `'numbersWithoutRuler'`) plus a separate `onlyArithmetic` input carry the same rule as `fallbackKinds: []`. The generator then has three switches (`withoutRuler`, `onlyArithmetic`, `fallbackKinds`) that must agree. | Derive `onlyArithmetic` from the trait in `playModeKinds` only, and add a mode table test that each mode's switches agree. |

### Failure Mode Analysis
| ID | Severity | Finding | Suggestion |
|----|----------|---------|------------|
| E2 | 🎯 | The checks `arithmeticModeNoType` and `arithmeticModeNoExercise` run only when `playModes.arithmetic` is on. But a round keeps its mode after the settings change: `playModes` is a live key and a task change rebuilds the scene in the same mode (`src/core/battle/controller.ts`, `LIVE_KEYS` and `applyPendingSettings`), and "Nochmal" repeats the mode of the round that ended (`src/app/App.tsx`, `startRound`). Example: during a "Plus und Minus" round the parent turns off "Plus und Minus", "Plus" and "Minus" and saves. Saving passes, the scene is rebuilt, `kindsAllowed` is empty, `fallbackKinds` is empty, `arithmeticExerciseAt` returns null and `generateChallenge` throws. Today "Nur Rechnen" falls back to "after" and "before" in this case. | Add a rule to the spec and the plan: when the round's mode cannot give a challenge with the new settings (the same test as FR-162, as a function `modeCanPlay(mode, settings)`), the running round keeps its task settings until it ends, and "Nochmal" goes to the start screen instead. Add controller tests for both paths. |
| E3 | 🎯 | `migrateSettingsToV14` runs the "Plus und Minus" exercise check inside `migrateSettings` (R25, data-model.md). That step works on the raw object from storage, an export file or a transfer code, before `clampAdditionOperand` and before the schema check in `parseSettings` (`src/core/storage/migrate.ts`). `operandsInto` loops from 1 to `maxOperand` (`src/core/math/arithmetic.ts`), so a damaged or crafted file with `subtraction.maxOperand` 1000000000 hangs the page. Unclamped values also give a different answer than the check that runs later. | Let the migration set `arithmetic` to `math && (addition || subtraction)` only. In `parseSettings`, after the schema check and the clamp, turn `arithmetic` off when it was migrated from version 13 and `arithmeticModeNoExercise` fails, then turn `mixed` on when no mode is left. Add a storage test with a huge `maxOperand` in version 13 data. |
| E4 | 💡 | A challenge from stage 3 uses the top step but records the skill's current step (amendment 27 item 8). Adaptive difficulty can then count a hard exercise as an easy one. | Accept, as amendment 26 does for its step fallback. Say so in R25. |

### Security & Privacy
| ID | Severity | Finding | Suggestion |
|----|----------|---------|------------|
| E5 | 💡 | Settings from import files and transfer codes are untrusted input. Apart from E3, the new fields are two booleans checked by the schema. | Covered by E3. |

### Performance & Scalability
| ID | Severity | Finding | Suggestion |
|----|----------|---------|------------|
| E6 | 💡 | `arithmeticExerciseAt` takes an rng and returns a draft, but R25 memoizes it on the settings fields. A cached draft would ignore the rng of the next call, so every challenge from stage 3 would be the same exercise. | Memoize the exact set of answers that have an exercise, per settings and player side. Let the rng pick the start answer and the operands on each call. The settings check then only tests that the set is not empty. |
| E7 | 💡 | `validateSettings` runs on every change on the settings page and now runs the exact search for both ends and both kinds. When no exercise exists, the search walks every answer, which is the case while the parent types into a field. | Add a unit test that keeps the worst case (width 1000, largest operand 1000, two steps, no valid answer) under about 50 ms, as amendment 26 did for `twoNumberFit`. |

### Testing Strategy
| ID | Severity | Finding | Suggestion |
|----|----------|---------|------------|
| E8 | 💡 | `tests/e2e/modes.spec.ts` runs only in the desktop projects today. `DEVICE_AND_DESKTOP_SPECS` lists `garageBattle`, `settingsApply` and `twoNumbers`, and the Fire projects match only `fire.spec.ts` (`playwright.config.ts`). Plan decision 13 does not list `playwright.config.ts`, so the four-button check of FR-166 would not run on the phone or the Fire sizes. | Add `playwright.config.ts` to decision 13: add `modes` to `DEVICE_AND_DESKTOP_SPECS` and to the Fire projects' `testMatch`. |
| E9 | 💡 | Quickstart row 38 migrates version 13 settings with only "Plus" on and the default "Größtes Ergebnis", so the check passes. It does not try the failing case from amendment 27 item 12 ("Größtes Ergebnis" 5), and it does not try a settings change during a round (E2). | Add both steps to row 38. |

### Operational Readiness
| ID | Severity | Finding | Suggestion |
|----|----------|---------|------------|
| E10 | 💡 | The start screen layout relies on `flex-wrap` (`.play-buttons` in `src/app/styles.css`). With `.mode-button` at 220 by 180 pixels, flex-wrap gives three buttons and one button at widths between about 700 and 950 pixels, not two rows of two. On an iPhone 13 held upright (390 by 664) only one button fits per row, so four rows of 180 pixels do not fit the height. R25 says the buttons "shrink" but gives no sizes. | Use a grid with 4 columns when four fit and 2 columns otherwise, set by media queries. Give the button sizes for phone upright and short screens in R25. |

### Dependencies & Integration
| ID | Severity | Finding | Suggestion |
|----|----------|---------|------------|
| E11 | 💡 | `summarize.ts` sorts bests by `PLAY_MODES.indexOf(mode)`. A `math` record gives -1 and sorts before "Gemischt". Plan decision 13 lists the sort order but does not say where "Nur Rechnen" goes. | Sort `math` after "Zahlen-Rätsel" and add a summarize test. |

---

## Cross-Lens Insights 🔗

| ID | Finding | Product Impact | Engineering Impact | Suggestion |
|----|---------|---------------|-------------------|------------|
| X1 | A round in "Plus und Minus" can outlive the settings that allowed it (E2) | The child's game stops with an error after the parent changes settings. | `generateChallenge` throws. | Keep the round's task settings until the round ends when the mode can no longer play, and send "Nochmal" to the start screen. |
| X2 | The migration check on raw data (E3) | A damaged export file or transfer code freezes the page instead of loading the defaults. | Unbounded loop before the schema check. | Move the check after the schema check and the clamp. |

---

## Findings Summary

| ID | Lens | Severity | Category | Finding | Suggestion |
|----|------|----------|----------|---------|------------|
| E2 | Engineering | 🎯 | Failure modes | A running round or "Nochmal" reaches settings with no exercise and the generator throws | Keep the round's task settings when the mode can no longer play; "Nochmal" goes to the start screen |
| E3 | Engineering | 🎯 | Failure modes | The migration searches raw, unclamped data | Run the check in `parseSettings` after the schema check and the clamp |
| P1 | Product | 🤔 | Problem validation | Reading of "what is between numbers" and the labels | Keep; report in the run summary |
| P4 | Product | 💡 | UX | The error shows in "Spielarten", the cause is elsewhere | Show it at the range group too, or scroll to it |
| P5 | Product | 💡 | UX | The migration turns "Plus und Minus" off without a notice | Accept; note it in the run summary |
| E1 | Engineering | 💡 | Architecture | Three generator switches must agree | Derive `onlyArithmetic` from the trait; mode table test |
| E4 | Engineering | 💡 | Failure modes | Stage 3 records the current step | Accept; say so in R25 |
| E6 | Engineering | 💡 | Performance | A memoized draft ignores the rng | Memoize the answer set, not the draft |
| E7 | Engineering | 💡 | Performance | The exact search on every settings change | Worst-case timing test |
| E8 | Engineering | 💡 | Testing | `modes.spec.ts` does not run on phones or Fire tablets | Change `playwright.config.ts` |
| E9 | Engineering | 💡 | Testing | Quickstart row 38 misses two cases | Add the failing migration and the mid-round change |
| E10 | Engineering | 💡 | Operations | `flex-wrap` gives 3 and 1, and four rows on a phone held upright | Grid with 4 or 2 columns; give the sizes |
| E11 | Engineering | 💡 | Integration | Sort order of `math` bests | Sort after "Zahlen-Rätsel"; test |
| P2 | Product | 💡 | User value | Old bests are not carried over | None |
| P3 | Product | 💡 | Alternatives | Fallback to "after" and "before" | None |
| P6 | Product | 💡 | Success | No own success criterion | None |
| E5 | Engineering | 💡 | Security | Untrusted import data | Covered by E3 |

## Applied (autonomous run)

- E2 is added as FR-167 and US11 scenario 15 in spec.md, with notes on FR-049 and FR-121, as amendment 27 Decision 11 and Behavior item 12, and in research R25, data-model.md, core-api.md (`modeCanPlay`) and plan decision 13. Verified in `src/core/battle/controller.ts` (`LIVE_KEYS`, `applyPendingSettings`) and `src/app/App.tsx` (`startRound`). The round keeps its task settings until it ends when its mode cannot play with the new settings; "Nochmal" shows the start screen when the mode is no longer offered or cannot play.
- E3 is added to FR-162, FR-165, amendment 27 items 7 and 9, research R25 and data-model.md. Verified in `src/core/storage/migrate.ts`: `parseSettings` calls `settingsSchema.safeParse(migrate(raw))` and then `validateSettings`, and `migrate` clamps only `addition.maxOperand`. The version 14 step only renames the switches; `parseSettings` runs the exercise check for version 13 and older data after the schema check and the clamp, and the check runs only when the operand fields have no error.
- P1 is kept: the reading of Decision 1 and the labels stay, and amendment 27 Decision 2 asks the product owner to confirm both.
- P4 is added to FR-162, amendment 27 item 7, research R25, data-model.md and plan decision 13: the error also shows at the range field, with a settings page test.
- P5 is accepted and noted in amendment 27 item 9, research R25 and data-model.md, for the run summary.
- E1 is added to research R25, core-api.md and the mode table tests of amendment 27 item 13.
- E4 is accepted and stated in research R25 and amendment 27 item 8.
- E6 is added to research R25, core-api.md (`arithmeticAnswerSet`), amendment 27 item 8 and plan decision 13.
- E7 is added as a timing test to research R25 and amendment 27 item 13.
- E8 is added to plan decision 13 and amendment 27 item 13 (`playwright.config.ts`).
- E9 is added to quickstart row 38.
- E10 is added to FR-166, amendment 27 item 2, research R25 (grid with 4 columns, or 2 columns on narrow screens, with sizes) and plan decision 13.
- E11 is added to research R25, core-api.md, plan decision 13 and amendment 27 item 13.
- P2, P3, P6 and E5 need no change.
