# Data Model: Math Tanks

All types live in `src/core/` and contain no DOM or Phaser references. Persisted types are validated with Zod on load (see [research.md](./research.md) R11). Changed by [amendment 01](./amendment-01-number-aiming.md) (number aiming, keyboard entry) [amendment 02](./amendment-02-ruler-ranges-and-detail.md) (any range, ruler levels, "read the ruler") [amendment 04](./amendment-04-hit-rule.md) (tank-body hit rule, Volltreffer, `exactHit` setting, outcome `'close'`) [amendment 05](./amendment-05-no-shortcuts-settings-early.md) (input method, no `nudge`) and [amendment 06](./amendment-06-one-hit-lives.md) (one exact hit destroys the enemy, 3 hearts, enemy fire rhythm, round types, score, time, personal best; `exactHit`, health, the Volltreffer and `'close'` removed) and [amendment 07](./amendment-07-visible-enemy-return-fire.md) (the enemy is always visible and fires back after every shot that does not destroy it; `shotsSinceEnemyFire` and `enemyFound` removed) and [amendment 09](./amendment-09-comparison-one-enemy.md) (comparison with one enemy and the options in the banner; decoys, number plates, `orderTaps`, `notOnTank`, `orderAnswer` and the kinds `'equal'` and `'order3'` removed; `'middle3'` added) and [amendment 10](./amendment-10-decoys-without-plates.md) (decoy tanks without number plates at the other options; `decoys`, the `'decoy'` tank kind, `tapTank` and the shell from the top edge in comparison turns are back; options keep the tank gap) and [amendment 11](./amendment-11-tank-garage.md) (stars, garage items and the chosen look in `mathtanks.garage.v1`; settings version 5 adds `garage`) and [amendment 12](./amendment-12-tablet-phone.md) (settings version 6 adds `numberPad`; the screen layout rule in `src/core/view/screen.ts`).

## Settings (persisted: `mathtanks.settings.v1`)

| Field | Type | Default | Rule |
|-------|------|---------|------|
| `version` | `10` | `10` | Schema version. Version 2 (amendments 01 and 02) removes `aimCorrection` and replaces `labelLevel` with `rulerLevelStart` and `rulerLevelMax`; version 3 (amendment 04) adds `exactHit`; version 4 (amendment 06) drops `exactHit` and adds `roundType`, `showClock` and `showRecords`; version 5 (amendment 11) adds `garage`; version 6 (amendment 12) adds `numberPad`; version 7 (PO1) turns `sound.speech` off once; version 8 (amendment 17) replaces `freePlay` with `playModes`; version 9 (amendment 18) adds `pointAfterFullHelp`; version 10 (amendment 19) adds `aimCross`; `migrate` upgrades version 0 to 9 data (see below) |
| `challengeTypes` | `{ numberLine: boolean; addition: boolean; subtraction: boolean; comparison: boolean }` | all `true` | At least one `true` when `playModes.mixed` or `playModes.math` is `true` (FR-047, amendment 17) |
| `range` | `{ preset: '0-10' \| '0-20' \| '0-50' \| '0-100' \| '0-1000' \| 'custom'; min: number; max: number }` | `0-100`, 0, 100 | Integers; `min < max`; `max - min` between 5 and 1000; `min` from -1000 to 9000 (any start, for example 550 to 780); preset values fix `min` and `max` |
| `addition` | `{ maxOperand: number; maxResult: number; steps: 1 \| 2 }` | 10, `range.max`, 1 | `1 <= maxOperand <= range.max - range.min` (review R5; stored settings with a larger value load with it clamped); `maxResult <= range.max`. `maxOperand` limits the added numbers only (every operand after the first); the starting number can be any number in the range (FR-022, T216) |
| `subtraction` | `{ maxOperand: number; steps: 1 \| 2 }` | 10, 1 | `1 <= maxOperand <= range.max - range.min` |
| `crossTens` | `boolean` | `true` | |
| `crossHundreds` | `boolean` | `false` | |
| `negativeResults` | `boolean` | `false` | Shown only when `range.min < 0` (custom ranges may start below 0, down to -1000). When `false`, results are never below 0; when `true`, results may go down to `range.min` |
| `rulerLevelStart` | `1 \| 2 \| 3 \| 4 \| 5` | `1` | Ruler detail level used when adaptive is off, and the easiest level adaptive may use (FR-018) |
| `rulerLevelMax` | `1 \| 2 \| 3 \| 4 \| 5` | `5` | Hardest level adaptive may reach; `rulerLevelStart <= rulerLevelMax`; equal values lock the level |
| `enemyDifficulty` | `'easy' \| 'normal' \| 'challenging'` | `'easy'` | |
| `help` | `{ nearestTen: boolean; countSteps: boolean; zoom: boolean; stepAnimation: boolean }` | all `true` | Showing the solution is always on (FR-032) |
| `beginnerAssist` | `boolean` | `true` | Splits addition and subtraction animations at ten boundaries (FR-024) |
| `sound` | `{ effects: boolean; music: boolean; speech: boolean }` | `true`, `false`, `false` | `speech` ("Vorlesen") is off by default since version 7 (PO1) |
| `roundType` | `'untilHearts' \| 'enemyCount'` | `'untilHearts'` | How a round ends (FR-082): "Bis alle Herzen weg" or "Gegner pro Runde". `'untilHearts'` with `noDamage: true` is invalid (it would never end) |
| `roundLength` | `number` | `5` | Enemies per round for `roundType: 'enemyCount'`, whole number 1 to 20 (amendment 06). Ignored for `'untilHearts'` |
| `adaptive` | `boolean` | `true` | |
| `playModes` | `{ mixed: boolean; ruler: boolean; math: boolean }` | all `true` | The play modes the start screen offers (amendment 17, FR-121): "Gemischt", "Nur Zahlenstrahl", "Nur Rechnen". At least one `true` (error key `noPlayMode`). Replaces `freePlay` (version 7 and older) |
| `noDamage` | `boolean` | `false` | FR-044 |
| `showClock` | `boolean` | `false` | Shows an up-counting clock at the top during play (FR-084) |
| `showRecords` | `boolean` | `true` | Shows "Neuer Rekord!" or "Dein Rekord: N" on the end screen (FR-086); the best is stored either way |
| `timeLimitSeconds` | `number \| null` | `null` | 10 to 120 when set |
| `pointAfterFullHelp` | `boolean` | `true` | "Punkt nach voller Hilfe" (amendment 18, FR-129), in the "Hilfe" group next to "Zeitlimit". When `false`, an enemy destroyed after help step 3 does not raise `enemiesDestroyed`, so it gives no star and does not count toward "Gegner pro Runde" or the personal best; the attempt is recorded as with help either way |
| `garage` | `boolean` | `true` | "Garage und Sterne" (amendment 11, FR-096): shows the garage button, the G key, the star total and the unlock line, and gives the child's tank the chosen look. When `false`, all of these are hidden and the tank has the standard look; stars are counted either way |
| `aimCross` | `{ mode: 'always' \| 'upToLevel' \| 'never'; level: 1 \| 2 \| 3 \| 4 \| 5 }` | `{ mode: 'always', level: 2 }` | "Zielkreuz" (amendment 19, FR-134): the yellow target marker, its guide line, the point on the ruler and the typed-number label on the ruler. `'always'` shows it ("Immer"); `'upToLevel'` shows it while the round's `rulerLevel` is at most `level` ("Bis Zahlenstrahl-Stufe N"); `'never'` hides it ("Nie"). `level` is kept when the mode is not `'upToLevel'`, so switching back restores it. `aimCrossShown(aimCross, rulerLevel)` in `src/core/battle/aimCross.ts` decides |
| `numberPad` | `'auto' \| 'always' \| 'never'` | `'auto'` | "Zahlenfeld" (amendment 12, FR-102): `'auto'` shows the on-screen number pad in battle when the main pointer is not fine or the screen is narrower than 1100 CSS pixels; `'always'` shows it on every screen; `'never'` hides it |

