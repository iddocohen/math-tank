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

1. Enemy drives (hidden under a "?" marker cloud) to the new answer position. Challenge banner appears and is spoken if speech is on. Answers are accepted after 1 second (FR-038 edge case).
2. Child drags or taps on the number line. Guide line and marker follow. Release confirms (or tap the check button on large-range zoom views).
3. Correct: short cheerful sound, enemy revealed, cannon glows (charged), phase `aiming`.
   Wrong: encouraging phrase, help step per FR-031, stay in `challenge`.
   Comparison turns: numbered tanks are visible; tapping a tank answers; for `order3` the child taps three tanks in order and each tap shows a small order badge; a wrong tap resets the order with an encouraging phrase.
4. Child sets angle and power (drag the cannon, or use the plus and minus buttons) and taps fire.
5. Shell flies; explosion; terrain and health update; previous path kept as a faint trail.
6. Enemy turn with visible arc. Then the next turn, or round end.

## Free-play turn flow

Enemy visible at a random position. Child aims and fires. A "Bonus" button opens an optional challenge; solving it charges the cannon for the next shot.

## Help visuals (FR-031)

- Step 1: phrase + pulsing highlight on the nearest major tick to the answer.
- Step 2: number line zooms to the ten containing the answer, and counts steps (numbers pop up one by one) from the nearest major tick; for addition and subtraction, a small tank icon moves along `stepPath`.
- Step 3: marker animates to the answer, number shown large, "Weiter" button (one tap) continues.
