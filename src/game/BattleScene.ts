/**
 * The battle scene (FR-002 to FR-005, FR-054, research R4). It only draws BattleController state
 * and reports when a shell animation has finished; all rules live in src/core.
 *
 * - Subscribes to the controller in create() and unsubscribes on shutdown.
 * - Replays the shell path in state.shot, then calls shotAnimationDone or enemyShotAnimationDone.
 * - The ruler (NumberLineView) handles tapping and dragging; the cannon cannot be dragged (FR-003).
 * - The player's turret shows the fixed 65-degree angle and turns to the arc's launch angle just before a
 *   raised or lifted shot (FR-065).
 * - Amendment 06 (FR-066, FR-073, FR-080): the enemy shakes after a near miss on its body (lastShot.nearMiss); an
 *   exact hit destroys it with a large explosion where it stood, and the new enemy fades in at its new number. The
 *   enemy shows a target ring where the pointer line meets it. The child's hearts sit above the child's tank, and
 *   the tank flashes when an enemy shell costs a heart.
 * - Guided searches (T067, amendment 07, FR-010, FR-073): the enemy, its target ring and its pointer line are
 *   visible in every challenge kind, and a near miss shakes it. An exact hit destroys it with the large explosion
 *   where it stood, and the new enemy fades in at its new number. The enemy turns its turret toward its aim and fires
 *   from its own tank after every shot of the child that does not destroy it.
 * - At the start of every round, which includes "Neue Landschaft", a bouncing "Du" arrow points at the child's tank
 *   for YOU_MARKER_MS (amendment 05, FR-077). The canvas attribute `data-you-marker` is `on` while it shows and `off`
 *   after, for the end-to-end tests only (tasks.md D4).
 * - Comparison (US4, amendment 10, FR-026, FR-066): the banner names the options; the enemy stands at the correct
 *   option and a decoy view, drawn exactly like the enemy and with no number plate, at each other option. Decoy views
 *   are created when a comparison search starts and removed when it ends. Every standing tank takes taps
 *   (controller.tapTank). A burst decoy breaks into cardboard pieces and is gone; when the enemy is destroyed the
 *   remaining decoys fade out. A near miss shakes the tank in lastShot.nearTankId. Help step 3 puts a green ring
 *   around the enemy. When the enemy fires, every standing decoy turns its turret and fires with it, each from its own
 *   barrel (bug report B2). For the end-to-end tests
 *   only, the canvas carries `data-enemy-tanks` (standing tanks that look like the enemy), `data-tank-taps`
 *   (`<number>@<x>,<y>` of each tappable tank, in world units), `data-decoy-bursts` (decoys burst this round) and
 *   `data-help-tanks` (the number of the tank marked by help step 3, or ''), `data-enemy-volley` (the start x of each
 *   shell of the latest enemy shot, in world units, sorted) and `data-trail-points` (points of the trail shown).
 * - While the phase is 'paused' the scene is paused, which stops update(), tweens, timers and particles. Phaser queues
 *   `scene.pause()` and `scene.resume()` until its next frame, while `scene.isPaused()` answers at once, so the scene
 *   keeps the last state it asked for (`pauseAsked`): a pause and a resume within one frame then end resumed
 *   (bug "iPhone rotation in Chrome", Phase 24; before, the scene stayed paused and the round hung).
 * - Amendment 11 (FR-093): `options.look` gives the child's tank its garage color, flag and hat and the child's shells
 *   their trail; the enemy and decoys keep their look. The canvas carries `data-player-look` (lookKey) for the
 *   end-to-end tests only (D4).
 * - Amendment 13 (FR-100, FR-101): when the enemy's shell lands beside the child's tank one miss before the limit, the
 *   tank wobbles and its hearts pulse once. After a destroyed enemy the new hills fade in once the explosion is over,
 *   the child's tank settles onto them and the next enemy fades in after that. For the end-to-end tests only, the
 *   canvas carries `data-terrain-seed` and `data-enemy-warnings` (warnings shown this round).
 * - Amendment 14 (FR-107 to FR-113): preload() loads the bundled CC0 dirt texture for the ground. Every tank that fires
 *   shows recoil, a muzzle flash and smoke (the enemy and each decoy of a volley too). A hit on a tank (the enemy
 *   destroyed, a heart lost, a decoy burst) shakes the screen a little, unless the operating system asks for reduced
 *   motion, which also means fewer particles. For the end-to-end tests only (D4), the canvas carries
 *   `data-muzzle-flashes`, `data-reduced-motion` and `data-fps` (frames in the last second).
 * - Amendment 21 (FR-137 to FR-142): a wave's other enemies get their own views (`waveViews`, by tank id), drawn like the
 *   enemy with a target ring; views follow tank ids, because the help target moves into `RoundState.enemy`. A destroyed
 *   enemy explodes and, while others of its wave stand, fades out; an enemy that comes alive fades in. The enemy shell
 *   comes from the tank in `ShotInFlight.shooterId`. While 2 or more enemies stand and help shows, the help target's
 *   ring pulses. For the end-to-end tests only (D4), the canvas carries `data-help-target` (the help target's number
 *   while 2 or more enemies stand, '' otherwise).
 * - Amendment 18: a hit that does not count plays no chime. For the end-to-end tests only (D4), the canvas carries
 *   `data-chimes` (chimes played since the scene started).
 */
