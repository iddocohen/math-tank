# Contract: screens and player flows

Changed by [amendment 01](../amendment-01-number-aiming.md) (number aiming, keyboard-only play) [amendment 02](../amendment-02-ruler-ranges-and-detail.md) (any range, ruler levels, "read the ruler") and [amendment 04](../amendment-04-hit-rule.md) (tank-body hit rule, Volltreffer, pointer line, "Genau treffen").

## Screens

| Screen | Built with | Opens from | Content |
|--------|-----------|-----------|---------|
| Start | React | App load | Large "Spielen" button, "Freies Spiel" when the parent allows it, gear icon (press and hold), fullscreen button. Enter or Space starts guided mode |
| Battle | Phaser canvas + React overlay | "Spielen", "Freies Spiel", "Nochmal" | Battlefield, ruler (number line), challenge banner, large number readout, −1 and +1 buttons, fire button, help button, speaker icon, pause, fullscreen, gear icon |
| Round end | React overlay | Round over | Encouraging message, "Nochmal" button (Enter or Space), back to start |
| Parent gate | React | Gear held for 2 s with mouse or touch | Opens a parent menu with "Einstellungen" and "Fortschritt". No key opens it |
| Settings | React | Parent menu | All fields from data-model Settings, grouped: Aufgaben, Zahlenraum, Plus und Minus, Zahlenstrahl (ruler starting and hardest level, with a ruler preview for the chosen range and level), Hilfe, Gegner, Ton, Runde. Save button disabled while invalid; errors shown next to fields |
| Progress | React | Parent menu | Per-skill table, sessions list, reset button with confirmation |

There are no angle or power controls, and the cannon cannot be dragged (amendment 01).

## Battle layout (logical world 1600 by 900, scaled to fit)

- Sky and battlefield: y 0 to 700. The battlefield spans exactly the configured range, for example 550 to 780.
- Ruler: y 720 to 820, x 80 to 1520, same mapping as the battlefield (core-api `numberToX`), always on screen, lines and labels per the ruler level.
- React overlay (HTML, positioned over the canvas): challenge banner at the top center; help, speaker and pause buttons at the top left; gear and fullscreen at the top right; the large number readout, −1, +1 and the fire button at the bottom right, below or beside the ruler on narrow screens. There is no text field.

## Choosing a number and firing (every mode)

1. The child taps or drags on the ruler (snaps to the nearest whole number), types digits, or uses −1, +1 or the arrow keys. A guide line, a target marker and the large readout follow at once. Releasing or typing only previews.
2. The fire button or Enter fires at the previewed number. The cannon stays at its fixed angle (65 degrees, raised up to 85 degrees when a hill blocks the arc), and the shell lands at the chosen number.
3. After landing: crater; the landing number shown large; the previous path kept as a faint trail.

## Hit feedback (amendment 04, FR-066, FR-071, FR-072, FR-074)

| Where the shell lands | Enemy | Status line | Ruler |
|-----------------------|-------|-------------|-------|
| Exact number | loses twice the hit damage; larger explosion | "Volltreffer!" and, for "read the ruler", "Der Gegner stand bei 637." | landing marker |
| On the tank body, not exact | loses the hit damage | "Treffer!" | bracket from the child's number to the enemy's number with "Du: 30 · Gegner: 31 · 1 Schritt" |
| On the tank body, not exact, "Genau treffen" on | shakes, no damage | "Ganz knapp!" | same bracket and text as the row above |
| Off the tank body, inside the blast radius | shakes, no damage | landing number | free play: bracket with the step count |
| Elsewhere | nothing | landing number | free play: bracket with the step count |

- The overlay root carries `data-last-shot`: `bullseye`, `body`, `close` (body hit without damage under "Genau treffen") or `miss`, for the end-to-end tests.
- Pointer line (FR-073): whenever a tank is visible (the enemy in free play, in "read the ruler" and after a guided search reveals it; every numbered tank in comparison turns), a thin vertical line runs from the tank's center down to the ruler. A hidden enemy has no line.
- With "Genau treffen" on, the enemy tank shows a bullseye (two rings and a dot) on its center line.

## Guided turn flow (one search per player turn)

