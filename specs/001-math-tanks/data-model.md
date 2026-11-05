# Data Model: Math Tanks

All types live in `src/core/` and contain no DOM or Phaser references. Persisted types are validated with Zod on load (see [research.md](./research.md) R11). Changed by [amendment 01](./amendment-01-number-aiming.md) (number aiming, keyboard entry) [amendment 02](./amendment-02-ruler-ranges-and-detail.md) (any range, ruler levels, "read the ruler") [amendment 04](./amendment-04-hit-rule.md) (tank-body hit rule, Volltreffer, `exactHit` setting, outcome `'close'`) [amendment 05](./amendment-05-no-shortcuts-settings-early.md) (input method, no `nudge`) and [amendment 06](./amendment-06-one-hit-lives.md) (one exact hit destroys the enemy, 3 hearts, enemy fire rhythm, round types, score, time, personal best; `exactHit`, health, the Volltreffer and `'close'` removed).

## Settings (persisted: `mathtanks.settings.v1`)

| Field | Type | Default | Rule |
|-------|------|---------|------|
| `version` | `4` | `4` | Schema version. Version 2 (amendments 01 and 02) removes `aimCorrection` and replaces `labelLevel` with `rulerLevelStart` and `rulerLevelMax`; version 3 (amendment 04) adds `exactHit`; version 4 (amendment 06) drops `exactHit` and adds `roundType`, `showClock` and `showRecords`; `migrate` upgrades version 0 to 3 data (see below) |
| `challengeTypes` | `{ numberLine: boolean; addition: boolean; subtraction: boolean; comparison: boolean }` | all `true` | At least one `true`, or `freePlay` is `true` (FR-047) |
| `range` | `{ preset: '0-10' \| '0-20' \| '0-50' \| '0-100' \| '0-1000' \| 'custom'; min: number; max: number }` | `0-100`, 0, 100 | Integers; `min < max`; `max - min` between 5 and 1000; `min` from -1000 to 9000 (any start, for example 550 to 780); preset values fix `min` and `max` |
| `addition` | `{ maxOperand: number; maxResult: number; steps: 1 \| 2 }` | 10, `range.max`, 1 | `1 <= maxOperand`; `maxResult <= range.max`. `maxOperand` limits the added numbers only (every operand after the first); the starting number can be any number in the range (FR-022, T216) |
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
| `roundType` | `'untilHearts' \| 'enemyCount'` | `'untilHearts'` | How a round ends (FR-082): "Bis alle Herzen weg" or "Gegner pro Runde". `'untilHearts'` with `noDamage: true` is invalid (it would never end) |
| `roundLength` | `number` | `5` | Enemies per round for `roundType: 'enemyCount'`, whole number 1 to 20 (amendment 06). Ignored for `'untilHearts'` |
| `adaptive` | `boolean` | `true` | |
| `freePlay` | `boolean` | `false` | When `true`, the start screen also offers "Freies Spiel"; guided stays the default |
| `noDamage` | `boolean` | `false` | FR-044 |
| `showClock` | `boolean` | `false` | Shows an up-counting clock at the top during play (FR-084) |
| `showRecords` | `boolean` | `true` | Shows "Neuer Rekord!" or "Dein Rekord: N" on the end screen (FR-086); the best is stored either way |
| `timeLimitSeconds` | `number \| null` | `null` | 10 to 120 when set |

`validateSettings(s): { ok: true } | { ok: false; errors: SettingsError[] }` checks all rules. `SettingsError` is a key from the translation table plus the field path.

**Migration from version 1**: `aimCorrection` is dropped; `rulerLevelStart` comes from `labelLevel` (1 → 1, 2 → 2, 3 → 3, 4 → 5, because old level 4 showed only the end points); `rulerLevelMax` is 5; `version` becomes 2.

**Migration from version 2**: `exactHit` is added with `false`; `version` becomes 3. Version 0 and 1 data go through both steps.

