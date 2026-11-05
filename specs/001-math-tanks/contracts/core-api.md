# Contract: engine-free core modules (`src/core/`)

These functions are the boundary between the learning logic, the physics, and the two user interfaces (Phaser and React). They are pure unless stated otherwise and never import Phaser, React or DOM APIs. Types are defined in [data-model.md](../data-model.md). Changed by [amendment 01](../amendment-01-number-aiming.md), [amendment 02](../amendment-02-ruler-ranges-and-detail.md), [amendment 04](../amendment-04-hit-rule.md) and [amendment 05](../amendment-05-no-shortcuts-settings-early.md).

## `core/rng`

```ts
createRng(seed: number): Rng
deriveSeed(...parts: number[]): number   // stable 32-bit hash
```

## `core/numberline`

```ts
interface Layout { worldWidth: number; left: number; right: number; }      // logical units, defaults 1600, 80, 1520
numberToX(n: number, min: number, max: number, layout?: Layout): number
xToNumber(x: number, min: number, max: number, layout?: Layout): number    // snaps to nearest integer, clamped to [min, max]

type RulerLevel = 1 | 2 | 3 | 4 | 5;
interface Tick { value: number; major: boolean; visible: boolean; labeled: boolean; }
ticksFor(view: { min: number; max: number }, level: RulerLevel, seed: number, opts?: { allLines?: boolean }):
  { majorStep: number; minorStep: number; ticks: Tick[]; labelTypedNumber: boolean }
typedNumberLabels(r: { ticks: Tick[]; labelTypedNumber: boolean }, selection: number | null, typed: boolean): number[]
  // [selection] on a crowded level 1 ruler for a typed number whose line has no label; [] otherwise (T203)
smallestVisibleStep(view: { min: number; max: number }, level: RulerLevel): number   // minor step on levels 1-3, major step on 4 and 5 (FR-068)
helpZoomView(answer: number, min: number, max: number): { min: number; max: number } // the ten-number interval containing answer, clamped to the range (help visual only)
```

Guarantees: `xToNumber(numberToX(n)) === n` for every integer `n` in range, for any range with width 5 to 1000 and any start; equal value steps give equal x steps; at most 101 ticks per view; steps follow spec FR-016 (width 230 gives major 50, minor 10); lines and labels follow the five levels of FR-017 (level 3 labels a seed-chosen subset of major lines; level 4 draws no minor lines; level 5 draws only the end points); end points are always drawn and labeled; `allLines: true` draws and labels every line of the view, for help steps (FR-018). `needsZoom` and `zoomIntervals` are removed by amendment 02 (no two-step selection).

## `core/math`

```ts
generateChallenge(input: {
  settings: Settings;
  skillSteps: Record<Skill, number>;     // current difficulty step per skill
  roundSeed: number;                      // challenge seed = deriveSeed(roundSeed, turn, purpose); id = `${roundSeed}-${turn}`
  turn: number;
  playerPosition: number;                 // range.min or range.max, fixed for the round
  rulerLevel: RulerLevel;                 // decides where a readPosition enemy may stand (FR-067)
  kindsAllowed?: ChallengeKind[];         // free play passes ['readPosition']
  inputMethod?: 'pointer' | 'keyboard';   // amendment 05 (FR-076): 'keyboard' skips findNumber; the fallback is then readPosition. Omitted: no restriction
}): Challenge
mainSkillOf(kind: ChallengeKind): Skill
minTankGap(min: number, max: number): number
minEnemyGap(min: number, max: number): number

validateChallenge(c: Challenge, settings: Settings, playerPosition: number): string[]   // empty when valid
checkAnswer(c: Challenge, answer: number | number[]): boolean   // exact answer only, for every kind (amendment 04 removes hitTolerance); whether a shot destroys the enemy is decided by core/battle/hitRule
stepPath(c: Challenge, beginnerAssist: boolean): number[]   // positions for the step animation, e.g. [43, 40, 36]
crossesTen(a: number, b: number): boolean
crossesHundred(a: number, b: number): boolean
```

The `purpose: 'search' | 'bonus'` input is removed by amendment 01 (no bonus challenges).

Guarantees: `validateChallenge(generateChallenge(x), ...)` returns `[]` for every seed and every valid `Settings` (tested over 10,000 seeds per preset configuration and over 200 random valid settings, SC-003). Same seed and inputs give the same challenge.

