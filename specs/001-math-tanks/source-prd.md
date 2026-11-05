# Source PRD (verbatim user input to /speckit.opsmill.auto, 2026-11-05)

# Math Tanks — Browser-Based Artillery Game for Learning Mathematics

## 1. Product Vision

Build a browser-based, single-player educational artillery game inspired by classic 1990s tank games such as Scorched Earth.

The primary audience is children aged 6–9 who are learning number lines, number magnitude, addition, and subtraction.

The game must be genuinely entertaining, featuring tanks, destructible hills, projectiles, explosions, and a computer-controlled opponent.

Mathematics must be integrated into gameplay rather than presented as a separate quiz or worksheet.

**Primary educational objective:** Help children understand how numbers map to positions on a number line, including the meaning of major and minor tick marks.

**Secondary objectives:** Develop confidence with addition, subtraction, number comparison, place value, and crossing tens boundaries.

**Critical design principle:** The game must be suitable for children with low frustration tolerance who may refuse traditional mathematics exercises.

## 2. Core Gameplay

### 2.1 Battlefield

- Side-view, 2D battlefield with rolling hills.
- One player-controlled tank and one AI-controlled enemy tank.
- Turn-based artillery combat.
- Projectiles follow visible ballistic trajectories.
- Terrain can be destroyed by explosions, leaving craters.
- Tanks can be damaged by direct hits and nearby explosions.
- Tanks respond to changing terrain.
- Randomized terrain layouts between rounds.
- Clear visual feedback, satisfying explosions, and optional sound effects.
- Restart and replay without page reload.

The battlefield must remain visually appealing and entertaining even during mathematics learning.

### 2.2 Shooting

Players must be able to:

- Aim the cannon.
- Adjust shot power.
- See the projectile trajectory after firing.
- Observe where shots land.
- Learn from misses and adjust subsequent shots.

The game must distinguish between physical artillery mechanics and mathematical answers.

A correct mathematical answer must not automatically guarantee a hit unless an explicitly selected beginner assistance mode provides aim correction.

A wrong answer must not permanently prevent progress.

### 2.3 Math-Integrated Controls

Support two approaches:

**Guided mode:** A math challenge determines a meaningful shooting action, such as selecting a target coordinate, charging the cannon, or unlocking a projectile.

**Free-play mode:** Traditional aiming and shooting are available, with optional mathematical challenges that provide bonuses.

Guided mode is the default for learning sessions.

## 3. Number Line Learning

### 3.1 Number Line as a Gameplay Mechanic

The number line must be a central interactive component of the game.

Example:

A target appears at horizontal coordinate 37 on a battlefield mapped to numbers 0–100.

The player must locate 37 on the number line.

Selecting 37 places a target marker or determines the horizontal target coordinate for the cannon.

The number line and battlefield coordinates must have a consistent, understandable mapping.

The game must visually connect the selected number-line position to the corresponding battlefield position.

The player can then fire the cannon using the aiming controls.

### 3.2 Configurable Number Range

Support:

- 0–10
- 0–20
- 0–50
- 0–100
- 0–1000
- Custom minimum and maximum values

The default configuration is 0–100.

A number line must remain readable at every configured range.

For large ranges, use zooming, panning, or a hierarchical representation rather than displaying hundreds of tiny ticks.

### 3.3 Major and Minor Tick Marks

The number line must distinguish between:

- Major tick marks: reference numbers such as 0, 10, 20, 30.
- Minor tick marks: individual units or context-appropriate subdivisions.

Tick marks must represent consistent numeric intervals.

A large tick must not imply a larger numeric step than a small tick when both mark adjacent unit positions.

The game must teach that major ticks are visual reference markers, not fundamentally different kinds of numbers.

Example:

Between 30 and 40, the child should learn to identify 31, 32, 33, and so forth.

### 3.4 Progressive Number Line Learning

Provide four levels:

**Level 1 — Fully labeled**

All numbers are visible. The child learns the relationship between positions and numbers.

**Level 2 — Major landmarks**

Only major reference numbers are visible. The child counts or estimates between them.

**Level 3 — Partially hidden**

Some labels are hidden. The child identifies missing numbers.

**Level 4 — Independent positioning**

The child selects a location with minimal visual assistance.

Progression must be configurable and should not occur automatically after only one successful answer.