`validateSettings(s): { ok: true } | { ok: false; errors: SettingsError[] }` checks all rules. `SettingsError` is a key from the translation table plus the field path.

**Migration from version 1**: `aimCorrection` is dropped; `rulerLevelStart` comes from `labelLevel` (1 → 1, 2 → 2, 3 → 3, 4 → 5, because old level 4 showed only the end points); `rulerLevelMax` is 5; `version` becomes 2.

**Migration from version 2**: `exactHit` is added with `false`; `version` becomes 3. Version 0 and 1 data go through both steps.

**Migration from version 3** (amendment 06): `exactHit` is dropped; `roundType` is added with `'untilHearts'`, or `'enemyCount'` when `noDamage` is `true`; `showClock` is added with `false` and `showRecords` with `true`; `roundLength` is kept as the number of enemies, clamped to 1 to 20 (a whole number; anything else is left for validation to reject); `version` becomes 4. Version 0, 1 and 2 data go through every step.

**Migration from version 4** (amendment 11): `garage` is added with `true` unless already set; `version` becomes 5. Version 0 to 3 data go through every step.

**Migration from version 5** (amendment 12): `numberPad` is added with `'auto'` unless already set; `version` becomes 6. Version 0 to 4 data go through every step.

**Migration from version 7** (amendment 17): `freePlay` is dropped and `playModes` is added: when `freePlay` was `true` and every challenge type was off (the parent offered only free play), `{ mixed: false, ruler: true, math: false }`; otherwise all three `true`. `version` becomes 8. Version 0 to 6 data and version 2 transfer codes (whose frozen base is version 6) go through every step.

**Migration from version 8** (amendment 18): `pointAfterFullHelp` is added with `true` unless already set; `version` becomes 9. Version 0 to 7 data and version 2 transfer codes go through every step.

**Migration from version 9** (amendment 19): `aimCross` is added with `{ mode: 'always', level: 2 }` unless already set; `version` becomes 10. Version 0 to 8 data and version 2 transfer codes go through every step.

**Migration from version 6** (PO1, product owner: "I do not want a sound of reading the question out loud"): `sound.speech` is set to `false`; `version` becomes 7. A parent who turns "Vorlesen" on again keeps it on, because version 7 data is not migrated. Version 0 to 5 data go through every step. After every step, a whole-number `addition.maxOperand` above the range width is clamped to it (review R5).

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
  | 'greater' | 'smaller' | 'largest3' | 'smallest3' | 'closestTo' | 'between' | 'middle3';      // comparison (amendment 09: 'equal' and 'order3' removed, 'middle3' added)

