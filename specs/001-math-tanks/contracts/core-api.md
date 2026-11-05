# Contract: engine-free core modules (`src/core/`)

These functions are the boundary between the learning logic, the physics, and the two user interfaces (Phaser and React). They are pure unless stated otherwise and never import Phaser, React or DOM APIs. Types are defined in [data-model.md](../data-model.md).

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

interface Tick { value: number; major: boolean; labeled: boolean; }
ticksFor(view: { min: number; max: number }, labelLevel: 1|2|3|4, seed: number): { majorStep: number; minorStep: number; ticks: Tick[] }
needsZoom(min: number, max: number): boolean                                // true when max - min > 100
zoomIntervals(min: number, max: number): Array<{ min: number; max: number }> // the major-step intervals for the coarse selection
```

Guarantees: `xToNumber(numberToX(n)) === n` for every integer `n` in range; equal value steps give equal x steps; at most 101 ticks per view; label level 3 hides at least half of the minor labels, chosen by `seed`; label level 4 labels only the view's end points; end points of custom ranges are always labeled.

## `core/math`

```ts
generateChallenge(input: {
  settings: Settings;
  skillSteps: Record<Skill, number>;     // current difficulty step per skill
  rng: Rng;
  playerPosition: number;
  kindsAllowed?: ChallengeKind[];         // free-play bonus may restrict kinds
}): Challenge

validateChallenge(c: Challenge, settings: Settings, playerPosition: number): string[]   // empty when valid
checkAnswer(c: Challenge, answer: number | number[]): boolean
stepPath(c: Challenge, beginnerAssist: boolean): number[]   // positions for the step animation, e.g. [43, 40, 36]
crossesTen(a: number, b: number): boolean
crossesHundred(a: number, b: number): boolean
```

Guarantees: `validateChallenge(generateChallenge(x), ...)` returns `[]` for every seed and every valid `Settings` (tested over 10,000 seeds per preset configuration, SC-003). Same seed and inputs give the same challenge.

## `core/progress`

```ts
classifyAttempt(a: { solved: boolean; helpLevel: number; wrongAnswers: number; responseMs: number; wrongTapTimes: number[] }): { independent: boolean; guess: boolean; outcome: RecentOutcome }
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
damageAt(impact: Point, tank: Point, blastRadius: number, directHit: boolean): number   // 0..maxDamage, decreasing with distance
solveAim(input: { origin: Point; target: Point; terrain: Heightmap; worldWidth: number; worldHeight: number }): { angleDeg: number; power: number } | null
```

Guarantees: fixed timestep (1/120 s); identical output for identical input; terrain never below `floor`; `solveAim` result, passed to `simulateShot` on the same terrain, lands within 10 units of the target or returns `null` when no shot within the angle and power limits reaches it.

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

  startRound(): void
  selectNumber(n: number): void            // preview while dragging; no answer check
  submitAnswer(answer: number | number[]): void
  requestHelp(): void
  continueAfterSolution(): void
  setAim(angleDeg: number, power: number): void
  fire(): void                              // computes the path; phase -> 'playerShot'
  shotAnimationDone(): void                 // called by the renderer after replaying the path; applies damage and terrain change
  enemyShotAnimationDone(): void
  requestBonusChallenge(): void             // free-play only
  pause(): void
  resume(): void
}
```

Renderers never change state directly; they call these methods. The controller records an `Attempt` through the `ProgressStore` when a challenge ends.

## `core/storage`

```ts
interface KeyValue { get(key: string): string | null; set(key: string, value: string): void }   // localStorage adapter or in-memory for tests
loadSettings(kv: KeyValue): { settings: Settings; resetReason: 'none' | 'invalid' | 'unavailable' }
saveSettings(kv: KeyValue, s: Settings): { ok: boolean }
loadProgress(kv: KeyValue): { progress: Progress; resetReason: 'none' | 'invalid' | 'unavailable' }
saveProgress(kv: KeyValue, p: Progress): { ok: boolean }
```

## `i18n`

```ts
type Messages = typeof de;     // de.ts is the source of truth for keys
t(): Messages
encouragements: readonly string[]          // FR-033
forbiddenWords: readonly string[]          // 'falsch', 'verloren', 'Fehler', 'versagt', 'schlecht', 'dumm'
```
