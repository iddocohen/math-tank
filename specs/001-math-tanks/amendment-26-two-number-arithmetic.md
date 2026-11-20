# Amendment 26: plus and minus with two larger numbers, with or without carrying

**Date**: 2026-11-20
**Requested by**: the product owner: "create a new functionality where addition and subtraction would hit a tank in the range one has defined. In this new mode, a parent can configure that two numbers with two digits hit the given tank or two numbers with two digits get subtracted without overflow in both, e.g. 35 + 12 or 22 + 11 for plus and 46 - 12, 34 - 11 for subtraction. Overflow means it does not go over the next number, e.g. 34 + 19, 47 + 16, same for subtraction. This should be configurable (overflow or not). Also it should be configurable what the range is such so bigger numbers can be done later." Later in the same session: "The helping should be showing the kid that the lower digits and higher digits can be added together (or subtracted) to achieve the result." And: "Also give the functionality as well in the configuration that overflow is configurable as well with X digits, e.g. if configured overflow with one digit, this is allowed: 45 + 6, 52 + 9."
**Changes**: US3 (new scenarios 6 to 12), FR-022, FR-023, FR-024, FR-046, FR-047; adds FR-148 to FR-157. Settings version 13.

## Decisions (answers from the product owner, 2026-11-20)

1. **An option inside plus and minus, not a new task type.** Plus and minus each get "Zahlengröße" (number size): "Kleine Schritte" (small steps, today's behavior) or "Zwei Zahlen" (two numbers). Progress, records and help stay with the existing addition and subtraction skills.
2. **The parent sets a range for the first number and a range for the second number**, each with a smallest and a largest number, default 10 to 99 for both. Bigger numbers (for example 100 to 999) can be set later, and the second number can have fewer digits than the first: first number 10 to 99 and second number 1 to 9 with carrying gives 45 + 6 and 52 + 9. (The product owner's "overflow with one digit" request is read as a one-digit second number; this reading was made by the orchestrator, 2026-11-20.)
3. **The answer must land on the battlefield.** The settings page warns when no exercise fits the battlefield range, as it does for other impossible limits today. Without carrying, two-digit sums stay at or below 99. With carrying they reach 198.
4. **Separate switches for plus and minus**: "Plus mit Übertrag" (with carrying) and "Minus mit Übertrag" (with borrowing). Off means no column carries or borrows. On means a column may carry or borrow, not that it must.
5. **Subtraction**: the first number is always larger than the second, so no answer is negative.
6. **Adaptive difficulty** may make the exercises easier, never harder than the parent's settings allow.
7. **Help shows the place values**: tens are added to tens and ones to ones (hundreds to hundreds for three-digit numbers), and the ruler shows the same path, tens first and then ones.

## Behavior

1. **"Zahlengröße" in the plus and the minus settings.**
   - "Kleine Schritte" (the default) keeps today's settings and exercises: the largest number added or subtracted, the number of steps, and the global "Zehnerübergang" and "Hunderterübergang" switches.
   - "Zwei Zahlen" shows instead:
     - "Erste Zahl von … bis …" (first number from … to …), default 10 to 99
     - "Zweite Zahl von … bis …" (second number from … to …), default 10 to 99
     - "Plus mit Übertrag" or "Minus mit Übertrag", default off

     The first number of an exercise comes from the first range and the second number from the second range. An exercise has exactly two numbers (a + b or a − b), never three. The global "Zehnerübergang" and "Hunderterübergang" switches do not apply to these exercises; the carry switch replaces them. For addition, "Größtes Ergebnis" (largest result) still applies.
2. **Where the enemy stands.** The enemy stands at the answer, as today. The first number is the starting number on the ruler, so both the first number and the answer lie inside the battlefield range. Exercises that do not fit are never generated. Example: with the battlefield 0 to 100 and both numbers 10 to 99 with carrying, 56 + 38 = 94 can come, 67 + 45 = 112 cannot.
3. **Carrying and borrowing, column by column.** Write both numbers one above the other, ones under ones.
   - Plus without carrying: in every column the two digits add up to 9 or less. 35 + 12, 22 + 11 and 234 + 152 come. 34 + 19, 47 + 16 and 234 + 158 do not.
   - Minus without borrowing: in every column the digit of the first number is at least the digit of the second. 46 − 12 and 34 − 11 come. 42 − 17 does not.
   - With the switch on, every exercise in the ranges may come, with or without carrying. With first number 10 to 99 and second number 1 to 9, 45 + 6 and 52 + 9 come; with the switch off, 45 + 3 comes and 45 + 6 does not.
   - When the two numbers have a different number of digits (for example a first number 10 to 99 and a second number 1 to 9), the missing digits of the shorter number count as 0.
4. **Subtraction**: the first number is larger than the second (46 − 12, never 12 − 46 or 23 − 23).
5. **Settings checks** (the existing error list on the settings page, FR-047). Saving is blocked and the page names the field when:
   - in either range, the smallest number is below 1, the largest number is above 999, or the smallest is larger than the largest
   - for minus, the largest first number is not larger than the smallest second number (no first number can be larger)
   - with plus or minus turned on, no exercise of that kind fits the battlefield range, "Größtes Ergebnis" and the carry switch. Example: battlefield 550 to 780 with first numbers 10 to 99 has no plus exercise, because no first number lies on the battlefield.

   A note that does not block saving appears when only some exercises fit, for example "Nicht alle Aufgaben passen auf das Feld. Es kommen nur Aufgaben mit Ergebnis bis 100." for both numbers 10 to 99 with carrying on the battlefield 0 to 100.
6. **Adaptive difficulty** (FR-037) uses its own ladder for "Zwei Zahlen", in the same addition and subtraction skills:
   - step 1: no carrying or borrowing, and the second number from the lower half of the parent's second range
   - step 2: no carrying or borrowing, both numbers from their whole ranges
   - step 3: carrying or borrowing allowed, second number from the lower half
   - step 4: the parent's settings

   The parent's settings are the ceiling: with the carry switch off, steps 3 and 4 have no carrying. With adaptive difficulty off, the parent's settings apply. The step a skill has reached is kept when the parent changes "Zahlengröße".
7. **Help step 2 shows the place values** (with the help type "Schritt-Animation" on, FR-024).
   - The banner shows one line per place, then the sum of the parts:
     - 35 + 12: "Zehner: 30 + 10 = 40", "Einer: 5 + 2 = 7", "40 + 7 = 47"
     - 34 + 19 (with carrying): "Zehner: 30 + 10 = 40", "Einer: 4 + 9 = 13", "40 + 13 = 53"
     - 46 − 12: "Zehner: 40 − 10 = 30", "Einer: 6 − 2 = 4", "30 + 4 = 34"
     - 234 + 152: a "Hunderter" line first: "Hunderter: 200 + 100 = 300", then the tens and ones lines, then "300 + 80 + 6 = 386"
   - Minus with borrowing cannot be split column by column, so the banner shows the jumps instead: 42 − 17 gives "Erst die Zehner: 42 − 10 = 32" and "Dann die Einer: 32 − 7 = 25".
   - The ruler marker starts at the first number and jumps the second number's hundreds, then its tens, then its ones: 35 + 12 goes 35 → 45 → 47, 46 − 12 goes 46 → 36 → 34. With beginner assistance it jumps one ten (or one hundred) at a time and stops at each ten it crosses in the ones jump, as today: 35 + 32 goes 35 → 45 → 55 → 65 → 67, and 34 + 19 goes 34 → 44 → 50 → 53. Without beginner assistance it makes one jump per place: 35 → 65 → 67.
   - In "Nur Rechnen", which draws no ruler, the banner lines show and the zoomed ten around the answer shows as today.
   - Help steps 1 and 3 do not change.
8. **"Kleine Schritte" does not change.** Its exercises, help, ladder and settings work as before this amendment.
9. **Old saves load.** Settings version 13 adds, for plus and for minus, "Zahlengröße" "Kleine Schritte", both ranges 10 to 99 and the carry switch off. Export files and transfer codes from older versions read with these defaults.
10. **A running round** takes the new settings when the settings page closes (amendment 25), because they shape the exercises.
11. **Tests first**:
    - Generator unit tests over many seeds: each number in its range, first number and answer on the battlefield, the minus first number larger, no column carries or borrows with the switch off, and with the switch on exercises with carrying do come. Three-digit ranges and a one-digit second number (45 + 6, 52 + 9) included.
    - Settings tests: the defaults, migration from version 12, each new error, the note, and the export and transfer readers.
    - Help tests: the banner lines and the marker stops for the examples above, with and without beginner assistance, and in "Nur Rechnen".
    - Ladder tests: each step, clamped by the carry switch.
    - Settings page tests: "Zahlengröße" shows and hides the right fields, and the errors and the note show.
    - e2e: turn on only plus, set "Zwei Zahlen" 10 to 99 without carrying, play: the banner shows two two-digit numbers without carrying, and help step 2 shows the place-value lines. Run it in the desktop and the device projects.