// Attempts stored before amendment 09 may carry 'equal' or 'order3'; they still load and count toward the comparison skill.
type StoredChallengeKind = ChallengeKind | 'equal' | 'order3';

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
  options?: number[];         // the 2 or 3 numbers named in the question, in banner order; options include answer (amendment 09)
  steps?: number[];           // intermediate positions for the step animation, e.g. [43, 40, 36]
  // readPosition only:
  rulerLevel?: 1 | 2 | 3 | 4 | 5;   // level the challenge was built for
}
```

**Validation** (`validateChallenge(c, settings, playerPosition)`): every value in `options`, `steps` and `answer` and the starting operand is inside `[range.min, range.max]` (the added or subtracted numbers may lie outside it, for example 560 + 5 in 550 to 780); addition and subtraction respect operand, result, crossing and step rules; comparison has 2 options (`greater`, `smaller`, `closestTo`) or 3 (`largest3`, `smallest3`, `between`, `middle3`), distinct, every two at least `minOptionGap` apart, exactly one correct option, and that option is `answer` (amendment 09); `answer` is at least `minEnemyGap` from the player tank position. Every option is at least `minTankGap` from the player tank position, because a decoy tank stands at each option other than the answer (amendment 10).

**Gaps**: `minTankGap = max(0.08 * (max - min), tankWidthInNumbers)`, where `tankWidthInNumbers` is the tank's 60-unit width converted to numbers; `minEnemyGap = 0.15 * (max - min)`; `minOptionGap = max(minTankGap, 2, ceil(0.02 * (max - min)))` (amendment 10, which adds `minTankGap` to amendment 09's value: 8 in 0 to 100, 18.4 in 550 to 780, 80 in 0 to 1000). `comparisonFits(kind, settings, playerPosition)` is false when the whole numbers of the range at least `minTankGap` from the player cannot hold the kind's options at `minOptionGap`; that kind is then skipped for the configuration.

**Comparison ladder** (amendment 09 item 7): the comparison step's `maxNumberFraction` limits the answer as for every skill and also the option spread: every other option is at most `max(maxNumberFraction * (max - min), (optionCount - 1) * minOptionGap)` from the answer (amendment 10: `optionCount - 1`, so the larger gap still fits in 20% of the range), so easy steps ask about nearby numbers in the low part of the range.

**Hit rule** (amendment 06, FR-066; `src/core/battle/hitRule.ts`): `bodyHalfWidth(min, max) = (TANK_WIDTH / 2) / (layout.right - layout.left) * (max - min)` in numbers (about 2.1 in 0 to 100, 4.8 in 550 to 780, 20.8 in 0 to 1000). `shotKind(fired, target, range)` is `'hit'` when `fired === target` (the enemy is destroyed), `'near'` when `|numberToX(fired) - numberToX(target)| <= TANK_WIDTH / 2` (a near miss on the body: the enemy shakes, nothing else), otherwise `'miss'`. In comparison turns (amendment 10) the same rule is applied to every standing tank: a decoy at the exact fired number is destroyed (a miss), and a near miss shakes the tank whose body it landed on. `enemyHitsPlayer(impact, hitTargetId, player)` is true when the enemy shell entered the player's hit circle or landed with `|impact.x - player.x| <= TANK_WIDTH / 2`; it removes one heart unless `noDamage`. There is no damage and no `MAX_DAMAGE` (amendment 04's body damage and Volltreffer are removed).

**readPosition placement**: on ruler levels 1 to 3 the answer is a multiple of the minor step (a number with a visible line); on levels 4 and 5 any whole number. The placement rule is unchanged by amendment 04, but `hitTolerance` is removed: whether a shot hits follows the tank-body rule below, the same for every challenge kind.

**Main skill per kind**: `findNumber`, `missingBetween`, `midpoint`, `readPosition` → `positions`; `after`, `stepsRight` → `countForward`; `before`, `stepsLeft` → `countBackward`; `addition` → `addition`; `subtraction` → `subtraction`; all comparison kinds → `comparison`. `tens` and `crossTens` are secondary skills added when a challenge involves a multiple of ten or crosses a ten boundary.

## Attempt (persisted inside Progress)

| Field | Type | Notes |
|-------|------|-------|
| `challengeId` | `string` | |
| `seed` | `number` | Reproduce the challenge |
| `kind` | `StoredChallengeKind` | `'equal'` and `'order3'` only in attempts stored before amendment 09 |
| `skills` | `Skill[]` | |
| `rangeKey` | `string` | e.g. `0-100` or `15-45` |
| `difficultyStep` | `number` | |
| `solved` | `boolean` | `true` if a correct answer was given before the solution was shown |
| `independent` | `boolean` | Exact number on the first shot without help (`solved`, `helpLevel` 0, `wrongAnswers` 0). A near miss on the body is a miss (FR-075) |
| `exact` | `boolean` | The shot that ended the search was at the enemy's exact number. Since amendment 06 every hit is exact, so new attempts always store `true`; kept so stored attempts stay readable. Optional when loading; missing means `true` |
| `helpLevel` | `0 \| 1 \| 2 \| 3` | Highest help step reached; 3 means the solution was shown |
| `wrongAnswers` | `number` | Misses: every fired number that is not the enemy's number (near misses on the body included) |
| `responseMs` | `number` | From challenge answerable to final answer |
| `guess` | `boolean` | FR-038 |
| `sessionId` | `string` | |
| `at` | `number` | Epoch milliseconds |

## SkillProgress (persisted inside Progress)

Keyed by `${skill}|${rangeKey}`.

| Field | Type | Notes |
|-------|------|-------|
| `step` | `number` | Current difficulty step for this skill (index into the skill's step ladder) |
| `recent` | `RecentOutcome[]` (max 6) | Non-guess outcomes since the last step change, `'independent' \| 'assisted' \| 'unsolved'` (a stored `'close'` from amendment 04 is still read), newest last. Used only by the adaptive rule; cleared on a step change. Amendment 17: the row of correct answers is the number of `'independent'` entries at the end of `recent` (a stored `'close'` is skipped and does not break it), so no new field is stored |
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

**Export file**: `{ app: 'math-tanks', exportedAt, settings, progress, records, garage }` as JSON; import validates every part with the same schemas and migrations as loading. A file without `records` (exported before amendment 06) imports with empty records. A file without `garage` (exported before amendment 11) keeps the garage of this browser, because stars are never lost (FR-096). A garage of version 0 or 1 (exported before amendment 19) is migrated like stored data (FR-133).

## Records (persisted: `mathtanks.records.v1`, amendment 06)

```ts
interface BestResult { enemies: number; ms: number; at: number }   // enemies destroyed, time played in ms, epoch ms when set
interface Records { version: 1; best: Record<string, BestResult> } // keyed by recordKey(settings, mode)
```

`recordKey(s, mode) = `${s.range.min}-${s.range.max}|${s.rulerLevelStart}|${s.roundType}`` for `mode` `'mixed'`, and the same key with `|ruler` or `|math` appended for the other two play modes (FR-086, amendment 17), from the round's settings snapshot. Keys stored before amendment 17 have no mode part and so belong to "Gemischt"; no migration is needed. `submitResult(records, key, { enemies, ms, at })` returns `{ records, newRecord, best }`: `newRecord` is true when `enemies >= 1` and there is no best for the key or `enemies > best.enemies`; then the result replaces the best. `best` is the best after the submission (null when none). A damaged or invalid stored value loads as empty records. Records are written once per finished round, after the round is over.

## Garage (persisted: `mathtanks.garage.v1`, amendment 11, star shop since amendment 19)

```ts
type GarageKind = 'color' | 'flag' | 'trail' | 'hat';
type ColorId = 'blue' | 'sky' | 'teal' | 'turquoise' | 'navyStripes';
type FlagId = 'star' | 'rocket' | 'dragon' | 'football' | 'lightning';
type TrailId = 'plain' | 'sparkles' | 'rainbow' | 'bubbles';
type HatId = 'none' | 'crown' | 'helmet';
type ItemId = ColorId | FlagId | TrailId | HatId;
interface Look { color: ColorId; flag: FlagId; trail: TrailId; hat: HatId }
interface GarageItem { id: ItemId; kind: GarageKind; price: 0 | 10 | 20 | 40 }   // 0 for the basic items
interface Garage {
  version: 2;
  balance: number;       // stars the child can spend; whole number >= 0
  totalEarned: number;   // every star ever earned; whole number >= 0; never goes down (FR-132)
  owned: ItemId[];       // bought items, never a basic item, no duplicates, in garage order
  look: Look;            // the equipped look; every part is owned or basic
}
```

The storage key keeps its name `mathtanks.garage.v1`; the value carries `version: 2` (amendment 19), as the settings keep their key across versions (D13).

**Price list** (amendment 19, FR-130). The garage numbers the items 1 to 17 in this order: by kind (colors, flags, trails, hats), and by price within each kind; items of equal price keep their amendment 11 order.

| No. | Item | `id` | Kind | Price | Class |
|-----|------|------|------|-------|-------|
| 1 | Blau (blue) | `blue` | color | 0 | basic |
| 2 | Himmelblau (sky blue) | `sky` | color | 10 | simple |
| 3 | Blaugrün (blue-green) | `teal` | color | 20 | better |
| 4 | Türkis (turquoise) | `turquoise` | color | 20 | better |
| 5 | Dunkelblau mit Streifen (dark blue with stripes) | `navyStripes` | color | 40 | special |
| 6 | Stern-Flagge (star flag) | `star` | flag | 0 | basic |
| 7 | Raketen-Flagge (rocket flag) | `rocket` | flag | 10 | simple |
| 8 | Fußball-Flagge (football flag) | `football` | flag | 10 | simple |
| 9 | Drachen-Flagge (dragon flag) | `dragon` | flag | 20 | better |
| 10 | Blitz-Flagge (lightning flag) | `lightning` | flag | 20 | better |
| 11 | Einfache Spur (plain trail) | `plain` | trail | 0 | basic |
| 12 | Funkel-Spur (sparkle trail) | `sparkles` | trail | 10 | simple |
| 13 | Blasen-Spur (bubble trail) | `bubbles` | trail | 20 | better |
| 14 | Regenbogen-Spur (rainbow trail) | `rainbow` | trail | 40 | special |
| 15 | Ohne Hut (no hat) | `none` | hat | 0 | basic |
| 16 | Helm (helmet) | `helmet` | hat | 10 | simple |
| 17 | Krone (crown) | `crown` | hat | 40 | special |

The German names are the ones in `src/i18n/de.ts`. All 13 items that cost something together cost 270 stars.

Functions (`src/core/rewards/garage.ts`, pure):

- `emptyGarage()` is `{ version: 2, balance: 0, totalEarned: 0, owned: [], look: STANDARD_LOOK }`.
- `newlyDestroyed(seen, current)` is `current - seen` when `current > seen`, else 0; the app calls it with each new `RoundState.enemiesDestroyed`, which counts enemies only, never decoys (FR-083), and with `pointAfterFullHelp` off not an enemy destroyed after help step 3 (amendment 18), and resets `seen` when a new round starts at 0.
- `addStars(garage, n)` adds `n` (a whole number above 0) to `balance` and to `totalEarned`; any other `n` returns the garage unchanged.
- `isOwned(garage, id)` is true for a basic item and for an id in `owned`.
- `starsNeeded(balance, id)` is `max(0, price - balance)`, shown as "noch N Sterne" for an item not owned.
- `canBuy(garage, id)` is true when the item is known, not owned and `price <= balance`. `buy(garage, id)` then takes the price from `balance`, adds the id to `owned` (in garage order) and equips it; otherwise it returns the garage unchanged.
- `returnItem(garage, id)` for an owned item that is not basic adds its price to `balance`, removes it from `owned`, and when it is equipped equips the basic item of its kind; otherwise it returns the garage unchanged. `totalEarned` does not change.
- `equip(garage, id)` equips an owned item for its kind; an item not owned or unknown leaves the garage unchanged.
- `newlyAffordable(before, after, owned)` is the item for the end screen line "Genug Sterne für: X" (FR-094): among the items not owned with `before < price <= after`, the most expensive one, and of equal prices the first in garage order; `null` when there is none. The app calls it with the balance at the start of the round and the balance at the end.
- `resetStars(garage)` ("Sterne zurücksetzen", FR-096) returns `{ version: 2, balance: 0, totalEarned: garage.totalEarned, owned: [], look: STANDARD_LOOK }`.
- `lookKey(look)` is `color:<id> flag:<id> trail:<id> hat:<id>`, the canvas attribute `data-player-look` in battle.
- `looks.ts` gives each item's drawing as plain shapes in tank coordinates (polygons, circles and lines with colors), drawn by Phaser in battle and by SVG in the garage preview, and `tankColor(id)` the body color. Every tank color has a hue between 175 and 235 degrees (blue to blue-green), far from the red enemy (hue near 0).

**Loading** (`loadGarage`, `parseGarage`): a missing key gives `emptyGarage()`. Older versions are migrated step by step (FR-097, FR-133):

- Version 0 (no `version` field, amendment 11 before T254) becomes version 1: a whole-number `stars` of at least 0 (anything else gives 0) and a full `look` (missing parts from `STANDARD_LOOK`).
- Version 1 (`{ version: 1, stars, look }`, amendment 11) becomes version 2 when `stars` is a whole number of at least 0 (anything else is left for the schema to reject): `owned` is every item that the old rule had unlocked, that is item `i` (0-based) of the old unlock order rocket, sky, sparkles, crown, dragon, teal, rainbow, helmet, football, turquoise, bubbles, lightning, navyStripes when `stars >= 10 * (i + 1)`; `balance = max(0, stars - sum of their prices)`; `totalEarned = stars`; `look` is kept. Example: 45 stars own rocket, sky, sparkles and crown (70 stars), so the balance is 0 and the total ever earned 45.
- After the schema check, unknown ids, basic ids and duplicates are removed from `owned`, which is put in garage order, and every part of `look` that is unknown or not owned becomes the basic item of its kind.

Damaged JSON or a failed schema check loads `emptyGarage()` and reports `'invalid'` like settings; a `version` above 2 reports `'newer'` and is not saved over (FR-048). "Fortschritt zurücksetzen" never touches this key; "Sterne zurücksetzen" writes `resetStars(garage)`.

## Transfer code (not persisted, amendment 15)

The link of "Spielstand übertragen" (FR-115 to FR-120). Transfer version 1 (the game writes version 2 since T305, see below; the content is the same):

```ts
type Outcome = 'i' | 'c' | 'a' | 'u'   // independent, close, assisted, unsolved (RecentOutcome)
interface TransferV1 {
  v: 1;
  settings: Settings;                         // as stored; any settings version, migrated when received
  garage: { stars: number; look: Look }       // written before amendment 19: migrated like a stored version 1 garage (FR-133)
        | Garage;                             // written since amendment 19: the stored garage, version 2
  records: Record<string, BestResult>;        // Records.best, keyed by recordKey
  skills: Record<string, [step: number, attempts: number, independentCorrect: number, assisted: number, guesses: number, window: string]>;
                                              // keyed like Progress.skills; window = masteryWindow as Outcome letters, at most 10
  sessions: Array<[id: string, startedAt: number, lastActiveAt: number, attempts: number, independentCorrect: number, assisted: number]>;
                                              // oldest first, like Progress.sessions
}
```

- **Not included**: `Progress.attempts` (the detailed history, up to 2000 entries) and `SkillProgress.recent`; only the file export (FR-048a) carries them.
- **Encoding**: `JSON.stringify(transfer)`, UTF-8, compressed with `CompressionStream('deflate-raw')`, then base64url without padding. A browser without `CompressionStream` sends the UTF-8 bytes uncompressed. The code is `v1.<data>`; the link is the current page address without its fragment, plus `#save=v1.<data>`.
- **Decoding**: the part after `v` up to the first `.` is the transfer version; only `1` is known, anything else is refused. The data is read as JSON directly when its bytes are a JSON object, else it is decompressed with `DecompressionStream('deflate-raw')` first.
- **Size**: the whole link is at most `TRANSFER_MAX_LINK_BYTES` = 2300 bytes, below the 2331 bytes of a version 40 QR code with error correction M. Too long: the oldest session totals are dropped one by one; when no session is left, every mastery window is cut to its newest 9, 8, ... 0 entries; the result reports `sessionsDropped` and `windowLength` (10 when untouched). When the link is still too long with empty windows, `fits` is false and the settings page shows no QR code.
- **Receiving**: the transfer is turned back into storage values and checked like loading (FR-048, FR-120): `settings` through `migrate` and `settingsSchema` and `validateSettings`; the garage through `parseGarage` (a garage without `version` is read as version 1 and migrated to version 2, FR-133); the records through `recordsSchema`; the progress `{ version: 1, attempts: [], skills, sessions }` through `progressSchema`, each skill with `recent: []`. Any failure refuses the whole code. A transfer version 1 made by an older game carries older settings, which `migrate` upgrades like stored ones.
- **Summary** for the dialog: `stars` the garage's `balance` (amendment 19), `record` the most `enemies` among the records (0 when there is none), `min` and `max` from `settings.range`.
- **Transfer version 2** (T305, written since Phase 24; version 1 codes are still read): the same content as a JSON array, so a typical save gives a link of about 400 bytes instead of about 930 (a QR code a phone camera reads from another screen; target at most 800 bytes):