### 3.5 Number Line Assistance

Provide optional assistance:

- Highlight the nearest known reference number.
- Count steps visually.
- Animate movement from one number to another.
- Zoom into the relevant ten-number interval.
- Show a movable tank, vehicle, or marker traveling along the number line.
- Display the answer after repeated unsuccessful attempts.

Assistance should be available without penalty.

### 3.6 Number Line Challenges

Examples:

- Find 37.
- Which number comes immediately after 49?
- Which number comes before 60?
- Move 4 steps right from 26.
- Move 7 steps left from 43.
- Identify the missing number between 38 and 40.
- Find the midpoint between 20 and 30.

Challenges must respect the configured range and difficulty.

## 4. Addition Mode

Support configurable addition exercises.

Examples:

- 4 + 3
- 8 + 7
- 24 + 8
- 37 + 25

Configuration:

- Maximum operand value.
- Maximum result.
- Allow or disallow crossing tens.
- Allow or disallow crossing hundreds.
- Single-step or multi-step addition.

Addition should be visualizable as movement to the right on the number line.

Example: 24 + 8 starts at 24 and advances eight units, arriving at 32.

Correct answers can charge the cannon, grant ammunition, or activate a targeting bonus.

## 5. Subtraction Mode

Support subtraction within configurable ranges.

Examples:

- 9 − 4
- 17 − 5
- 32 − 8
- 100 − 37

Configuration:

- 0–10
- 0–20
- 0–100
- Custom range
- Crossing tens enabled/disabled
- Crossing hundreds enabled/disabled
- Negative results enabled/disabled, default disabled

Subtraction must be represented as movement to the left on the number line.

Example:

43 − 7 starts at 43 and moves seven steps left to 36.

For beginner mode, show each step or split the movement at a ten boundary.

## 6. Number Comparison Mode

Generate questions such as:

- Which is greater: 47 or 74?
- Which is smaller: 18 or 21?
- Which number is closest to 50?
- Which number lies between 30 and 40?

The player may choose between two or more target objects.

For example, two enemy targets display different numbers. The player must select the target with the larger number before firing.

Support:

- Greater than
- Less than
- Equal to
- Ordering three numbers
- Finding the largest or smallest number

All exercises must respect the configured number range.

## 7. Child-Friendly Learning Experience

### 7.1 Low-Frustration Design

The game must never use humiliating, discouraging, or punitive language.

Avoid:

- "Wrong!"
- "You failed!"
- Loud negative sounds
- Loss of progress due to mathematical mistakes
- Forced timers
- Public scores or rankings

Prefer:

- "Try another spot."
- "Let's look at the nearest ten."
- "Almost! Let's count together."
- "Good try! You can adjust your aim."

After repeated unsuccessful attempts, the game should offer progressively more explicit assistance.

The child must always be able to continue playing.

### 7.2 Adaptive Difficulty

Track performance separately for each skill.

Examples:

- Recognizing number positions
- Counting forward
- Counting backward
- Understanding tens
- Crossing tens boundaries
- Addition
- Subtraction
- Comparing numbers

Increase difficulty gradually after repeated independent successes.

Reduce difficulty or offer support when the child struggles.

Do not interpret rapid random clicking as mastery.

### 7.3 Rewards

Include optional:

- New tank appearances
- Projectile visual effects
- Battlefield themes
- Stars or achievement badges
- Unlockable cosmetic upgrades

Rewards must not depend on perfect mathematical performance.

Avoid aggressive reward schedules, gambling-like mechanics, and monetization.

## 8. Enemy AI

Implement a configurable computer opponent.

Difficulty options:

- Easy
- Normal
- Challenging

The enemy should aim and fire with visible trajectories.

Enemy accuracy should vary by difficulty.

The AI must not exploit the player's mathematics difficulties.

In beginner mode, enemy attacks should be forgiving, and the child should have opportunities to recover.

Allow an optional no-damage exploration mode.

## 9. Parent Configuration

Provide a parent-accessible settings interface.

Settings:

- Enable/disable each mathematical mode.
- Select one mode or combine several modes.
- Configure minimum and maximum numbers.
- Configure addition and subtraction operand limits separately.
- Configure tens/hundreds crossing.
- Configure negative results.
- Select number-line labeling level.
- Configure enemy difficulty.
- Configure mathematics assistance.
- Configure sound effects and music.
- Configure round length.
- Enable/disable adaptive difficulty.
- Enable/disable free-play mode.

