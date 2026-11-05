# Contract: screens and player flows

Changed by [amendment 01](../amendment-01-number-aiming.md) (number aiming, keyboard-only play) [amendment 02](../amendment-02-ruler-ranges-and-detail.md) (any range, ruler levels, "read the ruler") [amendment 04](../amendment-04-hit-rule.md) (tank-body hit rule, Volltreffer, pointer line, "Genau treffen") [amendment 05](../amendment-05-no-shortcuts-settings-early.md) (no stepping shortcuts, no number while pointing, clear tanks, settings early) and [amendment 06](../amendment-06-one-hit-lives.md) (one exact hit destroys the enemy, 3 hearts, enemy fire after every 2 shots, score, time and personal best) and [amendment 07](../amendment-07-visible-enemy-return-fire.md) (the enemy is always visible, the step count after every miss, the enemy fires back after every shot that does not destroy it).

## Screens

| Screen | Built with | Opens from | Content |
|--------|-----------|-----------|---------|
| Start | React | App load | Large "Spielen" button, "Freies Spiel" when the parent allows it, gear icon (press and hold), fullscreen button. Enter or Space starts guided mode |
| Battle | Phaser canvas + React overlay | "Spielen", "Freies Spiel", "Nochmal" | Battlefield with the child's tank (3 hearts above it) and the enemy tank (no health bar, a target ring where the pointer line meets it), ruler (number line), tank counter at the top left (and the clock beside it when "Uhr beim Spielen zeigen" is on), challenge banner, large readout of typed digits, fire button, help button, speaker icon, pause, fullscreen, gear icon |
| Round end | React overlay | Round over | Encouraging message, the result "9 Panzer getroffen in 6:12", then "Neuer Rekord!" with a short celebration, or the record in small neutral text "Dein Rekord: 12" (neither when "Rekord zeigen" is off), "Nochmal" button (Enter or Space), back to start |
| Parent gate | React | Gear held for 2 s with mouse or touch | Opens a parent menu with "Einstellungen" and "Fortschritt". No key opens it |
| Settings | React | Parent menu | All fields from data-model Settings, grouped: Aufgaben, Zahlenraum, Plus und Minus, Zahlenstrahl (ruler starting and hardest level, with two ruler previews, "Am Anfang" and "Schwerste Stufe", for the chosen range), Hilfe, Gegner, Ton, Runde ("Rundenende" with "Bis alle Herzen weg" or "Gegner pro Runde" and the number of enemies, "Uhr beim Spielen zeigen", "Rekord zeigen"). Save button disabled while invalid; errors shown next to fields. A field for a feature that is not built yet is shown disabled with the note "kommt bald" (amendment 05, FR-079) |
| Progress | React | Parent menu | Per-skill table, sessions list, personal bests per range, starting level and round type (amendment 06), reset button with confirmation |

There are no angle or power controls, and the cannon cannot be dragged (amendment 01).

## Battle layout (logical world 1600 by 900, scaled to fit)

- Sky and battlefield: y 0 to 700. The battlefield spans exactly the configured range, for example 550 to 780.
- Ruler: y 720 to 820, x 80 to 1520, same mapping as the battlefield (core-api `numberToX`), always on screen, lines and labels per the ruler level.
- React overlay (HTML, positioned over the canvas): challenge banner at the top center; help, speaker and pause buttons at the top left; gear and fullscreen at the top right; the large readout of typed digits and the fire button at the bottom right, below or beside the ruler on narrow screens. There is no text field, there are no −1 and +1 buttons, and there are no health bars or health labels in the corners (amendment 05). At the top left a small tank symbol and the number of destroyed enemies (no text); with "Uhr beim Spielen zeigen" an up-counting clock `m:ss` beside it (amendment 06, FR-083, FR-084).
- Tanks (amendment 05, FR-077, FR-078): the child's tank is blue, with rounded shapes and a yellow star flag on its antenna; the enemy tank is red, with a darker, angular body and a black flag. There are no decoy tanks (amendment 09). Three hearts sit directly above the child's tank, with no text; a lost heart stays as an empty outline. The enemy has no health bar (amendment 06, FR-078, FR-080). At the start of every round, including after "Neue Landschaft", a large bouncing arrow with "Du" points at the child's tank for 3 seconds.

