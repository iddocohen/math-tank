# Contract: screens and player flows

Changed by [amendment 01](../amendment-01-number-aiming.md) (number aiming, keyboard-only play) [amendment 02](../amendment-02-ruler-ranges-and-detail.md) (any range, ruler levels, "read the ruler") [amendment 04](../amendment-04-hit-rule.md) (tank-body hit rule, Volltreffer, pointer line, "Genau treffen") [amendment 05](../amendment-05-no-shortcuts-settings-early.md) (no stepping shortcuts, no number while pointing, clear tanks, settings early) and [amendment 06](../amendment-06-one-hit-lives.md) (one exact hit destroys the enemy, 3 hearts, enemy fire after every 2 shots, score, time and personal best) and [amendment 07](../amendment-07-visible-enemy-return-fire.md) (the enemy is always visible, the step count after every miss, the enemy fires back after every shot that does not destroy it) and [amendment 11](../amendment-11-tank-garage.md) (stars, the garage, the chosen look in battle). Changed by [amendment 13](../amendment-13-enemy-zeroes-in-new-terrain.md) (the enemy zeroes in on misses in a row, new landscape after every destroyed enemy). Changed by [amendment 12](../amendment-12-tablet-phone.md) (number pad on touch devices, layouts for iPad and phone, "Bitte dreh das Handy").

## Screens

| Screen | Built with | Opens from | Content |
|--------|-----------|-----------|---------|
| Start | React | App load | Large "Spielen" button, "Freies Spiel" when the parent allows it, a large "Garage" button and a star symbol with the star total (both only with "Garage und Sterne" on, amendment 11), gear icon (press and hold), fullscreen button (only where the browser allows fullscreen; hidden on iPhone, amendment 12, FR-106). Enter or Space starts guided mode; G opens the garage |
| Garage | React | "Garage" button or G on the start screen | A preview tank (SVG) with the chosen color, flag, hat and a piece of the chosen trail; the star total; four groups (Farbe, Flagge, Spur, Hut) of numbered item buttons, at least 48 by 48 CSS pixels: unlocked items show their drawing and name and are chosen with one tap, the chosen one is marked; locked items show a grey silhouette and "noch N Sterne" and do not react; "Zurück" button (Escape). `data-testid="garage"`, `data-look` with `lookKey` of the chosen look |
| Battle | Phaser canvas + React overlay | "Spielen", "Freies Spiel", "Nochmal" | Battlefield with the child's tank (3 hearts above it) and the enemy tank (no health bar, a target ring where the pointer line meets it), ruler (number line), tank counter at the top left (and the clock beside it when "Uhr beim Spielen zeigen" is on), challenge banner, large readout of typed digits, fire button, on touch devices the number pad (amendment 12), help button, speaker icon, pause, fullscreen, gear icon |
| Round end | React overlay | Round over | Encouraging message, the result "9 Panzer getroffen in 6:12", then "Neuer Rekord!" with a short celebration, or the record in small neutral text "Dein Rekord: 12" (neither when "Rekord zeigen" is off); with "Garage und Sterne" on, the line "Neu freigeschaltet: Raketen-Flagge!" with sparkles when the round unlocked items, and the star total; "Nochmal" button (Enter or Space), back to start |
| Parent gate | React | Gear held for 2 s with mouse or touch | Opens a parent menu with "Einstellungen" and "Fortschritt". No key opens it. A touch hold opens no browser long-press menu (amendment 12) |
| Turn the phone | React | A phone held upright (narrower than 600 CSS px and taller than wide), over the start screen, the garage and the battle | A full-screen picture of a turning phone and "Bitte dreh das Handy", with the gear at the top right. A running round pauses and continues when the phone is held sideways; keys do nothing meanwhile. Parent screens open over it and work upright (amendment 12, FR-104). `data-testid="rotate-screen"` |
| Settings | React | Parent menu | All fields from data-model Settings, grouped: Aufgaben, Zahlenraum, Plus und Minus, Zahlenstrahl (ruler starting and hardest level, with two ruler previews, "Am Anfang" and "Schwerste Stufe", for the chosen range), Hilfe, Gegner, Ton, Runde ("Zahlenfeld" with "Automatisch", "Immer" and "Nie", amendment 12; "Rundenende" with "Bis alle Herzen weg" or "Gegner pro Runde" and the number of enemies, "Uhr beim Spielen zeigen", "Rekord zeigen"). Save button disabled while invalid; errors shown next to fields. A field for a feature that is not built yet is shown disabled with the note "kommt bald" (amendment 05, FR-079) |
| Progress | React | Parent menu | Per-skill table, sessions list, personal bests per range, starting level and round type (amendment 06), reset button with confirmation (keeps the stars); the star total and "Sterne zurücksetzen" with its own confirmation (amendment 11) |

