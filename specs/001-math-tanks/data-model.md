# Data Model: Math Tanks

All types live in `src/core/` and contain no DOM or Phaser references. Persisted types are validated with Zod on load (see [research.md](./research.md) R11).

## Settings (persisted: `mathtanks.settings.v1`)

| Field | Type | Default | Rule |
|-------|------|---------|------|
| `version` | `1` | `1` | Schema version |
| `challengeTypes` | `{ numberLine: boolean; addition: boolean; subtraction: boolean; comparison: boolean }` | all `true` | At least one `true`, or `freePlay` is `true` (FR-047) |
| `range` | `{ preset: '0-10' \| '0-20' \| '0-50' \| '0-100' \| '0-1000' \| 'custom'; min: number; max: number }` | `0-100`, 0, 100 | Integers; `min < max`; `max - min` between 5 and 1000; preset values fix `min` and `max` |
| `addition` | `{ maxOperand: number; maxResult: number; steps: 1 \| 2 }` | 10, `range.max`, 1 | `1 <= maxOperand`; `maxResult <= range.max` |
| `subtraction` | `{ maxOperand: number; steps: 1 \| 2 }` | 10, 1 | `1 <= maxOperand <= range.max - range.min` |
| `crossTens` | `boolean` | `true` | |
| `crossHundreds` | `boolean` | `false` | |
| `negativeResults` | `boolean` | `false` | Shown only when `range.min < 0` (custom ranges may start below 0, down to -1000). When `false`, results are never below 0; when `true`, results may go down to `range.min` |
| `labelLevel` | `1 \| 2 \| 3 \| 4` | `1` | |
| `enemyDifficulty` | `'easy' \| 'normal' \| 'challenging'` | `'easy'` | |
| `help` | `{ nearestTen: boolean; countSteps: boolean; zoom: boolean; stepAnimation: boolean }` | all `true` | Showing the solution is always on (FR-032) |
| `beginnerAssist` | `boolean` | `true` | Splits addition and subtraction animations at ten boundaries (FR-024) |
| `aimCorrection` | `boolean` | `false` | FR-012 |
| `sound` | `{ effects: boolean; music: boolean; speech: boolean }` | `true`, `false`, `true` | |
| `roundLength` | `number` | `10` | Player turns, 3 to 30 |
| `adaptive` | `boolean` | `true` | |
| `freePlay` | `boolean` | `false` | When `true`, the start screen also offers "Freies Spiel"; guided stays the default |
| `noDamage` | `boolean` | `false` | FR-044 |
| `timeLimitSeconds` | `number \| null` | `null` | 10 to 120 when set |

`validateSettings(s): { ok: true } | { ok: false; errors: SettingsError[] }` checks all rules. `SettingsError` is a key from the translation table plus the field path.

`withRange(s, range): Settings` returns settings with the new range and linked limits clamped to fit it (`addition.maxResult`, `addition.maxOperand`, `subtraction.maxOperand`), so a range change never leaves the form invalid (FR-047).

## Rng

`interface Rng { next(): number /* [0,1) */; int(min, max): number /* inclusive */; pick<T>(items: readonly T[]): T; normal(mean, sd): number }`. Created with `createRng(seed: number)`. `deriveSeed(roundSeed, turn, salt)` gives child seeds.

## Skill

`type Skill = 'positions' | 'countForward' | 'countBackward' | 'tens' | 'crossTens' | 'addition' | 'subtraction' | 'comparison'`

## Challenge

```ts
type ChallengeKind =
  | 'findNumber' | 'after' | 'before' | 'stepsRight' | 'stepsLeft' | 'missingBetween' | 'midpoint'   // number line
  | 'addition' | 'subtraction'
  | 'greater' | 'smaller' | 'equal' | 'order3' | 'largest3' | 'smallest3' | 'closestTo' | 'between'; // comparison

interface Challenge {
  id: string;                 // `${roundSeed}-${turn}`
  seed: number;
  kind: ChallengeKind;
  difficultyStep: number;     // step of the main skill used to build it
  mainSkill: Skill;           // fixed per kind (FR-036)
  skills: Skill[];            // mainSkill plus further skills it counts toward
  prompt: PromptSpec;         // translation key + parameters, e.g. { key: 'subtraction', params: { a: 43, b: 7 } }
  operands: number[];         // all numbers in the question
  answer: number;             // the target position on the number line
  // comparison only:
  options?: number[];         // numbers on the 2 or 3 tanks; options include answer
  orderAnswer?: number[];     // for 'order3': the required tap sequence
  steps?: number[];           // intermediate positions for the step animation, e.g. [43, 40, 36]
}
```