import Phaser from 'phaser';
import type { BattleController } from '../core/battle/controller';
import { ENEMY_ID, tankCenter, WORLD_HEIGHT, WORLD_WIDTH } from '../core/battle/round';
import { standingEnemies } from '../core/battle/wave';
import { BLAST_RADIUS } from '../core/physics/damage';
import { FIXED_ANGLE_DEG } from '../core/physics/arc';
import { LIVES } from '../core/battle/hitRule';
import { isWarningStreak } from '../core/ai/enemy';
import type { RoundState, ShotInFlight, TankState } from '../core/types';
import { launchAngle, toScreenY } from '../core/view/geometry';
import { YOU_MARKER_MS } from '../core/view/tankStyle';
import { Effects } from './effects';
import { NumberLineView } from './NumberLineView';
import { ProjectileView } from './ProjectileView';
import { FADE_MS, TankView } from './TankView';
import { TerrainView } from './TerrainView';
import { ensureTextures, TEX } from './textures';
import { landingSounds } from '../audio/sfx';
import { lookKey } from '../core/rewards/garage';
import { STANDARD_LOOK, type Look } from '../core/rewards/items';
import { motionProfile } from '../core/view/motion';
import dirtUrl from '../assets/textures/dirt.png';

/** Sound hooks the scene calls; src/audio/sfx.ts provides them. */
export interface BattleSounds {
  shot(): void;
  boom(): void;
  chime(): void;
  plopp(): void;
}

export interface BattleSceneOptions {
  sounds?: BattleSounds;
  /** The child's tank and shell look from the garage (amendment 11); the standard look when absent. */
  look?: Look;
}

/** The player's turret turns to a raised or lifted arc over this time before the shell leaves. */
const PLAYER_TURN_MS = 250;
/** A new enemy fades in after the large explosion of the destroyed one. */
const NEW_ENEMY_DELAY_MS = 600;
/** New hills after a destroyed enemy (amendment 13, FR-101): the fade starts after the explosion and takes 0.7 s. */
const TERRAIN_FADE = { delayMs: 500, durationMs: 700 };
/** With new hills the child's tank settles and the next enemy appears once they have faded in. */
const AFTER_TERRAIN_FADE_MS = TERRAIN_FADE.delayMs + TERRAIN_FADE.durationMs;
/** The enemy turns its cannon, then fires after this pause, so the child can follow. */
const ENEMY_TURN_MS = 450;
const ENEMY_FIRE_DELAY_MS = 700;
/** A folded decoy view is removed once its fade-out is over. */
const FOLD_REMOVE_MS = 800;