There are no angle or power controls, and the cannon cannot be dragged (amendment 01).

## Battle layout (logical world 1600 by 900, scaled to fit)

- Sky and battlefield: y 0 to 700. The battlefield spans exactly the configured range, for example 550 to 780.
- Ruler: y 720 to 820, x 80 to 1520, same mapping as the battlefield (core-api `numberToX`), always on screen, lines and labels per the ruler level.
- React overlay (HTML, positioned over the canvas): challenge banner at the top center; the pause button and the tank counter at the top left; gear, speaker (only when speech is available) and fullscreen (only where the browser allows it) at the top right, so the banner between the two groups covers none of them; the help button at the left of the control bar; while paused, a pause screen with "Weiterspielen" covers the battle (T138, T140, T141); the large readout of typed digits and the fire button at the bottom right, below or beside the ruler on narrow screens. There is no text field, there are no −1 and +1 buttons, and there are no health bars or health labels in the corners (amendment 05). At the top left a small tank symbol and the number of destroyed enemies (no text); with "Uhr beim Spielen zeigen" an up-counting clock `m:ss` beside it (amendment 06, FR-083, FR-084).
- Tanks (amendment 05, FR-077, FR-078): the child's tank is blue, with rounded shapes and a yellow star flag on its antenna; the enemy tank is red, with a darker, angular body and a black flag. Decoy tanks in comparison turns look exactly like the enemy (amendment 10). Three hearts sit directly above the child's tank, with no text; a lost heart stays as an empty outline. The enemy has no health bar (amendment 06, FR-078, FR-080). At the start of every round, including after "Neue Landschaft", a large bouncing arrow with "Du" points at the child's tank for 3 seconds.

## Screen layouts and the number pad (amendment 12, FR-102 to FR-106)

The battle root (`main.battle`) carries `data-layout` (`wide`, `portrait`, `side`) and `data-number-pad` (`true` or `false`); the rule is in data-model.md "Screen layout". The canvas is scaled with Phaser Scale FIT inside its own area, so the whole 1600 by 900 world, ruler included, is always visible.

| Layout | Example sizes (CSS px) | Battlefield and ruler | Readout, number pad and "Feuer!" | Help button | Gear and "Neue Landschaft" |
|--------|------------------------|-----------------------|----------------------------------|-------------|----------------------------|
| `wide` | 1024 by 768, 1180 by 820, 1366 by 1024, desktop | Top, above the bar | Bar at the bottom: readout, pad keys in two rows (1 to 5 with ⌫, 6 to 0 with minus), "Feuer!" | Left end of the bar | Top right; right side of the battlefield |
| `portrait` | 768 by 1024, 820 by 1180 | Top, full width (16:9) | The area below: readout and "Feuer!" in a column, the pad in a large grid (1 2 3 / 4 5 6 / 7 8 9 / minus 0 ⌫) | Top left of the area below | Top right; right side of the battlefield |
| `side` | 844 by 390, 932 by 430 | Left | Column on the right: readout, the pad as a compact grid (same order as `portrait`), "Feuer!" | Top of the pad column, left of the readout (never over the battlefield) | Top right of the battlefield; right side of the battlefield |
| Turn the phone | 390 by 844 | Not shown | Not shown | Not shown | Gear only |