**Validation** (`validateChallenge(c, settings, playerPosition)`): every value in `operands`, `options`, `steps` and `answer` is inside `[range.min, range.max]`; addition and subtraction respect operand, result, crossing and step rules; comparison has exactly one correct option and distinct options; `answer` is at least `minEnemyGap` from the player tank position; every comparison option is at least `minTankGap` from every other option and from the player tank.

**Gaps**: `minTankGap = max(0.08 * (max - min), tankWidthInNumbers)`, where `tankWidthInNumbers` is the tank's 60-unit width converted to numbers; `minEnemyGap = 0.15 * (max - min)`. When the range cannot fit 2 options at `minTankGap` on the side away from the player, comparison is skipped for that configuration.

**Main skill per kind**: `findNumber`, `missingBetween`, `midpoint` → `positions`; `after`, `stepsRight` → `countForward`; `before`, `stepsLeft` → `countBackward`; `addition` → `addition`; `subtraction` → `subtraction`; all comparison kinds → `comparison`. `tens` and `crossTens` are secondary skills added when a challenge involves a multiple of ten or crosses a ten boundary.

## Attempt (persisted inside Progress)

| Field | Type | Notes |
|-------|------|-------|
| `challengeId` | `string` | |
| `seed` | `number` | Reproduce the challenge |
| `kind` | `ChallengeKind` | |
| `skills` | `Skill[]` | |
| `rangeKey` | `string` | e.g. `0-100` or `15-45` |
| `difficultyStep` | `number` | |
| `solved` | `boolean` | `true` if a correct answer was given before the solution was shown |
| `independent` | `boolean` | `solved` and no help was used and no wrong answer |
| `helpLevel` | `0 \| 1 \| 2 \| 3` | Highest help step reached; 3 means the solution was shown |
| `wrongAnswers` | `number` | |
| `responseMs` | `number` | From challenge answerable to final answer |
| `guess` | `boolean` | FR-038 |
| `sessionId` | `string` | |
| `at` | `number` | Epoch milliseconds |

## SkillProgress (persisted inside Progress)

Keyed by `${skill}|${rangeKey}`.