export class BattleScene extends Phaser.Scene {
  private readonly controller: BattleController;
  private readonly sounds: BattleSounds | undefined;
  private readonly look: Look;
  private unsubscribe: (() => void) | null = null;
  private terrain!: TerrainView;
  private player!: TankView;
  private enemy!: TankView;
  /** Decoy views by tank id, for the decoys of the current comparison search (amendment 10). */
  private readonly decoyViews = new Map<string, TankView>();
  /** Views of the wave's other enemies by tank id (amendment 21); the tank with ENEMY_ID always uses `enemy`. */
  private readonly waveViews = new Map<string, TankView>();
  /** Views of destroyed wave enemies that left the state and fade out after their explosion (code review). */
  private readonly fadingWrecks = new Set<TankView>();
  private decoyBursts = 0;
  private enemyWarnings = 0;
  /** Whether the scene last asked Phaser to pause (true) or to resume (false). */
  private pauseAsked = false;
  /** Delay before a new enemy or decoy fades in: longer while new hills fade in. */
  private appearDelay = NEW_ENEMY_DELAY_MS;
  private projectile!: ProjectileView;
  private effects!: Effects;
  private numberLine!: NumberLineView;
  private prev: RoundState | null = null;
  /** The shot whose replay has been started, so a state update never starts it twice. */
  private startedShot: ShotInFlight | null = null;
  private pendingFire: Phaser.Time.TimerEvent | null = null;
  private muzzleFlashes = 0;
  private chimes = 0;
  private frames = 0;
  private frameTime = 0;

  constructor(controller: BattleController, options: BattleSceneOptions = {}) {
    super('battle');
    this.controller = controller;
    this.sounds = options.sounds;
    this.look = options.look ?? STANDARD_LOOK;
  }

  /** The CC0 dirt texture (amendment 14, FR-107); when it fails to load, TerrainView uses the generated pattern. */
  preload(): void {
    if (!this.textures.exists(TEX.dirt)) this.load.image(TEX.dirt, dirtUrl);
  }