## Choosing a number and firing (every mode)

1. The child taps or drags on the ruler (snaps to the nearest whole number) or types digits. A guide line and a target marker follow at once. While pointing, no number is shown: no large readout and no label next to the marker. Typed digits appear in the readout as they are typed. Releasing or typing only previews. There is no way to step the preview by 1 or 10 (amendment 05).
2. The fire button or Enter fires at the previewed number. The cannon stays at its fixed angle (65 degrees, raised up to 85 degrees when a hill blocks the arc), and the shell lands at the chosen number.
3. After landing: crater; the landing number shown large; the previous path kept as a faint trail.
4. Input method (amendment 05, FR-076): typing a digit or pressing Enter to fire sets the round's input method to keyboard; tapping or dragging on the ruler or tapping the fire button sets it to pointer. With keyboard input, the next search is never "Finde N".

## Hit feedback (amendment 06, FR-066, FR-072)

| Where the shell lands | Enemy | Status line | Ruler |
|-----------------------|-------|-------------|-------|
| Exact number | destroyed with a large explosion; a new enemy appears at a new position; tank counter + 1 | "Getroffen!" and "Der Gegner stand bei 637." | landing marker |
| On the tank body, not exact | shakes, not destroyed (a miss) | "Ganz knapp! Triff die Linie." | bracket from the child's number to the enemy's number with "Du: 30 · Gegner: 31 · 1 Schritt" |
| Off the tank body | nothing (a miss) | landing number | bracket from the landing number to the enemy with "N Schritte", in every mode (amendment 07) |

- The overlay root carries, for the end-to-end tests only: `data-last-shot` (`hit`, `near` or `miss`), `data-lives` (0 to 3), `data-enemies-destroyed`, `data-last-distance` (the step count of the last shot, amendment 07) and `data-outcome` at the round end; `data-shots-since-enemy-fire` is removed by amendment 07. The canvas carries `data-steps-label`, the text of the step-count bracket on the ruler ('' when none). `data-enemy-health` and `data-player-health` are removed (amendment 06).
- Enemy shot (FR-006, FR-041 to FR-043a, FR-080, FR-081, amendment 07): right after every shot of the child that does not destroy it, the enemy fires once, from its own tank with a visible arc, in comparison turns too (amendment 09). The shell usually lands 40 to 100 world units beside the child's tank and changes nothing; a seeded draw makes it hit about 1 in 6 ("Leicht"), 1 in 4 ("Normal") or 1 in 3 ("Herausfordernd") shots, never the first shot of a round. A hit on the child's tank removes one heart with a short flash. In no-damage mode the hearts never go down.
- Pointer line (FR-073): the enemy, in every mode and challenge kind, and every numbered tank in comparison turns are always visible, and a thin dashed vertical line runs from the tank's center down to the ruler and ends in a small triangle on the ruler line. No number is drawn at or near it and no ruler label is highlighted; the enemy's number appears only in the feedback after a hit or a near miss. Where the line meets the enemy tank, a small target ring marks the spot to hit (amendment 06). There is no hidden enemy (amendment 07).

## Guided turn flow (one search per player turn)