## `core/progress`

```ts
classifyAttempt(a: { solved: boolean; exact: boolean; helpLevel: number; wrongAnswers: number; responseMs: number; wrongAnswerTimes: number[]; submittedAt: number }): { independent: boolean; guess: boolean; outcome: RecentOutcome }
// outcome: 'independent' when solved, helpLevel 0 and wrongAnswers 0; 'assisted' when solved after help or misses; 'unsolved' when the solution was shown.
// Amendment 06: every hit is exact, a near miss on the body is a miss, so 'close' is never produced (a stored 'close' still loads and is neutral)
// guess: solved and responseMs < 1500, or solved and 3+ wrongAnswerTimes within 5000 ms before submittedAt
startOrContinueSession(p: Progress, now: number): Progress   // 30-minute idle and new-day rules
recordAttempt(p: Progress, a: Attempt, settings: Settings): Progress     // returns a new Progress; updates skill steps by the adaptive rule
skillStatus(sp: SkillProgress): 'mastered' | 'developing'
summarize(p: Progress): ProgressSummary                                   // data for the progress page
ladders: Record<Skill, DifficultyStep[]>
effectiveStep(p: Progress, skill: Skill, rangeKey: string, settings: Settings): DifficultyStep
```

## `core/physics`

```ts
generateTerrain(seed: number, worldWidth: number, worldHeight: number): Heightmap
carveCrater(t: Heightmap, cx: number, cy: number, radius: number, floor: number): Heightmap   // returns a new heightmap
surfaceY(t: Heightmap, x: number): number
simulateShot(input: { origin: Point; angleDeg: number; power: number; terrain: Heightmap; targets: Array<{ id: string; x: number; y: number; radius: number }>; worldWidth: number; worldHeight: number }): { path: Point[]; impact: Point; hitTargetId: string | null; outOfBounds: boolean }
BLAST_RADIUS = 60   // crater size; damageAt and MAX_DAMAGE are removed by amendment 06 (no health)
solveAim(input: { origin: Point; target: Point; terrain: Heightmap; worldWidth: number; worldHeight: number }): { angleDeg: number; power: number; hits: boolean; missDistance: number }   // enemy only (R18)

// amendment 01: the player's fixed cannon
FIXED_ANGLE_DEG = 65; MAX_ARC_ANGLE_DEG = 85; ARC_ANGLE_STEP_DEG = 5
solveArcToX(input: { origin: Point; targetX: number; towardRight: boolean; terrain: Heightmap; worldWidth: number; worldHeight: number; tolerance: number }):
  { angleDeg: number; power: number; path: Point[]; impact: Point; lifted: boolean }
```