```ts
type TransferV2 = [
  settings: Partial<Settings> & { version: number },   // only the values that differ from TRANSFER_V2_SETTINGS_BASE (the frozen version 6 defaults), object by object; version always
  garage: [stars: number, color: string, flag: string, trail: string, hat: string]           // garage payload 1, written before amendment 19
        | [2, balance: number, totalEarned: number, owned: string[], color: string, flag: string, trail: string, hat: string],
                                              // garage payload 2 (amendment 19); the first element tells the two apart: a 5-element array is payload 1
  records: Array<[key: string, enemies: number, ms: number, at: number]>,
  skills: Array<[key: string, step: number, attempts: number, independentCorrect: number, assisted: number, guesses: number, window: string]>,
                                              // skills with no progress at all are left out; a missing skill reads as empty
  sessions: Array<[startDelta: number, activeMs: number, attempts: number, independentCorrect: number, assisted: number, id: number | string]>,
                                              // startDelta from the previous session's startedAt (the first from 0); activeMs = lastActiveAt - startedAt;
                                              // id is the counter n when the id is "<startedAt>-<n>", else the id itself
];
```

  The code is `v2.<data>`. Writing and decoding both use `TRANSFER_V2_SETTINGS_BASE`, a frozen copy of the version 6 defaults in `src/core/transfer/transfer.ts`, never the live `defaultSettings()`, so changing a default later never changes what an existing code means (review T1). Amendment 19 adds `aimCross: { mode: 'always', level: 2 }` to that base in the same way: a code written before it reads as "Immer", and a code with the default leaves the field out. The garage part carries its own payload number: a 5-element array (payload 1, the star total) is read as a version 1 garage and migrated (FR-133); `[2, ...]` (payload 2) is read as a version 2 garage. The game writes payload 2. Amendment 18 adds `pointAfterFullHelp: true` to that base: a code written before it holds no such field and reads as `true`, which is also what the version 8 to 9 step gives, so its meaning does not change; a code with the setting on leaves the field out, and one with it off carries `false`. Decoding lays the differences over that base, then migrates from the settings version in the code and checks everything exactly like version 1. `src/core/transfer/transfer.test.ts` keeps two codes written on 2026-11-05 and checks that they still decode to the same save.
