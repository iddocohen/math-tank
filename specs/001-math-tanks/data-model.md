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
| `negativeResults` | `boolean` | `false` | When `true`, results may go below 0 only if `range.min < 0`; otherwise no effect (results always stay in range) |
| `labelLevel` | `1 \| 2 \| 3 \| 4` | `1` | |
| `enemyDifficulty` | `'easy' \| 'normal' \| 'challenging'` | `'easy'` | |
| `help` | `{ nearestTen: boolean; countSteps: boolean; zoom: boolean; stepAnimation: boolean }` | all `true` | Showing the solution is always on (FR-032) |
| `beginnerAssist` | `boolean` | `true` | Splits addition and subtraction animations at ten boundaries (FR-024) |
| `aimCorrection` | `boolean` | `false` | FR-012 |
| `sound` | `{ effects: boolean; music: boolean; speech: boolean }` | `true`, `false`, `true` | |
| `roundLength` | `number` | `10` | Player turns, 3 to 30 |
| `adaptive` | `boolean` | `true` | |
| `freePlay` | `boolean` | `false` | When `true`, rounds start in free-play mode |
| `noDamage` | `boolean` | `false` | FR-044 |
| `timeLimitSeconds` | `number \| null` | `null` | 10 to 120 when set |

`validateSettings(s): { ok: true } | { ok: false; errors: SettingsError[] }` checks all rules. `SettingsError` is a key from the translation table plus the field path.

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
  difficultyStep: number;     // per-skill step used to build it
  skills: Skill[];            // FR-036
  prompt: PromptSpec;         // translation key + parameters, e.g. { key: 'subtraction', params: { a: 43, b: 7 } }
  operands: number[];         // all numbers in the question
  answer: number;             // the target position on the number line
  // comparison only:
  options?: number[];         // numbers on the 2 or 3 tanks; options include answer
  orderAnswer?: number[];     // for 'order3': the required tap sequence
  steps?: number[];           // intermediate positions for the step animation, e.g. [43, 40, 36]
}
```

**Validation** (`validateChallenge(c, settings)`): every value in `operands`, `options`, `steps` and `answer` is inside `[range.min, range.max]`; addition and subtraction respect operand, result, crossing and step rules; comparison has exactly one correct option and distinct options; `answer` is at least `minEnemyGap` units from the player tank position.

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
| `recent` | `RecentOutcome[]` (max 10) | `'independent' \| 'assisted' \| 'unsolved' \| 'guess'`, newest last |
| `attempts` | `number` | |
| `independentCorrect` | `number` | |
| `assisted` | `number` | |

`status(sp)`: `'mastered'` when at least 10 non-guess outcomes in `recent` and at least 8 of the last 10 non-guess outcomes are `'independent'`; otherwise `'developing'` (FR-039).

## Progress (persisted: `mathtanks.progress.v1`)

```ts
interface Progress {
  version: 1;
  attempts: Attempt[];                         // capped at the newest 5000
  skills: Record<string, SkillProgress>;
  sessions: SessionSummary[];                  // not capped
}
interface SessionSummary { id: string; startedAt: number; attempts: number; independentCorrect: number; assisted: number; }
```

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

**Adaptive rule** (`nextStep(sp, settings)`, FR-037): if `adaptive` is off, the step is 0 and the parent's label level applies. Otherwise: up one step when at least 5 of the last 6 outcomes are `'independent'`; down one step when at least 3 of the last 5 are `'assisted'` or `'unsolved'`; `'guess'` outcomes count toward neither and are skipped when counting. After a change, `recent` is cleared so the next change needs new evidence. The effective label level is the higher (harder) of the parent's level and the step's level only when the parent has set level 1 and adaptive is on; otherwise the parent's level applies.

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
  challenge: Challenge | null;
  help: { level: 0 | 1 | 2 | 3; wrongAnswers: number; wrongTapTimes: number[] };
  selection: number | null;        // number chosen on the number line
  charged: boolean;                // FR-011
  aim: { angleDeg: number; power: number };
  lastPlayerPath: Point[] | null;  // FR-004 trail
  outcome: 'playerWon' | 'enemyWon' | 'turnsUsed' | null;
}

interface TankState { id: string; kind: 'player' | 'enemy' | 'decoy'; position: number /* number on the line */; x: number; y: number; health: number /* 0..100 */; label?: number; alive: boolean; }
```

**State transitions**

```text
start → challenge (guided) | aiming (freePlay)
challenge --correct--> aiming (charged = true)
challenge --wrong--> challenge (help.level + 1, message)
challenge --wrong at level 2 or help at level 2--> challenge (help.level = 3, solution shown) --continue--> aiming (charged = false)
aiming --fire--> playerShot --impact--> enemyTurn | roundOver
enemyTurn --impact--> challenge | aiming (next turn) | roundOver
any (except roundOver) --pause--> paused --resume--> previous phase
```

Round over when `player.health == 0` (`enemyWon`), `enemy.health == 0` (`playerWon`), or `turn == roundLength` after the enemy turn (`turnsUsed`). In `noDamage` mode the player's health never drops.

Between turns in guided mode, the enemy drives to the next challenge's answer position; the player tank stays at the end farther from that position, at least `minEnemyGap` = 15% of the range away.

In comparison turns, each option is shown on a tank standing at the position of its own number, so the battlefield keeps the same number-to-position mapping as the number line. The real enemy is the tank whose number is the correct answer.