Without the number pad (`numberPad: 'never'`, or `'auto'` on a desktop wider than 1100 px) every size uses the bar at the bottom with the readout and the fire button, as before amendment 12.

Number pad rules:

- Keys 0 to 9, ⌫, "Feuer!"; a minus key only when `range.min < 0`. Digit, minus and ⌫ keys are at least 48 by 48 CSS px, 56 by 56 in `wide` and `side`, larger in `portrait`. `data-testid="number-pad"`, each key `data-testid="pad-key"` with `data-key` (`0` to `9`, `minus`, `backspace`); "Feuer!" stays `.fire-button`.
- A key calls the same controller method as the keyboard: `typeDigit`, `typeMinus`, `backspace`, and "Feuer!" calls `confirm('keyboard')`, so the pad counts as keyboard input for FR-076. The fire button without the pad still calls `confirm('pointer')`.
- Keys have `tabIndex={-1}` and never take focus; they are disabled while a shell is in flight, like the keyboard (FR-061).
- The challenge banner is centered over the battlefield, not over the pad column, and its text is at least 16 px high in `side`.

## Choosing a number and firing (every mode)

1. The child taps or drags on the ruler (snaps to the nearest whole number) or types digits. A guide line and a target marker follow at once. While pointing, no number is shown: no large readout and no label next to the marker. Typed digits appear in the readout as they are typed. Releasing or typing only previews. There is no way to step the preview by 1 or 10 (amendment 05).
2. The fire button or Enter fires at the previewed number. The cannon stays at its fixed angle (65 degrees, raised up to 85 degrees when a hill blocks the arc), and the shell lands at the chosen number.
3. After landing: crater; the landing number shown large; the previous path kept as a faint trail.
4. Input method (amendment 05, FR-076): typing a digit or pressing Enter to fire sets the round's input method to keyboard; tapping or dragging on the ruler or tapping the fire button sets it to pointer. Keys of the on-screen number pad, its "Feuer!" key included, set it to keyboard (amendment 12, FR-103). With keyboard input, the next search is never "Finde N".

## Hit feedback (amendment 06, FR-066, FR-072)

| Where the shell lands | Enemy | Status line | Ruler |
|-----------------------|-------|-------------|-------|
| Exact number | destroyed with a large explosion; a new enemy appears at a new position; tank counter + 1 | "Getroffen!" and "Der Gegner stand bei 637." | landing marker |
| On the tank body, not exact | shakes, not destroyed (a miss) | "Ganz knapp! Triff die Linie." | bracket from the child's number to the enemy's number with "Du: 30 · Gegner: 31 · 1 Schritt" |
| Off the tank body | nothing (a miss) | landing number | bracket from the landing number to the enemy with "N Schritte", in every mode (amendment 07) |