- **Size limits when reading** (review R3): a code longer than `TRANSFER_MAX_CODE_LENGTH` = 8192 characters is refused without reading it, and unpacking stops and refuses the code as soon as the JSON passes `TRANSFER_MAX_JSON_BYTES` = 65536 bytes.

## Screen layout (not persisted, amendment 12)

`src/core/view/screen.ts`, pure, no DOM:

- `ScreenLayout = 'wide' | 'portrait' | 'side' | 'rotate'` (FR-104).
- `ScreenMedia { portrait, phoneWidth, sideHeight, padWidth, finePointer }`: the results of the CSS media queries `SCREEN_QUERIES` = `(orientation: portrait)`, `(max-width: 599.98px)`, `(max-height: 500px)`, `(max-width: 1099.98px)`, `(pointer: fine)`.
- `layoutFromMedia(media): ScreenLayout`: `'rotate'` when `portrait` and `phoneWidth`; `'portrait'` when `portrait` otherwise; `'side'` when `sideHeight`; else `'wide'`.
- `mediaFromSize(width, height, finePointer)`: the same results from a size (`portrait` is `height >= width`, as in CSS); `screenLayout(width, height)` is `layoutFromMedia(mediaFromSize(...))`. A square screen counts as upright (changed by the Phase 24 bug "iPhone rotation in Chrome"; before, it counted as sideways).
- `numberPadShown(setting, { finePointer, padWidth }): boolean` (FR-102): `'always'` gives `true`, `'never'` gives `false`, `'auto'` gives `true` when `finePointer` is `false` or `padWidth` is `true`.
- Constants `PAD_WIDTH_LIMIT = 1100`, `PHONE_WIDTH_LIMIT = 600`, `SIDE_HEIGHT_LIMIT = 500`.

