# Feature Specification: Math Tanks, an artillery game for learning the number line

**Feature Branch**: `001-math-tanks`

**Created**: 2026-11-05

**Status**: Draft

**Input**: User description: the full PRD "Math Tanks — Browser-Based Artillery Game for Learning Mathematics", stored verbatim in [source-prd.md](./source-prd.md).

## Overview

Children aged 6 to 9 play a turn-based tank artillery game in the browser against a computer opponent. The battlefield's horizontal axis is a number line. To find out where the enemy is, the child solves a number-line, addition, subtraction or comparison challenge. The answer marks a position on the battlefield. The child then aims and fires. A correct answer tells the child where to shoot, but it does not aim the cannon for them, unless a parent turns on aim correction.

The game is built for children with low frustration tolerance. It never uses punishing language or sounds, never takes away progress for a mathematical mistake, and always lets the child continue. A parent configures the mathematics and views the child's progress behind a gate that a child does not open by accident.

This release is the MVP described in PRD section 14, extended to cover every PRD acceptance criterion (AC-01 to AC-10). Cosmetic unlocks, advanced AI, detailed learning analytics and additional battlefield themes are deferred, as PRD section 14 states.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Play an artillery battle against the computer (Priority: P1)

The child starts a battle from the start screen. A side-view battlefield with rolling hills shows the child's tank and the enemy tank. On their turn, the child changes the cannon angle and shot power, fires, and watches the shell fly along a visible arc. The shell explodes where it lands, leaves a crater in the hill, and damages any tank close to the explosion. Tanks settle onto the changed ground. The enemy then takes its turn, also with a visible arc. The round ends when one tank has no health left or the configured number of turns is used up. The child can start a new round with a new random landscape without reloading the page.

**Why this priority**: Without an entertaining game, no child will engage with the mathematics. This story alone is a playable game (AC-01).

**Independent Test**: Start the game in free-play mode with all mathematics turned off, play a full round, and confirm aiming, firing, visible arcs, craters, damage, enemy turns, round end and replay all work.

**Acceptance Scenarios**:

1. **Given** the game is loaded, **When** the child taps "Spielen" (Play), **Then** a battlefield with random rolling hills, the child's tank and the enemy tank appears within 3 seconds.
2. **Given** it is the child's turn, **When** the child changes the angle and the power and taps the fire button, **Then** a shell flies along a visible ballistic arc and explodes where it hits the ground or a tank.
3. **Given** a shell explodes on a hill, **When** the explosion finishes, **Then** the hill has a crater at that spot, and any tank standing over removed ground moves down to rest on the new surface.
4. **Given** a shell explodes on or near a tank, **When** the explosion finishes, **Then** that tank loses health, more for a direct hit than for a near miss, and its health bar updates.
5. **Given** the child's shot has landed, **When** the enemy takes its turn, **Then** the enemy's shell also follows a visible arc.
6. **Given** a shot has missed, **When** the child aims again, **Then** the path of the previous shot is still shown as a faint trail, so the child can adjust.
7. **Given** a round has ended, **When** the child taps "Nochmal" (Again), **Then** a new round starts with a different landscape, without a page reload.
8. **Given** the child's tank loses all its health, **When** the round ends, **Then** the game shows an encouraging message (for example "Gut gekämpft! Noch eine Runde?") and no learning progress is lost.

---

### User Story 2 - Find the enemy on the number line (Priority: P1)

In guided mode (the default), the enemy tank is hidden at the start of each search. The challenge, such as "Finde 37" (Find 37), says where it is. Nothing on the battlefield shows the enemy's position until the challenge is solved. A number line spans the bottom of the screen and covers the same range as the battlefield, so position 37 on the number line is directly below position 37 on the battlefield. The child taps or drags on the number line to choose a number, adjusts it with +1 and −1 buttons if needed, and confirms it with a large check button. The game draws a vertical guide line from the chosen number up to the battlefield and places a target marker there. When the confirmed answer is correct, the enemy tank is revealed at that position and the cannon is charged. The child then aims and fires.

The enemy stays at its position until it is hit or the child has fired 3 shots at it, so the child can learn from misses and adjust. During those follow-up turns, the child can solve an optional bonus challenge to charge the cannon again. When the enemy is hit or the 3 shots are used, the enemy hides and moves, and a new search challenge starts.

The number line shows major tick marks (for example 0, 10, 20 and so on) and minor tick marks for every unit in between, all equally spaced. How many labels are visible depends on the labeling level.

**Why this priority**: This is the primary learning goal of the PRD: understanding that positions match numbers, including what major and minor ticks mean (AC-02, AC-03).