| Field | Type | Notes |
|-------|------|-------|
| `step` | `number` | Current difficulty step for this skill (index into the skill's step ladder) |
| `recent` | `RecentOutcome[]` (max 6) | Non-guess outcomes since the last step change, `'independent' \| 'assisted' \| 'unsolved'`, newest last. Used only by the adaptive rule; cleared on a step change |
| `masteryWindow` | `RecentOutcome[]` (max 10) | Last 10 non-guess outcomes in this skill and range; never cleared by step changes |
| `guesses` | `number` | Count of attempts flagged as guesses |
| `attempts` | `number` | |
| `independentCorrect` | `number` | |
| `assisted` | `number` | |

`status(sp)`: `'mastered'` when `sp.independentCorrect >= 10`, `masteryWindow` holds 10 outcomes, and at least 8 of them are `'independent'`; otherwise `'developing'` (FR-039).

## Progress (persisted: `mathtanks.progress.v1`)

```ts
interface Progress {
  version: 1;
  attempts: Attempt[];                         // capped at the newest 2000 (about 400 KB); summaries keep older totals
  skills: Record<string, SkillProgress>;
  sessions: SessionSummary[];                  // not capped
}
interface SessionSummary { id: string; startedAt: number; lastActiveAt: number; attempts: number; independentCorrect: number; assisted: number; }
```

A new session starts on game load, when `now - lastActiveAt > 30 minutes`, or when the calendar day of `now` differs from `startedAt`. Progress is saved after each attempt, between turns, never during a shot animation.

**Export file**: `{ app: 'math-tanks', exportedAt, settings, progress }` as JSON; import validates both parts with the same schemas and migrations as loading.

## Difficulty ladders

Each skill has an ordered list of `DifficultyStep` values. A step narrows the generator's choices but never widens them beyond the parent settings.

```ts
interface DifficultyStep {
  maxNumberFraction: number;   // fraction of the range the answer may come from, e.g. 0.2, 0.5, 1
  allowCrossTens: boolean;     // still limited by settings.crossTens
  maxOperand?: number;         // still limited by settings
  labelLevel?: 1 | 2 | 3 | 4;  // only applies when adaptive is on; never easier than the parent's choice is forced
}
```

**Adaptive rule** (`nextStep(sp, settings)`, FR-037): if `adaptive` is off, the generator uses the parent settings directly (the top of every ladder, clamped by settings) and the parent's label level. Otherwise each skill starts at step 0: up one step when at least 5 of the last 6 entries in `recent` are `'independent'`; down one step when at least 3 of the last 5 are `'assisted'` or `'unsolved'`. Guesses never enter `recent` or `masteryWindow`. After a change, `recent` is cleared so the next change needs new evidence; `masteryWindow` is kept. Parent settings are ceilings: a step never allows numbers, operands or crossings that the settings forbid.

**Label level**: when adaptive is off, the parent's level. When adaptive is on, the level comes from the `positions` skill's step (`labelLevel` on its ladder), but never easier than the parent's level. Other skills' ladders have no `labelLevel`, so labels do not change between challenge kinds.

## Round state (not persisted)

```ts
type Phase =
  | 'challenge'        // waiting for an answer (guided mode)
  | 'aiming'           // target known; player sets angle and power
  | 'playerShot'       // shell in flight
  | 'enemyTurn'        // enemy aiming and shot in flight
  | 'roundOver'
  | 'paused';

interface RoundState {
  seed: number;
  mode: 'guided' | 'freePlay';
  turn: number;                    // player turns used
  phase: Phase;
  terrain: Heightmap;              // Float32Array of surface heights per column
  player: TankState;
  enemy: TankState;
  decoys: TankState[];             // comparison turns only
  playerSide: 'left' | 'right';    // fixed for the round, alternates between rounds
  enemyFound: boolean;             // false during a search: enemy hidden, nothing drawn at its position
  shotsAtEnemy: number;            // shots since the enemy was found; new search after a hit or 3 shots
  challenge: Challenge | null;
  challengePurpose: 'search' | 'bonus' | null;
  answerableAt: number | null;     // clock time when answers became possible (1 s after display)
  help: { level: 0 | 1 | 2 | 3; wrongAnswers: number; wrongAnswerTimes: number[] };
  selection: number | null;        // previewed number; submitted only by the check button
  charged: boolean;                // FR-011
  aim: { angleDeg: number; power: number };
  lastPlayerPath: Point[] | null;  // FR-004 trail
  outcome: 'playerWon' | 'enemyWon' | 'turnsUsed' | null;
}

interface TankState { id: string; kind: 'player' | 'enemy' | 'decoy'; position: number /* number on the line */; x: number; y: number; health: number /* 0..100 */; label?: number; alive: boolean; }
```

**State transitions**

```text
start → challenge/search (guided) | aiming (freePlay)
challenge --correct--> aiming (charged = true, enemyFound = true for a search)
challenge --wrong--> challenge (help.level + 1, message)
challenge --wrong at level 2 or help at level 2 or time limit--> challenge (help.level = 3, solution shown) --continue--> aiming (charged = false, enemyFound = true)
aiming --bonus button--> challenge/bonus --solved or solution shown--> aiming
aiming --fire--> playerShot --impact--> enemyTurn | roundOver
enemyTurn --impact--> next player turn | roundOver
next player turn (guided): enemy hit by last shot or shotsAtEnemy == 3 → enemy hides and moves, challenge/search; otherwise aiming
any (except roundOver) --pause--> paused --resume--> previous phase
```

Round over when `player.health == 0` (`enemyWon`), `enemy.health == 0` (`playerWon`), or `turn == roundLength` after the enemy turn (`turnsUsed`). In `noDamage` mode the player's health never drops.

The player tank stands at `range.min` (left side) or `range.max` (right side) for the whole round. When a new search starts, the enemy hides (fades out) and the next challenge's answer becomes its position; it is drawn again only when `enemyFound` becomes `true`. The answer is always at least `minEnemyGap` from the player tank.

In comparison turns, each option is shown on a tank standing at the position of its own number, so the battlefield keeps the same number-to-position mapping as the number line. The real enemy is the tank whose number is the correct answer.
