# Data Model: Math Tanks

All types live in `src/core/` and contain no DOM or Phaser references. Persisted types are validated with Zod on load (see [research.md](./research.md) R11). Changed by [amendment 01](./amendment-01-number-aiming.md) (number aiming, keyboard entry) [amendment 02](./amendment-02-ruler-ranges-and-detail.md) (any range, ruler levels, "read the ruler") and [amendment 04](./amendment-04-hit-rule.md) (tank-body hit rule, Volltreffer, `exactHit` setting, outcome `'close'`).

## Settings (persisted: `mathtanks.settings.v1`)

| Field | Type | Default | Rule |
|-------|------|---------|------|
| `version` | `3` | `3` | Schema version. Version 2 (amendments 01 and 02) removes `aimCorrection` and replaces `labelLevel` with `rulerLevelStart` and `rulerLevelMax`; version 3 (amendment 04) adds `exactHit`; `migrate` upgrades version 0, 1 and 2 data (see below) |
| `challengeTypes` | `{ numberLine: boolean; addition: boolean; subtraction: boolean; comparison: boolean }` | all `true` | At least one `true`, or `freePlay` is `true` (FR-047) |
| `range` | `{ preset: '0-10' \| '0-20' \| '0-50' \| '0-100' \| '0-1000' \| 'custom'; min: number; max: number }` | `0-100`, 0, 100 | Integers; `min < max`; `max - min` between 5 and 1000; `min` from -1000 to 9000 (any start, for example 550 to 780); preset values fix `min` and `max` |
| `addition` | `{ maxOperand: number; maxResult: number; steps: 1 \| 2 }` | 10, `range.max`, 1 | `1 <= maxOperand`; `maxResult <= range.max` |
| `subtraction` | `{ maxOperand: number; steps: 1 \| 2 }` | 10, 1 | `1 <= maxOperand <= range.max - range.min` |
| `crossTens` | `boolean` | `true` | |
| `crossHundreds` | `boolean` | `false` | |
| `negativeResults` | `boolean` | `false` | Shown only when `range.min < 0` (custom ranges may start below 0, down to -1000). When `false`, results are never below 0; when `true`, results may go down to `range.min` |
| `rulerLevelStart` | `1 \| 2 \| 3 \| 4 \| 5` | `1` | Ruler detail level used when adaptive is off, and the easiest level adaptive may use (FR-018) |
| `rulerLevelMax` | `1 \| 2 \| 3 \| 4 \| 5` | `5` | Hardest level adaptive may reach; `rulerLevelStart <= rulerLevelMax`; equal values lock the level |
| `enemyDifficulty` | `'easy' \| 'normal' \| 'challenging'` | `'easy'` | |
| `help` | `{ nearestTen: boolean; countSteps: boolean; zoom: boolean; stepAnimation: boolean }` | all `true` | Showing the solution is always on (FR-032) |
| `beginnerAssist` | `boolean` | `true` | Splits addition and subtraction animations at ten boundaries (FR-024) |
| `sound` | `{ effects: boolean; music: boolean; speech: boolean }` | `true`, `false`, `true` | |
| `roundLength` | `number` | `10` | Player turns, 3 to 30 |
| `adaptive` | `boolean` | `true` | |
| `freePlay` | `boolean` | `false` | When `true`, the start screen also offers "Freies Spiel"; guided stays the default |
| `noDamage` | `boolean` | `false` | FR-044 |
| `exactHit` | `boolean` | `false` | "Genau treffen" (FR-074): only the exact number damages the enemy, and the enemy tank shows a bullseye. Adaptive difficulty never changes it |
| `timeLimitSeconds` | `number \| null` | `null` | 10 to 120 when set |

`validateSettings(s): { ok: true } | { ok: false; errors: SettingsError[] }` checks all rules. `SettingsError` is a key from the translation table plus the field path.

**Migration from version 1**: `aimCorrection` is dropped; `rulerLevelStart` comes from `labelLevel` (1 → 1, 2 → 2, 3 → 3, 4 → 5, because old level 4 showed only the end points); `rulerLevelMax` is 5; `version` becomes 2.

**Migration from version 2**: `exactHit` is added with `false`; `version` becomes 3. Version 0 and 1 data go through both steps.