The app (`src/app/useScreen.ts`) reads `SCREEN_QUERIES` with `matchMedia` and updates on their `change` events, and as a backup on `resize`, `orientationchange`, `visualViewport` resize, `pageshow` and `visibilitychange` and after short waits. Only without `matchMedia` does it read `window.innerWidth` and `window.innerHeight` (and counts the pointer as fine). `src/app/styles.css` hides the rotate picture with the same media queries.

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

**Adaptive rule** (`nextStep(sp, settings)`, FR-037): if `adaptive` is off, the generator uses the parent settings directly (the top of every ladder, clamped by settings) and the parent's label level. Otherwise each skill starts at step 0. Amendment 17 (FR-037): up one step when the last 3 entries in `recent` are `'independent'` (3 in a row); down one step when at least 2 of the last 3 entries are `'assisted'` or `'unsolved'`. A stored `'close'` is left out of both counts. `rowToRaise(sp, skill, settings)` gives how many more independent answers in a row raise the step (3 minus the row), or `null` at the highest step the settings allow or with `adaptive` off; the progress page shows it (FR-040). Before amendment 17: up after 5 of the last 6, down after 3 of the last 5. Guesses never enter `recent` or `masteryWindow`. After a change, `recent` is cleared so the next change needs new evidence; `masteryWindow` is kept. Parent settings are ceilings: a step never allows numbers, operands or crossings that the settings forbid.

**Ruler level** (FR-018): when adaptive is off, `rulerLevelStart`. When adaptive is on, the level comes from the `positions` skill's step (`rulerLevel` on its ladder), clamped to `[rulerLevelStart, rulerLevelMax]`. Other skills' ladders have no `rulerLevel`, so the ruler does not change between challenge kinds. Help steps draw all lines of the zoomed area whatever the level.

**Help in "Nur Rechnen"** (amendment 17, FR-123): `nextHelp(challenge, level, landed, settings, mode)` with mode `'math'` gives step 1 the direction only (no `nearestMajor`), and step 2 for a challenge that is not a comparison the ten around the answer as `zoom` (with `help.zoom` on) and no `count`; addition and subtraction keep their `stepPath`. The view draws the zoom box only while that step shows; the ruler band itself is not drawn in this mode.

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
type PlayMode = 'mixed' | 'ruler' | 'math';   // amendment 17: "Gemischt", "Nur Zahlenstrahl", "Nur Rechnen"

