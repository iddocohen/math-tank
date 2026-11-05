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
 *   around the enemy. The enemy does not turn its turret before a shell from the top edge. For the end-to-end tests
 *   only, the canvas carries `data-enemy-tanks` (standing tanks that look like the enemy), `data-tank-taps`
 *   (`<number>@<x>,<y>` of each tappable tank, in world units), `data-decoy-bursts` (decoys burst this round) and
 *   `data-help-tanks` (the number of the tank marked by help step 3, or '').
 * - While the phase is 'paused' the scene is paused, which stops update(), tweens, timers and particles.
 */
import Phaser from 'phaser';
import type { BattleController } from '../core/battle/controller';
import { tankCenter, WORLD_HEIGHT, WORLD_WIDTH } from '../core/battle/round';
import { BLAST_RADIUS } from '../core/physics/damage';
import { FIXED_ANGLE_DEG } from '../core/physics/arc';
import { LIVES } from '../core/battle/hitRule';
import type { RoundState, ShotInFlight, TankState } from '../core/types';
import { launchAngle, toScreenY } from '../core/view/geometry';
import { YOU_MARKER_MS } from '../core/view/tankStyle';
import { Effects } from './effects';
import { NumberLineView } from './NumberLineView';
import { ProjectileView } from './ProjectileView';
import { TankView } from './TankView';
import { TerrainView } from './TerrainView';
import { ensureTextures, TEX } from './textures';
import { landingSounds } from '../audio/sfx';

/** Sound hooks the scene calls; src/audio/sfx.ts provides them. */
export interface BattleSounds {
  shot(): void;
  boom(): void;
  chime(): void;
  plopp(): void;
}

export interface BattleSceneOptions {
  sounds?: BattleSounds;
}

/** The player's turret turns to a raised or lifted arc over this time before the shell leaves. */
const PLAYER_TURN_MS = 250;
/** A new enemy fades in after the large explosion of the destroyed one. */
const NEW_ENEMY_DELAY_MS = 600;
/** The enemy turns its cannon, then fires after this pause, so the child can follow. */
const ENEMY_TURN_MS = 450;
const ENEMY_FIRE_DELAY_MS = 700;
/** A folded decoy view is removed once its fade-out is over. */
const FOLD_REMOVE_MS = 800;

export class BattleScene extends Phaser.Scene {
  private readonly controller: BattleController;
  private readonly sounds: BattleSounds | undefined;
  private unsubscribe: (() => void) | null = null;
  private terrain!: TerrainView;
  private player!: TankView;
  private enemy!: TankView;
  /** Decoy views by tank id, for the decoys of the current comparison search (amendment 10). */
  private readonly decoyViews = new Map<string, TankView>();
  private decoyBursts = 0;
  private projectile!: ProjectileView;
  private effects!: Effects;
  private numberLine!: NumberLineView;
  private prev: RoundState | null = null;
  /** The shot whose replay has been started, so a state update never starts it twice. */
  private startedShot: ShotInFlight | null = null;
  private pendingFire: Phaser.Time.TimerEvent | null = null;

  constructor(controller: BattleController, options: BattleSceneOptions = {}) {
    super('battle');
    this.controller = controller;
    this.sounds = options.sounds;
  }

