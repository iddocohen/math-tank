# Feature Specification: Math Tanks, an artillery game for learning the number line

**Feature Branch**: `001-math-tanks`

**Created**: 2026-11-05

**Status**: Draft, changed by [amendment 01](./amendment-01-number-aiming.md), [amendment 02](./amendment-02-ruler-ranges-and-detail.md), [amendment 03](./amendment-03-new-scene-button.md), [amendment 04](./amendment-04-hit-rule.md) and [amendment 05](./amendment-05-no-shortcuts-settings-early.md)

**Input**: User description: the full PRD "Math Tanks — Browser-Based Artillery Game for Learning Mathematics", stored verbatim in [source-prd.md](./source-prd.md).

## Overview

Children aged 6 to 9 play a turn-based tank artillery game in the browser against a computer opponent. The battlefield's horizontal axis is a number line. To find out where the enemy is, the child solves a number-line, addition, subtraction or comparison challenge. The answer is a number, and the child aims by choosing that number: the cannon has a fixed angle, and the shell lands at the battlefield position of the chosen number. Every chosen number is fired. When the shell lands on the enemy tank's body, the enemy is hit; the exact number is a bullseye ("Volltreffer") with double damage. When the shell lands off the tank, the game shows where it landed, and help becomes more explicit after each miss. Every child action works with number keys and Enter alone, as well as with mouse and touch. The parent can set any number range with a width from 5 to 1000, such as 550 to 780. The ruler along the bottom of the battlefield shows more or fewer lines and labels depending on its detail level, and in "read the ruler" challenges the child reads the number under a visible enemy.

The game is built for children with low frustration tolerance. It never uses punishing language or sounds, never takes away progress for a mathematical mistake, and always lets the child continue. A parent configures the mathematics and views the child's progress behind a gate that a child does not open by accident.

This release is the MVP described in PRD section 14, extended to cover every PRD acceptance criterion (AC-01 to AC-10). Cosmetic unlocks, advanced AI, detailed learning analytics and additional battlefield themes are deferred, as PRD section 14 states.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Play an artillery battle against the computer (Priority: P1)

The child starts a battle from the start screen. A side-view battlefield with rolling hills shows the child's tank and the enemy tank. In free play the enemy is visible, and the child reads the ruler to find the number under it. On their turn, the child chooses a number on the number line under the battlefield, by tapping, dragging or typing it, and fires. The cannon keeps a fixed angle; the game computes the arc so that the shell lands at the battlefield position of the chosen number. The shell explodes there and leaves a crater in the hill. When the chosen number is the enemy's number, the enemy loses health. Tanks settle onto the changed ground. The enemy then takes its turn, also with a visible arc. The round ends when one tank has no health left or the configured number of turns is used up. The child can start a new round with a new random landscape without reloading the page.

**Why this priority**: Without an entertaining game, no child will engage with the mathematics. This story alone is a playable game (AC-01).

**Independent Test**: Start the game in free-play mode, play a full round by choosing numbers and firing, and confirm that every shell lands at the chosen number, that craters, damage on a hit on the tank body, double damage on the exact number, enemy turns, round end and replay all work, and that the round can be played with the keyboard alone.

**Acceptance Scenarios**:

1. **Given** the game is loaded, **When** the child taps "Spielen" (Play), **Then** a battlefield with random rolling hills, the child's tank and the enemy tank appears within 3 seconds.
2. **Given** it is the child's turn, **When** the child chooses a number and taps the fire button or presses Enter, **Then** a shell flies along a visible ballistic arc from the fixed cannon and explodes at the battlefield position of that number. The child never sets an angle or a power, and the cannon cannot be dragged.
3. **Given** a shell explodes on a hill, **When** the explosion finishes, **Then** the hill has a crater at that spot, and any tank standing over removed ground moves down to rest on the new surface.
4. **Given** the child fires at a number whose battlefield position is on the enemy tank's body, **When** the explosion finishes, **Then** the enemy loses health and its health bar updates. **Given** the child fires at the enemy's exact number, **Then** the enemy loses twice as much health, the explosion is larger and the message "Volltreffer!" appears. **Given** the child fires at a number off the tank body but inside the blast radius, **Then** the enemy tank shakes and loses no health. **Given** an enemy shell explodes on or near the child's tank, **Then** the child's tank loses health, more for a direct hit than for a near miss.
5. **Given** the child's shot has landed, **When** the enemy takes its turn, **Then** the enemy's shell also follows a visible arc.
6. **Given** a shot has missed, **When** the child chooses the next number, **Then** the landing number is shown large, the path of the previous shot is still shown as a faint trail, and in free play the distance to the enemy is shown in steps on the number line.
7. **Given** a round has ended, **When** the child taps "Nochmal" (Again) or presses Enter, **Then** a new round starts with a different landscape, without a page reload.
8. **Given** the child's tank loses all its health, **When** the round ends, **Then** the game shows an encouraging message (for example "Gut gekämpft! Noch eine Runde?") and no learning progress is lost.
9. **Given** a hill stands between the cannon and the chosen number, **When** the child fires, **Then** the game raises the arc so that the shell still lands at the chosen number.

---

### User Story 2 - Find the enemy on the number line (Priority: P1)

In guided mode (the default), the enemy tank is hidden at the start of each search. The challenge, such as "Finde 37" (Find 37), says where it is. Nothing on the battlefield shows the enemy's position until the challenge is solved. A number line spans the bottom of the screen and covers the same range as the battlefield, so position 37 on the number line is directly below position 37 on the battlefield. The child taps or drags on the number line, or types the number, to choose it and fires with the large fire button or the Enter key. The game draws a vertical guide line from the chosen number up to the battlefield and places a target marker there. Each fire is an answer. When the shell lands on the enemy tank's body, the enemy is revealed and damaged; the exact number is a Volltreffer. When it is wrong, the shell lands at the chosen number, the landing number is shown large, and help becomes more explicit (User Story 5). A miss never gives the enemy a turn.

After the hit, or after the child fires at the shown solution, the enemy takes its turn with a visible arc. Then the enemy hides and moves, and a new search starts. A player turn is one search, and the round length counts searches.

The number line shows major tick marks (for example 0, 10, 20 and so on) and minor tick marks for every unit in between, all equally spaced. Which lines and labels are visible depends on the ruler detail level (Stufe 1 to 5).

**Why this priority**: This is the primary learning goal of the PRD: understanding that positions match numbers, including what major and minor ticks mean (AC-02, AC-03).

**Independent Test**: With range 0 to 100 and only number-line challenges on, play searches and confirm that each chosen number places a marker at the matching battlefield position, that the shell lands there, that a shell on the tank body hits, that the exact number is a Volltreffer, and that ticks between 30 and 40 are drawn and selectable.

**Acceptance Scenarios**:

1. **Given** a range of 0 to 100, **When** the child selects 37 on the number line, **Then** a guide line and a target marker appear at the battlefield position that matches 37, and the selected number is shown in large digits.
2. **Given** the number line between 30 and 40, **When** it is displayed, **Then** 30 and 40 have major ticks, 31 to 39 have minor ticks, and every tick is the same distance from its neighbors.
3. **Given** the challenge "Finde 37", **When** the child chooses 37 and fires, **Then** the shell lands at 37, the challenge counts as solved, and the enemy is revealed at 37 and loses health.
4. **Given** a challenge of the type "Welche Zahl kommt direkt nach 49?" (which number comes right after 49), **When** the child fires at 50, **Then** the challenge counts as solved.
5. **Given** ruler level 1, **Then** major and minor lines are drawn and every line is labeled where space allows (otherwise minor labels appear next to the preview marker). **Given** level 2, **Then** major and minor lines are drawn and only major lines are labeled. **Given** level 3, **Then** major and minor lines are drawn and only some major lines are labeled, always including the two end points. **Given** level 4, **Then** only major lines are drawn and labeled. **Given** level 5, **Then** only the two end points are drawn and labeled.
6. **Given** the child has selected a number, **When** the child moves their finger or pointer along the line, **Then** the guide line and the battlefield marker follow it, and no number is shown until the shot has been fired. Releasing only previews the number; the number is fired only when the child taps the fire button (which replaces the check button) or presses Enter. *(Changed by amendment 05: no number while pointing, and the +1 and −1 buttons are removed.)*
7. **Given** the challenge "Finde 37", **When** the child fires at 41, **Then** the shell lands at 41, the number 41 is shown large, the enemy stays hidden and loses no health, the enemy does not take a turn, and the first help step appears.
8. **Given** a guided search, **When** the challenge is shown, **Then** no marker, shadow or other sign of the enemy is visible on the battlefield until the enemy is hit or the solution is shown.
9. **Given** the enemy has been hit, **When** the explosion finishes, **Then** the enemy takes its turn with a visible arc, then hides and moves, and a new search starts; the round length counts this as one player turn.
10. **Given** a "read the ruler" challenge, **When** it is shown, **Then** the enemy is visible and no number is given; **When** the child fires at the number under the enemy, **Then** it is a Volltreffer. **When** the child fires at a number on the enemy tank's body but not at its number, **Then** the enemy is hit and the ruler shows both numbers and the distance, for example "Du: 630 · Gegner: 637 · 7 Schritte".
11. **Given** any ruler level and a "read the ruler" challenge, **When** the child fires at a number off the enemy tank's body, **Then** it is a miss, whatever the visible lines. *(Changed by amendment 04: the read-the-ruler tolerance of amendment 02 is replaced by the tank-body rule.)*
12. **Given** the enemy is visible, **Then** a thin dashed vertical line runs from the center of the enemy tank down to the ruler and ends in a small triangle on the ruler line, with no number drawn near it and no ruler label highlighted. **Given** a guided position search, **Then** there is no line until the enemy is revealed.

---

### User Story 3 - Addition and subtraction move along the number line (Priority: P2)

Some challenges are additions or subtractions whose result is the enemy's position, such as "Der Gegner ist bei 43 − 7" (The enemy is at 43 − 7). The number line shows the starting number. The child selects the result. When the child asks for help, or at the second help step after misses, a marker steps from the starting number to the right (addition) or to the left (subtraction), one unit at a time, and splits the movement at a ten boundary when one is crossed (for example 43 → 40 → 36).

**Why this priority**: Addition and subtraction are secondary objectives and part of the MVP (AC-05).

**Independent Test**: Turn on only subtraction, generate the exercise 43 − 7, use the step animation, and fire at 36.

**Acceptance Scenarios**:

1. **Given** the exercise 43 − 7, **When** the child taps the help button, **Then** a marker moves left from 43 to 40 and then from 40 to 36, counting each step aloud or on screen, and the child can then fire at 36.
2. **Given** the exercise 24 + 8, **When** the step animation runs, **Then** the marker moves right from 24 to 30 and then to 32.
3. **Given** crossing tens is turned off, **When** exercises are generated, **Then** no exercise crosses a ten boundary (for example 24 + 8 is never generated, but 24 + 5 can be).
4. **Given** negative results are turned off (the default), **When** subtraction exercises are generated, **Then** no result is below 0 or below the range minimum.
5. **Given** the parent sets maximum operand 10 and maximum result 20 for addition, **When** addition exercises are generated, **Then** no operand is above 10 and no result is above 20.

---

### User Story 4 - Compare numbers to pick the real enemy (Priority: P2)

Some turns show the enemy tank together with one or two decoy tanks that look the same. Each tank carries a number. A challenge such as "Welche Zahl ist größer?" (Which number is greater?) tells the child how to find the real enemy. The child taps a tank, or types the number on it and presses Enter. The cannon fires at that tank's number. When it is the real enemy, the enemy is hit. When it is a decoy, the decoy is destroyed, the shot counts as a miss, and help becomes more explicit. For ordering three numbers, taps or typed numbers place order badges without firing; when the order is correct, the cannon fires at the enemy, which is the tank with the largest number.

**Why this priority**: Comparison is a secondary objective and part of the MVP (AC-06).

**Independent Test**: Turn on only comparison, get a challenge with 47 and 74, and tap the tank labeled 74 or type 74 and press Enter.

**Acceptance Scenarios**:

