# Amendment 27: "Nur Rechnen" becomes "Plus und Minus" and "Zahlen-Rätsel"

**Date**: 2026-11-21
**Requested by**: the product owner: "Can we split the Nur Rechnen into two categories, one with the addition and subtraction and one with what is between numbers?"
**Changes**: US11 (scenarios 1 and 4 changed, new scenarios 7 to 15), FR-046, FR-047, FR-049, FR-062, FR-086, FR-121, FR-122, FR-123, FR-155; adds FR-158 to FR-167. Settings version 14.
**Critique**: [critique-20261121-amendment-27.md](./critiques/critique-20261121-amendment-27.md). Its findings E2 and E3 and several smaller ones are applied below and listed in its "Applied" section.

## Decisions

The orchestrator read the request as follows (2026-11-21). The product owner can correct each reading.

1. **"Nur Rechnen" is replaced by two modes.** Both draw no ruler and show the question banner, as "Nur Rechnen" does today.
   - **"Plus und Minus"**: only addition and subtraction, with "Kleine Schritte" and "Zwei Zahlen" (amendment 26).
   - **"Zahlen-Rätsel"**: every other kind that needs no ruler:
     - the number-line kinds "after", "before", "stepsRight", "stepsLeft", "missingBetween" and "midpoint"
     - the comparison kinds "greater", "smaller", "largest3", "smallest3", "closestTo", "between" and "middle3"

   "what is between numbers" is read as these number questions: what comes before or after a number, what lies between two numbers, and which number is larger or smaller.
2. **The labels** are "Plus und Minus" and "Zahlen-Rätsel" (number puzzles). The orchestrator chose them because a child and a parent understand them without an explanation. The product owner has not confirmed them. The critique (P1) notes a narrower reading of "what is between numbers": only "missingBetween", "midpoint", "between", "middle3", "after" and "before". This amendment keeps the wider reading of Decision 1 and the labels; the product owner is asked to confirm both.
3. **Each mode follows the parent's challenge-type switches.** "Plus und Minus" uses the "Plus" and "Minus" switches. "Zahlen-Rätsel" uses the "Zahlenstrahl" and "Vergleichen" switches. A mode whose switches are all off cannot be offered: the settings page shows an error and blocks saving, as it does today when every challenge type is off and "Gemischt" or "Nur Rechnen" is offered (error key `noChallengeTypes`, text `guidedNeedsType`).
4. **"Plus und Minus" never falls back to another kind.** Today "Nur Rechnen" falls back to "after" and "before" when no allowed kind fits (`MODE_TRAITS.math.fallbackKinds`). The code check (below) found settings that pass the settings page today and still have no plus or minus exercise for one side of the battlefield. This amendment decides:
   - The settings page blocks saving when "Plus und Minus" is offered and the parent's settings give no plus or minus exercise whose answer is far enough from the child's tank on the left side, or none on the right side.
   - The generator then tries, in order: the current difficulty step as today, the same step over the whole battlefield, and the parent's settings (the top step), walking every answer until one exercise is valid. With settings that pass the check, the last stage always finds an exercise.
5. **"Zahlen-Rätsel" keeps the fallbacks of "Nur Rechnen"**: "after" and "before", also when only "Vergleichen" is on. This is today's behavior for "Nur Rechnen" with only "Vergleichen" on.
6. **The start screen offers up to four modes** in this order: "Gemischt" (key 1), "Nur Zahlenstrahl" (key 2), "Plus und Minus" (key 3), "Zahlen-Rätsel" (key 4). The parent chooses which modes are offered. Enter and Space start the first offered mode. G opens the garage.
7. **Records** (decision of this amendment): each new mode has its own personal best. A best stored for "Nur Rechnen" (key suffix `|math`) stays in storage, in export files and in transfer codes, and the progress page lists it with the label "Nur Rechnen". It is not the best of "Plus und Minus" or of "Zahlen-Rätsel", because a "Nur Rechnen" round mixed both kinds of questions. Each new mode starts without a best, so its first finished round with at least one destroyed enemy shows "Neuer Rekord!".
8. **Settings version 14** (decision of this amendment): a stored "Nur Rechnen" switch carries over to both new modes, but only to a mode that can be offered with the stored challenge types. Details in Behavior item 9.
9. **A running "Nur Rechnen" round** (decision of this amendment): no mapping is needed. The code check found that the game does not save a running round: a reload shows the start screen. Amendment 08 is about the "Neue Landschaft" button and keeps the round only within the open page. A new version of the game is applied only while the start screen shows, never during a round (`src/app/swUpdate.ts`), so a running "Nur Rechnen" round ends normally with the old version.
10. **Adaptive difficulty and the progress page do not change.** Both new modes record attempts in the main skill of each challenge, as "Nur Rechnen" does (FR-124). The only change on the progress page is the label of new bests (item 7).
11. **A round that outlives its settings** (critique E2, decision of this amendment): the parent can change the settings during a round (amendment 25), and `playModes` is a setting that changes no task, so the round keeps its mode. "Nochmal" repeats the mode of the round that ended. The check of Behavior item 7 runs only while "Plus und Minus" is offered, so a running round or "Nochmal" can reach settings that give no plus or minus exercise. Then the round keeps its task settings until it ends, and "Nochmal" shows the start screen. Details in Behavior item 12.

