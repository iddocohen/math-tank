/**
 * The battle scene (FR-002 to FR-005, FR-054, research R4). It only draws BattleController state
 * and reports when a shell animation has finished; all rules live in src/core.
 *
 * - Subscribes to the controller in create() and unsubscribes on shutdown.
 * - Replays the shell path in state.shot, then calls shotAnimationDone or enemyShotAnimationDone.
 * - The ruler (NumberLineView) handles tapping and dragging; the cannon cannot be dragged (FR-003).
 * - The player's turret shows the fixed 65-degree angle and turns to the arc's launch angle just before a
 *   raised or lifted shot (FR-065). The enemy shakes when the player's shell lands near it (lastShot.nearMiss).
 * - While the phase is 'paused' the scene is paused, which stops update(), tweens, timers and particles.
 */
import Phaser from 'phaser';
import type { BattleController } from '../core/battle/controller';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../core/battle/round';
import { FIXED_ANGLE_DEG } from '../core/physics/arc';
import type { RoundState, ShotInFlight, TankState } from '../core/types';
import { launchAngle, toScreenY } from '../core/view/geometry';
import { Effects } from './effects';
import { NumberLineView } from './NumberLineView';
import { ProjectileView } from './ProjectileView';
import { TankView } from './TankView';
import { TerrainView } from './TerrainView';
import { ensureTextures, TEX } from './textures';

/** Sound hooks the scene calls; src/audio/sfx.ts provides them. */
export interface BattleSounds {
  shot(): void;
  boom(): void;
}

export interface BattleSceneOptions {
  sounds?: BattleSounds;
}

/** The player's turret turns to a raised or lifted arc over this time before the shell leaves. */
const PLAYER_TURN_MS = 250;
/** The enemy turns its cannon, then fires after this pause, so the child can follow. */
const ENEMY_TURN_MS = 450;
const ENEMY_FIRE_DELAY_MS = 700;

export class BattleScene extends Phaser.Scene {
  private readonly controller: BattleController;
  private readonly sounds: BattleSounds | undefined;
  private unsubscribe: (() => void) | null = null;
  private terrain!: TerrainView;
  private player!: TankView;
  private enemy!: TankView;
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
    this.enemy = new TankView(this, 'enemy', WORLD_HEIGHT);
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
      this.enemy.setAim(s.player.x < s.enemy.x ? 150 : 30);
      this.player.setAim(fixedAngle(s));
    }

    this.terrain.update(s.terrain);
    this.syncTank(this.player, s.player, prev?.player, newRound);
    this.syncTank(this.enemy, s.enemy, prev?.enemy, newRound);
    this.enemy.setHidden(!s.enemyFound, !newRound);
    // Back to the fixed angle once a raised or lifted shot has landed.
    if (!newRound && s.phase !== 'playerShot' && prev?.phase === 'playerShot') this.player.turnTo(fixedAngle(s), PLAYER_TURN_MS);
    if (!newRound && s.lastShot !== prev?.lastShot && s.lastShot?.nearMiss) this.enemy.shake();
    this.numberLine.update(s);
    // The previous player path stays as a faint trail until the next player shot (FR-004).
    this.projectile.setTrail(s.phase === 'playerShot' ? null : s.lastPlayerPath);

    if (s.shot && s.shot !== this.startedShot && (s.phase === 'playerShot' || s.phase === 'enemyTurn')) {
      this.startShot(s.shot);
    }

    if (s.phase === 'paused' && !this.scene.isPaused()) this.scene.pause();
    else if (s.phase !== 'paused' && this.scene.isPaused()) this.scene.resume();
  }

  private syncTank(view: TankView, tank: TankState, before: TankState | undefined, newRound: boolean): void {
    view.sync(tank, newRound);
    if (!newRound && before && tank.health < before.health) this.effects.hitFlash(view);
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
    if (angle !== null) this.enemy.turnTo(angle, ENEMY_TURN_MS);
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
    if (shot.outOfBounds) {
      this.effects.puff(shot.impact.x, y);
    } else {
      this.effects.explosion(shot.impact.x, y, shot.blastRadius);
      this.sounds?.boom();
    }
    // The controller applies the crater and damage; its update redraws the terrain right away.
    if (shot.shooter === 'player') this.controller.shotAnimationDone();
    else this.controller.enemyShotAnimationDone();
  }
}

/** The player's fixed cannon angle toward the enemy side, in physics degrees (0 right, 90 up). */
function fixedAngle(s: RoundState): number {
  return s.playerSide === 'left' ? FIXED_ANGLE_DEG : 180 - FIXED_ANGLE_DEG;
}