Guarantees: fixed timestep (1/120 s); identical output for identical input; terrain never below `floor`; `solveAim` always returns the shot whose impact is closest to the target, taking terrain into account; `hits` is true when that impact is within 10 units of the target. `solveArcToX` tries 65 degrees, then 70, 75, 80 and 85, and for each angle searches the power by bisection until `|impact.x - targetX| <= tolerance` (the caller passes a quarter of one unit's width, so `xToNumber(impact.x)` is the chosen number). It ignores tank hit boxes in flight. When no angle clears the terrain, it returns the 85-degree arc lifted over the highest terrain between muzzle and target (`lifted: true`) and ending at `targetX` on the surface. One call takes under 20 ms. `CHARGED_BLAST_RADIUS` is removed (FR-011 removed).

## `core/ai`

```ts
ENEMY_HIT_CHANCE: Record<Difficulty, number>   // easy 1/6, normal 1/4, challenging 1/3 (FR-041)
NEAR_MISS_MIN = 40; NEAR_MISS_MAX = 100         // world units from the child's tank center (FR-041)
planEnemyShot(input: { difficulty: Difficulty; roundSeed: number; shotIndexInRound: number; playerX: number; worldWidth: number }): { hits: boolean; targetX: number }
enemyShot(input: { difficulty: Difficulty; roundSeed: number; shotIndexInRound: number; origin: Point; playerX: number; terrain: Heightmap; worldWidth: number; worldHeight: number }):
  { hits: boolean; targetX: number; path: Point[]; impact: Point }
```

Changed by amendment 07: the enemy no longer aims with `solveAim` plus random error. `planEnemyShot` makes one seeded draw from `deriveSeed(roundSeed, 6, shotIndexInRound)`: `hits` is true with probability `ENEMY_HIT_CHANCE[difficulty]` and always false for `shotIndexInRound === 0` (FR-043). With `hits`, `targetX` is `playerX`; otherwise it is `playerX ± d` with `d` from 40 to 100 on a drawn side, and the other side when the drawn one is outside `[0, worldWidth]`. `enemyShot` adds the arc of `solveArcToX` from `origin` to `targetX`, so `|impact.x - targetX|` is at most 0.5 units. The input type has no field for attempts, help, mistakes or challenge data, so the draw cannot depend on them (FR-042). Over 3000 seeded shots the hit rate is within 0.03 of the chance for each difficulty. `enemyDamageFactor` is removed by amendment 06: each enemy hit removes one heart.

```ts
// core/battle/topShell (renamed from hiddenShell by amendment 07; used only in comparison turns, FR-043a)
topShellEntryX(roundSeed: number, shotIndex: number, playerX: number, worldWidth?: number): number   // within 160 of playerX, clamped to the world
topShellPath(input: { impact: Point; entryX: number; terrain: Heightmap; worldHeight: number }): Point[]   // falls from the top edge onto the impact
```

## `core/battle` (stateful)

```ts
class BattleController {
  constructor(deps: { settings: Settings; progress: ProgressStore; clock: () => number; seed?: number; speaker?: Speaker })
  getState(): RoundState
  subscribe(listener: (s: RoundState) => void): () => void

  startRound(mode: 'guided' | 'freePlay'): void   // 3 hearts, score 0, time 0 (amendment 06); enemy shot index 0
  newScene(): void                         // "Neue Landschaft" (amendment 08, FR-070): new terrain seed, the side may switch, exactly one enemy at a new
                                           // position with a new challenge that is not a comparison (no decoys); hearts, enemiesDestroyed,
                                           // turn, round time and enemy shot index stay; no enemy shot; an unfinished challenge is dropped
                                           // without an attempt; ignored in 'playerShot', 'enemyTurn', 'paused' and 'roundOver'
  elapsedMs(): number                      // time played this round: elapsedMs plus the running part; stopped while paused and after the round ends (FR-084)
  selectNumber(n: number): void            // pointer preview while dragging or after release; clears typed digits; never fires; sets inputMethod 'pointer'
  typeDigit(d: 0|1|2|3|4|5|6|7|8|9): void  // keyboard digit (FR-060); sets inputMethod 'keyboard' (also typeMinus and backspace)
  typeMinus(): void                        // accepted only as the first character when range.min < 0
  backspace(): void
  confirm(method?: 'pointer' | 'keyboard'): void   // Enter and Space pass nothing ('keyboard'), the fire button passes 'pointer'; fires at the selection;
                                           // a fired shot sets inputMethod to method (FR-076);
                                           // out-of-range entry -> no shot, range hint (FR-063); in order3 places a badge for the typed tank number
  fireAt(n: number): void                  // fires at n (the arc from solveArcToX); in phase 'challenge' this is the answer
  tapTank(tankId: string): void            // comparison: fires at the tank's number; order3 places a badge without firing
  requestHelp(): void                      // help button or H key: next help step
  shotAnimationDone(): void                // after replaying the path: crater; exact number -> enemy destroyed, score + 1, new visible enemy
                                           // (or roundOver 'goalReached'); otherwise miss (near miss on the body -> shake) -> help and
                                           // enemy turn at once (FR-066, FR-081, amendment 07); sets lastShot
  enemyShotAnimationDone(): void           // a hit on the player's body removes one heart unless noDamage; 0 hearts -> roundOver 'heartsGone'
                                           // the shell comes from the enemy's muzzle, in comparison turns from the top edge (FR-043a)
  tick(): void                             // time limit (tasks.md D1)
  pause(): void                            // pause button or Escape
  resume(): void
}
```

Removed by amendment 01: `setAim`, `fire`, `submitSelection`, `nudgeSelection`, `continueAfterSolution`, `requestBonusChallenge`. Removed by amendment 02: `selectInterval`, `leaveZoom`. Removed by amendment 05: `nudge` (no +1 and −1 buttons, no arrow keys). `RoundState.inputMethod` records the latest input method; the next search passes it to `generateChallenge` (FR-076). Digits and Enter are ignored outside the phases `challenge` and `aiming`, and fires before `answerableAt` are ignored.

`getState()` returns the full state; there is no hidden enemy and no reduced view of it (amendment 07 removes `publicState`, `placedEnemy` and `HiddenTank`). `visibleEnemy(state)` in `round.ts` returns the enemy while it is alive. Renderers never change state directly; they call these methods. Keys reach the controller through `keyToAction(key, screen)` in `src/app/keyboard.ts` (see [ui-flows.md](./ui-flows.md)). The controller records an `Attempt` through the `ProgressStore` when a challenge ends.

## `core/battle/hitRule` (pure, amendment 04, changed by amendment 06)

```ts
type ShotKind = 'hit' | 'near' | 'miss';
bodyHalfWidth(min: number, max: number, layout?: Layout): number      // half of TANK_WIDTH (60) in numbers for the range
shotKind(fired: number, target: number, range: { min: number; max: number }): ShotKind
                                                                      // 'hit' when fired === target (enemy destroyed); 'near' when the x distance is at most TANK_WIDTH / 2
enemyHitsPlayer(impact: Point, hitTargetId: string | null, player: TankState): boolean
                                                                      // the enemy shell entered the player's hit circle or landed within TANK_WIDTH / 2 of its x
LIVES = 3                                                             // ENEMY_FIRE_EVERY is removed by amendment 07
```

Guarantees: `shotKind(n, n, r)` is `'hit'` for every range; in 0 to 100 a shot 2 away is `'near'` and 3 away is `'miss'`; in 0 to 10 a shot 1 away is `'miss'`; in 0 to 1000 a shot 20 away is `'near'`. `enemyDamage` is removed by amendment 06.

## `core/records` (pure, amendment 06)

```ts
interface BestResult { enemies: number; ms: number; at: number }
interface Records { version: 1; best: Record<string, BestResult> }
emptyRecords(): Records
recordKey(s: Pick<Settings, 'range' | 'rulerLevelStart' | 'roundType'>): string   // `${min}-${max}|${level}|${roundType}`
submitResult(r: Records, key: string, result: BestResult): { records: Records; newRecord: boolean; best: BestResult | null }
                                                                      // newRecord when enemies >= 1 and enemies > the stored best (or none)
formatTime(ms: number): string                                         // m:ss, e.g. 372000 -> "6:12"
```

## `core/battle/entry` (pure)

```ts
applyKey(entry: { typed: string; outOfRange: boolean }, key: { digit: number } | 'minus' | 'backspace', range: { min: number; max: number }):
  { entry: { typed: string; outOfRange: boolean }; selection: number | null }
```

## `core/storage`

```ts
interface KeyValue { get(key: string): string | null; set(key: string, value: string): void }   // localStorage adapter or in-memory for tests
loadSettings(kv: KeyValue): { settings: Settings; resetReason: 'none' | 'invalid' | 'unavailable' }
saveSettings(kv: KeyValue, s: Settings): { ok: boolean }
loadProgress(kv: KeyValue): { progress: Progress; resetReason: 'none' | 'invalid' | 'unavailable' }
saveProgress(kv: KeyValue, p: Progress): { ok: boolean }
loadRecords(kv: KeyValue): { records: Records; resetReason: 'none' | 'invalid' | 'unavailable' }   // key mathtanks.records.v1 (amendment 06)
saveRecords(kv: KeyValue, r: Records): { ok: boolean }
migrate(raw: unknown, kind: 'settings' | 'progress'): unknown   // upgrades older versions before validation; settings 0 and 1 -> 2 -> 3 -> 4 per data-model.md
exportData(settings: Settings, progress: Progress, records: Records, now?: Date): string   // JSON text for download; exportedAt is now as ISO 8601
importData(text: string): { ok: true; settings: Settings; progress: Progress; records: Records } | { ok: false; reason: 'notJson' | 'wrongApp' | 'invalidSettings' | 'invalidProgress' | 'invalidRecords' }
                                                                      // a file without records imports with empty records
```

## `i18n`

```ts
type Messages = typeof de;     // de.ts is the source of truth for keys
t(): Messages
encouragements: readonly string[]          // FR-033
forbiddenWords: readonly string[]          // 'falsch', 'verloren', 'Fehler', 'versagt', 'schlecht', 'dumm'
```