## Findings from the code check (orchestrator, 2026-11-21)

- `src/core/modes.ts` `MODE_TRAITS.math`: no ruler, question banner, number pad forced with "Automatisch", kinds `'enabledWithoutRuler'`, fallbacks "after" and "before". Help, the number pad, speech, the overlay and the number line read these traits and not the mode name, except the start screen icon (`src/app/StartScreen.tsx` `ModeIcon`) and the wave size (`src/core/battle/wave.ts` checks `mode === 'mixed'`).
- `src/core/math/generate.ts` `playModeKinds`: for "Nur Rechnen" it passes the enabled kinds without `readPosition` and `findNumber`, the fallbacks "after" and "before", and `withoutRuler`. With `withoutRuler`, the last stage tries "after" and "before" over the whole battlefield before "find N".
- The settings checks for "Kleine Schritte" (`src/core/settings/validate.ts`) test only that some sum or difference lies in the result limits: `additionNoExercise` when `lowestResult + 1` is above the largest result, `subtractionNoExercise` when `lowestResult + 1` is above the range maximum. They do not test the distance to the child's tank (15% of the range width, `minEnemyGap`). The "Zwei Zahlen" check `additionNoPair` / `subtractionNoPair` (`twoNumberFit`) does not test it either. Example: battlefield 0 to 100, only "Plus" on, "Größtes Ergebnis" 5. Saving passes. When the child's tank stands at 0, every answer from 1 to 5 is closer than 15, so no plus exercise fits. Today "Nur Rechnen" then asks "after" or "before", and "Gemischt" asks "Finde N" or "Wo steht der Gegner?".
- The child's tank stands at the range minimum or the range maximum, chosen per round (`src/core/battle/round.ts` `createRound`).
- Stored settings are checked with `validateSettings` when they load (`src/core/storage/migrate.ts` `parseSettings`). Settings that fail any check load as the defaults. So a new check must not make settings that load today fail after the migration.
- The frozen transfer base `TRANSFER_V2_SETTINGS_BASE` has `freePlay` and no `playModes`, so every transfer code since settings version 8 carries the whole `playModes` object in its differences.
- The progress page drops a record whose key names an unknown mode (`src/core/progress/summarize.ts` `parseRecordKey`).

## Behavior

1. **Start screen.** One big picture button per offered mode, in the order "Gemischt", "Nur Zahlenstrahl", "Plus und Minus", "Zahlen-Rätsel". The default offers all four.
   - Keys 1, 2, 3 and 4 start these modes when offered. A key for a mode that is not offered does nothing.
   - Enter and Space start the first offered mode. G opens the garage, as before.
   - With only one mode offered, the single "Spielen" button stays.
   - Icons: "Plus und Minus" shows a round badge with a plus sign and a minus sign. "Zahlen-Rätsel" keeps the question-mark badge of "Nur Rechnen". Both are drawn as shapes, with no SVG text.
2. **Four buttons fit every layout.** The four mode buttons and the garage button show without scrolling and without clipping at every size the game supports:
   - desktop, iPad sideways and upright
   - phone sideways and phone upright (amendment 22)
   - Fire 7, Fire HD 8 and Fire HD 10, sideways and upright (amendment 16, FR-125)

   When four buttons do not fit in one row, they show as two rows of two. Each button keeps its icon, its label and its key number, and stays at least 48 CSS pixels tall, the smallest touch target of FR-053.

   The buttons sit in a grid, not in a wrapping row, because a wrapping row gives three buttons and one between about 700 and 950 pixels of width, and one button per row on a phone held upright (critique E10). The grid has 4 columns where four buttons fit in one row, and 2 columns otherwise. Research R25 gives the widths, heights and sizes.