  create(): void {
    ensureTextures(this, WORLD_WIDTH, WORLD_HEIGHT);
    const reducedMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.game.canvas.dataset.reducedMotion = String(reducedMotion);
    this.muzzleFlashes = 0;
    this.game.canvas.dataset.muzzleFlashes = '0';
    this.chimes = 0;
    this.game.canvas.dataset.chimes = '0';
    this.add.image(0, 0, TEX.sky).setOrigin(0, 0);
    this.terrain = new TerrainView(this, WORLD_HEIGHT, WORLD_WIDTH);
    this.projectile = new ProjectileView(this, WORLD_HEIGHT, this.look.trail);
    this.player = new TankView(this, 'player', WORLD_HEIGHT, undefined, this.look);
    this.game.canvas.dataset.playerLook = lookKey(this.look);
    this.enemy = new TankView(this, 'enemy', WORLD_HEIGHT, () => this.controller.tapTank(this.controller.getState().enemy.id));
    this.numberLine = new NumberLineView(this, this.controller, WORLD_HEIGHT);
    this.effects = new Effects(this, motionProfile(reducedMotion));
    this.prev = null;
    this.startedShot = null;

    this.unsubscribe = this.controller.subscribe((s) => this.draw(s));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.teardown, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.teardown, this);
    this.draw(this.controller.getState());
  }

  update(_time: number, delta: number): void {
    this.projectile.advance(delta);
    // The frame rate over the last second, for the end-to-end performance check (SC-002).
    this.frames++;
    this.frameTime += delta;
    if (this.frameTime >= 1000) {
      this.game.canvas.dataset.fps = String(Math.round((this.frames * 1000) / this.frameTime));
      this.frames = 0;
      this.frameTime = 0;
    }
  }

  private teardown(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    for (const view of this.decoyViews.values()) view.destroy();
    this.decoyViews.clear();
    for (const view of this.waveViews.values()) view.destroy();
    this.waveViews.clear();
    for (const view of this.fadingWrecks) view.destroy();
    this.fadingWrecks.clear();
    this.numberLine.destroy();
  }

  private draw(s: RoundState): void {
    const prev = this.prev;
    const newRound = prev === null || prev.seed !== s.seed;
    this.prev = s;

    if (newRound) {
      this.projectile.stop();
      this.pendingFire?.remove();
      this.pendingFire = null;
      this.startedShot = null;
      this.enemy.setBarrelAngle(s.playerSide === 'left' ? 150 : 30);
      this.player.setBarrelAngle(fixedAngle(s));
      this.enemy.setTarget(true);
      if (s.phase !== 'roundOver') this.showYouMarker();
      this.enemyWarnings = 0;
    }

    // New hills after a destroyed enemy fade in instead of switching at once (amendment 13, FR-101).
    const newHills = !newRound && prev !== null && s.terrainSeed !== prev.terrainSeed;
    this.appearDelay = newHills ? AFTER_TERRAIN_FADE_MS : NEW_ENEMY_DELAY_MS;
    this.terrain.update(s.terrain, s.terrainSeed, newHills ? TERRAIN_FADE : undefined);
    this.game.canvas.dataset.terrainSeed = String(s.terrainSeed);
    this.player.sync(s.player, newRound, newHills ? TERRAIN_FADE.delayMs + TERRAIN_FADE.durationMs / 2 : 0);
    this.player.setLives(s.lives, LIVES);
    const destroyed = !newRound && s.lastShot !== prev?.lastShot && s.lastShot?.hit === true;
    // The new search right after a hit (every play mode is a search, amendment 17): the destroyed enemy stays in view
    // during its explosion.
    const searchAfterHit = !newRound && !destroyed && prev?.phase === 'playerShot' && s.phase === 'challenge' && s.lastShot?.hit === true;
    this.drawEnemies(s, prev, newRound, destroyed || searchAfterHit);
    if (!newRound && prev && s.lives < prev.lives) {
      this.effects.hitFlash(this.player);
      this.effects.shake();
    }
    // One miss before the enemy hits, its shell lands beside the child's tank: wobble and heart pulse (FR-100).
    const enemyShellLanded = !newRound && prev?.phase === 'enemyTurn' && s.phase !== 'enemyTurn' && s.phase !== 'paused';
    if (enemyShellLanded && isWarningStreak(s.missStreak, this.controller.getRoundSettings().enemyDifficulty)) {
      this.player.warn();
      this.enemyWarnings++;
    }
    this.game.canvas.dataset.enemyWarnings = String(this.enemyWarnings);
    // Back to the fixed angle once a raised or lifted shot has landed.
    if (!newRound && s.phase !== 'playerShot' && prev?.phase === 'playerShot') this.player.turnTo(fixedAngle(s), PLAYER_TURN_MS);
    if (!newRound && s.lastShot !== prev?.lastShot && s.lastShot?.nearMiss) {
      const id = s.lastShot.nearTankId;
      (id === null ? this.enemy : (this.enemyView(id) ?? this.decoyViews.get(id)))?.shake();
    }
    // The large explosion where the destroyed enemy stood; the hit state itself holds the destroyed enemy.
    const gone = destroyed ? ([s.enemy, ...s.wave].find((t) => t.id === s.lastShot?.hitTankId) ?? s.enemy) : null;
    if (gone) {
      const c = tankCenter(gone);
      this.effects.destroyed(c.x, toScreenY(c.y, WORLD_HEIGHT), BLAST_RADIUS);
      this.effects.shake();
    }
    this.drawDecoys(s, prev, newRound, searchAfterHit);
    this.numberLine.update(s);
    // The previous player path stays as a faint trail until the next player shot (FR-004).
    // New ground has no trail: the controller clears it with new hills, "Neue Landschaft" and a new round (bug report B1).
    const trail = s.phase === 'playerShot' ? null : s.lastPlayerPath;
    this.projectile.setTrail(trail);
    this.game.canvas.dataset.trailPoints = String(trail?.length ?? 0);

    if (s.shot && s.shot !== this.startedShot && (s.phase === 'playerShot' || s.phase === 'enemyTurn')) {
      this.startShot(s.shot);
    }

    const pause = s.phase === 'paused';
    if (pause !== this.pauseAsked) {
      this.pauseAsked = pause;
      if (pause) this.scene.pause();
      else this.scene.resume();
    }
  }

  /**
   * The last destroyed enemy of a wave leaves the state when the next wave is placed; its wreck stays in view during
   * its explosion and then fades out, like a destroyed enemy while others of its wave stand (code review).
   */
  private fadeWreck(view: TankView): void {
    this.fadingWrecks.add(view);
    view.fadeOut(NEW_ENEMY_DELAY_MS);
    this.time.delayedCall(NEW_ENEMY_DELAY_MS + FADE_MS, () => {
      if (!this.fadingWrecks.delete(view)) return;
      view.destroy();
      this.game.canvas.dataset.fadingWrecks = String(this.fadingWrecks.size);
    });
  }

  /** The view of an enemy of the wave by tank id (amendment 21). */
  private enemyView(id: string): TankView | undefined {
    return id === ENEMY_ID ? this.enemy : this.waveViews.get(id);
  }

  /**
   * The enemy and the wave's other enemies (amendment 21). `instant` places them without tweening (a new round, the hit
   * and the search after it). An enemy that comes alive fades in at its number (amendment 07, FR-010); one destroyed
   * while others of its wave stand fades out after its explosion; the last one of a wave too, after the next wave came.
   */
  private drawEnemies(s: RoundState, prev: RoundState | null, newRound: boolean, instant: boolean): void {
    const tanks = [s.enemy, ...s.wave];
    const ids = new Set(tanks.map((t) => t.id));
    for (const [id, view] of this.waveViews) {
      if (ids.has(id)) continue;
      this.waveViews.delete(id);
      // Only the enemy destroyed by the last shot still shows; one destroyed earlier in the wave has already faded out.
      if (!newRound && s.lastShot?.hit && s.lastShot.hitTankId === id) this.fadeWreck(view);
      else view.destroy();
    }
    if (newRound) {
      for (const view of this.fadingWrecks) view.destroy();
      this.fadingWrecks.clear();
    } else if (prev && prev.wave.length > 0 && s.lastShot?.hit && s.lastShot.hitTankId === ENEMY_ID) {
      // The ENEMY_ID view moves on to the next wave at once, so its wreck gets a view of its own (code review).
      const wreck = [prev.enemy, ...prev.wave].find((t) => t.id === ENEMY_ID);
      const next = [s.enemy, ...s.wave].find((t) => t.id === ENEMY_ID);
      if (wreck && !wreck.alive && next?.alive) {
        const view = new TankView(this, 'enemy', WORLD_HEIGHT);
        view.setBarrelAngle(s.playerSide === 'left' ? 150 : 30);
        view.sync(wreck, true);
        this.fadeWreck(view);
      }
    }
    this.game.canvas.dataset.fadingWrecks = String(this.fadingWrecks.size);
    const before = prev === null || newRound ? new Map<string, TankState>() : new Map([prev.enemy, ...prev.wave].map((t) => [t.id, t]));
    const standing = standingEnemies(s).length;
    for (const tank of tanks) {
      let view = this.enemyView(tank.id);
      const created = !view;
      if (!view) {
        view = new TankView(this, 'enemy', WORLD_HEIGHT);
        view.setBarrelAngle(s.playerSide === 'left' ? 150 : 30);
        view.setTarget(true);
        this.waveViews.set(tank.id, view);
      }
      const was = before.get(tank.id);
      view.sync(tank, newRound || created || instant);
      if (newRound) continue;
      if (tank.alive && (was === undefined || !was.alive)) view.appear(this.appearDelay);
      else if (!tank.alive && was?.alive && standing > 0) view.fadeOut(NEW_ENEMY_DELAY_MS);
    }
    // The help target's ring pulses while help shows and 2 or more enemies stand (FR-141).
    const pulse = standing >= 2 && s.phase !== 'roundOver' && s.help.level > 0;
    for (const tank of tanks) this.enemyView(tank.id)?.setTargetPulse(pulse && tank.id === s.enemy.id);
    this.game.canvas.dataset.helpTarget = standing >= 2 ? String(s.enemy.position) : '';
  }

  /**
   * Decoy views of a comparison search (amendment 10, FR-026, FR-066): created with the search, fading in with a new
   * enemy, burst into cardboard at their number, folded away with a destroyed enemy, removed when the search ends.
   */
  private drawDecoys(s: RoundState, prev: RoundState | null, newRound: boolean, searchAfterHit: boolean): void {
    if (newRound) this.decoyBursts = 0;
    const ids = new Set(s.decoys.map((d) => d.id));
    for (const [id, view] of this.decoyViews) {
      if (ids.has(id)) continue;
      this.decoyViews.delete(id);
      if (newRound) view.destroy();
      else {
        view.setTappable(false);
        view.hide(true);
        this.time.delayedCall(FOLD_REMOVE_MS, () => view.destroy());
      }
    }
    const shotChanged = !newRound && s.lastShot !== prev?.lastShot;
    for (const decoy of s.decoys) {
      let view = this.decoyViews.get(decoy.id);
      const created = !view;
      if (!view) {
        view = new TankView(this, 'decoy', WORLD_HEIGHT, () => this.controller.tapTank(decoy.id));
        view.setBarrelAngle(s.playerSide === 'left' ? 150 : 30);
        view.setTarget(true);
        this.decoyViews.set(decoy.id, view);
        if (searchAfterHit) view.appear(this.appearDelay);
      }
      view.sync({ ...decoy, alive: true }, created);
      const wasAlive = prev?.decoys.find((d) => d.id === decoy.id)?.alive ?? decoy.alive;
      if (wasAlive && !decoy.alive) {
        if (shotChanged && s.lastShot?.decoyHit && s.lastShot.hitTankId === decoy.id) {
          // A decoy hit at its number bursts like a cardboard dummy and is gone (FR-066).
          const c = tankCenter(decoy);
          this.effects.cardboard(c.x, toScreenY(c.y, WORLD_HEIGHT));
          this.effects.shake();
          view.hide(false);
          this.decoyBursts++;
        } else {
          // The enemy was destroyed: the remaining decoys fold away (fade out).
          view.hide(true);
        }
      } else if (!decoy.alive) {
        view.hide(false);
      }
    }

    // Taps, the help mark and the test attributes.
    const choosing = s.phase === 'challenge' && s.decoys.length > 0;
    const standing: Array<{ tank: TankState; view: TankView }> = [];
    for (const tank of [s.enemy, ...s.wave]) {
      const view = this.enemyView(tank.id);
      if (view && tank.alive) standing.push({ tank, view });
    }
    for (const decoy of s.decoys) {
      const view = this.decoyViews.get(decoy.id);
      if (view && decoy.alive) standing.push({ tank: decoy, view });
    }
    standing.sort((a, b) => a.tank.position - b.tank.position);
    this.enemy.setTappable(choosing && s.enemy.alive);
    for (const decoy of s.decoys) this.decoyViews.get(decoy.id)?.setTappable(choosing && decoy.alive);
    const marked = s.decoys.length > 0 && s.enemy.alive && s.phase !== 'roundOver' && s.help.content?.solution != null;
    this.enemy.setMark(marked);
    const canvas = this.game.canvas;
    canvas.dataset.enemyTanks = String(standing.length);
    canvas.dataset.tankTaps = choosing
      ? standing
          .map(({ tank, view }) => {
            const p = view.tapCenter();
            return `${tank.position}@${Math.round(p.x)},${Math.round(p.y)}`;
          })
          .join(';')
      : '';
    canvas.dataset.decoyBursts = String(this.decoyBursts);
    canvas.dataset.helpTanks = marked ? String(s.enemy.position) : '';
  }

  private showYouMarker(): void {
    const canvas = this.game.canvas;
    canvas.dataset.youMarker = 'on';
    this.player.showYouMarker(YOU_MARKER_MS, () => {
      canvas.dataset.youMarker = 'off';
    });
  }

  private startShot(shot: ShotInFlight): void {
    this.startedShot = shot;
    const angle = launchAngle(shot.path);
    if (shot.shooter === 'player') {
      // The turret stays at the fixed angle unless the arc had to be raised or lifted.
      const fixed = fixedAngle(this.controller.getState());
      if (angle === null || Math.abs(angle - fixed) < 1) {
        this.fire(shot);
        return;
      }
      this.player.turnTo(angle, PLAYER_TURN_MS);
      this.fireAfter(shot, PLAYER_TURN_MS);
      return;
    }
    // The enemy turns its turret toward its aim. In a comparison turn every standing decoy turns toward its own aim at
    // the same time and fires with it, so the volley does not show which tank is the enemy (bug report B2, FR-043a).
    if (angle !== null) this.shooterView(shot).turnTo(angle, ENEMY_TURN_MS);
    for (const d of shot.decoyShells) {
      const a = launchAngle(d.path);
      if (a !== null) this.decoyViews.get(d.shooterId)?.turnTo(a, ENEMY_TURN_MS);
    }
    this.game.canvas.dataset.enemyVolley = [shot.path[0], ...shot.decoyShells.map((d) => d.path[0])]
      .map((p) => Math.round(p?.x ?? 0))
      .sort((a, b) => a - b)
      .join(';');
    this.fireAfter(shot, ENEMY_FIRE_DELAY_MS);
  }

  /** The enemy view that fires an enemy shell: the tank in shooterId in a wave (amendment 21), otherwise the enemy. */
  private shooterView(shot: ShotInFlight): TankView {
    return (shot.shooterId === undefined ? undefined : this.enemyView(shot.shooterId)) ?? this.enemy;
  }

  private fireAfter(shot: ShotInFlight, ms: number): void {
    this.pendingFire = this.time.delayedCall(ms, () => {
      this.pendingFire = null;
      if (this.startedShot === shot) this.fire(shot);
    });
  }

  private fire(shot: ShotInFlight): void {
    this.sounds?.shot();
    // Recoil, muzzle flash and smoke on every tank that fires (amendment 14, FR-111).
    const shooters = [shot.shooter === 'player' ? this.player : this.shooterView(shot), ...shot.decoyShells.map((d) => this.decoyViews.get(d.shooterId))];
    for (const view of shooters) view?.fire();
    this.muzzleFlashes += shooters.filter(Boolean).length;
    this.game.canvas.dataset.muzzleFlashes = String(this.muzzleFlashes);
    if (shot.decoyShells.length === 0) {
      this.projectile.play(shot, () => this.landed(shot));
      return;
    }
    // A comparison volley (bug report B2): every shell explodes where it lands, and the controller hears of the
    // enemy's shell once the last shell is down, so neither the explosions nor the timing show which shell is real.
    this.projectile.play(
      shot,
      () => this.controller.enemyShotAnimationDone(),
      (_, impact) => {
        this.effects.explosion(impact.x, toScreenY(impact.y, WORLD_HEIGHT), BLAST_RADIUS);
        this.sounds?.boom();
      },
    );
  }

  private landed(shot: ShotInFlight): void {
    const y = toScreenY(shot.impact.y, WORLD_HEIGHT);
    this.effects.explosion(shot.impact.x, y, BLAST_RADIUS);
    // The controller applies the crater and damage; its update redraws the terrain right away.
    // Every destroyed enemy, also one that does not count (amendment 18).
    const before = this.controller.getState();
    if (shot.shooter === 'player') this.controller.shotAnimationDone();
    else this.controller.enemyShotAnimationDone();
    // The same soft boom for every explosion, a miss included, and the soft chime after a hit (FR-009, AC-07); a hit
    // that does not count raises enemiesHit but not enemiesDestroyed, and gets no chime (amendment 18).
    const after = this.controller.getState();
    const destroyedEnemy = shot.shooter === 'player' && after.enemiesHit > before.enemiesHit;
    const uncounted = destroyedEnemy && after.enemiesDestroyed === before.enemiesDestroyed;
    // A burst decoy plays only the light plopp (amendment 10, FR-066).
    const burstDecoy = shot.shooter === 'player' && after.lastShot?.decoyHit === true;
    for (const sound of landingSounds({ destroyedEnemy, uncounted, burstDecoy })) {
      this.sounds?.[sound]();
      if (sound === 'chime') this.game.canvas.dataset.chimes = String(++this.chimes);
    }
  }
}

/** The player's fixed cannon angle toward the enemy side, in physics degrees (0 right, 90 up). */
function fixedAngle(s: RoundState): number {
  return s.playerSide === 'left' ? FIXED_ANGLE_DEG : 180 - FIXED_ANGLE_DEG;
}