type Phase =
  | 'challenge'        // guided: challenge shown; the child chooses a number and fires; every fire is an answer
  | 'aiming'           // no longer entered since amendment 17 (every play mode is a search in 'challenge'); kept for the placeholder state before the first round
  | 'playerShot'       // shell in flight
  | 'enemyTurn'        // enemy aiming and shot in flight
  | 'roundOver'
  | 'paused';

interface RoundState {
  seed: number;
  mode: PlayMode;                  // 'mixed' | 'ruler' | 'math' (amendment 17, FR-121 to FR-123); replaces 'guided' | 'freePlay'
  turn: number;                    // player shots fired this round (challenge ids use it)
  lives: number;                   // child's hearts, 3 at the start (LIVES), 0 ends the round (FR-080)
  enemiesDestroyed: number;        // score (FR-083): the enemies that count; with pointAfterFullHelp off, an enemy destroyed after help step 3 is not counted (amendment 18, FR-129)
  enemiesHit: number;              // every enemy destroyed this round, counted or not (amendment 18); seeds the new hills (renewTerrain) and the view's hit sound
  elapsedMs: number;               // play time up to the last pause; final once the round is over (FR-084). The controller's elapsedMs() adds the running part
  missStreak: number;              // the child's misses in a row (amendment 13, FR-098): + 1 per shot that does not destroy the enemy (near misses and burst decoys included), + 2 for a fast guess (FR-038 rule);
                                   // 0 after a shot that destroys the enemy and after an enemy hit; kept by newScene; 0 at startRound
  phase: Phase;
  terrainSeed: number;             // seed of the current ground (amendment 13, FR-101): deriveSeed(seed, 0) at round start, new after every destroyed enemy; newScene makes a new round seed and with it a new terrain seed
  terrain: Heightmap;              // Float32Array of surface heights per column
  player: TankState;
  enemy: TankState;
  decoys: TankState[];             // comparison searches: one decoy at each option other than the answer, [] otherwise (amendment 10); a destroyed decoy stays with alive false until the search ends
  playerSide: 'left' | 'right';    // fixed for the round, alternates between rounds
  challenge: Challenge | null;     // mode 'ruler': always a readPosition challenge; mode 'math': never readPosition or findNumber
  answerableAt: number | null;     // clock time when answers became possible (1 s after display)
  help: { level: 0 | 1 | 2 | 3; wrongAnswers: number; wrongAnswerTimes: number[] };
  selection: number | null;        // previewed number; fired by the fire button or Enter
  entry: { typed: string; outOfRange: boolean };   // keyboard digits typed so far ('' when none, may start with '-'); outOfRange shows the range hint (FR-063)
  inputMethod: 'pointer' | 'keyboard' | null;   // latest input method (amendment 05, FR-076); carried into the next round; null before any input
  rulerLevel: 1 | 2 | 3 | 4 | 5;   // for this round (FR-018)
  lastShot: LastShot | null;       // landed number shown large; distance in steps shown after every miss, in every mode (amendment 07)
  lastEnemyHit: boolean;           // the latest enemy shell removed a heart (the renderer flashes the tank)
  lastPlayerPath: Point[] | null;  // FR-004 trail
  stepAnimation: number[] | null;  // addition and subtraction after a help request: the marker's stops from the start to the result, e.g. [43, 40, 36] (stepPath, FR-024); null otherwise
  shot: ShotInFlight | null;       // shell in flight for the renderer to replay; ShotInFlight.decoyShells holds the harmless shells of the standing decoys in a comparison volley ({ shooterId, path, impact }[], empty otherwise; bug report B2, FR-043a)
  outcome: 'goalReached' | 'heartsGone' | null;   // goalReached: roundLength enemies destroyed with roundType 'enemyCount'
}

interface LastShot {
  fired: number;                   // the number the player fired at
  landed: number;                  // the number under the impact point
  hit: boolean;                    // fired === enemyNumber: the enemy was destroyed (FR-066)
  nearMiss: boolean;               // on the enemy's body but not exact: the enemy shakes, "Ganz knapp! Triff die Linie." (FR-066, FR-072)
  hitTankId: string | null;        // the destroyed enemy or the destroyed decoy, or null (amendment 10)
  decoyHit: boolean;               // a decoy stood at the fired number and was destroyed: a miss (amendment 10)
  nearTankId: string | null;       // with nearMiss: the tank whose body the shell landed on, which shakes (amendment 10)
  targetNumber: number;            // the number the step count refers to: the enemy's, or in comparison turns the nearest tank still standing (amendment 10, FR-072)
  distance: number | null;         // steps from the landed number to targetNumber
  enemyNumber: number;             // the enemy's number when the shell landed; feedback shows it after the enemy moved
  uncounted?: boolean;             // true for a hit after help step 3 with pointAfterFullHelp off: not counted, feedback "Getroffen, mit Hilfe." (amendment 18, FR-129)
}