**Migration from version 3** (amendment 06): `exactHit` is dropped; `roundType` is added with `'untilHearts'`, or `'enemyCount'` when `noDamage` is `true`; `showClock` is added with `false` and `showRecords` with `true`; `roundLength` is kept as the number of enemies, clamped to 1 to 20 (a whole number; anything else is left for validation to reject); `version` becomes 4. Version 0, 1 and 2 data go through every step.

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

**Validation** (`validateChallenge(c, settings, playerPosition)`): every value in `options`, `steps` and `answer` and the starting operand is inside `[range.min, range.max]` (the added or subtracted numbers may lie outside it, for example 560 + 5 in 550 to 780); addition and subtraction respect operand, result, crossing and step rules; comparison has exactly one correct option and distinct options; `answer` is at least `minEnemyGap` from the player tank position; every comparison option is at least `minTankGap` from every other option and from the player tank.

**Gaps**: `minTankGap = max(0.08 * (max - min), tankWidthInNumbers)`, where `tankWidthInNumbers` is the tank's 60-unit width converted to numbers; `minEnemyGap = 0.15 * (max - min)`. When the range cannot fit 2 options at `minTankGap` on the side away from the player, comparison is skipped for that configuration.

**Hit rule** (amendment 06, FR-066; `src/core/battle/hitRule.ts`): `bodyHalfWidth(min, max) = (TANK_WIDTH / 2) / (layout.right - layout.left) * (max - min)` in numbers (about 2.1 in 0 to 100, 4.8 in 550 to 780, 20.8 in 0 to 1000). `shotKind(fired, target, range)` is `'hit'` when `fired === target` (the enemy is destroyed), `'near'` when `|numberToX(fired) - numberToX(target)| <= TANK_WIDTH / 2` (a near miss on the body: the enemy shakes, nothing else), otherwise `'miss'`. `enemyHitsPlayer(impact, hitTargetId, player)` is true when the enemy shell entered the player's hit circle or landed with `|impact.x - player.x| <= TANK_WIDTH / 2`; it removes one heart unless `noDamage`. There is no damage and no `MAX_DAMAGE` (amendment 04's body damage and Volltreffer are removed).

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
| `independent` | `boolean` | Exact number on the first shot without help (`solved`, `helpLevel` 0, `wrongAnswers` 0). A near miss on the body is a miss (FR-075) |
| `exact` | `boolean` | The shot that ended the search was at the enemy's exact number. Since amendment 06 every hit is exact, so new attempts always store `true`; kept so stored attempts stay readable. Optional when loading; missing means `true` |
| `helpLevel` | `0 \| 1 \| 2 \| 3` | Highest help step reached; 3 means the solution was shown |
| `wrongAnswers` | `number` | Misses: every fired number that is not the enemy's number (near misses on the body included), decoys hit, wrong `order3` sequences |
| `responseMs` | `number` | From challenge answerable to final answer |
| `guess` | `boolean` | FR-038 |
| `sessionId` | `string` | |
| `at` | `number` | Epoch milliseconds |

## SkillProgress (persisted inside Progress)

Keyed by `${skill}|${rangeKey}`.