- The overlay root carries, for the end-to-end tests only: `data-last-shot` (`hit`, `near` or `miss`), `data-lives` (0 to 3), `data-enemies-destroyed`, `data-last-distance` (the step count of the last shot, amendment 07) and `data-outcome` at the round end; `data-shots-since-enemy-fire` is removed by amendment 07. The canvas carries `data-steps-label`, the text of the step-count bracket on the ruler ('' when none). `data-enemy-health` and `data-player-health` are removed (amendment 06).
- Enemy shot (FR-006, FR-041 to FR-043a, FR-080, FR-081, amendment 07): right after every shot of the child that does not destroy it, the enemy fires once, from its own tank with a visible arc; in comparison turns every standing decoy turns its turret and fires with it from its own barrel, and the decoys' shells land harmlessly farther from the child's tank, so the volley does not show which tank is the enemy (bug report B2). Amendment 13 (FR-098 to FR-100): the shell lands beside the child's tank, about 100 world units away after 1 miss in a row, 60 after 2 and 35 after 3 or more, on a random side, and changes nothing but the ground; it hits when the misses in a row reach 4 ("Leicht"), 3 ("Normal") or 2 ("Herausfordernd"), never on the first enemy shot of a round, and the count then starts again. A fast guess counts as 2 misses. When the shell lands beside the tank one miss before the limit, the child's tank wobbles briefly and the hearts above it pulse once, with no text. A hit on the child's tank removes one heart with a short flash. In no-damage mode the shells still come closer and land on the tank, but the hearts never go down.
- New landscape after every destroyed enemy (amendment 13, FR-101): after the large explosion (about 0.5 s) the old ground fades into new hills over about 0.7 s, the child's tank settles onto the new ground at the same place, and the next enemy fades in on the new ground. Hearts, the tank counter, the time and the ruler stay. Not after the last enemy of a "Gegner pro Runde" round, which ends at once.
- For the end-to-end tests only (tasks.md D4, amendment 13): the overlay root carries `data-miss-streak`; the canvas carries `data-terrain-seed` (the seed of the ground drawn) and `data-enemy-warnings` (how many warnings this round showed).
- Pointer line (FR-073): the enemy, in every mode and challenge kind, and every decoy in comparison turns are always visible, and a thin dashed vertical line runs from the tank's center down to the ruler and ends in a small triangle on the ruler line. No number is drawn at or near it and no ruler label is highlighted; the enemy's number appears only in the feedback after a hit or a near miss. Where the line meets the enemy tank or a decoy, a small target ring marks the spot to hit (amendments 06 and 10). There is no hidden enemy (amendment 07).

## Guided turn flow (one search per player turn)