`withRange(s, range): Settings` returns settings with the new range and linked limits clamped to fit it (`addition.maxResult`, `addition.maxOperand`, `subtraction.maxOperand`), so a range change never leaves the form invalid (FR-047).

## Rng

`interface Rng { next(): number /* [0,1) */; int(min, max): number /* inclusive */; pick<T>(items: readonly T[]): T; normal(mean, sd): number }`. Created with `createRng(seed: number)`. `deriveSeed(roundSeed, turn, salt)` gives child seeds.

## Skill

`type Skill = 'positions' | 'countForward' | 'countBackward' | 'tens' | 'crossTens' | 'addition' | 'subtraction' | 'comparison'`

## Challenge

```ts
type ChallengeKind =
  | 'findNumber' | 'after' | 'before' | 'stepsRight' | 'stepsLeft' | 'missingBetween' | 'midpoint'   // number line
  | 'readPosition'                                                                                   // number line, amendment 02: enemy visible, child reads the ruler
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
  // readPosition only:
  rulerLevel?: 1 | 2 | 3 | 4 | 5;   // level the challenge was built for
}
```

**Validation** (`validateChallenge(c, settings, playerPosition)`): every value in `operands`, `options`, `steps` and `answer` is inside `[range.min, range.max]`; addition and subtraction respect operand, result, crossing and step rules; comparison has exactly one correct option and distinct options; `answer` is at least `minEnemyGap` from the player tank position; every comparison option is at least `minTankGap` from every other option and from the player tank.

**Gaps**: `minTankGap = max(0.08 * (max - min), tankWidthInNumbers)`, where `tankWidthInNumbers` is the tank's 60-unit width converted to numbers; `minEnemyGap = 0.15 * (max - min)`. When the range cannot fit 2 options at `minTankGap` on the side away from the player, comparison is skipped for that configuration.

**Hit rule** (amendment 04, FR-066, FR-071, FR-074; `src/core/battle/hitRule.ts`): `bodyHalfWidth(min, max) = (TANK_WIDTH / 2) / (layout.right - layout.left) * (max - min)` in numbers (about 2.1 in 0 to 100, 4.8 in 550 to 780, 20.8 in 0 to 1000). `shotKind(fired, target, range)` is `'bullseye'` when `fired === target`, `'body'` when `|numberToX(fired) - numberToX(target)| <= TANK_WIDTH / 2`, otherwise `'miss'`. Damage to the enemy: `'bullseye'` 2 × `MAX_DAMAGE` (80); `'body'` `MAX_DAMAGE` (40), or 0 when `exactHit` is on; `'miss'` 0.

**readPosition placement**: on ruler levels 1 to 3 the answer is a multiple of the minor step (a number with a visible line); on levels 4 and 5 any whole number. The placement rule is unchanged by amendment 04, but `hitTolerance` is removed: whether a shot hits follows the tank-body rule below, the same for every challenge kind.

**Main skill per kind**: `findNumber`, `missingBetween`, `midpoint`, `readPosition` → `positions`; `after`, `stepsRight` → `countForward`; `before`, `stepsLeft` → `countBackward`; `addition` → `addition`; `subtraction` → `subtraction`; all comparison kinds → `comparison`. `tens` and `crossTens` are secondary skills added when a challenge involves a multiple of ten or crosses a ten boundary.

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
| `independent` | `boolean` | Exact number on the first shot without help (`solved`, `exact`, `helpLevel` 0, `wrongAnswers` 0). A body hit that is not exact is never independent (FR-075) |
| `exact` | `boolean` | The shot that ended the search was at the enemy's exact number (Volltreffer). Optional when loading; missing means `true`, because attempts recorded before amendment 04 needed the exact number |
| `helpLevel` | `0 \| 1 \| 2 \| 3` | Highest help step reached; 3 means the solution was shown |
| `wrongAnswers` | `number` | Misses: fired numbers off the tank body, decoys hit, wrong `order3` sequences, and with `exactHit` on body hits that are not exact |
| `responseMs` | `number` | From challenge answerable to final answer |
| `guess` | `boolean` | FR-038 |
| `sessionId` | `string` | |
| `at` | `number` | Epoch milliseconds |