  create(): void {
    ensureTextures(this, WORLD_WIDTH, WORLD_HEIGHT);
    this.add.image(0, 0, TEX.sky).setOrigin(0, 0);
    this.terrain = new TerrainView(this, WORLD_HEIGHT);
    this.projectile = new ProjectileView(this, WORLD_WIDTH, WORLD_HEIGHT);
    this.player = new TankView(this, 'player', WORLD_HEIGHT);
    this.enemy = new TankView(this, 'enemy', WORLD_HEIGHT, () => this.controller.tapTank(this.controller.getState().enemy.id));
    this.numberLine = new NumberLineView(this, this.controller, WORLD_HEIGHT);
    this.effects = new Effects(this);
    this.prev = null;
    this.startedShot = null;

    this.unsubscribe = this.controller.subscribe((s) => this.draw(s));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.teardown, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.teardown, this);
    this.draw(this.controller.getState());
  }

  update(_time: number, delta: number): void {
    this.projectile.advance(delta);
  }

  private teardown(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    for (const view of this.decoyViews.values()) view.destroy();
    this.decoyViews.clear();
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
      this.enemy.setAim(s.playerSide === 'left' ? 150 : 30);
      this.player.setAim(fixedAngle(s));
      this.enemy.setTarget(true);
      if (s.phase !== 'roundOver') this.showYouMarker();
    }

    this.terrain.update(s.terrain);
    this.player.sync(s.player, newRound);
    this.player.setLives(s.lives, LIVES);
    const destroyed = !newRound && s.lastShot !== prev?.lastShot && s.lastShot?.hit === true;
    // The new search right after a guided hit: the destroyed enemy stays in view during its explosion.
    const searchAfterHit = !newRound && !destroyed && s.mode === 'guided' && prev?.phase === 'playerShot' && s.phase === 'challenge' && s.lastShot?.hit === true;
    this.enemy.sync(s.enemy, newRound || destroyed || searchAfterHit);
    // The new enemy is visible in every challenge kind and fades in at its number (amendment 07, FR-010).
    if (searchAfterHit) this.enemy.appear(NEW_ENEMY_DELAY_MS);
    if (!newRound && prev && s.lives < prev.lives) this.effects.hitFlash(this.player);
    // Back to the fixed angle once a raised or lifted shot has landed.
    if (!newRound && s.phase !== 'playerShot' && prev?.phase === 'playerShot') this.player.turnTo(fixedAngle(s), PLAYER_TURN_MS);
    if (!newRound && s.lastShot !== prev?.lastShot && s.lastShot?.nearMiss) {
      const id = s.lastShot.nearTankId;
      (id === null || id === s.enemy.id ? this.enemy : this.decoyViews.get(id))?.shake();
    }
    // The large explosion where the destroyed enemy stood. In free play the previous state holds the destroyed enemy
    // and the new one fades in at its new number; in a guided search the hit state itself holds the destroyed enemy.
    const gone = destroyed ? (s.mode === 'guided' ? s.enemy : (prev?.enemy ?? s.enemy)) : null;
    if (gone) {
      const c = tankCenter(gone);
      this.effects.destroyed(c.x, toScreenY(c.y, WORLD_HEIGHT), BLAST_RADIUS);
      if (s.mode !== 'guided') this.enemy.appear(NEW_ENEMY_DELAY_MS);
    }
    this.drawDecoys(s, prev, newRound, searchAfterHit);
    this.numberLine.update(s);
    // The previous player path stays as a faint trail until the next player shot (FR-004).
    this.projectile.setTrail(s.phase === 'playerShot' ? null : s.lastPlayerPath);

    if (s.shot && s.shot !== this.startedShot && (s.phase === 'playerShot' || s.phase === 'enemyTurn')) {
      this.startShot(s.shot);
    }

    if (s.phase === 'paused' && !this.scene.isPaused()) this.scene.pause();
    else if (s.phase !== 'paused' && this.scene.isPaused()) this.scene.resume();
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
        view.setHidden(true, true);
        this.time.delayedCall(FOLD_REMOVE_MS, () => view.destroy());
      }
    }
    const shotChanged = !newRound && s.lastShot !== prev?.lastShot;
    for (const decoy of s.decoys) {
      let view = this.decoyViews.get(decoy.id);
      const created = !view;
      if (!view) {
        view = new TankView(this, 'decoy', WORLD_HEIGHT, () => this.controller.tapTank(decoy.id));
        view.setAim(s.playerSide === 'left' ? 150 : 30);
        view.setTarget(true);
        this.decoyViews.set(decoy.id, view);
        if (searchAfterHit) view.appear(NEW_ENEMY_DELAY_MS);
      }
      view.sync({ ...decoy, alive: true }, created);
      const wasAlive = prev?.decoys.find((d) => d.id === decoy.id)?.alive ?? decoy.alive;
      if (wasAlive && !decoy.alive) {
        if (shotChanged && s.lastShot?.decoyHit && s.lastShot.hitTankId === decoy.id) {
          // A decoy hit at its number bursts like a cardboard dummy and is gone (FR-066).
          const c = tankCenter(decoy);
          this.effects.cardboard(c.x, toScreenY(c.y, WORLD_HEIGHT));
          view.setHidden(true, false);
          this.decoyBursts++;
        } else {
          // The enemy was destroyed: the remaining decoys fold away (fade out).
          view.setHidden(true, true);
        }
      } else if (!decoy.alive) {
        view.setHidden(true, false);
      }
    }

    // Taps, the help mark and the test attributes.
    const choosing = s.phase === 'challenge' && s.decoys.length > 0;
    const standing: Array<{ tank: TankState; view: TankView }> = [];
    if (s.enemy.alive) standing.push({ tank: s.enemy, view: this.enemy });
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
    // The enemy turns its turret toward its aim, except before a shell from the top edge in a comparison turn, which
    // must not show which tank is the enemy (amendment 10, FR-043a).
    if (angle !== null && this.controller.getState().decoys.length === 0) this.enemy.turnTo(angle, ENEMY_TURN_MS);
    this.fireAfter(shot, ENEMY_FIRE_DELAY_MS);
  }

  private fireAfter(shot: ShotInFlight, ms: number): void {
    this.pendingFire = this.time.delayedCall(ms, () => {
      this.pendingFire = null;
      if (this.startedShot === shot) this.fire(shot);
    });
  }

  private fire(shot: ShotInFlight): void {
    this.sounds?.shot();
    this.projectile.play(shot, () => this.landed(shot));
  }

  private landed(shot: ShotInFlight): void {
    const y = toScreenY(shot.impact.y, WORLD_HEIGHT);
    if (shot.outOfBounds) this.effects.puff(shot.impact.x, y);
    else this.effects.explosion(shot.impact.x, y, shot.blastRadius);
    // The controller applies the crater and damage; its update redraws the terrain right away.
    const before = this.controller.getState().enemiesDestroyed;
    if (shot.shooter === 'player') this.controller.shotAnimationDone();
    else this.controller.enemyShotAnimationDone();
    // The same soft boom for every explosion, a miss included, and the soft chime after a hit (FR-009, AC-07).
    const destroyedEnemy = shot.shooter === 'player' && this.controller.getState().enemiesDestroyed > before;
    // A burst decoy plays only the light plopp (amendment 10, FR-066).
    const burstDecoy = shot.shooter === 'player' && this.controller.getState().lastShot?.decoyHit === true;
    for (const sound of landingSounds({ outOfBounds: shot.outOfBounds, destroyedEnemy, burstDecoy })) this.sounds?.[sound]();
  }
}

/** The player's fixed cannon angle toward the enemy side, in physics degrees (0 right, 90 up). */
function fixedAngle(s: RoundState): number {
  return s.playerSide === 'left' ? FIXED_ANGLE_DEG : 180 - FIXED_ANGLE_DEG;
}