1. Search starts: the new enemy fades in at the challenge's answer with its pointer line, in every challenge kind (amendment 07); no number is drawn at the line. The challenge appears as a large card in the middle of the sky and is spoken if speech is on; after about 3 seconds or at the first input (a digit, a tap on the ruler, a help request or a shot) it moves to the top center and stays large there (FR-088). Fires are accepted after 1 second. A hit text from the previous search fades out about 2 seconds after the hit, and the hit's landing marker on the ruler with it (FR-004, FR-066).
2. The child chooses a number and fires (see above). Every fire is an answer.
3. Hit (the shell lands at the enemy's exact number): short cheerful sound, the enemy is destroyed, the tank counter goes up; feedback as in the hit feedback table above.
   Miss (a near miss on the body included): the landing number is shown large on the ruler, the ruler shows the bracket from the landing number to the enemy with the step count (after a near miss, "Ganz knapp! Triff die Linie." with both numbers, and the tank shakes), and the next help step (FR-031). The one message line below the challenge (FR-057) shows the encouraging phrase until about 2 seconds after the child can choose again, then the help step's text; there is no "Gelandet bei N" message. The landing marker and the bracket stay until the next shot. Then the enemy fires once (FR-081); then the child chooses again.
4. After the hit (or the shot at the shown solution): round end when the parent's number of enemies is reached, otherwise the hills change to a new landscape (amendment 13), a new enemy appears at a new position and a new search starts (step 1); the destroyed enemy does not fire.

The player's tank stands at the left or right end for the whole round and switches sides in the next round.

## Comparison turns

Amendments 09 and 10 (FR-026, FR-027, FR-031, FR-043a, FR-066): the banner asks the question and names the options, for example "Der Gegner steht bei der größeren Zahl: 47 oder 74"; each option is its own element (`data-testid="banner-option"`), so help can mark it. One tank stands at each option: the real enemy at the correct option and a decoy at each other option. All look like the enemy, each with its dashed pointer line and target ring, and none has a number plate. The child finds the tank at the answer by reading the ruler, then types the number and presses Enter, picks it on the ruler and fires, or taps the tank (a tap area of at least 48 by 48 CSS pixels; a tap fires at that tank's number).

- A shot at a decoy's number bursts the decoy into flat cardboard pieces with a light "plopp" sound, clearly different from the enemy's explosion. It is a miss: the encouraging phrase and the next help step appear, and the enemy fires back. The decoy stays gone for the rest of the search.
- A hit on the enemy destroys it with the large explosion; the remaining decoys fold away (fade out) with it, and the next search starts.
- A near miss on any tank's body makes that tank shake; the step count and the near-miss line refer to the tank nearest the landing number among the tanks still standing.
- The enemy and every standing decoy fire together, each from its own barrel; only the enemy's shell can hit (bug report B2). The canvas carries `data-enemy-volley` (start x of each shell) for the end-to-end tests.
- Help: step 1 highlights the tens digit of every option in the banner (`data-testid="tens-digit"`); step 2 puts a small marker on the ruler under each option's number, with no extra number labels; step 3 marks the correct tank with a green ring and shows the solution, and one tap or Enter fires at it.
- "Neue Landschaft" never starts a comparison turn, so right after it exactly one tank stands opposite the child (amendment 08 item 1, restored by amendment 10).
- There are no number plates and no order badges.
- For the end-to-end tests only (tasks.md D4), the canvas carries `data-enemy-tanks` (the number of standing tanks that look like the enemy, decoys included), `data-pointer-lines` (their numbers, ascending, comma-separated), `data-tank-taps` (`<number>@<x>,<y>` of each tappable tank in world coordinates, `;`-separated, empty outside comparison searches), `data-decoy-bursts` (decoys burst in this round) and `data-help-tanks` (the number of the tank marked by help step 3, or empty).

## Free-play turn flow

Started from the "Freies Spiel" button, shown only when the parent has made free play available. Every turn is a "read the ruler" challenge: the enemy is visible, the child reads the ruler and fires. The enemy fires back after every shot of the child that does not destroy it (amendment 07). A miss shows the distance to the enemy in steps on the ruler; a near miss on the body shows "Ganz knapp! Triff die Linie." with both numbers and the distance. After a hit the enemy is destroyed, the hills change to a new landscape, and a new enemy appears at a new visible position (amendment 13). The enemy zeroes in on misses in a row as in guided mode; in free play every miss adds 1.

## Round end and personal best (amendment 06, FR-084 to FR-086)

1. The round ends when the child's hearts are gone, or with "Gegner pro Runde" right after the last enemy is destroyed.
2. The time stops. The game stores the result against the personal best for the round's range, ruler starting level and round type.
3. The end screen shows an encouraging message ("Super! Alle Gegner getroffen." or "Gut gekämpft! Noch eine Runde?"), the result "9 Panzer getroffen in 6:12" ("1 Panzer" for one), and with "Rekord zeigen" on either "Neuer Rekord!" with a short pop and sparkle (no motion with reduced motion), or "Dein Rekord: 12" in small neutral text when a best exists. It never says "verloren" or "nicht geschafft" and never compares the two numbers.
4. "Zum Start" during a round ends it without a result. "Neue Landschaft" does not end the round (amendment 08): new hills and one new enemy, while hearts, score and time continue. Free play has no other challenge and no bonus.

## Garage and the chosen look (amendment 11, FR-089 to FR-097)

1. Each enemy the child destroys adds 1 star at once (decoys add none), with "Garage und Sterne" on or off.
2. The garage chooses the look: one tap on an unlocked item, or its number typed and Enter. The choice is stored at once.
3. A battle draws the child's tank in the chosen color (dark blue with stripes adds light stripes on the body), with the chosen flag on the antenna and the chosen hat on the turret; the child's shells draw the chosen trail (sparkles: small white and yellow stars along the path; rainbow: several colored lines side by side; bubbles: light circles). With "Garage und Sterne" off, the standard look is used. The canvas carries `data-player-look` with `lookKey` of the look in use, for the end-to-end tests only (D4).
4. The end screen compares the star total at the start of the round with the total now and names every item unlocked in between.

## Keyboard map (FR-059 to FR-064)

| Key | Start screen | Battle (`challenge`, `aiming`) | Solution step (help level 3) | Paused | Round end |
|-----|--------------|-------------------------------|------------------------------|--------|-----------|
| 0 to 9 | none | type a digit | type a digit (fires at the typed number instead) | none | none |
| Minus | none | first character, only when the range has negative numbers | same | none | none |
| Backspace | none | delete the last digit | same | none | none |
| Enter | start guided round | fire at the typed or previewed number (also in comparison turns, where a typed decoy number fires at the decoy; there are no badges, amendments 09 and 10) | fire at the solution | resume | new round |
| Space | start guided round | none | fire at the solution | resume | new round |
| H | none | next help step | none | none | none |
| Escape | none | pause | pause | resume | none |
| G | open the garage (only with "Garage und Sterne" on) | none | none | none | none |

In the garage (amendment 11, FR-092): 0 to 9 type the number of an item (at most 2 digits; the item is selected and the preview shows it when it is unlocked), Backspace deletes the last digit, Enter chooses the selected item when it is unlocked, Escape goes back to the start screen. Space and every other key do nothing.

- No other key does anything. The arrow keys were removed by amendment 05, because stepping toward the answer is a shortcut.
- Keys are ignored while a shell is in flight (`playerShot`, `enemyTurn`), so a held Enter never fires twice.
- A typed number outside the range is not fired; the preview stays at the nearest end, and a hint shows the range, for example "Zahlen von 550 bis 780".
- Focus starts in the game when the app loads (the app root has `tabIndex={-1}` and receives focus), and the keyboard listener is on the window, so typing works without a click. No key opens the parent gate; the gear button ignores keyboard activation.
- Mouse and touch keep working for every action.
- The on-screen number pad (amendment 12) sends the same actions as the keys in the Battle and Solution step columns: digits, minus, ⌫ as Backspace and "Feuer!" as Enter. It is not a keyboard: `keyToAction` does not change, and a physical keyboard works next to the pad.

## Help visuals (FR-031)

- Step 1: phrase, the direction from the landing number to the answer ("Weiter nach rechts" or "Weiter nach links"), and a pulsing highlight on the nearest major line to the answer.
- Step 2: the ruler zooms to the ten containing the answer, with all lines and labels shown whatever the ruler level, and counts steps (numbers pop up one by one) from the landing number to the answer; for addition and subtraction, a small tank icon moves along `stepPath`.
- Step 3: a marker animates to the answer, the number is shown large, and one tap on the fire button, Enter or Space fires at it.
- Comparison: step 1 highlights the tens digits of the options in the banner; step 2 puts a marker on the ruler under each option's number; step 3 marks the correct tank and shows the solution, and one tap or Enter fires (amendments 09 and 10).

## Settings page extras

- Ruler previews (T218, FR-069): two rulers as wide as the settings page, "Am Anfang" at the starting level and "Schwerste Stufe" at the hardest level, drawn with `ticksFor` and the game's layout and label rows (T217) for the chosen range, and redrawn on every change of the range preset, the custom minimum or maximum, or either level.
- "Genau treffen" is removed by amendment 06. "Rundenende" offers "Bis alle Herzen weg" and "Gegner pro Runde"; the number of enemies (1 to 20) appears only with "Gegner pro Runde"; with "Ohne Schaden spielen" on, "Bis alle Herzen weg" is not offered and the choice switches to "Gegner pro Runde". Switches "Uhr beim Spielen zeigen" (off) and "Rekord zeigen" (on).
- "Daten sichern" also includes the personal bests, the stars and the chosen look (amendment 11).
- "Garage und Sterne" switch in the group Runde (on), amendment 11.
- "Daten sichern" (export) downloads a JSON file; "Daten laden" (import) reads one and shows the result.
- A short note explains how to add the game to the Home Screen on iPad and Android.
- A setting for a feature that is not built yet is shown disabled, with the note "kommt bald" (coming soon), instead of being hidden (amendment 05, FR-079).
- A notice appears when stored data was reset or cannot be saved.