1. Search starts: the new enemy fades in at the challenge's answer with its pointer line, in every challenge kind (amendment 07); no number is drawn at the line. The challenge banner appears and is spoken if speech is on. Fires are accepted after 1 second.
2. The child chooses a number and fires (see above). Every fire is an answer.
3. Hit (the shell lands at the enemy's exact number): short cheerful sound, the enemy is destroyed, the tank counter goes up; feedback as in the hit feedback table above.
   Miss (a near miss on the body included): the landing number is shown large, the ruler shows the bracket from the landing number to the enemy with the step count (after a near miss, "Ganz knapp! Triff die Linie." with both numbers, and the tank shakes), an encouraging phrase, and the next help step (FR-031). Then the enemy fires once (FR-081); then the child chooses again.
4. After the hit (or the shot at the shown solution): round end when the parent's number of enemies is reached, otherwise a new enemy appears at a new position and a new search starts (step 1); the destroyed enemy does not fire.

The player's tank stands at the left or right end for the whole round and switches sides in the next round.

## Comparison turns

Amendment 09 (FR-026, FR-027, FR-031): a comparison turn looks like every other turn. Exactly one enemy tank stands on the battlefield at the correct option, visible, with its dashed pointer line and no number plate. The banner asks the question and names the options, for example "Der Gegner steht bei der größeren Zahl: 47 oder 74"; each option is its own element (`data-testid="banner-option"`), so help can mark it. The child types the number or picks it on the ruler and fires; a shot at another number is a miss like in every other challenge, and the enemy fires back from its own tank. Help: step 1 highlights the tens digit of every option in the banner (`data-testid="tens-digit"`); step 2 puts a small marker on the ruler under each option's number, with no extra number labels; step 3 shows the solution as for other kinds. There are no decoy tanks, no tank tapping and no order badges.

## Free-play turn flow

Started from the "Freies Spiel" button, shown only when the parent has made free play available. Every turn is a "read the ruler" challenge: the enemy is visible, the child reads the ruler and fires. The enemy fires back after every shot of the child that does not destroy it (amendment 07). A miss shows the distance to the enemy in steps on the ruler; a near miss on the body shows "Ganz knapp! Triff die Linie." with both numbers and the distance. After a hit the enemy is destroyed and a new enemy appears at a new visible position.

## Round end and personal best (amendment 06, FR-084 to FR-086)

1. The round ends when the child's hearts are gone, or with "Gegner pro Runde" right after the last enemy is destroyed.
2. The time stops. The game stores the result against the personal best for the round's range, ruler starting level and round type.
3. The end screen shows an encouraging message ("Super! Alle Gegner getroffen." or "Gut gekämpft! Noch eine Runde?"), the result "9 Panzer getroffen in 6:12" ("1 Panzer" for one), and with "Rekord zeigen" on either "Neuer Rekord!" with a short pop and sparkle (no motion with reduced motion), or "Dein Rekord: 12" in small neutral text when a best exists. It never says "verloren" or "nicht geschafft" and never compares the two numbers.
4. "Zum Start" during a round ends it without a result. "Neue Landschaft" does not end the round (amendment 08): new hills and one new enemy, while hearts, score and time continue. Free play has no other challenge and no bonus.

## Keyboard map (FR-059 to FR-064)

| Key | Start screen | Battle (`challenge`, `aiming`) | Solution step (help level 3) | Paused | Round end |
|-----|--------------|-------------------------------|------------------------------|--------|-----------|
| 0 to 9 | none | type a digit | type a digit (fires at the typed number instead) | none | none |
| Minus | none | first character, only when the range has negative numbers | same | none | none |
| Backspace | none | delete the last digit | same | none | none |
| Enter | start guided round | fire at the typed or previewed number (also in comparison turns; there are no badges or tanks to type, amendment 09) | fire at the solution | resume | new round |
| Space | start guided round | none | fire at the solution | resume | new round |
| H | none | next help step | none | none | none |
| Escape | none | pause | pause | resume | none |

- No other key does anything. The arrow keys were removed by amendment 05, because stepping toward the answer is a shortcut.
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

- Ruler previews (T218, FR-069): two rulers as wide as the settings page, "Am Anfang" at the starting level and "Schwerste Stufe" at the hardest level, drawn with `ticksFor` and the game's layout and label rows (T217) for the chosen range, and redrawn on every change of the range preset, the custom minimum or maximum, or either level.
- "Genau treffen" is removed by amendment 06. "Rundenende" offers "Bis alle Herzen weg" and "Gegner pro Runde"; the number of enemies (1 to 20) appears only with "Gegner pro Runde"; with "Ohne Schaden spielen" on, "Bis alle Herzen weg" is not offered and the choice switches to "Gegner pro Runde". Switches "Uhr beim Spielen zeigen" (off) and "Rekord zeigen" (on).
- "Daten sichern" also includes the personal bests.
- "Daten sichern" (export) downloads a JSON file; "Daten laden" (import) reads one and shows the result.
- A short note explains how to add the game to the Home Screen on iPad and Android.
- A setting for a feature that is not built yet is shown disabled, with the note "kommt bald" (coming soon), instead of being hidden (amendment 05, FR-079).
- A notice appears when stored data was reset or cannot be saved.