1. Search starts: for position challenges the enemy fades out completely and nothing is drawn at its new position; for "read the ruler" the enemy is visible and no number is given. The challenge banner appears and is spoken if speech is on. Fires are accepted after 1 second.
2. The child chooses a number and fires (see above). Every fire is an answer.
3. Hit (the shell lands on the enemy tank's body; the exact number is a Volltreffer): short cheerful sound, the enemy is revealed and loses health; feedback as in the hit feedback table above. With "Genau treffen" on, a body hit that is not exact is a miss with the message "Ganz knapp!" and the step count.
   Miss: the landing number is shown large, an encouraging phrase, and the next help step (FR-031). The enemy takes no turn; health does not change; the child chooses again. A shell inside the enemy's blast radius makes the enemy shake.
4. After the hit (or the shot at the shown solution), the enemy takes its turn with a visible arc. Then round end, or the enemy hides and moves and a new search starts (step 1).

The player's tank stands at the left or right end for the whole round and switches sides in the next round.

## Comparison turns

Numbered tanks are visible, each at its own number, each with a pointer line to the ruler. Tapping a tank (a Volltreffer on that tank), or typing its number and pressing Enter, fires at it. A decoy is destroyed and the shot counts as a miss. For `order3`, taps or typed numbers (Enter after each) place order badges 1, 2, 3 without firing; after a correct third badge the cannon fires at the enemy (the largest number); a wrong order resets the badges with an encouraging phrase and the next help step. A typed number that is on no tank places no badge and shows a hint.

## Free-play turn flow

Started from the "Freies Spiel" button, shown only when the parent has made free play available. Every turn is a "read the ruler" challenge: the enemy is visible, the child reads the ruler and fires. Every shot is followed by an enemy turn. A miss shows the distance to the enemy in steps on the ruler; a body hit that is not exact shows both numbers and the distance. After a hit the enemy moves to a new visible position. Free play has no other challenge and no bonus.

## Keyboard map (FR-059 to FR-064)

| Key | Start screen | Battle (`challenge`, `aiming`) | Solution step (help level 3) | Paused | Round end |
|-----|--------------|-------------------------------|------------------------------|--------|-----------|
| 0 to 9 | none | type a digit | type a digit (fires at the typed number instead) | none | none |
| Minus | none | first character, only when the range has negative numbers | same | none | none |
| Backspace | none | delete the last digit | same | none | none |
| Enter | start guided round | fire at the typed or previewed number; in `order3`, place a badge for the typed tank number | fire at the solution | resume | new round |
| Space | start guided round | none | fire at the solution | resume | new round |
| Arrow left, right | none | preview −1, +1 | same | none | none |
| Arrow up, down | none | preview +10, −10 | same | none | none |
| H | none | next help step | none | none | none |
| Escape | none | pause | pause | resume | none |

- Keys are ignored while a shell is in flight (`playerShot`, `enemyTurn`), so a held Enter never fires twice.
- A typed number outside the range is not fired; the preview stays at the nearest end, and a hint shows the range, for example "Zahlen von 550 bis 780".
- Focus starts in the game when the app loads (the app root has `tabIndex={-1}` and receives focus), and the keyboard listener is on the window, so typing works without a click. No key opens the parent gate; the gear button ignores keyboard activation.
- Mouse and touch keep working for every action.

## Help visuals (FR-031)

- Step 1: phrase, the direction from the landing number to the answer ("Weiter nach rechts" or "Weiter nach links"), and a pulsing highlight on the nearest major line to the answer.
- Step 2: the ruler zooms to the ten containing the answer, with all lines and labels shown whatever the ruler level, and counts steps (numbers pop up one by one) from the landing number to the answer; for addition and subtraction, a small tank icon moves along `stepPath`.
- Step 3: a marker animates to the answer, the number is shown large, and one tap on the fire button, Enter or Space fires at it.
- Comparison: step 1 highlights the tens digits on every tank; step 2 puts a marker on the ruler under each option's number; step 3 shows the correct tank or order, and one tap or Enter fires.

## Settings page extras

- Ruler preview: a small ruler drawn with `ticksFor` for the chosen range and starting level, updated as the parent changes them.
- "Genau treffen" (aim exactly) switch with a one-line explanation: "Nur die genaue Zahl trifft." (only the exact number hits).
- "Daten sichern" (export) downloads a JSON file; "Daten laden" (import) reads one and shows the result.
- A short note explains how to add the game to the Home Screen on iPad and Android.
- A notice appears when stored data was reset or cannot be saved.