3. **"Plus und Minus".** No ruler band, no ruler lines, no pointer lines; the question banner shows; the enemy stands visible at the answer. The challenges are additions when "Plus" is on and subtractions when "Minus" is on, with the "Zahlengröße" each has ("Kleine Schritte" or "Zwei Zahlen"). No other kind comes, also not as a fallback.
4. **"Zahlen-Rätsel".** No ruler band, as in item 3. The challenges are the kinds of Decision 1:
   - the number-line kinds when "Zahlenstrahl" is on ("Finde N" and "Wo steht der Gegner?" never come)
   - the comparison kinds when "Vergleichen" is on

   When no allowed kind fits, "after" or "before" comes, as in "Nur Rechnen" today.
5. **Everything else works as in "Nur Rechnen"** in both modes:
   - typing with the keyboard or the number pad; with "Zahlenfeld" "Automatisch" the number pad shows on every screen
   - a tap on the ruler area selects nothing
   - after a miss the landing number and the step count show
   - help step 1 names the direction in words; help step 2 shows the zoomed ten around the answer (comparison: the option markers); help step 3 shows the solution
   - help step 2 of a "Zwei Zahlen" exercise shows the place-value lines and the zoomed ten (amendment 26, FR-155)
   - with "Vorlesen" on, the question is read aloud; the place-value lines are not
   - "Neue Landschaft" gives a new challenge that is not a comparison (amendment 10 item 10)
6. **Settings page, group "Spielarten".** Four switches:
   - "Spielart „Gemischt“ anbieten"
   - "Spielart „Nur Zahlenstrahl“ anbieten"
   - "Spielart „Plus und Minus“ anbieten"
   - "Spielart „Zahlen-Rätsel“ anbieten"

   The hint shown when every challenge type is off reads: "„Gemischt“, „Plus und Minus“ und „Zahlen-Rätsel“ brauchen Aufgabenarten. Ohne Aufgabenart gibt es nur „Nur Zahlenstrahl“." Its button "Nur „Nur Zahlenstrahl“ anbieten" turns off the other three modes.
7. **Settings checks** (FR-047). Saving is blocked and the page names the field when:
   - "Gemischt" is offered and every challenge type is off (`noChallengeTypes`, as today, now for "Gemischt" only)
   - "Plus und Minus" is offered and "Plus" and "Minus" are both off: "„Plus und Minus“ braucht „Plus“ oder „Minus“."
   - "Zahlen-Rätsel" is offered and "Zahlenstrahl" and "Vergleichen" are both off: "„Zahlen-Rätsel“ braucht „Zahlenstrahl“ oder „Vergleichen“."
   - "Plus und Minus" is offered and, with the parent's settings, no plus or minus exercise of the turned-on kinds has an answer at least 15% of the range width from the range minimum, or none at least that far from the range maximum: "Bei „Plus und Minus“ passt keine Aufgabe weit genug vom Panzer des Kindes. Bitte den Zahlenraum, „Größtes Ergebnis“ oder die Zahlen ändern." Example: battlefield 0 to 100, only "Plus", "Größtes Ergebnis" 5.

   The last check runs only when the range, the largest operands, "Größtes Ergebnis" and the "Zwei Zahlen" fields have no error, so it never searches limits that are out of bounds (critique E3). Its text shows in the group "Spielarten" and also at the range field, because a change of the range can cause it and the automatic limit adjustment (FR-047) does not fix it (critique P4).

   The German texts are proposals of this amendment.
8. **The generator in "Plus und Minus"** tries, in order:
   1. a random turned-on arithmetic kind at its current difficulty step, as today
   2. the same kinds at the same step over the whole battlefield, without the step's "smaller numbers first"
   3. the parent's settings (the top step), every answer in turn, the first valid exercise

   A challenge made in stage 3 records the skill's current step, as every challenge does. Adaptive difficulty can then count a harder exercise as one of the current step; this is accepted, as amendment 26 accepts it for its step fallback (critique E4). With settings that pass item 7, stage 3 always finds an exercise.

   Stage 3 keeps, per settings and per side of the child's tank, the set of answers that have an exercise. Each call lets the random numbers pick the start answer and the operands, so stage 3 does not give the same exercise every time (critique E6).
9. **Settings version 14.** `playModes.math` is replaced by `playModes.arithmetic` and `playModes.numbers`. The migration from version 13:
   - `arithmetic` is `true` when `math` was `true` and "Plus" or "Minus" is on
   - `numbers` is `true` when `math` was `true` and "Zahlenstrahl" or "Vergleichen" is on

   The exercise check of item 7 does not run in this step, because the step works on raw data from storage, an export file or a transfer code, before the schema check and before the largest operands are clamped (critique E3). It runs when the settings are read (`parseSettings`), after the schema check and the clamp, only for data stored as version 13 or older:
   - when `arithmetic` is `true` and the exercise check of item 7 fails, `arithmetic` becomes `false`
   - when no mode is left on, `mixed` becomes `true`; this can only happen when only "Nur Rechnen" was offered, and then a challenge type is on

   The parent gets no notice of this change (critique P5). It affects only settings that give no plus or minus exercise far enough from the child's tank; it is reported in the run summary for the product owner.

   Export files and transfer codes of every older version load through the same steps. A transfer code with all four modes and new bests stays under the 2300-byte limit.
