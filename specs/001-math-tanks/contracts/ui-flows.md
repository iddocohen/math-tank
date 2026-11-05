# Contract: screens and player flows

## Screens

| Screen | Built with | Opens from | Content |
|--------|-----------|-----------|---------|
| Start | React | App load | Large "Spielen" button, gear icon (press and hold), fullscreen button |
| Battle | Phaser canvas + React overlay | "Spielen", "Nochmal" | Battlefield, number line, challenge banner, help button, speaker icon, pause, fullscreen, gear icon, angle and power controls, fire button |
| Round end | React overlay | Round over | Encouraging message, "Nochmal" button, back to start |
| Parent gate | React | Gear held for 2 s | Opens a parent menu with "Einstellungen" and "Fortschritt" |
| Settings | React | Parent menu | All fields from data-model Settings, grouped: Aufgaben, Zahlenraum, Plus und Minus, Zahlenstrahl, Hilfe, Gegner, Ton, Runde. Save button disabled while invalid; errors shown next to fields |
| Progress | React | Parent menu | Per-skill table, sessions list, reset button with confirmation |

## Battle layout (logical world 1600 by 900, scaled to fit)

- Sky and battlefield: y 0 to 700.
- Number line: y 720 to 820, x 80 to 1520, same mapping as the battlefield (core-api `numberToX`).
- React overlay (HTML, positioned over the canvas): challenge banner at the top center; help, speaker and pause buttons at the top left; gear and fullscreen at the top right; angle and power controls and the fire button at the bottom right, below or beside the number line on narrow screens.

## Guided turn flow

1. Search starts: the enemy fades out completely; nothing is drawn at its new position. Challenge banner appears and is spoken if speech is on. Answers are accepted after 1 second.
2. Child drags or taps on the number line. Guide line, marker and a large number readout above the finger follow. Release only previews. The +1 and −1 buttons adjust the preview. The check button (48 px or larger) submits it.
3. Correct: short cheerful sound, enemy fades in at the answer, cannon glows (charged), phase `aiming`.
   Wrong: encouraging phrase, help step per FR-031, stay in `challenge`.
   Comparison turns: numbered tanks are visible; tapping a tank answers; for `order3` the child taps three tanks in order and each tap shows a small order badge; a wrong tap resets the order with an encouraging phrase.
4. Child sets angle and power (drag the cannon, or use the plus and minus buttons) and taps fire.
5. Shell flies; explosion; terrain and health update; previous path kept as a faint trail.
6. Enemy turn with visible arc. Then round end, or the next player turn: if the enemy was hit or 3 shots have been fired at it, a new search starts (step 1); otherwise the enemy stays visible, the trail of the last shot stays, and a "Bonus" button offers an optional challenge to charge the cannon.

The player's tank stands at the left or right end for the whole round and switches sides in the next round.

## Free-play turn flow

Started from the "Freies Spiel" button, shown only when the parent has made free play available. Enemy visible at a random position. Child aims and fires. A "Bonus" button opens an optional challenge (number-line, addition or subtraction kinds); solving it charges the cannon for the next shot.

## Help visuals (FR-031)

- Step 1: phrase + pulsing highlight on the nearest major tick to the answer.
- Step 2: number line zooms to the ten containing the answer, and counts steps (numbers pop up one by one) from the nearest major tick; for addition and subtraction, a small tank icon moves along `stepPath`.
- Step 3: marker animates to the answer, number shown large, "Weiter" button (one tap) continues.
- Comparison: step 1 highlights the tens digits on every tank; step 2 puts a marker on the number line under each option's number; step 3 shows the correct tank or order, then "Weiter".

## Settings page extras

- "Daten sichern" (export) downloads a JSON file; "Daten laden" (import) reads one and shows the result.
- A short note explains how to add the game to the Home Screen on iPad and Android.
- A notice appears when stored data was reset or cannot be saved.