| Field | Type | Notes |
|-------|------|-------|
| `step` | `number` | Current difficulty step for this skill (index into the skill's step ladder) |
| `recent` | `RecentOutcome[]` (max 6) | Non-guess outcomes since the last step change, `'independent' \| 'assisted' \| 'unsolved'` (a stored `'close'` from amendment 04 is still read), newest last. Used only by the adaptive rule; cleared on a step change |
| `masteryWindow` | `RecentOutcome[]` (max 10) | Last 10 non-guess outcomes in this skill and range; never cleared by step changes |
| `guesses` | `number` | Count of attempts flagged as guesses |
| `attempts` | `number` | |
| `independentCorrect` | `number` | |
| `assisted` | `number` | |

**RecentOutcome**: `'independent'` (exact number, no help, no misses), `'assisted'` (hit after help or misses), `'unsolved'` (the solution was shown). Amendment 06 removes `'close'` from new records; the progress schema still reads a stored `'close'`, which counts neither toward raising nor toward lowering, and not toward mastery.

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

**Export file**: `{ app: 'math-tanks', exportedAt, settings, progress, records }` as JSON; import validates every part with the same schemas and migrations as loading. A file without `records` (exported before amendment 06) imports with empty records.

## Records (persisted: `mathtanks.records.v1`, amendment 06)

```ts
interface BestResult { enemies: number; ms: number; at: number }   // enemies destroyed, time played in ms, epoch ms when set
interface Records { version: 1; best: Record<string, BestResult> } // keyed by recordKey(settings)
```

`recordKey(s) = `${s.range.min}-${s.range.max}|${s.rulerLevelStart}|${s.roundType}`` (FR-086), from the round's settings snapshot. `submitResult(records, key, { enemies, ms, at })` returns `{ records, newRecord, best }`: `newRecord` is true when `enemies >= 1` and there is no best for the key or `enemies > best.enemies`; then the result replaces the best. `best` is the best after the submission (null when none). A damaged or invalid stored value loads as empty records. Records are written once per finished round, after the round is over.

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
| 1 | major and minor | every line where the label spacing is at least 28 logical units; otherwise major lines, and only a typed number labeled under the preview marker (T203) |
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
  turn: number;                    // player shots fired this round (challenge ids use it)
  lives: number;                   // child's hearts, 3 at the start (LIVES), 0 ends the round (FR-080)
  enemiesDestroyed: number;        // score (FR-083)
  shotsSinceEnemyFire: number;     // child's shots at the current enemy since it last fired; at 2 the enemy fires and it resets; a destroyed enemy resets it (FR-081)
  elapsedMs: number;               // play time up to the last pause; final once the round is over (FR-084). The controller's elapsedMs() adds the running part
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
  inputMethod: 'pointer' | 'keyboard' | null;   // latest input method (amendment 05, FR-076); carried into the next round; null before any input
  rulerLevel: 1 | 2 | 3 | 4 | 5;   // for this round (FR-018)
  lastShot: LastShot | null;       // landed number shown large; distance in steps shown in free play
  lastEnemyHit: boolean;           // the latest enemy shell removed a heart (the renderer flashes the tank)
  lastPlayerPath: Point[] | null;  // FR-004 trail
  stepAnimation: number[] | null;  // addition and subtraction after a help request: the marker's stops from the start to the result, e.g. [43, 40, 36] (stepPath, FR-024); null otherwise
  shot: ShotInFlight | null;       // shell in flight for the renderer to replay
  outcome: 'goalReached' | 'heartsGone' | null;   // goalReached: roundLength enemies destroyed with roundType 'enemyCount'
}

interface LastShot {
  fired: number;                   // the number the player fired at
  landed: number;                  // the number under the impact point
  hit: boolean;                    // fired === enemyNumber: the enemy was destroyed (FR-066)
  nearMiss: boolean;               // on the enemy's body but not exact: the enemy shakes, "Ganz knapp! Triff die Linie." (FR-066, FR-072)
  hitTankId: string | null;        // the destroyed enemy or the destroyed decoy, or null
  distance: number | null;         // steps from the landed number to the enemy's number
  enemyNumber: number;             // the enemy's number when the shell landed; feedback shows it after the enemy moved
}