interface TankState { id: string; kind: 'player' | 'enemy' | 'decoy'; position: number /* number on the line */; x: number; y: number; alive: boolean; }   // no health (amendment 06); no number plate `label` (amendment 09); decoys are back without it (amendment 10)
```

Removed by amendment 01: `aim`, `charged`, `shotsAtEnemy`, `challengePurpose` (only searches remain). Removed by amendment 07: `shotsSinceEnemyFire` (the enemy fires after every shot that does not destroy it) and `enemyFound` (the enemy is always visible), and with them the reduced enemy that `getState()` reported during a guided search. Removed by amendment 09: `decoys`, `orderTaps`, `notOnTank`, `TankState.label`, the `'decoy'` tank kind and `Challenge.orderAnswer`. Amendment 10 brings back `decoys` and the `'decoy'` kind, without `label`.

**Keyboard entry** (`applyKey(entry, key, range)` in `src/core/battle/entry.ts`, pure): a digit appends to `typed` (ignored past the digit count of the longest number in the range); `-` is accepted only as the first character when `range.min < 0`; Backspace removes the last character. After each change, `selection` is the typed value when it is inside the range; otherwise `selection` is the nearest end and `outOfRange` is true. A pointer selection clears `typed`. *(The nudge is removed by amendment 05.)*

**Input method** (amendment 05, FR-076): `typeDigit`, `typeMinus`, `backspace` and `confirm()` from Enter set `inputMethod` to `'keyboard'`; `selectNumber` and `confirm('pointer')` from the fire button set it to `'pointer'`. Ignored calls (wrong phase) change nothing. `startRound` and `newScene` keep the value of the previous round. The next search passes `inputMethod ?? 'keyboard'` to `generateChallenge`, which then skips `findNumber` for `'keyboard'`.

**State transitions**

```text
start → challenge (a search in every play mode, enemy visible; mode 'ruler' always readPosition, mode 'math' never readPosition or findNumber)
challenge | aiming --typeDigit / typeMinus / backspace / selectNumber--> same phase (selection, entry and inputMethod change)
challenge | aiming --confirm or fireAt(n), answerable, n in range--> playerShot (path from solveArcToX)
challenge | aiming --confirm with entry.outOfRange--> same phase (nothing fired, range hint)
playerShot --hit (exact number)--> enemy destroyed (enemiesHit + 1; enemiesDestroyed + 1 unless pointAfterFullHelp is off and help.level is 3, then lastShot.uncounted; attempt recorded, missStreak 0) --> roundOver (goalReached) | new landscape (renewTerrain: new terrainSeed and terrain, tanks settled at their numbers) and a new search with a new visible enemy; the destroyed enemy does not fire
playerShot --miss (near miss on the body, or off it)--> enemyTurn (help.level + 1, missStreak + 1, or + 2 for a fast guess, lastShot with the step count shown)
playerShot (guided, comparison) --decoy's exact number--> decoy destroyed (alive false, lastShot.decoyHit), a miss --> enemyTurn (help.level + 1; the enemy and every standing decoy fire together from their own barrels, bug report B2)
playerShot (guided, comparison) --hit--> enemy destroyed, every decoy alive false (folded away) --> new search
challenge (comparison) --tapTank(id) of a standing enemy or decoy--> as confirm at that tank's number
challenge --help (button or H) or time limit--> challenge (help.level + 1)
challenge at help.level 3 --> selection = answer; confirm fires at it (the shot hits)
enemyTurn --impact--> when the enemy's plan was a hit (missStreak at the difficulty's limit, not the first enemy shot of the round): missStreak 0 and lives - 1 unless noDamage; lives 0 --> roundOver (heartsGone), otherwise the phase the child left (challenge or aiming)
any (except roundOver) --pause (button or Escape)--> paused --resume--> previous phase
```

Round over (amendment 06, FR-008, FR-082) when `lives == 0` (`heartsGone`), or, with `roundType: 'enemyCount'`, when `enemiesDestroyed == roundLength` right after the hit (`goalReached`, before any enemy shot). In `noDamage` mode `lives` never drops; the enemy's shells still come closer and land on the child's tank at the limit (amendment 13, FR-044). The player's shell follows the hit rule above: only the exact number destroys the enemy; a decoy is destroyed only at its exact number and does not count in the score; a near miss on the body sets `nearMiss` (the enemy shakes). The player's own shell never damages the player.

**Time** (FR-084): `startRound` starts the clock at 0. `pause` adds the running part to `elapsedMs` and stops it; `resume` starts it again; the round end freezes it. The app pauses the battle while the parent gate is open and while the tab is hidden (`visibilitychange`), so those times are not counted. `formatTime(ms)` gives `m:ss` (for example `6:12`; `61:05` past an hour).

The player tank stands at `range.min` (left side) or `range.max` (right side) for the whole round. When a new search starts, the next challenge's answer becomes the enemy's position and the new enemy fades in there; it is visible in every challenge kind (amendment 07). The answer is always at least `minEnemyGap` from the player tank.

In comparison turns (amendment 10, replacing amendment 09 item 1), one tank stands at each option the banner names: the enemy at the correct option and a decoy (`kind: 'decoy'`, id `decoy-<challenge id>-<i>`) at each other option. Decoys look exactly like the enemy and carry no number plate. A destroyed decoy stays gone for the rest of the search; the next search replaces `decoys`. The search right after `newScene` is never a comparison (amendment 08 item 1, restored by amendment 10 item 10).

**Enemy shot** (amendment 07, FR-041 to FR-043a, FR-081; `src/core/ai/enemy.ts`): after every player shot that does not destroy the enemy, the enemy fires once. `planEnemyShot` makes one seeded draw from `deriveSeed(roundSeed, 6, shotIndexInRound)`: the shot hits with probability `ENEMY_HIT_CHANCE` (`easy` 1/6, `normal` 1/4, `challenging` 1/3), never on `shotIndexInRound` 0. A hit aims at the child's tank center. Otherwise the shell aims at a point `NEAR_MISS_MIN` (40) to `NEAR_MISS_MAX` (100) world units left or right of the child's tank, outside the hit area (half the tank width, 30 units); the side comes from the draw, and when that side would leave the battlefield the other side is used. The path is the arc of `solveArcToX` from the enemy's muzzle, so the shell lands at the aimed x. In comparison turns (amendment 10, FR-043a) the path is `topShellPath` instead: the shell enters at the top edge at `topShellEntryX(roundSeed, shotIndex, playerX)`, an x that depends on nothing about the enemy, and falls onto the same impact. The draw reads only the round seed, the shot index and the difficulty, never answers, help or mistakes (FR-042).