10. **Records.** "Plus und Minus" stores its best under the key suffix `|arithmetic`, "Zahlen-Rätsel" under `|numbers`. Keys with `|math` stay as they are, show on the progress page as "Nur Rechnen", and are never compared with a new round.
11. **`?mode=`** (the test parameter of the start screen) takes `mixed`, `ruler`, `arithmetic` and `numbers`. `math` is no longer known, so Enter starts the first offered mode.
12. **Settings changed during a round** (FR-167, critique E2). A function `modeCanPlay(mode, settings)` says whether a mode can give a challenge with the settings: "Plus und Minus" needs "Plus" or "Minus" and an exercise far enough from the child's tank on both sides (the checks of item 7); the other modes always can. It does not read `playModes`.
    - When the parent saves during a round and the round's mode cannot play with the new settings, the round keeps the task settings it had until it ends. Settings that change no task (sound, "Zahlenfeld", the clock and the others of amendment 25) still apply. The next round uses the new settings.
    - "Nochmal" and Enter on the end screen show the start screen instead of a new round when the mode of the round that ended is no longer offered or `modeCanPlay` is false with the current settings.
13. **Tests first**:
    - Mode table tests: both new modes have no ruler, the question banner and the forced number pad; "Plus und Minus" has no fallback kinds; "Zahlen-Rätsel" has "after" and "before". For every mode, `playModeKinds` gives `onlyArithmetic` exactly when the trait `kinds` is `'arithmetic'` and `fallbackKinds` is `[]`, and `withoutRuler` exactly when `showsRuler` is false (critique E1).
    - Generator tests over many seeds: in "Plus und Minus" every challenge is addition or subtraction, also with only "Plus" on and the child's tank at either end, and with "Zwei Zahlen"; in "Zahlen-Rätsel" no challenge is addition, subtraction, "Finde N" or "Wo steht der Gegner?".
    - Property test over random valid settings: every "Plus und Minus" challenge is addition or subtraction and passes `validateChallenge`, for both tank sides.
    - Generator test: a step with no answer far enough from the tank moves on to stage 2 and then stage 3. Stage 3 with different seeds gives more than one exercise (critique E6).
    - Timing test: the exercise check with a width of 1000, largest operand 1000, two steps and no valid answer finishes in under about 50 ms (critique E7).
    - Settings tests: each new error, `noChallengeTypes` for "Gemischt" only, the defaults, and the migration from version 13 for each case of item 9, including a version 13 "Nur Rechnen" with only "Plus" and "Größtes Ergebnis" 5. Version 13 data with `subtraction.maxOperand` 1000000000 loads as invalid at once, without the exercise search (critique E3).
    - Storage, export and transfer tests: version 8 to 13 data and codes load with the new switches; a code with all four modes and four new bests stays under the limit.
    - Records and progress tests: the new key suffixes; a `|math` best shows as "Nur Rechnen" and is not the best of either new mode; on the progress page a `|math` best sorts after "Zahlen-Rätsel" for the same range (critique E11).
    - Controller and app tests (critique E2): a "Plus und Minus" round whose settings change to "Plus" and "Minus" off keeps plus and minus questions until it ends; "Nochmal" after that round, and after a round whose mode is no longer offered, shows the start screen.
    - Keyboard and start screen tests: keys 1 to 4, Enter with each first offered mode, a key for a mode not offered, `?mode=math`.
    - Settings page tests: four switches, the new errors, the hint text and its button; a range change that causes the exercise error shows the text at the range field and in "Spielarten" (critique P4).
    - Help and overlay tests: the zoomed ten and the "Zwei Zahlen" place-value lines in "Plus und Minus"; comparison option markers in "Zahlen-Rätsel".
    - e2e (desktop and device projects, including phone upright and the Fire projects): four buttons visible without scrolling and inside the screen; press 3: only plus and minus questions and no ruler; press 4: no plus or minus question and no ruler; `tests/e2e/modes.spec.ts` updated from three buttons to four. `playwright.config.ts` adds `modes` to `DEVICE_AND_DESKTOP_SPECS` and to the `testMatch` of the Fire projects, so the test runs in those projects (critique E8).