## SkillProgress (persisted inside Progress)

Keyed by `${skill}|${rangeKey}`.

| Field | Type | Notes |
|-------|------|-------|
| `step` | `number` | Current difficulty step for this skill (index into the skill's step ladder) |
| `recent` | `RecentOutcome[]` (max 6) | Non-guess outcomes since the last step change, `'independent' \| 'close' \| 'assisted' \| 'unsolved'`, newest last. Used only by the adaptive rule; cleared on a step change |
| `masteryWindow` | `RecentOutcome[]` (max 10) | Last 10 non-guess outcomes in this skill and range; never cleared by step changes |
| `guesses` | `number` | Count of attempts flagged as guesses |
| `attempts` | `number` | |
| `independentCorrect` | `number` | |
| `assisted` | `number` | |

**RecentOutcome**: `'independent'` (exact number, no help, no misses), `'close'` (body hit that is not exact, no help, no misses; amendment 04), `'assisted'` (hit after help or misses), `'unsolved'` (the solution was shown). `'close'` counts neither toward raising (5 of 6 `'independent'`) nor toward lowering (3 of 5 `'assisted'` or `'unsolved'`), and not toward mastery.

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
  rulerLevel?: 1 | 2 | 3 | 4 | 5;  // positions ladder only; clamped to [rulerLevelStart, rulerLevelMax]
}
```

**Adaptive rule** (`nextStep(sp, settings)`, FR-037): if `adaptive` is off, the generator uses the parent settings directly (the top of every ladder, clamped by settings) and the parent's label level. Otherwise each skill starts at step 0: up one step when at least 5 of the last 6 entries in `recent` are `'independent'`; down one step when at least 3 of the last 5 are `'assisted'` or `'unsolved'`. Guesses never enter `recent` or `masteryWindow`. After a change, `recent` is cleared so the next change needs new evidence; `masteryWindow` is kept. Parent settings are ceilings: a step never allows numbers, operands or crossings that the settings forbid.

**Ruler level** (FR-018): when adaptive is off, `rulerLevelStart`. When adaptive is on, the level comes from the `positions` skill's step (`rulerLevel` on its ladder), clamped to `[rulerLevelStart, rulerLevelMax]`. Other skills' ladders have no `rulerLevel`, so the ruler does not change between challenge kinds. Help steps draw all lines of the zoomed area whatever the level.

## Ruler (not persisted)

```ts
type RulerLevel = 1 | 2 | 3 | 4 | 5;
interface Tick { value: number; major: boolean; visible: boolean; labeled: boolean; }
```

| Level | Lines drawn | Labels |
|-------|-------------|--------|
| 1 | major and minor | every line where the label spacing is at least 28 logical units; otherwise major lines, and minor labels next to the preview marker |
| 2 | major and minor | major lines |
| 3 | major and minor | some major lines, chosen by seed, always both end points |
| 4 | major only | major lines |
| 5 | end points only | end points |

Steps follow spec FR-016 for the view's width. Both end points are always drawn and labeled.

## Round state (not persisted)

```ts
type Phase =
  | 'challenge'        // guided: challenge shown; the child chooses a number and fires; every fire is an answer
  | 'aiming'           // free play: the enemy is visible ("read the ruler"); the child chooses a number and fires
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
  enemyFound: boolean;             // false during a position search: enemy hidden; true after a hit, for readPosition and in free play
  challenge: Challenge | null;     // in free play always a readPosition challenge
  answerableAt: number | null;     // clock time when answers became possible (1 s after display)
  help: { level: 0 | 1 | 2 | 3; wrongAnswers: number; wrongAnswerTimes: number[] };
  selection: number | null;        // previewed number; fired by the fire button or Enter
  entry: { typed: string; outOfRange: boolean };   // keyboard digits typed so far ('' when none, may start with '-'); outOfRange shows the range hint (FR-063)
  orderTaps: string[];             // order3: tank ids badged so far
  rulerLevel: 1 | 2 | 3 | 4 | 5;   // for this round (FR-018)
  lastShot: LastShot | null;       // landed number shown large; distance in steps shown in free play
  lastPlayerPath: Point[] | null;  // FR-004 trail
  shot: ShotInFlight | null;       // shell in flight for the renderer to replay
  outcome: 'playerWon' | 'enemyWon' | 'turnsUsed' | null;
}