**Independent Test**: With range 0 to 100 and only number-line challenges on, play turns and confirm that each chosen number places a marker at the matching battlefield position, and that ticks between 30 and 40 are drawn and selectable.

**Acceptance Scenarios**:

1. **Given** a range of 0 to 100, **When** the child selects 37 on the number line, **Then** a guide line and a target marker appear at the battlefield position that matches 37, and the selected number is shown in large digits.
2. **Given** the number line between 30 and 40, **When** it is displayed, **Then** 30 and 40 have major ticks, 31 to 39 have minor ticks, and every tick is the same distance from its neighbors.
3. **Given** the challenge "Finde 37", **When** the child selects 37, **Then** the challenge counts as solved, the enemy is revealed at 37 and the cannon is charged.
4. **Given** a challenge of the type "Welche Zahl kommt direkt nach 49?" (which number comes right after 49), **When** the child selects 50, **Then** the challenge counts as solved.
5. **Given** labeling level 1, **Then** every number on the line is labeled. **Given** level 2, **Then** only major ticks are labeled. **Given** level 3, **Then** major ticks and some minor ticks are labeled and the rest are hidden. **Given** level 4, **Then** only the two end points are labeled.
6. **Given** the child has selected a number, **When** the child moves their finger or pointer along the line, **Then** the selected number (shown in large digits above the finger) and the battlefield marker follow it. Releasing only previews the number; the answer is checked only when the child taps the check button. The +1 and −1 buttons change the previewed number by one.
7. **Given** a correct answer, **When** the child fires, **Then** the shot is not aimed automatically; whether it hits depends on the angle and power the child chose, unless aim correction is on.
8. **Given** a guided search, **When** the challenge is shown, **Then** no marker, shadow or other sign of the enemy is visible on the battlefield until the challenge is solved or the solution is shown.
9. **Given** the enemy has been found, **When** the child misses, **Then** the enemy stays in place for up to 3 shots in total, and the trail of the previous shot stays visible.

---

### User Story 3 - Addition and subtraction move along the number line (Priority: P2)

Some challenges are additions or subtractions whose result is the enemy's position, such as "Der Gegner ist bei 43 − 7" (The enemy is at 43 − 7). The number line shows the starting number. The child selects the result. When the child asks for help, or in beginner assistance, a marker steps from the starting number to the right (addition) or to the left (subtraction), one unit at a time, and splits the movement at a ten boundary when one is crossed (for example 43 → 40 → 36).

**Why this priority**: Addition and subtraction are secondary objectives and part of the MVP (AC-05).

**Independent Test**: Turn on only subtraction, generate the exercise 43 − 7, use the step animation, and select 36.

**Acceptance Scenarios**:

1. **Given** the exercise 43 − 7, **When** the child taps the help button, **Then** a marker moves left from 43 to 40 and then from 40 to 36, counting each step aloud or on screen, and the child can then select 36.
2. **Given** the exercise 24 + 8, **When** the step animation runs, **Then** the marker moves right from 24 to 30 and then to 32.
3. **Given** crossing tens is turned off, **When** exercises are generated, **Then** no exercise crosses a ten boundary (for example 24 + 8 is never generated, but 24 + 5 can be).
4. **Given** negative results are turned off (the default), **When** subtraction exercises are generated, **Then** no result is below 0 or below the range minimum.
5. **Given** the parent sets maximum operand 10 and maximum result 20 for addition, **When** addition exercises are generated, **Then** no operand is above 10 and no result is above 20.

---

### User Story 4 - Compare numbers to pick the real enemy (Priority: P2)

Some turns show the enemy tank together with one or two decoy tanks that look the same. Each tank carries a number. A challenge such as "Welche Zahl ist größer?" (Which number is greater?) tells the child how to find the real enemy. The child taps a tank to choose it. The chosen tank is marked as the target, and the child aims and fires. Hitting a decoy destroys only the decoy.

**Why this priority**: Comparison is a secondary objective and part of the MVP (AC-06).

**Independent Test**: Turn on only comparison, get a challenge with 47 and 74, select 74, and fire.

**Acceptance Scenarios**:

1. **Given** two tanks labeled 47 and 74 and the question "Welche Zahl ist größer?", **When** the child taps the tank labeled 74, **Then** that tank is marked as the target, the cannon is charged and the child can fire.
2. **Given** a "smaller" question, **When** the child taps the tank with the smaller number, **Then** the challenge counts as solved.
3. **Given** three tanks and the question "Tippe die Zahlen von klein nach groß an" (tap the numbers from smallest to largest), **When** the child taps them in increasing order, **Then** the challenge counts as solved.
4. **Given** an "equal" question showing a number and two tanks, **When** the child taps the tank with the same number, **Then** the challenge counts as solved.
5. **Given** a question such as "Welche Zahl ist am nächsten an 50?" or "Welche Zahl liegt zwischen 30 und 40?", **When** the child taps the matching tank, **Then** the challenge counts as solved.
6. **Given** any comparison challenge, **Then** every number shown is inside the configured range, exactly one choice is correct, and all tanks (options and the player's tank) stand at least the minimum tank gap apart so that they never overlap.

---

### User Story 5 - Gentle help after mistakes (Priority: P2)

When the child chooses a wrong answer, the game responds with a friendly message and never says "falsch" (wrong) or plays a negative sound. Each further wrong answer brings more explicit help. After the third wrong answer the game shows the solution, and the child confirms it and continues to aim and fire. A help button is always available and using it has no penalty. Answers that needed help are recorded as "with help", not as independent answers.

**Why this priority**: Low frustration is the critical design principle of the PRD (AC-07).

**Independent Test**: Answer one challenge wrong three times in a row and confirm the help steps, the shown solution, that play continues, and that the answer is recorded as "with help".

**Acceptance Scenarios**:

1. **Given** a challenge, **When** the child gives the first wrong answer, **Then** the game shows an encouraging message such as "Versuch eine andere Stelle." (Try another spot) and highlights the nearest major tick.
2. **Given** a second wrong answer, **Then** the game zooms into the ten-number interval that contains the answer and counts steps from the nearest major tick.
3. **Given** a third wrong answer, **Then** the game animates a marker to the correct number, shows the answer, and lets the child continue with one tap.
4. **Given** any challenge, **When** the child taps the help button before answering, **Then** the next help step is shown immediately, with no loss of health, turns or progress.
5. **Given** any challenge, **Then** no time limit is shown or enforced, unless the parent has turned one on. When a parent-set time limit runs out, the game shows the next help step, with no penalty.
6. **Given** the full set of on-screen and spoken texts, **Then** none contains discouraging words such as "falsch", "verloren" (lost) or "Fehler" (mistake) in feedback to the child.

---

### User Story 6 - Parent settings that persist (Priority: P2)

A parent opens the settings by pressing and holding the gear icon for 2 seconds. The parent chooses which challenge types are on, the number range, operand limits, tens and hundreds crossing, negative results, the labeling level, enemy difficulty, assistance options, sound and music, round length, adaptive difficulty, free-play mode, aim correction and the no-damage mode. Settings take effect at the start of the next round and are kept after the browser is closed and reopened.

**Why this priority**: Parents need to match the game to the child's level, and the MVP requires parent configuration and local persistence (AC-04, AC-08).

**Independent Test**: Change several settings, close and reopen the browser, and confirm they are kept. Set range 0 to 20 and confirm that no generated exercise needs an answer outside 0 to 20.

**Acceptance Scenarios**:

1. **Given** the child taps the gear icon briefly, **Then** settings do not open and the game continues. **Given** a parent presses and holds it for 2 seconds, **Then** the game pauses and settings open.
2. **Given** the parent changes the range to 0 to 20 and enemy difficulty to "Leicht" (Easy), **When** the browser is closed and reopened, **Then** both settings are kept.
3. **Given** a range of 0 to 20, **When** any number of exercises are generated with any combination of enabled challenge types, **Then** every answer, every operand, every shown number and every intermediate step is between 0 and 20.
4. **Given** the parent turns off every challenge type, **Then** the settings screen shows that guided mode needs at least one challenge type and offers free-play mode instead; it never saves a configuration that cannot generate a challenge.
5. **Given** the parent enters a custom range where the minimum is not smaller than the maximum, **Then** the settings screen does not accept it and explains why.
6. **Given** settings changed during a round, **Then** the current round continues with the old settings and the new ones apply from the next round.

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

---

### User Story 8 - Play anywhere, offline, on a tablet (Priority: P3)

The child plays with a mouse or a touch screen, on a desktop or a tablet, in fullscreen if desired. The game can be paused and resumed at any time. Challenges can be read aloud by the browser's speech function. After the game has loaded once, it keeps working without an internet connection.

**Why this priority**: These are PRD usability and technical requirements (AC-10), but they build on the playable game.

**Independent Test**: Load the game once, disconnect the network, reload the page and play a round. Repeat on a tablet with touch input.

**Acceptance Scenarios**:

1. **Given** the game has been loaded once, **When** the network is disconnected and the page is reloaded, **Then** the game starts and a full round can be played.
2. **Given** a tablet, **When** the child uses touch to select numbers, aim and fire, **Then** every control works and every interactive target is at least 48 by 48 CSS pixels with clear space between targets.
3. **Given** a running round, **When** the child taps pause, **Then** all motion stops; **When** the child taps resume, **Then** the round continues where it stopped.
4. **Given** spoken instructions are on, **When** a challenge appears, **Then** the browser reads it aloud in German, and the child can tap a speaker icon to hear it again.
5. **Given** the child taps the fullscreen button, **Then** the game fills the screen, and the layout fits screens from 768 by 600 pixels upward in both orientations.

---

### User Story 9 - Larger and custom number ranges (Priority: P3)

A parent can choose 0 to 50, 0 to 1000 or a custom minimum and maximum in addition to the MVP ranges 0 to 10, 0 to 20 and 0 to 100. For large ranges, the number line stays readable: it first shows only the hundreds, the child selects the right hundred, then the line zooms into that hundred and the child selects the number.

**Why this priority**: PRD section 3.2 requires these ranges, but PRD section 14 lists only 0 to 10, 0 to 20 and 0 to 100 for the first release.

**Independent Test**: Set range 0 to 1000, get "Finde 437", select the 400s, then 437.

**Acceptance Scenarios**:

1. **Given** range 0 to 1000, **When** the number line appears, **Then** it shows major ticks every 100 and minor ticks every 10, never more than about 100 ticks at once.
2. **Given** range 0 to 1000 and the challenge "Finde 437", **When** the child selects the interval 400 to 500, **Then** the line zooms to 400 to 500 with ticks per unit, and the child can select 437.
3. **Given** a custom range of 15 to 45, **Then** major ticks are at 20, 30 and 40, the end points are labeled, and all exercises stay inside 15 to 45.

---

### Edge Cases

- **Range too small for a challenge type**: in range 0 to 10 with crossing tens off, some exercise types (such as "midpoint" or addition crossing ten) cannot be generated. The generator must skip those types for that configuration and never produce an impossible or out-of-range exercise. If no type is possible, the game falls back to "Finde N" challenges.
- **Enemy position overlaps the child's tank**: the child's tank stands at one end of the battlefield for the whole round (the end alternates between rounds), and answers that would place any tank closer than the minimum gap to the child's tank are not generated.
- **Comparison options too close together**: options must be at least the minimum tank gap apart; when the range cannot fit 2 options at that gap, comparison is skipped for that configuration.
- **Finger slip on a dense number line**: releasing never submits an answer, so a slip only changes the preview.
- **Browser deletes stored data after a long break** (Safari on iPad deletes site data after 7 days without a visit unless the game is on the Home Screen): the game asks the browser for persistent storage, the settings page explains how to add the game to the Home Screen, and parents can export and import settings and progress as a file.
- **Game update available mid-round**: updates are applied only on the start screen, never during a round.
- **Shell leaves the screen**: a shell that leaves the left or right edge counts as a miss and its landing point is shown at the edge.
- **Tank on a destroyed slope**: when the ground under a tank is removed, the tank drops to the new surface and is never left floating or buried.
- **Crater digs through the bottom**: terrain never becomes lower than a fixed floor, so tanks always have ground.
- **Rapid tapping**: taps faster than a human can read the challenge are ignored as answers until the challenge has been visible for 1 second.
- **Settings opened mid-round**: the round pauses; on closing, it resumes with the old settings (see User Story 6, scenario 6).
- **Stored data is missing or damaged**: the game starts with default settings, keeps playing, and tells the parent on the settings page that settings were reset.
- **Speech not available in the browser**: the speaker icon is hidden and the game works without speech.
- **Browser storage full or blocked**: the game keeps working for the session and tells the parent on the settings page that settings cannot be saved.
- **Free-play with no challenge types enabled**: free play works without challenges; the optional challenge button is hidden.
- **Round length reached with both tanks alive**: the round ends with an encouraging summary, no winner or loser is declared.

## Requirements *(mandatory)*

### Functional Requirements

**Battlefield and shooting**

- **FR-001**: The game MUST show a side-view battlefield with randomly generated rolling hills, one player tank and one computer tank, with a new landscape for each round.
- **FR-002**: Turns MUST alternate between the player and the computer.
- **FR-003**: The player MUST be able to set the cannon angle and the shot power with both mouse and touch, and fire with a single large button.
- **FR-004**: Shells MUST follow a visible ballistic arc under constant gravity; the arc of the player's previous shot MUST stay visible as a faint trail until the next shot.
- **FR-005**: An explosion MUST remove terrain in a round area, leaving a crater; terrain MUST never drop below a fixed floor.
- **FR-006**: An explosion MUST damage every tank within its blast radius, with damage decreasing with distance from the center; a direct hit MUST cause the most damage.
- **FR-007**: After terrain changes, tanks MUST settle onto the new ground surface.
- **FR-008**: A round MUST end when one tank's health reaches zero or when the configured number of player turns is used. The end screen MUST show only encouraging text and MUST offer a new round without a page reload.
- **FR-009**: Explosions and hits MUST have clear visual effects; sound effects and music MUST be optional and controlled by settings. The game MUST NOT play loud or negative sounds in response to a wrong answer.

**Guided and free-play modes**

- **FR-010**: The game MUST offer guided mode, the default, in which each search for the enemy begins with a challenge whose solution marks the target: either a battlefield position (number-line, addition and subtraction challenges) or one of several numbered tanks (comparison challenges). During a position search, the enemy's position MUST NOT be visible or inferable from anything on the battlefield until the challenge is solved or the solution is shown.
- **FR-010a**: The player's tank MUST stand at one end of the battlefield for a whole round; the end MUST alternate between rounds. A found enemy MUST stay in place until it is hit or the player has fired 3 shots at it; follow-up turns MUST offer an optional bonus challenge (FR-014) instead of a new search. Afterwards, the enemy hides and a new search starts.
- **FR-011**: In guided mode, solving the challenge MUST reveal the target and charge the cannon. A charged cannon fires a shell with a larger blast radius than an uncharged one.
- **FR-012**: A correct answer MUST NOT change the cannon's angle or power, unless the parent has turned on aim correction. With aim correction on, a correct answer MUST set the angle and power to a shot that hits the marked target, taking the terrain into account; when no shot within the angle and power limits reaches the target, it MUST choose the shot that lands closest to it.
- **FR-013**: After the help sequence shows the solution (FR-031), the child MUST be able to continue to aim and fire in that turn with an uncharged cannon. A wrong answer MUST NOT end the turn, skip the turn, or reduce health.
- **FR-014**: The game MUST offer free-play mode, which the parent makes available or unavailable. When available, the start screen shows a second button "Freies Spiel" (free play) next to "Spielen"; guided mode stays the default. In free play the enemy is visible, the player aims and fires without a required challenge, and an optional bonus challenge (number-line, addition or subtraction kinds only, not comparison) lets the player earn a charged shot.

**Number line**

- **FR-015**: A number line covering the configured range MUST be shown along the bottom of the battlefield. Its scale MUST be linear, and the position of each number on the line MUST be directly below the matching battlefield position.
- **FR-016**: The number line MUST show major ticks at reference numbers and minor ticks between them, with steps chosen by the width of the visible range: width up to 20, major every 5 and minor every 1 (major every 10 when the range includes a multiple of 10 and width is over 10); width 21 to 100, major 10 and minor 1; width 101 to 200, major 10 and minor 1 in the zoomed view, major 50 and minor 10 in the overview; width 201 to 1000, major 100 and minor 10 in the overview. Ticks MUST be equally spaced for equal steps; major ticks MUST be longer and bolder but MUST NOT mark a different step size than minor ticks. The two end points MUST always be labeled.
- **FR-017**: The number line MUST support four labeling levels: 1 all ticks labeled; 2 only major ticks labeled; 3 major ticks plus a rotating subset of minor ticks labeled, with at least half of the minor labels hidden; 4 only the two end points labeled.
- **FR-018**: Labeling level MUST be set by the parent, and MUST NOT advance automatically after a single correct answer; with adaptive difficulty on, it may advance only by the adaptive rules (FR-037).
- **FR-019**: Selecting a number MUST work by tapping or by dragging along the line, snapping to the nearest whole number. While dragging, a vertical guide line MUST connect the chosen number to the battlefield, and the chosen number MUST be shown in large digits above the finger. Releasing MUST only preview the number. Buttons for +1 and −1 MUST adjust the preview, and a check button MUST submit it as the answer.
- **FR-020**: For ranges with more than 100 units, the number line MUST use a two-step selection: first the interval between two major ticks, then the number within a zoomed view of that interval. The zoomed view MUST show connector lines from its two ends to the matching part of the battlefield.
- **FR-021**: Number-line challenges MUST include: find a number; the number right after a number; the number right before a number; move N steps right; move N steps left; the missing number between two numbers; and the midpoint between two major ticks. Every number shown and every answer MUST be inside the configured range.

**Addition and subtraction**

- **FR-022**: Addition challenges MUST respect parent limits for the maximum operand, the maximum result, crossing tens on or off, and crossing hundreds on or off, and MUST support single-step (a + b) and two-step (a + b + c) exercises.
- **FR-023**: Subtraction challenges MUST respect parent limits for the maximum operand (the number subtracted), the range, crossing tens on or off, crossing hundreds on or off, and negative results on or off (default off), and MUST support single-step and two-step exercises.
- **FR-024**: Addition and subtraction MUST be visualizable on the number line as a marker moving right (addition) or left (subtraction) one step at a time from the starting number; in beginner assistance, the movement MUST pause at each crossed ten boundary.
- **FR-025**: Addition and subtraction challenges MUST be generated so that the result is the target's position on the battlefield.

**Comparison**

- **FR-026**: Comparison challenges MUST show the enemy tank and one or two decoy tanks that look the same, each carrying a number in the configured range, and MUST include: greater, smaller, equal, ordering three numbers from smallest to largest, largest of three, smallest of three, closest to a given number, and between two given numbers.
- **FR-027**: Every comparison challenge MUST have exactly one correct answer. The correct tank MUST be the real enemy; hitting a decoy MUST destroy only the decoy. Each numbered tank MUST stand at the position of its own number, and all tanks MUST be at least the minimum tank gap apart (8% of the range width, and never less than one tank width).

**Challenge generation**

- **FR-028**: Challenge generation MUST be separate from game physics and rendering, and MUST be deterministic for a given seed, so that tests can reproduce any challenge.
- **FR-029**: The generator MUST never produce an exercise whose answer, operands, shown numbers or intermediate steps fall outside the configured range or violate a parent setting. When a challenge type cannot be generated under the current settings, the generator MUST skip that type; when no enabled type can be generated, it MUST fall back to a "find a number" challenge.

**Assistance and low frustration**

- **FR-030**: A help button MUST be visible during every challenge. Using it MUST NOT cost health, turns or progress.
- **FR-031**: Help MUST escalate with each wrong answer or help request in the same challenge: step 1, an encouraging message and a highlight of the nearest major tick; step 2, a zoom into the relevant ten-number interval and a step count from the nearest major tick (or the step animation for addition and subtraction); step 3, an animated marker moving to the solution, the solution shown, and a one-tap continue. For comparison challenges: step 1, an encouraging message and the tens digits of all options highlighted; step 2, a marker on the number line under each option's number, showing which lies further right; step 3, the correct tank (or, for ordering, the correct order) shown, and a one-tap continue.
- **FR-032**: Each help type in FR-031 MUST be switchable on or off by the parent; the final step (showing the solution) MUST stay on so the child can always continue.
- **FR-033**: All feedback to the child MUST use encouraging wording from a reviewed list of German phrases. Feedback MUST NOT include the words "falsch", "verloren", "Fehler", "versagt" or similar, and MUST NOT include public scores or rankings.
- **FR-034**: No time limit MUST apply to challenges or turns by default. When a parent sets a time limit and it runs out, the game MUST show the next help step, with no penalty.

**Adaptive difficulty and progress**

- **FR-035**: The game MUST record every challenge attempt with: skill, challenge type, number range, difficulty step, whether it was answered correctly, whether help was used and up to which step, number of wrong answers before the correct one, response time, whether it was flagged as a guess, and session.
- **FR-036**: Skills tracked separately MUST be: number positions, counting forward, counting backward, understanding tens, crossing tens, addition, subtraction and comparison. Each challenge kind MUST have exactly one main skill, whose difficulty step decides how the challenge is built; a challenge MAY also count toward further skills in the progress records (for example 43 − 7 has main skill subtraction and also counts toward crossing tens).
- **FR-037**: When adaptive difficulty is on, the game MUST raise a skill's difficulty one step after at least 5 of the last 6 non-guess attempts in that skill were correct and independent, and MUST lower it one step after 3 of the last 5 non-guess attempts needed help or were not solved independently. Parent settings MUST act as ceilings: difficulty MUST never go beyond them. Adaptive difficulty MUST start each skill at the easiest step. Difficulty steps MUST be defined per skill as a fixed ordered list (for example: smaller numbers, then larger numbers, then crossing tens). The number-line labeling level MUST follow the number-positions skill only, so labels do not change between challenge types.
- **FR-038**: A correct answer confirmed less than 1.5 seconds after answers became possible, or following 3 or more wrong answers within 5 seconds, MUST be recorded as a guess and MUST NOT count toward raising difficulty or mastery.
- **FR-039**: A skill in a number range MUST be shown as mastered only when there are at least 10 independent, non-guess attempts and at least 8 of the last 10 non-guess attempts are independent and correct. The record used for mastery MUST NOT be cleared when the difficulty step changes. Assisted answers MUST NOT count toward mastery.
- **FR-040**: A parent progress page, behind the same gate as settings, MUST show per skill: attempts, independent correct answers, answers with help (shown separately from accuracy), current difficulty step, mastered or developing status per range, the skills with the most help needed, and a history per session (date, attempts, independent correct, with help). The parent MUST be able to reset progress after a confirmation.

**Enemy**

- **FR-041**: The computer opponent MUST offer three difficulties: "Leicht" (Easy), "Normal" and "Herausfordernd" (Challenging). Its accuracy MUST increase with difficulty, by adding less random error to an ideal shot.
- **FR-042**: The computer opponent's choices MUST NOT depend on the child's mathematical performance, challenge outcomes, or help usage.
- **FR-043**: On "Leicht", enemy hits MUST cause at most half the damage of player hits, and the enemy's first shot of a round MUST miss.
- **FR-044**: The parent MUST be able to turn on a no-damage mode in which the player's tank takes no damage.

**Parent settings**

- **FR-045**: Settings and the progress page MUST open only after pressing and holding the gear icon for 2 seconds; a short tap MUST NOT open them. Opening them MUST pause the game.
- **FR-046**: Settings MUST include: each challenge type on or off (number line, addition, subtraction, comparison); number range (0 to 10, 0 to 20, 0 to 50, 0 to 100, 0 to 1000, custom minimum and maximum, default 0 to 100); addition limits (maximum operand, maximum result, steps); subtraction limits (maximum operand, steps); crossing tens on or off; crossing hundreds on or off; negative results on or off (default off; shown only when a custom range starts below 0, and then results may go below 0 only when it is on); labeling level 1 to 4 (default 1); enemy difficulty (default "Leicht"); each help type on or off; beginner assistance on or off (default on); aim correction on or off (default off); sound effects, music and spoken instructions on or off; round length in player turns (default 10); adaptive difficulty on or off (default on); free-play mode on or off; no-damage mode on or off (default off); optional time limit (default off).
- **FR-047**: Settings MUST be validated before saving: the custom minimum must be smaller than the maximum, at least one challenge type or free-play mode must be on, and operand limits must allow at least one exercise in the range. When the parent changes the range, linked limits (maximum result, maximum operands) MUST be adjusted automatically to fit the new range.
- **FR-048**: Settings and progress MUST be stored in the browser and kept across browser sessions. The game MUST ask the browser to keep its stored data permanently. If stored data cannot be read, the game MUST start with defaults and tell the parent on the settings page. Stored data MUST carry a version number, and older versions MUST be migrated on load.
- **FR-048a**: The parent MUST be able to export settings and progress to a file and import them again. The settings page MUST explain how to add the game to the Home Screen of a tablet, which keeps stored data on Safari.
- **FR-049**: Settings changes MUST apply from the next round.

**Platform and usability**

- **FR-050**: The game MUST run in current versions of Chrome, Edge, Firefox and Safari on desktop and tablet, without a server component, account or login.
- **FR-051**: After the first complete load, the game MUST keep working without a network connection, including after a page reload.
- **FR-052**: The game MUST NOT send any data to external services, and MUST NOT contain advertising, analytics or tracking.
- **FR-053**: Every interactive target MUST be at least 48 by 48 CSS pixels; numbers MUST use a large, clear typeface. The number line as a whole is one large target; single ticks are exempt because the preview, the +1 and −1 buttons and the check button (each at least 48 pixels) make exact selection possible.
- **FR-051a**: A new version of the game MUST be applied only from the start screen, never during a round.
- **FR-054**: The game MUST support pause and resume, and fullscreen.
- **FR-055**: Challenges MUST be readable aloud with the browser's speech function when it is available and spoken instructions are on; a speaker icon MUST repeat the current challenge. Speech MUST be started from the "Spielen" tap, because tablet browsers do not speak before a user tap.
- **FR-056**: All child-facing and parent-facing text MUST be in German, loaded from a translation table, so that adding English requires only a new table and no code change.
- **FR-057**: Child-facing screens MUST rely mainly on numbers, icons and speech, with short German text of at most about 8 words per message.
- **FR-058**: Rendering MUST adapt to the screen size and orientation, keeping the number line and battlefield aligned (FR-015).

### Key Entities

- **Settings**: the parent's configuration (see FR-046). One active set per browser.
- **Challenge**: one exercise for one player turn: its type, the numbers shown, the expected answer, the target it marks, the skills it counts toward, and the seed that produced it.
- **Attempt**: the record of one challenge as the child answered it (see FR-035).
- **Skill progress**: per skill and number range: current difficulty step, recent attempts used for adaptive rules, and mastered or developing status.
- **Session**: one period of play with its date and attempt totals. A new session starts when the game is opened, after 30 minutes without input, or on a new calendar day.
- **Round**: one battle: landscape, tanks with health, turn count and outcome.
- **Tank**: player, enemy or decoy; position on the battlefield (as a number in the range), health, and for decoys and comparison targets, the number it carries.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A child can start a battle from the start screen with at most 2 taps, and the battlefield appears within 3 seconds on a typical tablet.
- **SC-002**: During battle, animation runs at a steady rate with no visible stutter on a typical tablet (at least 30 frames per second on a 2020 or later mid-range tablet, 60 on desktop).
- **SC-003**: For each preset range and for custom ranges, 10,000 generated challenges per configuration produce no answer, operand, shown number or intermediate step outside the range, and no exercise that breaks a parent setting.
- **SC-004**: For every number in a range up to 0 to 100, selecting it on the number line places the battlefield marker within half a unit's width of the matching battlefield position.
- **SC-005**: In every challenge, the child can always continue to fire within at most 3 wrong answers or 3 help requests.
- **SC-006**: No child-facing message, spoken text or sound in the game contains discouraging wording or a negative sound effect, as checked against the forbidden word list in FR-033.
- **SC-007**: Settings and progress are identical after closing and reopening the browser in 100% of test runs.
- **SC-008**: After one full load, a round can be started and finished with the network disconnected.
- **SC-009**: In guided mode, the fire button of every search turn is enabled only after an answer has been confirmed on the number line or a numbered tank, or after the solution has been shown, so the number line is part of every search.
- **SC-010**: In observation sessions with target children, the child voluntarily starts another round in most sessions, and uses fewer help steps over successive sessions for the same skill and range (PRD section 15). These are evaluation goals for parents and testers, not automated tests.

## Assumptions

- **Scope**: the release covers the PRD's MVP list (section 14) and every acceptance criterion (AC-01 to AC-10). Ranges 0 to 50, 0 to 1000 and custom ranges are included as a lower-priority story because PRD section 3.2 requires them.
- **Deferred, per PRD section 14**: cosmetic unlocks (new tank appearances, projectile effects, battlefield themes), stars and achievement badges, advanced AI, detailed learning analytics beyond FR-040, and additional battlefield themes. The PRD marks all rewards as optional.
- **Guided-mode design**: each challenge's answer is the enemy's position (or, in comparison, the enemy among decoys). This choice ties every challenge to aiming. The PRD offers "selecting a target coordinate" as one valid design.
- **Comparison tanks stand at their own numbers**, so a larger number is always further right. This keeps one consistent mapping between numbers and battlefield positions (PRD section 3.1) and reinforces the number line idea, even though a child can answer some comparisons by position.
- **Hosting**: the game is served as static files over HTTPS (for example GitHub Pages) or from localhost; offline mode does not work when the files are opened directly from disk.
- **Range presets 0 to 50, 0 to 1000 and custom** stay in this release as the lowest-priority story (US9), because PRD section 3.2 requires them; they can be cut first if time is short.
- **Charged shot**: the bonus for a correct answer is a larger blast radius; the PRD lists "charge the cannon" as one valid reward.
- **Parent gate**: press and hold for 2 seconds. This is a common pattern for apps for young children and needs no reading.
- **Help thresholds**: three escalation steps, with the solution shown on the third wrong answer. The PRD asks for "progressively more explicit assistance" without numbers.
- **Adaptive thresholds** (5 of 6 to raise, 3 of 5 to lower, 1 second for guesses, 8 of 10 for mastery) are reasonable defaults; the PRD gives no numbers.
- **Round length** is counted in player turns, default 10.
- **Battlefield mapping**: the battlefield's horizontal axis is the configured range, mapped linearly, and tanks stand at whole-number positions.
- **Devices**: "typical tablet" means an iPad or Android tablet from 2020 or later; minimum supported screen size is 768 by 600 CSS pixels.
- **Languages**: German only in this release; English is prepared by the translation table (FR-056) but not written.
- **Graphics and sound** are original, simple and drawn by the game; no assets from existing games are used.