1. **Given** two tanks labeled 47 and 74 and the question "Welche Zahl ist größer?", **When** the child taps the tank labeled 74, or types 74 and presses Enter, **Then** the cannon fires at 74 and the enemy is hit with a Volltreffer, because each tank stands at its own number.
2. **Given** a "smaller" question, **When** the child taps the tank with the smaller number, **Then** the challenge counts as solved. **When** the child taps the decoy, **Then** the decoy is destroyed, the enemy does not take a turn, and the first help step appears.
3. **Given** three tanks and the question "Tippe die Zahlen von klein nach groß an" (tap the numbers from smallest to largest), **When** the child taps them, or types each number and presses Enter after each, in increasing order, **Then** each tap places an order badge without firing, and after the third the cannon fires at the enemy. **When** the order is wrong, **Then** the badges reset and the next help step appears.
4. **Given** an "equal" question showing a number and two tanks, **When** the child taps the tank with the same number, **Then** the challenge counts as solved.
5. **Given** a question such as "Welche Zahl ist am nächsten an 50?" or "Welche Zahl liegt zwischen 30 und 40?", **When** the child taps the matching tank, **Then** the challenge counts as solved.
6. **Given** any comparison challenge, **Then** every number shown is inside the configured range, exactly one choice is correct, and all tanks (options and the player's tank) stand at least the minimum tank gap apart so that they never overlap.

---

### User Story 5 - Gentle help after mistakes (Priority: P2)

Every fired number is an answer. When the shell lands at a wrong number, the game shows the landing number, responds with a friendly message, and never says "falsch" (wrong) or plays a negative sound. Help appears by itself after each miss and becomes more explicit: first the direction, then a count of the steps from the landing number to the answer, then the solution, which the child fires at with one tap or Enter. A miss never gives the enemy a turn and never costs health. A help button and the H key are always available and using them has no penalty. Answers that needed help are recorded as "with help", not as independent answers.

**Why this priority**: Low frustration is the critical design principle of the PRD (AC-07).

**Independent Test**: Fire at three wrong numbers in one search and confirm the help steps, that the enemy takes no turn between misses, that the solution is shown and fired at with one tap or Enter, and that the answer is recorded as "with help".

**Acceptance Scenarios**:

1. **Given** the challenge "Finde 37", **When** the child's first shot lands at 31, **Then** the game shows 31 large, an encouraging message such as "Versuch eine andere Stelle." (Try another spot), the direction "Weiter nach rechts" (further to the right), and highlights the nearest major tick to the answer.
2. **Given** a second miss, **Then** the game zooms into the ten-number interval that contains the answer and counts the steps from the landing number to the answer (for addition and subtraction, it shows the step animation instead).
3. **Given** a third miss, **Then** the game animates a marker to the correct number and shows it, and the child fires at it with one tap or Enter.
4. **Given** any challenge, **When** the child taps the help button or presses H before firing, **Then** the next help step is shown immediately, with no loss of health, turns or progress.
5. **Given** any challenge, **Then** no time limit is shown or enforced, unless the parent has turned one on. When a parent-set time limit runs out, the game shows the next help step, with no penalty.
6. **Given** the full set of on-screen and spoken texts, **Then** none contains discouraging words such as "falsch", "verloren" (lost) or "Fehler" (mistake) in feedback to the child.
7. **Given** a search with misses, **Then** the enemy takes no turn and the child's health does not change until the enemy is hit or the solution is fired at.

---

### User Story 6 - Parent settings that persist (Priority: P2)

A parent opens the settings by pressing and holding the gear icon for 2 seconds. The parent chooses which challenge types are on, the number range, operand limits, tens and hundreds crossing, negative results, the ruler's starting level and hardest allowed level (with a preview of the ruler), enemy difficulty, assistance options, sound and music, round length, adaptive difficulty, free-play mode and the no-damage mode. Settings take effect at the start of the next round and are kept after the browser is closed and reopened.

**Why this priority**: Parents need to match the game to the child's level, and the MVP requires parent configuration and local persistence (AC-04, AC-08).

**Independent Test**: Change several settings, close and reopen the browser, and confirm they are kept. Set range 0 to 20 and confirm that no generated exercise needs an answer outside 0 to 20.

**Acceptance Scenarios**:

1. **Given** the child taps the gear icon briefly, **Then** settings do not open and the game continues. **Given** a parent presses and holds it for 2 seconds, **Then** the game pauses and settings open.
2. **Given** the parent changes the range to 0 to 20 and enemy difficulty to "Leicht" (Easy), **When** the browser is closed and reopened, **Then** both settings are kept.
3. **Given** a range of 0 to 20, **When** any number of exercises are generated with any combination of enabled challenge types, **Then** every answer, every operand, every shown number and every intermediate step is between 0 and 20.
4. **Given** the parent turns off every challenge type, **Then** the settings screen shows that guided mode needs at least one challenge type and offers free-play mode instead; it never saves a configuration that cannot generate a challenge.
5. **Given** the parent enters a custom range where the minimum is not smaller than the maximum, **Then** the settings screen does not accept it and explains why.
6. **Given** settings changed during a round, **Then** the current round continues with the old settings and the new ones apply from the next round.
7. **Given** the parent turns on "Genau treffen" (aim exactly), **When** the child fires at a number on the enemy tank's body but not at its number, **Then** the enemy takes no damage, the message "Ganz knapp!" and the step count appear, and the enemy tank shows a bullseye on its center line.

---

### User Story 7 - Difficulty adapts and parents view progress (Priority: P3)

The game tracks results separately for each skill: number positions, counting forward, counting backward, understanding tens, crossing tens, addition, subtraction and comparison. After repeated independent successes in a skill, it gradually raises difficulty within the parent's limits. When the child struggles, it lowers difficulty and offers help earlier. Answers that are too fast to be real thinking, or bursts of rapid random taps, do not count as success. A progress page behind the parent gate shows attempts, independent correct answers and answers with help per skill and over sessions.

**Why this priority**: Adaptive difficulty and the progress view are PRD requirements (AC-09), but the game is useful without them.

**Independent Test**: Simulate a sequence of independent correct answers and a sequence of wrong answers for one skill, and confirm difficulty goes up and down within the parent's limits. Open the progress page and confirm the counts.

**Acceptance Scenarios**:

1. **Given** adaptive difficulty is on, **When** the child answers at least 5 of the last 6 challenges in a skill correctly without help, **Then** the next challenges in that skill are one difficulty step harder, but never beyond the parent's limits.
2. **Given** adaptive difficulty is on, **When** the child answers 3 of the last 5 challenges in a skill wrong or with help, **Then** the next challenges are one difficulty step easier, but never below the easiest step.
3. **Given** a correct answer confirmed less than 1.5 seconds after answers became possible, or a correct answer that follows 3 or more wrong answers within 5 seconds, **Then** it is recorded as a guess and does not count toward raising difficulty or mastery.
4. **Given** a skill where all correct answers were given with help, **Then** the progress page never shows that skill as mastered.
5. **Given** the parent opens the progress page, **Then** it shows, per skill, the number of attempts, independent correct answers and answers with help, the current difficulty step, a mastered or developing status per number range, the skills with the most help needed, and a per-session history.
6. **Given** adaptive difficulty is off, **Then** difficulty stays at the levels the parent configured.
7. **Given** the child hits the enemy tank's body without help but not at the exact number, **Then** the attempt is recorded as close: it counts neither toward raising nor toward lowering difficulty, and not toward mastery.

---

### User Story 8 - Play anywhere, offline, on a tablet (Priority: P3)

The child plays with a mouse, a touch screen or the keyboard alone, on a desktop or a tablet, in fullscreen if desired. With the keyboard, the child needs only number keys and Enter. The game can be paused and resumed at any time. Challenges can be read aloud by the browser's speech function. After the game has loaded once, it keeps working without an internet connection.

**Why this priority**: These are PRD usability and technical requirements (AC-10), but they build on the playable game.

**Independent Test**: Load the game once, disconnect the network, reload the page and play a round. Repeat on a tablet with touch input, and once on a desktop with the keyboard only.

**Acceptance Scenarios**:

1. **Given** the game has been loaded once, **When** the network is disconnected and the page is reloaded, **Then** the game starts and a full round can be played.
2. **Given** a tablet, **When** the child uses touch to select numbers and fire, **Then** every control works and every interactive target is at least 48 by 48 CSS pixels with clear space between targets.
3. **Given** a running round, **When** the child taps pause, **Then** all motion stops; **When** the child taps resume, **Then** the round continues where it stopped.
4. **Given** spoken instructions are on, **When** a challenge appears, **Then** the browser reads it aloud in German, and the child can tap a speaker icon to hear it again.
5. **Given** the child taps the fullscreen button, **Then** the game fills the screen, and the layout fits screens from 768 by 600 pixels upward in both orientations.
6. **Given** the start screen has just loaded, **When** the child presses Enter without clicking anything, **Then** a guided round starts; **When** the child then types 3 and 7, **Then** 37 appears large and the preview marker moves to 37 at once; **When** the child presses Enter, **Then** the cannon fires at 37.
7. **Given** a typed number, **When** the child presses Backspace, **Then** the last digit is removed; **When** the child presses an arrow key, **Then** nothing happens. *(Changed by amendment 05: the arrow keys no longer move the preview.)*
8. **Given** range 0 to 100, **When** the child types 150 and presses Enter, **Then** nothing is fired, the preview stays at 100, and a friendly hint shows the range 0 to 100.
9. **Given** a running round, **When** the child presses Escape, **Then** the round pauses; pressing Escape again resumes it. **When** the child presses any key on the gear icon, **Then** the parent settings do not open.
10. **Given** the solution step or the round-end screen, **When** the child presses Enter or Space, **Then** the cannon fires at the solution or a new round starts.

---

### User Story 9 - Any number range on the ruler (Priority: P2, raised from P3 by amendment 02)

A parent can choose 0 to 50, 0 to 1000 or any whole-number range with a width from 5 to 1000, including ranges that do not start at 0 (for example 550 to 780), in addition to 0 to 10, 0 to 20 and 0 to 100. The battlefield always spans exactly the chosen range, and the ruler under it is always on screen. The child reaches every number by typing it; there is no two-step selection, and there are no +1 and −1 buttons or arrow keys (amendment 05).

**Why this priority**: the product owner wants the child to think about which number fits a position in ranges such as 550 to 780 (amendment 02). PRD section 3.2 requires these ranges.

**Independent Test**: Set range 550 to 780, start free play, read the ruler under the visible enemy, type the number and press Enter.

**Acceptance Scenarios**:

1. **Given** range 0 to 1000, **When** the ruler appears, **Then** it shows major lines every 100 and minor lines every 10, never more than about 100 lines at once.
2. **Given** range 0 to 1000 and the challenge "Finde 437", **When** the child types 437 and presses Enter, **Then** the cannon fires at 437; tapping the ruler snaps to the nearest whole number. *(Changed by amendment 05: the +1 and −1 buttons are removed; typing reaches every number.)*
3. **Given** a custom range of 15 to 45, **Then** major lines are at 20, 30 and 40, the end points are labeled, and all exercises stay inside 15 to 45.
4. **Given** range 550 to 780, **Then** the battlefield spans 550 to 780, the ruler shows major lines every 50 (550, 600, 650, 700, 750) and minor lines every 10, both end points are labeled, and every challenge stays inside 550 to 780.
5. **Given** range 550 to 780 and ruler level 1 to 3, **When** a "read the ruler" challenge places the enemy, **Then** the enemy stands on a minor line (a multiple of 10).
6. **Given** a help step that zooms or counts steps, **Then** all lines of the zoomed area are shown for that step, whatever the ruler level.

---

### Edge Cases

- **Range too small for a challenge type**: in range 0 to 10 with crossing tens off, some exercise types (such as "midpoint" or addition crossing ten) cannot be generated. The generator must skip those types for that configuration and never produce an impossible or out-of-range exercise. If no type is possible, the game falls back to "Finde N" challenges.
- **Enemy position overlaps the child's tank**: the child's tank stands at one end of the battlefield for the whole round (the end alternates between rounds), and answers that would place any tank closer than the minimum gap to the child's tank are not generated.
- **Comparison options too close together**: options must be at least the minimum tank gap apart; when the range cannot fit 2 options at that gap, comparison is skipped for that configuration.
- **Finger slip on a dense number line**: releasing never fires, so a slip only changes the preview.
- **Browser deletes stored data after a long break** (Safari on iPad deletes site data after 7 days without a visit unless the game is on the Home Screen): the game asks the browser for persistent storage, the settings page explains how to add the game to the Home Screen, and parents can export and import settings and progress as a file.
- **Game update available mid-round**: updates are applied only on the start screen, never during a round.
- **Shell leaves the screen**: the player's shell always lands at the chosen number (FR-065), so only an enemy shell can leave the left or right edge; it counts as a miss and its landing point is shown at the edge.
- **Hill blocks the fixed arc**: the game raises the cannon angle in 5-degree steps up to 85 degrees until the arc clears the hill; the shell always lands at the chosen number.
- **Typed number outside the range**: it is not fired; the preview stays at the nearest end of the range, and a friendly hint shows the range. Digits beyond the length of the longest number in the range are ignored.
- **Minus key in a range without negative numbers**: the key is ignored.
- **Keys pressed while a shell is in flight**: digits and Enter are ignored until the child can choose the next number, so a held Enter key never fires twice.
- **Comparison: typed number not on any tank**: in a single-choice comparison, the number is fired like any other number and counts as a miss; in ordering three numbers, it places no badge and a hint asks for a number on a tank.
- **Near miss next to the enemy**: a shell off the tank body but inside the blast radius makes the enemy tank shake; it loses no health. With "Genau treffen" on, a shell on the tank body but not at the exact number also only shakes the tank.
- **Narrow ranges**: in 0 to 10 the tank body is narrower than one step, so only the exact number lands on it; in 0 to 1000 the body covers about 40 numbers.
- **Tank on a destroyed slope**: when the ground under a tank is removed, the tank drops to the new surface and is never left floating or buried.
- **Crater digs through the bottom**: terrain never becomes lower than a fixed floor, so tanks always have ground.
- **Rapid tapping or typing**: fires before the challenge has been visible for 1 second are ignored and do not count as answers.
- **Settings opened mid-round**: the round pauses; on closing, it resumes with the old settings (see User Story 6, scenario 6).
- **Stored data is missing or damaged**: the game starts with default settings, keeps playing, and tells the parent on the settings page that settings were reset.
- **Speech not available in the browser**: the speaker icon is hidden and the game works without speech.
- **Browser storage full or blocked**: the game keeps working for the session and tells the parent on the settings page that settings cannot be saved.
- **Free-play with no challenge types enabled**: free play works without challenges (it never shows one).
- **Round length reached with both tanks alive**: the round ends with an encouraging summary, no winner or loser is declared.

## Requirements *(mandatory)*

### Functional Requirements

**Battlefield and shooting**

- **FR-001**: The game MUST show a side-view battlefield with randomly generated rolling hills, one player tank and one computer tank, with a new landscape for each round.
- **FR-002**: Turns MUST alternate between the player and the computer. In guided mode a player turn is one search (FR-010a); a miss during a search does not end the player's turn (FR-013).
- **FR-003**: The player MUST aim by choosing a number, never by setting an angle or a power. The player chooses the number on the number line (FR-019) or by typing it (FR-060), and fires with a single large fire button or the Enter key. The cannon MUST NOT be draggable. *(Changed by amendment 01: angle and power controls removed.)*
- **FR-004**: Shells MUST follow a visible ballistic arc under constant gravity. The player's shell MUST land at the battlefield position of the chosen number (FR-065). The arc of the player's previous shot MUST stay visible as a faint trail until the next shot, and the landing number MUST be shown large after each player shot.
- **FR-005**: An explosion MUST remove terrain in a round area, leaving a crater; terrain MUST never drop below a fixed floor.
- **FR-006**: The explosion of an enemy shell MUST damage every tank within its blast radius, with damage decreasing with distance from the center; a direct hit MUST cause the most damage. The player's shell damages tanks only by the tank-body rule (FR-066). *(Changed by amendment 04.)*
- **FR-007**: After terrain changes, tanks MUST settle onto the new ground surface.
- **FR-008**: A round MUST end when one tank's health reaches zero or when the configured number of player turns is used (searches in guided mode, shots in free play). The end screen MUST show only encouraging text and MUST offer a new round without a page reload.
- **FR-009**: Explosions and hits MUST have clear visual effects; sound effects and music MUST be optional and controlled by settings. The game MUST NOT play loud or negative sounds in response to a wrong answer.

**Guided and free-play modes**

- **FR-010**: The game MUST offer guided mode, the default, in which each search for the enemy begins with a challenge whose solution is the number to fire at: either a battlefield position (number-line, addition and subtraction challenges) or the number on one of several numbered tanks (comparison challenges). Each fired number MUST count as an answer. During a position search, the enemy's position MUST NOT be visible or inferable from anything on the battlefield until the enemy is hit or the solution is shown.
- **FR-010a**: The player's tank MUST stand at one end of the battlefield for a whole round; the end MUST alternate between rounds. A player turn MUST be one search: it ends when the player's shell hits the enemy, or when the player fires at the shown solution. Then the enemy takes its turn, hides and moves, and a new search starts. *(Changed by amendment 01: removed the rule that a found enemy stays for 3 shots, and the bonus challenge in follow-up turns.)*
- **FR-011**: *Removed by amendment 01.* Charged shots and their larger blast radius no longer exist. Every player shell has the same blast radius.
- **FR-012**: *Removed by amendment 01.* Aim correction no longer exists, because the fixed cannon and the automatic arc (FR-065) always land the shell at the chosen number.
- **FR-013**: A miss MUST NOT end the search, give the enemy a turn, or reduce health or turns. After a miss, the shell lands at the chosen number, the landing number is shown large, and the next help step appears (FR-031). After the help sequence shows the solution, the child MUST be able to fire at it with one tap or the Enter key.
- **FR-014**: The game MUST offer free-play mode, which the parent makes available or unavailable. When available, the start screen shows a second button "Freies Spiel" (free play) next to "Spielen"; guided mode stays the default. In free play the enemy is visible, every turn is a "read the ruler" challenge (FR-067), the player chooses a number and fires, every player shot is followed by an enemy turn, and a miss shows the distance to the enemy in steps on the number line. *(Changed by amendment 01: the bonus challenge and its charged shot are removed.)*

**Number line**

- **FR-015**: A number line covering the configured range MUST be shown along the bottom of the battlefield. Its scale MUST be linear, and the position of each number on the line MUST be directly below the matching battlefield position.
- **FR-016**: The number line MUST show major ticks at reference numbers and minor ticks between them, with steps chosen by the width of the visible range: width up to 20, major every 5 and minor every 1 (major every 10 when the range includes a multiple of 10 and width is over 10); width 21 to 100, major 10 and minor 1; width 101 to 400, major 50 and minor 10; width 401 to 1000, major 100 and minor 10. A zoomed help view (FR-020) uses the steps for its own width. *(Changed by amendment 02: width 230, as in 550 to 780, uses major 50 and minor 10.)* Ticks MUST be equally spaced for equal steps; major ticks MUST be longer and bolder but MUST NOT mark a different step size than minor ticks. The two end points MUST always be labeled.
- **FR-017**: The ruler MUST support five detail levels, which control both lines and labels: Stufe 1, major and minor lines, every line labeled where space allows (otherwise minor labels appear next to the preview marker, but only for a typed number, never while pointing; amendment 05); Stufe 2, major and minor lines, only major lines labeled; Stufe 3, major and minor lines, only some major lines labeled, always including the two end points; Stufe 4, major lines only, labeled; Stufe 5, only the two end points, labeled. *(Changed by amendment 02: replaces the four labeling levels.)*
- **FR-018**: The parent MUST set a starting ruler level and a hardest allowed level (defaults 1 and 5); setting both to the same value locks the level. With adaptive difficulty off, the starting level MUST be used. With adaptive difficulty on, the level MUST follow the number-positions skill (FR-037): one level harder after repeated independent hits, one level easier when the child struggles, never outside the parent's two limits, and never after a single correct answer. Help steps that zoom, count steps or highlight the nearest major line MUST show all lines of the zoomed area for that step, whatever the level.
- **FR-019**: Selecting a number MUST work by tapping or by dragging along the line, snapping to the nearest whole number, and by typing (FR-060). While tapping or dragging, a vertical guide line MUST connect the chosen number to the battlefield and a target marker MUST follow it, but no number MUST be shown (no large readout and no label next to the marker) until the shot has been fired; after landing, the landing number is shown (FR-004). Typed digits MUST be shown as they are typed, because the child produced that number (FR-060). Releasing MUST only preview the number. The fire button, which replaces the check button, MUST fire at the previewed number. There MUST be no buttons or keys that step the preview by 1 or 10. The number line, the preview and the fire button MUST be present in every mode, including free play. *(Changed by amendment 05: the +1 and −1 buttons and the number shown while pointing are removed.)*
- **FR-020**: For every range, the child MUST be able to reach every number by typing it (FR-060); tapping or dragging MUST snap to the nearest whole number. The zoomed view of a ten-number interval MUST be used only as a help visual (FR-031) and MUST show connector lines from its two ends to the matching part of the battlefield. *(Changed by amendment 02: the two-step selection for ranges over 100 units is removed. Changed by amendment 05: the +1 and −1 buttons and the arrow keys are removed.)*
- **FR-021**: Number-line challenges MUST include: find a number; the number right after a number; the number right before a number; move N steps right; move N steps left; the missing number between two numbers; the midpoint between two major ticks; and read the ruler (`readPosition`, FR-067). Every number shown and every answer MUST be inside the configured range.

**Addition and subtraction**

- **FR-022**: Addition challenges MUST respect parent limits for the maximum operand, the maximum result, crossing tens on or off, and crossing hundreds on or off, and MUST support single-step (a + b) and two-step (a + b + c) exercises.
- **FR-023**: Subtraction challenges MUST respect parent limits for the maximum operand (the number subtracted), the range, crossing tens on or off, crossing hundreds on or off, and negative results on or off (default off), and MUST support single-step and two-step exercises.
- **FR-024**: Addition and subtraction MUST be visualizable on the number line as a marker moving right (addition) or left (subtraction) one step at a time from the starting number; in beginner assistance, the movement MUST pause at each crossed ten boundary.
- **FR-025**: Addition and subtraction challenges MUST be generated so that the result is the target's position on the battlefield.

**Comparison**

- **FR-026**: Comparison challenges MUST show the enemy tank and one or two decoy tanks that look the same, each carrying a number in the configured range, and MUST include: greater, smaller, equal, ordering three numbers from smallest to largest, largest of three, smallest of three, closest to a given number, and between two given numbers. Tapping a numbered tank, or typing its number and pressing Enter, MUST fire at that tank's number. For ordering three numbers, taps or typed numbers (Enter after each) MUST place order badges without firing; when the order is correct, the cannon MUST fire at the enemy, which is the tank with the largest number; a wrong order MUST reset the badges and show the next help step.
- **FR-027**: Every comparison challenge MUST have exactly one correct answer. The correct tank MUST be the real enemy. A shot at a decoy MUST destroy only the decoy and count as a miss (FR-013). Each numbered tank MUST stand at the position of its own number, and all tanks MUST be at least the minimum tank gap apart (8% of the range width, and never less than one tank width).

**Challenge generation**

- **FR-028**: Challenge generation MUST be separate from game physics and rendering, and MUST be deterministic for a given seed, so that tests can reproduce any challenge.
- **FR-029**: The generator MUST never produce an exercise whose answer, operands, shown numbers or intermediate steps fall outside the configured range or violate a parent setting. When a challenge type cannot be generated under the current settings, the generator MUST skip that type; when no enabled type can be generated, it MUST fall back to a "find a number" challenge, or to a "read the ruler" challenge when the latest input method is the keyboard (FR-076).

**Assistance and low frustration**

- **FR-030**: Help MUST appear by itself after each miss, so the child never needs the help button. A help button and the H key MUST also show the next help step at any time during a challenge. Using them MUST NOT cost health, turns or progress.
- **FR-031**: Help MUST escalate with each miss or help request in the same search: step 1, an encouraging message, the direction from the landing number to the answer ("Weiter nach rechts" or "Weiter nach links"), and a highlight of the nearest major tick to the answer; step 2, a zoom into the ten-number interval that contains the answer and a count of the steps from the landing number to the answer (or the step animation for addition and subtraction); step 3, an animated marker moving to the solution, the solution shown, and the child fires at it with one tap or the Enter key. When help is requested before any miss, step 1 shows no direction and step 2 counts from the nearest major tick. For comparison challenges: step 1, an encouraging message and the tens digits of all options highlighted; step 2, a marker on the number line under each option's number, showing which lies further right; step 3, the correct tank (or, for ordering, the correct order) shown, and the child fires at it with one tap or the Enter key.
- **FR-032**: Each help type in FR-031 MUST be switchable on or off by the parent; the final step (showing the solution) MUST stay on so the child can always continue.
- **FR-033**: All feedback to the child MUST use encouraging wording from a reviewed list of German phrases. Feedback MUST NOT include the words "falsch", "verloren", "Fehler", "versagt" or similar, and MUST NOT include public scores or rankings.
- **FR-034**: No time limit MUST apply to challenges or turns by default. When a parent sets a time limit and it runs out, the game MUST show the next help step, with no penalty.

**Adaptive difficulty and progress**

- **FR-035**: The game MUST record every challenge attempt with: skill, challenge type, number range, difficulty step, whether it was answered correctly, whether help was used and up to which step, number of wrong answers (misses) before the hit, response time, whether it was flagged as a guess, and session.
- **FR-036**: Skills tracked separately MUST be: number positions, counting forward, counting backward, understanding tens, crossing tens, addition, subtraction and comparison. Each challenge kind MUST have exactly one main skill, whose difficulty step decides how the challenge is built; a challenge MAY also count toward further skills in the progress records (for example 43 − 7 has main skill subtraction and also counts toward crossing tens).
- **FR-037**: When adaptive difficulty is on, the game MUST raise a skill's difficulty one step after at least 5 of the last 6 non-guess attempts in that skill were correct and independent, and MUST lower it one step after 3 of the last 5 non-guess attempts needed help or were not solved independently. Parent settings MUST act as ceilings: difficulty MUST never go beyond them. Adaptive difficulty MUST start each skill at the easiest step. Difficulty steps MUST be defined per skill as a fixed ordered list (for example: smaller numbers, then larger numbers, then crossing tens). The ruler detail level MUST follow the number-positions skill only (FR-018), so the ruler does not change between challenge types.
- **FR-038**: A correct answer confirmed less than 1.5 seconds after answers became possible, or following 3 or more wrong answers within 5 seconds, MUST be recorded as a guess and MUST NOT count toward raising difficulty or mastery.
- **FR-039**: A skill in a number range MUST be shown as mastered only when there are at least 10 independent, non-guess attempts and at least 8 of the last 10 non-guess attempts are independent and correct. The record used for mastery MUST NOT be cleared when the difficulty step changes. Assisted answers MUST NOT count toward mastery.
- **FR-040**: A parent progress page, behind the same gate as settings, MUST show per skill: attempts, independent correct answers, answers with help (shown separately from accuracy), current difficulty step, mastered or developing status per range, the skills with the most help needed, and a history per session (date, attempts, independent correct, with help). The parent MUST be able to reset progress after a confirmation.

**Enemy**

- **FR-041**: The computer opponent MUST offer three difficulties: "Leicht" (Easy), "Normal" and "Herausfordernd" (Challenging). Its accuracy MUST increase with difficulty, by adding less random error to an ideal shot.
- **FR-042**: The computer opponent's choices MUST NOT depend on the child's mathematical performance, challenge outcomes, or help usage.
- **FR-043**: On "Leicht", enemy hits MUST cause at most half the damage of player hits, and the enemy's first shot of a round MUST miss.
- **FR-044**: The parent MUST be able to turn on a no-damage mode in which the player's tank takes no damage.

**Parent settings**

- **FR-045**: Settings and the progress page MUST open only after pressing and holding the gear icon for 2 seconds with mouse or touch; a short tap or any key press MUST NOT open them. Opening them MUST pause the game.
- **FR-046**: Settings MUST include: each challenge type on or off (number line, addition, subtraction, comparison); number range (0 to 10, 0 to 20, 0 to 50, 0 to 100, 0 to 1000, or a custom whole-number minimum and maximum with a width from 5 to 1000 and any start, such as 550 to 780; default 0 to 100); addition limits (maximum operand, maximum result, steps); subtraction limits (maximum operand, steps); crossing tens on or off; crossing hundreds on or off; negative results on or off (default off; shown only when a custom range starts below 0, and then results may go below 0 only when it is on); ruler starting level and hardest allowed level, each 1 to 5 (defaults 1 and 5, start not harder than the hardest), with a preview of the ruler for the chosen range and level (FR-069); enemy difficulty (default "Leicht"); each help type on or off; beginner assistance on or off (default on); sound effects, music and spoken instructions on or off; round length in player turns (default 10); adaptive difficulty on or off (default on); "Genau treffen" (aim exactly) on or off (default off, FR-074); free-play mode on or off; no-damage mode on or off (default off); optional time limit (default off).
- **FR-047**: Settings MUST be validated before saving: the custom minimum must be smaller than the maximum, at least one challenge type or free-play mode must be on, and operand limits must allow at least one exercise in the range. When the parent changes the range, linked limits (maximum result, maximum operands) MUST be adjusted automatically to fit the new range.
- **FR-048**: Settings and progress MUST be stored in the browser and kept across browser sessions. The game MUST ask the browser to keep its stored data permanently. If stored data cannot be read, the game MUST start with defaults and tell the parent on the settings page. Stored data MUST carry a version number, and older versions MUST be migrated on load.
- **FR-048a**: The parent MUST be able to export settings and progress to a file and import them again. The settings page MUST explain how to add the game to the Home Screen of a tablet, which keeps stored data on Safari.
- **FR-049**: Settings changes MUST apply from the next round.

**Platform and usability**

- **FR-050**: The game MUST run in current versions of Chrome, Edge, Firefox and Safari on desktop and tablet, without a server component, account or login.
- **FR-051**: After the first complete load, the game MUST keep working without a network connection, including after a page reload.
- **FR-052**: The game MUST NOT send any data to external services, and MUST NOT contain advertising, analytics or tracking.
- **FR-053**: Every interactive target MUST be at least 48 by 48 CSS pixels; numbers MUST use a large, clear typeface. The number line as a whole is one large target; single ticks are exempt because the preview, the fire button (at least 48 pixels) and typed numbers (FR-060) make exact selection possible. *(Changed by amendment 05: the +1 and −1 buttons are removed.)* Every child action MUST also work with the keyboard alone (FR-059).
- **FR-051a**: A new version of the game MUST be applied only from the start screen, never during a round.
- **FR-054**: The game MUST support pause and resume, and fullscreen.
- **FR-055**: Challenges MUST be readable aloud with the browser's speech function when it is available and spoken instructions are on; a speaker icon MUST repeat the current challenge. Speech MUST be started from the "Spielen" tap, because tablet browsers do not speak before a user tap.
- **FR-056**: All child-facing and parent-facing text MUST be in German, loaded from a translation table, so that adding English requires only a new table and no code change.
- **FR-057**: Child-facing screens MUST rely mainly on numbers, icons and speech, with short German text of at most about 8 words per message.
- **FR-058**: Rendering MUST adapt to the screen size and orientation, keeping the number line and battlefield aligned (FR-015).

**Keyboard-only play (added by amendment 01)**

- **FR-059**: Every child action MUST work with the keyboard alone, using number keys and Enter; mouse and touch MUST keep working. Keyboard focus MUST start in the game, so typing works without clicking first, and there MUST be no visible text field to click.
- **FR-060**: Typing digits MUST enter a number. The number MUST appear large, and the preview marker on the number line and the battlefield MUST move to it at once. Backspace MUST delete the last digit. A minus key MUST be accepted only as the first character and only when the range allows negative numbers. Digits beyond the length of the longest number in the range MUST be ignored.
- **FR-061**: Enter MUST fire at the typed or previewed number. Keys MUST be ignored while a shell is in flight. The arrow keys MUST do nothing. *(Changed by amendment 05: the arrow keys no longer change the preview by 1 or 10, because stepping toward the answer is a shortcut the product owner does not want.)*
- **FR-062**: On the start screen, the round-end screen and the solution step, Enter and Space MUST start, continue or fire. The H key MUST show the next help step. Escape MUST pause and resume the round. No key MUST open the parent gate. The game MUST react only to these keys: digits, Minus (only when the range has negative numbers), Backspace, Enter, Space (start, continue, fire at a shown solution), H (help) and Escape (pause); every other key MUST do nothing. *(Changed by amendment 05.)*
- **FR-063**: A typed number outside the range MUST NOT be fired. The preview MUST stay at the nearest end of the range, and a friendly hint MUST show the range.
- **FR-064**: In comparison challenges, the child MUST be able to answer by typing the number on a tank and pressing Enter (FR-026). For every range, typing the full number MUST fire at it directly (FR-020).

**Number aiming (added by amendment 01)**

- **FR-065**: The player's cannon MUST point up at a fixed angle of 65 degrees from horizontal toward the enemy side. For each shot, the game MUST compute the power so that the shell lands at the battlefield position of the chosen number. When the terrain blocks that arc, the game MUST raise the angle in 5-degree steps up to 85 degrees. The shell MUST always land at the chosen number, within half a unit's width of its battlefield position.
- **FR-066**: The player's shell MUST damage the enemy when its landing point is on the enemy tank's body: within half the tank's drawn width (60 world units, so 30 units) of the tank's center, measured along the battlefield. A body hit MUST cause direct-hit damage; a Volltreffer (FR-071) MUST cause twice that. The rule MUST apply in every mode and to every challenge kind, and the width in numbers MUST follow from the range (about 4 numbers in 0 to 100, about 40 in 0 to 1000). A shell that lands at a decoy's number MUST destroy that decoy. The explosion and crater MUST appear for every shot. When the shell lands inside the blast radius of the enemy but off its body, the enemy tank MUST shake and take no damage. The player's own shell MUST never damage the player's tank. With "Genau treffen" on, FR-074 applies. *(Changed by amendment 04: replaces the exact-number rule of amendment 01.)*

**Ruler and ranges (added by amendment 02)**

- **FR-067**: The game MUST offer the challenge kind "read the ruler" (`readPosition`, main skill number positions), part of the number-line challenge type and on by default. The enemy is visible and no number is given; the child fires at the number under the enemy. It MUST be the only challenge kind in free play. On ruler levels 1 to 3, the enemy MUST stand only on whole numbers that have a visible line; on levels 4 and 5, on any whole number.
- **FR-068**: In a "read the ruler" challenge, a shot MUST hit by the tank-body rule of FR-066 on every ruler level; there is no separate tolerance. After a Volltreffer the feedback MUST show the enemy's number; after a body hit that is not exact, the feedback of FR-072 MUST appear. *(Changed by amendment 04: replaces the hit tolerance of amendment 02.)*
- **FR-069**: The settings page MUST show a small preview of the ruler for the chosen range and starting level, drawn with the same tick rules as the game.
- **FR-070**: The battle screen MUST show a "Neue Landschaft" (new landscape) button with a refresh icon at the right side, at least 48 by 48 CSS pixels. Pressing it MUST start a new round at once in the same mode and with the same settings: a new landscape, a new enemy position, full health for both tanks, the turn count reset, a new challenge in guided mode, and the player's tank on the other side, as for any new round. It MUST be disabled while a shell is in flight and while the game is paused. An unfinished challenge MUST be discarded without recording an attempt, and the session continues. The button MUST have no key and MUST NOT take keyboard focus, so a keyboard player never starts a new scene by accident. *(Added by [amendment 03](./amendment-03-new-scene-button.md).)*

**Hit rule, Volltreffer and pointer line (added by amendment 04)**

- **FR-071**: A shell at exactly the enemy's number MUST be a Volltreffer (bullseye): twice the direct-hit damage, a larger explosion, and the message "Volltreffer!".
- **FR-072**: After a hit on the tank body that is not exact, the ruler MUST show the child's number, the enemy's number and the distance in steps, for example "Du: 30 · Gegner: 31 · 1 Schritt". The wording MUST be encouraging and MUST NOT use a word from FR-033. After a miss off the tank body, the game MUST show the landing number, the direction and the help steps as before (FR-013, FR-030); in free play it MUST also show the distance in steps.
- **FR-073**: Whenever the enemy or a numbered tank is visible (free play, "read the ruler", comparison tanks, and the enemy after a guided search reveals it), a thin dashed vertical line MUST run from the tank's center down to the ruler and end in a small triangle on the ruler line. No number MUST be drawn at or near the line, and the ruler labels around it MUST NOT be highlighted: the child reads the number from the ruler. The enemy's number MAY appear only in the hit feedback after a hit (FR-071, FR-072). While the enemy is hidden in a guided search, no line MUST be drawn. *(Wording from the product owner's clarification of amendment 04 item 5, 2026-11-05.)*
- **FR-074**: The parent setting "Genau treffen" (aim exactly), default off, MUST make only the exact number damage the enemy. A shell on the tank body that is not exact MUST then show "Ganz knapp!" (very close) and the step count, MUST make the tank shake, MUST cause no damage, and in a guided search MUST count as a miss, so the search continues with the help steps. While the setting is on, the enemy tank MUST show a bullseye on its center line. Adaptive difficulty MUST never change this setting.
- **FR-075**: Progress records MUST stay strict: only a shot at the exact number without help counts as an independent correct answer for adaptive difficulty (FR-037) and mastery (FR-039). A body hit that is not exact, without help, MUST be recorded with the outcome close, which counts neither toward raising nor toward lowering difficulty, and not toward mastery. A body hit after help MUST be recorded as assisted. In a guided search a close hit MUST end the search like any hit: the enemy is damaged and takes its turn.

**No shortcuts, clear tanks and early settings (added by amendment 05)**

- **FR-076**: The game MUST track the input method of the current round: "keyboard" once the child types a digit or presses Enter to fire, "pointer" once the child taps or drags on the ruler or taps the fire button. The latest method used MUST decide the next search: with keyboard input, the "find a number" challenge ("Finde 37") MUST be skipped like a kind that cannot be generated (FR-029), because typing a given number needs no thinking. All other kinds stay. When "find a number" is the only kind left and the latest method is the keyboard, the game MUST fall back to "read the ruler". Before the child has used any input method, the game MUST treat the input as keyboard input (a decision of this update; the amendment does not say what happens before the first input).
- **FR-077**: The child's tank and the enemy tank MUST differ by color, shape and flag, not by color alone, so a color-blind child can tell them apart. The child's tank MUST be blue, with rounded shapes and a yellow star flag on its antenna. The enemy tank MUST be red, with a darker, angular body and a black flag. Decoy tanks in comparison turns MUST look exactly like the enemy. At the start of every round, including after "Neue Landschaft" (FR-070), a large bouncing arrow with the word "Du" (you) MUST point at the child's tank for 3 seconds.
- **FR-078**: Each tank's health bar MUST sit directly above that tank, in the tank's color, with no text label. The game MUST NOT show health bars or health labels in the screen corners.
- **FR-079**: The settings page MUST show every setting from FR-046. A setting that belongs to a feature that is not built yet MUST be shown disabled and marked "kommt bald" (coming soon), not hidden. The parent gate (FR-045), the settings page and the progress page MUST be built right after amendment 04, before guided mode, so the product owner can configure the game while the rest is built.

### Key Entities

- **Settings**: the parent's configuration (see FR-046). One active set per browser.
- **Challenge**: one exercise for one player turn: its type, the numbers shown, the expected answer, the target it marks, the skills it counts toward, and the seed that produced it.
- **Attempt**: the record of one challenge as the child answered it (see FR-035).
- **Skill progress**: per skill and number range: current difficulty step, recent attempts used for adaptive rules, and mastered or developing status.
- **Session**: one period of play with its date and attempt totals. A new session starts when the game is opened, after 30 minutes without input, or on a new calendar day.
- **Round**: one battle: landscape, tanks with health, turn count (searches in guided mode) and outcome.
- **Tank**: player, enemy or decoy; position on the battlefield (as a number in the range), health, and for decoys and comparison targets, the number it carries.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A child can start a battle from the start screen with at most 2 taps, and the battlefield appears within 3 seconds on a typical tablet.
- **SC-002**: During battle, animation runs at a steady rate with no visible stutter on a typical tablet (at least 30 frames per second on a 2020 or later mid-range tablet, 60 on desktop).
- **SC-003**: For each preset range and for custom ranges, 10,000 generated challenges per configuration produce no answer, operand, shown number or intermediate step outside the range, and no exercise that breaks a parent setting.
- **SC-004**: For every number in a range up to 0 to 100, selecting it on the number line places the battlefield marker within half a unit's width of the matching battlefield position.
- **SC-005**: In every search, the child can always fire at the enemy's number within at most 3 misses or 3 help requests, and no miss gives the enemy a turn or reduces the child's health.
- **SC-006**: No child-facing message, spoken text or sound in the game contains discouraging wording or a negative sound effect, as checked against the forbidden word list in FR-033.
- **SC-007**: Settings and progress are identical after closing and reopening the browser in 100% of test runs.
- **SC-008**: After one full load, a round can be started and finished with the network disconnected.
- **SC-009**: In guided mode, every player shot is fired at a number the child chose (on the number line, by typing, or by choosing a numbered tank) or at the shown solution, and the enemy loses health only when that number equals the enemy's number, so the number line is part of every search.
- **SC-010**: In observation sessions with target children, the child voluntarily starts another round in most sessions, and uses fewer help steps over successive sessions for the same skill and range (PRD section 15). These are evaluation goals for parents and testers, not automated tests.
- **SC-011**: A full guided round, from the start screen through searches, misses, help, the solution step, pause and resume, to the round end and a new round, can be played with only number keys, Enter, Escape, H and Backspace, with no mouse click or touch, in Chromium, WebKit and Firefox.
- **SC-012**: For every number in each preset range and on seeded terrains, the player's shell lands within half a unit's width of the chosen number's battlefield position.
- **SC-013**: For every range width from 5 to 1000 and starting points from -1000 to 9000, including 550 to 780, the ruler follows FR-016 and FR-017 at each of the 5 levels and shows at most 101 lines, and 10,000 generated challenges per tested range stay inside it.

## Assumptions

- **Scope**: the release covers the PRD's MVP list (section 14) and every acceptance criterion (AC-01 to AC-10). Ranges 0 to 50, 0 to 1000 and custom ranges are included as a P2 story (amendment 02).
- **Deferred, per PRD section 14**: cosmetic unlocks (new tank appearances, projectile effects, battlefield themes), stars and achievement badges, advanced AI, detailed learning analytics beyond FR-040, and additional battlefield themes. The PRD marks all rewards as optional.
- **Guided-mode design**: each challenge's answer is the enemy's position (or, in comparison, the enemy among decoys), and aiming is choosing that number (amendment 01). The PRD offers "selecting a target coordinate" as one valid design.
- **Comparison tanks stand at their own numbers**, so a larger number is always further right. This keeps one consistent mapping between numbers and battlefield positions (PRD section 3.1) and reinforces the number line idea, even though a child can answer some comparisons by position.
- **Hosting**: the game is served as static files over HTTPS (for example GitHub Pages) or from localhost; offline mode does not work when the files are opened directly from disk.
- **Custom range limits**: a custom range has a width from 5 to 1000 and a minimum from -1000 to 9000, so the largest number has at most 4 digits plus a sign. The amendment gives no upper limit; this one keeps typed numbers short.
- **Read-the-ruler tolerance on level 5**: *Superseded by amendment 04.* Amendment 02's tolerance (half of the smallest visible step, the major step on level 5) no longer exists; the tank-body rule of FR-066 applies on every level.
- **Free play and progress**: free-play shots (always "read the ruler") are practice and are not recorded as attempts, so they do not change difficulty or mastery. The amendments do not say.
- **Parent gate**: press and hold for 2 seconds. This is a common pattern for apps for young children and needs no reading.
- **Help thresholds**: three escalation steps, with the solution shown on the third miss. The PRD asks for "progressively more explicit assistance" without numbers.
- **Adaptive thresholds** (5 of 6 to raise, 3 of 5 to lower, 1 second for guesses, 8 of 10 for mastery) are reasonable defaults; the PRD gives no numbers.
- **Round length** is counted in player turns, default 10: searches in guided mode, shots in free play.
- **Hit damage**: a body hit causes the direct-hit damage of FR-006 (40 of 100 health), and a Volltreffer twice that (80), so the enemy needs two to three hits. Amendment 04 says "double damage" but gives no base number.
- **Tank body width**: the hit area is the 60-unit tank width used for the tank gaps (FR-027), centered on the tank's number. In numbers it is 60 divided by the 1440-unit ruler length, times the range width: about 4 numbers in 0 to 100, about 9.6 in 550 to 780 and about 42 in 0 to 1000. The amendment says "about 4" and "about 40".
- **Comparison and the hit rule**: tapping or typing a tank's number fires at that tank's center, so it is always a Volltreffer on the chosen tank. Decoys are destroyed only at their exact number, as before (amendment 04 item 8).
- **Miss distance in guided mode**: a miss shows the landing number and, from help step 1, the direction; the step count from the landing number to the answer appears at help step 2. Showing the distance as a number on the first miss would give the answer away. Free play shows the distance after every miss, because the enemy is visible.
- **Free-play enemy**: after each hit in free play, the enemy moves to a new visible position at least the minimum enemy gap from the player.
- **Battlefield mapping**: the battlefield's horizontal axis is the configured range, mapped linearly, and tanks stand at whole-number positions.
- **Devices**: "typical tablet" means an iPad or Android tablet from 2020 or later; minimum supported screen size is 768 by 600 CSS pixels.
- **Languages**: German only in this release; English is prepared by the translation table (FR-056) but not written.
- **Graphics and sound** are original, simple and drawn by the game; no assets from existing games are used.

## Amendments

- **[Amendment 01: aim by number, not by angle](./amendment-01-number-aiming.md)** (2026-11-05, product owner). Replaces angle and power aiming with number aiming (fixed cannon, automatic arc, exact numbers hit, every chosen number fires, misses never give the enemy a turn, help driven by misses) and adds keyboard-only play. It overrides [source-prd.md](./source-prd.md) section 2.2 ("Aim the cannon", "Adjust shot power") and the PRD rule that a correct answer must not guarantee a hit. Changed: US1, US2, US4, US5, US8, US9, FR-002 to FR-004, FR-006, FR-008, FR-010, FR-010a, FR-013, FR-014, FR-019, FR-026, FR-027, FR-030, FR-031, FR-035, FR-045, FR-046, FR-053, SC-005, SC-009. Removed: FR-011, FR-012. Added: FR-059 to FR-066, SC-011, SC-012.
- **[Amendment 02: any number range, reading the ruler, and ruler detail levels](./amendment-02-ruler-ranges-and-detail.md)** (2026-11-05, product owner). Allows any range with a width from 5 to 1000 (such as 550 to 780) and raises US9 to P2; removes the two-step zoom selection; adds the "read the ruler" challenge kind, the only kind in free play; replaces the four labeling levels with five ruler detail levels, set by a starting and a hardest level and moved by adaptive difficulty; shows a ruler preview in the settings. Changed: US2, US6, US9, FR-014, FR-016 to FR-018, FR-020, FR-021, FR-037, FR-046, FR-064, FR-066. Added: FR-067 to FR-069, SC-013.
- **[Amendment 03: new scene button](./amendment-03-new-scene-button.md)** (2026-11-05, product owner). Adds a "Neue Landschaft" button that starts a new round at once, without recording an attempt, and has no key. Added: FR-070.
- **[Amendment 04: a hit on the tank body counts, exact number is a bullseye](./amendment-04-hit-rule.md)** (2026-11-05, product owner). A shell on the enemy tank's body is a hit in every mode; the exact number is a Volltreffer with double damage; a body hit that is not exact shows both numbers and the distance; a pointer line connects every visible tank to the ruler; progress counts only exact shots as independent and adds the outcome close; the parent setting "Genau treffen" restores exact-only damage. Replaces amendment 01 item 3 and amendment 02 item 3. Changed: US1, US2, US4, US6, US7, FR-006, FR-046, FR-066, FR-068, Assumptions. Added: FR-071 to FR-075.
- **[Amendment 05: no shortcuts to the answer, clear tanks and parent settings early](./amendment-05-no-shortcuts-settings-early.md)** (2026-11-05, product owner). Removes the arrow-key actions and the +1 and −1 buttons, because stepping toward the answer gives the child an easy path; shows no number while the child points on the ruler, until the shot is fired; generates "Finde N" only when the child chooses numbers with mouse or touch; limits the keyboard to digits, Minus, Backspace, Enter, Space, H and Escape; makes the child's tank and the enemy tank differ by color, shape and flag, with a "Du" arrow at the start of every round; moves the health bars above the tanks; and schedules the parent gate, settings and progress pages before guided mode, with settings for features not built yet marked "kommt bald". Keeps the pointer line of FR-073 as it is. Changes amendment 01 item 10 (keyboard map) and the +1 and −1 controls. Changed: US2 scenario 6, US8 scenario 7, US9 scenario 2, Edge Cases, FR-017, FR-019, FR-020, FR-029, FR-053, FR-061, FR-062. Added: FR-076 to FR-079.