interface LastShot {
  fired: number;                   // the number the player fired at
  landed: number;                  // the number under the impact point
  hit: boolean;                    // the enemy took damage (body hit, or only the exact number with exactHit)
  bodyHit: boolean;                // the landing point was on the enemy tank's body, exact or not (amendment 04)
  bullseye: boolean;               // Volltreffer: fired === enemyNumber (FR-071)
  nearMiss: boolean;               // the enemy shook without damage: inside the blast radius, not a damaging hit
  hitTankId: string | null;        // the damaged enemy or the destroyed decoy, or null
  distance: number | null;         // steps from the landed number to the enemy's number
  enemyNumber: number;             // the enemy's number when the shell landed; feedback shows it after the enemy moved
}

interface TankState { id: string; kind: 'player' | 'enemy' | 'decoy'; position: number /* number on the line */; x: number; y: number; health: number /* 0..100 */; label?: number; alive: boolean; }
```

Removed by amendment 01: `aim`, `charged`, `shotsAtEnemy`, `challengePurpose` (only searches remain).

**Keyboard entry** (`applyKey(entry, key, range)` in `src/core/battle/entry.ts`, pure): a digit appends to `typed` (ignored past the digit count of the longest number in the range); `-` is accepted only as the first character when `range.min < 0`; Backspace removes the last character. After each change, `selection` is the typed value when it is inside the range; otherwise `selection` is the nearest end and `outOfRange` is true. A pointer selection or a nudge clears `typed`.

**State transitions**

```text
start → challenge (guided search) | aiming (freePlay, readPosition, enemy visible)
challenge | aiming --typeDigit / backspace / nudge / selectNumber--> same phase (selection and entry change)
challenge | aiming --confirm or fireAt(n), answerable, n in range--> playerShot (path from solveArcToX)
challenge | aiming --confirm with entry.outOfRange--> same phase (nothing fired, range hint)
challenge --tapTank (single choice)--> playerShot at that tank's number
challenge --tapTank (order3)--> challenge (badge placed) ; third correct badge --> playerShot at the enemy ; wrong order --> challenge (badges reset, miss)
playerShot (guided) --hit (bullseye or body)--> enemyTurn (enemyFound = true, enemy damaged, attempt recorded: 'independent' only for an exact first shot, 'close' for a body hit without help)
playerShot (guided) --miss (off the body, or a body hit with exactHit)--> challenge (help.level + 1, lastShot shown, no enemy turn, no health change)
challenge --help (button or H) or time limit--> challenge (help.level + 1)
challenge at help.level 3 --> selection = answer; confirm fires at it (the shot hits)
playerShot (freePlay) --hit or miss--> enemyTurn
enemyTurn --impact--> next player turn | roundOver
next player turn (guided): enemy hides and moves; new search, turn + 1
next player turn (freePlay): new readPosition challenge; after a hit the enemy moves to a new visible position
any (except roundOver) --pause (button or Escape)--> paused --resume--> previous phase
```

Round over when `player.health == 0` (`enemyWon`), `enemy.health == 0` (`playerWon`), or `turn == roundLength` after the enemy turn (`turnsUsed`); `turn` counts searches in guided mode and shots in free play. In `noDamage` mode the player's health never drops. The player's shell follows the hit rule above (amendment 04): a shell on the enemy's body costs it `MAX_DAMAGE`, a Volltreffer twice that, and with `exactHit` only the Volltreffer counts; a decoy is destroyed only at its exact number; a shell inside the enemy's blast radius that does not damage it sets `nearMiss` (the enemy shakes, no damage). The player's own shell never damages the player.

The player tank stands at `range.min` (left side) or `range.max` (right side) for the whole round. When a new search starts, the enemy hides (fades out) and the next challenge's answer becomes its position; it is drawn again only when `enemyFound` becomes `true` (at once for readPosition). The answer is always at least `minEnemyGap` from the player tank.

In comparison turns, each option is shown on a tank standing at the position of its own number, so the battlefield keeps the same number-to-position mapping as the number line. The real enemy is the tank whose number is the correct answer.