interface TankState { id: string; kind: 'player' | 'enemy' | 'decoy'; position: number /* number on the line */; x: number; y: number; label?: number; alive: boolean; }   // no health (amendment 06)
```

Removed by amendment 01: `aim`, `charged`, `shotsAtEnemy`, `challengePurpose` (only searches remain).

**Keyboard entry** (`applyKey(entry, key, range)` in `src/core/battle/entry.ts`, pure): a digit appends to `typed` (ignored past the digit count of the longest number in the range); `-` is accepted only as the first character when `range.min < 0`; Backspace removes the last character. After each change, `selection` is the typed value when it is inside the range; otherwise `selection` is the nearest end and `outOfRange` is true. A pointer selection clears `typed`. *(The nudge is removed by amendment 05.)*

**Input method** (amendment 05, FR-076): `typeDigit`, `typeMinus`, `backspace` and `confirm()` from Enter set `inputMethod` to `'keyboard'`; `selectNumber` and `confirm('pointer')` from the fire button set it to `'pointer'`. Ignored calls (wrong phase) change nothing. `startRound` and `newScene` keep the value of the previous round. The next search passes `inputMethod ?? 'keyboard'` to `generateChallenge`, which then skips `findNumber` for `'keyboard'`.

**State transitions**

```text
start → challenge (guided search) | aiming (freePlay, readPosition, enemy visible)
challenge | aiming --typeDigit / typeMinus / backspace / selectNumber--> same phase (selection, entry and inputMethod change)
challenge | aiming --confirm or fireAt(n), answerable, n in range--> playerShot (path from solveArcToX)
challenge | aiming --confirm with entry.outOfRange--> same phase (nothing fired, range hint)
challenge --tapTank (single choice)--> playerShot at that tank's number
challenge --tapTank (order3)--> challenge (badge placed) ; third correct badge --> playerShot at the enemy ; wrong order --> challenge (badges reset, miss)
playerShot (guided) --hit (exact number)--> enemy destroyed (enemyFound = true, enemiesDestroyed + 1, shotsSinceEnemyFire = 0, attempt recorded) --> roundOver (goalReached) | new search with a new hidden enemy
playerShot (guided) --miss (near miss on the body or off it)--> shotsSinceEnemyFire + 1; at 2 --> enemyTurn, otherwise challenge (help.level + 1, lastShot shown)
challenge --help (button or H) or time limit--> challenge (help.level + 1)
challenge at help.level 3 --> selection = answer; confirm fires at it (the shot hits)
playerShot (freePlay) --hit--> enemy destroyed, enemiesDestroyed + 1, shotsSinceEnemyFire = 0 --> roundOver (goalReached) | aiming with a new readPosition challenge and a new visible enemy at its answer
playerShot (freePlay) --miss--> shotsSinceEnemyFire + 1; at 2 --> enemyTurn (and reset to 0), otherwise aiming
enemyTurn --impact--> lives - 1 when enemyHitsPlayer and not noDamage; lives 0 --> roundOver (heartsGone), otherwise the phase the child left (challenge or aiming)
any (except roundOver) --pause (button or Escape)--> paused --resume--> previous phase
```

Round over (amendment 06, FR-008, FR-082) when `lives == 0` (`heartsGone`), or, with `roundType: 'enemyCount'`, when `enemiesDestroyed == roundLength` right after the hit (`goalReached`, before any enemy shot). In `noDamage` mode `lives` never drops. The player's shell follows the hit rule above: only the exact number destroys the enemy; a decoy is destroyed only at its exact number and does not count in the score; a near miss on the body sets `nearMiss` (the enemy shakes). The player's own shell never damages the player.

**Time** (FR-084): `startRound` starts the clock at 0. `pause` adds the running part to `elapsedMs` and stops it; `resume` starts it again; the round end freezes it. The app pauses the battle while the parent gate is open and while the tab is hidden (`visibilitychange`), so those times are not counted. `formatTime(ms)` gives `m:ss` (for example `6:12`; `61:05` past an hour).

The player tank stands at `range.min` (left side) or `range.max` (right side) for the whole round. When a new search starts, the enemy hides (fades out) and the next challenge's answer becomes its position; it is drawn again only when `enemyFound` becomes `true` (at once for readPosition). The answer is always at least `minEnemyGap` from the player tank.

In comparison turns, each option is shown on a tank standing at the position of its own number, so the battlefield keeps the same number-to-position mapping as the number line. The real enemy is the tank whose number is the correct answer.