Settings must persist locally across browser sessions.

Parent settings should not interrupt the child's gameplay accidentally.

## 10. Learning Progress

Provide a parent dashboard showing:

- Exercises attempted.
- Independent correct answers.
- Answers completed with assistance.
- Skills currently being practiced.
- Number ranges mastered or still developing.
- Most common difficulties.
- Progress over multiple sessions.

Separate accuracy from assistance usage.

Do not classify a child as having mastered a skill based only on assisted answers.

Progress data must be stored locally by default.

No account, advertising, analytics tracking, or external service should be required.

## 11. Accessibility and Usability

- Browser-based.
- Desktop and tablet support.
- Mouse and touch controls.
- Large, clearly separated interactive targets.
- Minimal reading required.
- Clear numeric typography.
- Optional spoken instructions using browser-supported speech functionality.
- No time pressure by default.
- Pause and resume.
- Fullscreen mode.
- German as the default language.
- Architecture prepared for English localization.

## 12. Technical Requirements

The application must:

- Run locally in a modern browser.
- Require no backend for the initial version.
- Work without login.
- Support offline gameplay after initial loading.
- Persist configuration and progress locally.
- Maintain smooth animation on typical desktop and tablet hardware.
- Keep mathematical exercise generation separate from game physics.
- Use deterministic, testable mathematics logic.
- Avoid generating impossible exercises.
- Use a responsive rendering system.
- Include automated tests for mathematics, number-line mapping, and progression logic.

Preferred implementation direction:

- TypeScript
- React for menus, settings, and dashboard
- Phaser 3 or an equivalent mature 2D game engine for gameplay
- Vite for development and build
- Local browser storage for persistence

Final technology selection should be validated during technical planning.

## 13. Acceptance Criteria

### AC-01: Playable Artillery Game

Given a browser with the application loaded, the child can start a battle, aim, fire, observe projectile trajectories, destroy terrain, and play against an AI opponent.

### AC-02: Number Line Interaction

Given a configured number range of 0–100, the child can select a number on the number line and receive visual feedback connecting the number to its battlefield coordinate.

### AC-03: Major and Minor Ticks

Given a number line from 30 to 40, major reference marks and minor unit marks are displayed correctly, and the child can locate 37.

### AC-04: Configurable Ranges

Given a parent-selected range of 0–20, no generated exercise requires answers outside the configured permitted range.

### AC-05: Subtraction

Given the exercise 43 − 7, the child can visualize movement from 43 to 36 and select the correct answer.

### AC-06: Comparison

Given numbers 47 and 74, the child can select 74 as the greater number and proceed with the associated shooting action.

### AC-07: Assistance

Given multiple incorrect attempts, the game offers an optional hint and eventually demonstrates the correct solution without penalizing the child.

### AC-08: Persistence

Given changed parent settings, closing and reopening the browser retains the selected configuration.

### AC-09: Adaptive Difficulty

Given repeated independent successes or difficulties, the system adjusts exercise complexity within parent-defined boundaries.

### AC-10: Offline Play

Given that the game has been loaded and its assets cached, the player can continue playing without an internet connection.

## 14. MVP Scope

The first playable release must include:

1. One battlefield theme.
2. Two tanks.
3. Turn-based shooting.
4. Projectile physics.
5. Destructible terrain.
6. Basic enemy AI.
7. Interactive number line.
8. Number ranges 0–10, 0–20, and 0–100.
9. Addition, subtraction, and comparison challenges.
10. Parent configuration.
11. Beginner assistance.
12. Local settings persistence.
13. German interface.

Defer cosmetic unlocks, advanced AI, detailed learning analytics, and additional battlefield themes until the core experience is validated.

## 15. Product Success Criteria

The primary measure of success is not the number of correct answers.

Success means that a child who previously avoided number-line exercises willingly interacts with the number line during gameplay.

Evaluate whether the child:

- Voluntarily starts another round.
- Understands that positions correspond to numbers.
- Recognizes major reference marks.
- Can locate numbers between reference marks.
- Uses fewer hints over time.
- Shows increasing confidence without escalating frustration.

The game must prioritize engagement, conceptual understanding, and confidence over speed or competitive performance.
