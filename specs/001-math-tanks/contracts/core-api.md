# Contract: engine-free core modules (`src/core/`)

These functions are the boundary between the learning logic, the physics, and the two user interfaces (Phaser and React). They are pure unless stated otherwise and never import Phaser, React or DOM APIs. Types are defined in [data-model.md](../data-model.md). Changed by [amendment 01](../amendment-01-number-aiming.md) and [amendment 02](../amendment-02-ruler-ranges-and-detail.md).

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
  { majorStep: number; minorStep: number; ticks: Tick[]; labelsNearPreview: boolean }
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
}): Challenge
mainSkillOf(kind: ChallengeKind): Skill
minTankGap(min: number, max: number): number
minEnemyGap(min: number, max: number): number

validateChallenge(c: Challenge, settings: Settings, playerPosition: number): string[]   // empty when valid
checkAnswer(c: Challenge, answer: number | number[]): boolean   // exact, except readPosition within c.hitTolerance (FR-068)
stepPath(c: Challenge, beginnerAssist: boolean): number[]   // positions for the step animation, e.g. [43, 40, 36]
crossesTen(a: number, b: number): boolean
crossesHundred(a: number, b: number): boolean
```

The `purpose: 'search' | 'bonus'` input is removed by amendment 01 (no bonus challenges).

Guarantees: `validateChallenge(generateChallenge(x), ...)` returns `[]` for every seed and every valid `Settings` (tested over 10,000 seeds per preset configuration and over 200 random valid settings, SC-003). Same seed and inputs give the same challenge.

## `core/progress`

```ts
classifyAttempt(a: { solved: boolean; helpLevel: number; wrongAnswers: number; responseMs: number; wrongAnswerTimes: number[]; submittedAt: number }): { independent: boolean; guess: boolean; outcome: RecentOutcome }
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
damageAt(impact: Point, tank: Point, blastRadius: number, directHit: boolean): number   // enemy shells only; 0..maxDamage, decreasing with distance
solveAim(input: { origin: Point; target: Point; terrain: Heightmap; worldWidth: number; worldHeight: number }): { angleDeg: number; power: number; hits: boolean; missDistance: number }   // enemy only (R18)

// amendment 01: the player's fixed cannon
FIXED_ANGLE_DEG = 65; MAX_ARC_ANGLE_DEG = 85; ARC_ANGLE_STEP_DEG = 5
solveArcToX(input: { origin: Point; targetX: number; towardRight: boolean; terrain: Heightmap; worldWidth: number; worldHeight: number; tolerance: number }):
  { angleDeg: number; power: number; path: Point[]; impact: Point; lifted: boolean }
```

Guarantees: fixed timestep (1/120 s); identical output for identical input; terrain never below `floor`; `solveAim` always returns the shot whose impact is closest to the target, taking terrain into account; `hits` is true when that impact is within 10 units of the target. `solveArcToX` tries 65 degrees, then 70, 75, 80 and 85, and for each angle searches the power by bisection until `|impact.x - targetX| <= tolerance` (the caller passes a quarter of one unit's width, so `xToNumber(impact.x)` is the chosen number). It ignores tank hit boxes in flight. When no angle clears the terrain, it returns the 85-degree arc lifted over the highest terrain between muzzle and target (`lifted: true`) and ending at `targetX` on the surface. One call takes under 20 ms. `CHARGED_BLAST_RADIUS` is removed (FR-011 removed).

## `core/ai`

```ts
enemyShot(input: { difficulty: 'easy'|'normal'|'challenging'; rng: Rng; shotIndexInRound: number; origin: Point; target: Point; terrain: Heightmap; worldWidth: number; worldHeight: number }): { angleDeg: number; power: number }
enemyDamageFactor(difficulty): number   // 0.5 on easy, 1 otherwise
```

The input type has no field for attempts, help or challenge data (FR-042). On `easy`, `shotIndexInRound === 0` always returns a shot that misses by more than the blast radius.

## `core/battle` (stateful)

```ts
class BattleController {
  constructor(deps: { settings: Settings; progress: ProgressStore; clock: () => number; seed?: number; speaker?: Speaker })
  getState(): RoundState
  subscribe(listener: (s: RoundState) => void): () => void

  startRound(mode: 'guided' | 'freePlay'): void
  selectNumber(n: number): void            // pointer preview while dragging or after release; clears typed digits; never fires
  nudge(delta: 1 | -1 | 10 | -10): void    // +1 / -1 buttons and arrow keys; clamped to the range
  typeDigit(d: 0|1|2|3|4|5|6|7|8|9): void  // keyboard digit (FR-060)
  typeMinus(): void                        // accepted only as the first character when range.min < 0
  backspace(): void
  confirm(): void                          // Enter, Space at the solution step, or the fire button: fires at the selection;
                                           // out-of-range entry -> no shot, range hint (FR-063); in order3 places a badge for the typed tank number
  fireAt(n: number): void                  // fires at n (the arc from solveArcToX); in phase 'challenge' this is the answer
  tapTank(tankId: string): void            // comparison: fires at the tank's number; order3 places a badge without firing
  requestHelp(): void                      // help button or H key: next help step
  shotAnimationDone(): void                // after replaying the path: crater, exact-hit damage or near-miss shake, miss -> help, hit -> enemy turn
  enemyShotAnimationDone(): void
  tick(): void                             // time limit (tasks.md D1)
  pause(): void                            // pause button or Escape
  resume(): void
}
```

Removed by amendment 01: `setAim`, `fire`, `submitSelection`, `nudgeSelection`, `continueAfterSolution`, `requestBonusChallenge`. Removed by amendment 02: `selectInterval`, `leaveZoom`. Digits, Enter and arrow keys are ignored outside the phases `challenge` and `aiming`, and fires before `answerableAt` are ignored.

Renderers never change state directly; they call these methods. Keys reach the controller through `keyToAction(key, screen)` in `src/app/keyboard.ts` (see [ui-flows.md](./ui-flows.md)). The controller records an `Attempt` through the `ProgressStore` when a challenge ends.

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
migrate(raw: unknown, kind: 'settings' | 'progress'): unknown   // upgrades older versions before validation; settings 1 -> 2 per data-model.md
exportData(settings: Settings, progress: Progress): string        // JSON text for download
importData(text: string): { ok: true; settings: Settings; progress: Progress } | { ok: false; reason: string }
```

## `i18n`

```ts
type Messages = typeof de;     // de.ts is the source of truth for keys
t(): Messages
encouragements: readonly string[]          // FR-033
forbiddenWords: readonly string[]          // 'falsch', 'verloren', 'Fehler', 'versagt', 'schlecht', 'dumm'
```
