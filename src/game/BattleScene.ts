/**
 * The battle scene (FR-002 to FR-005, FR-054, research R4). It only draws BattleController state
 * and reports when a shell animation has finished; all rules live in src/core.
 *
 * - Subscribes to the controller in create() and unsubscribes on shutdown.
 * - Replays the shell path in state.shot, then calls shotAnimationDone or enemyShotAnimationDone.
 * - Dragging near the player's cannon sets the angle (setAim); power stays as it is.
 * - While the phase is 'paused' the scene is paused, which stops update(), tweens, timers and particles.
 */
import Phaser from 'phaser';
import type { BattleController } from '../core/battle/controller';
import { muzzle, WORLD_HEIGHT, WORLD_WIDTH } from '../core/battle/round';
import type { RoundState, ShotInFlight, TankState } from '../core/types';
import { aimAngleFromPointer, launchAngle, toScreenY } from '../core/view/geometry';
import { Effects } from './effects';
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

/** How far from the muzzle (world units) a press still grabs the cannon. */
const GRAB_RADIUS = 150;
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
  private prev: RoundState | null = null;
  /** The shot whose replay has been started, so a state update never starts it twice. */
  private startedShot: ShotInFlight | null = null;
  private pendingEnemyFire: Phaser.Time.TimerEvent | null = null;
  private dragging = false;

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
    this.effects = new Effects(this);
    this.prev = null;
    this.startedShot = null;

    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    this.input.on(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove, this);
    this.input.on(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
    this.input.on(Phaser.Input.Events.GAME_OUT, this.onPointerUp, this);

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
    this.input.off(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    this.input.off(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove, this);
    this.input.off(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
    this.input.off(Phaser.Input.Events.GAME_OUT, this.onPointerUp, this);
  }

  private draw(s: RoundState): void {
    const prev = this.prev;
    const newRound = prev === null || prev.seed !== s.seed;
    this.prev = s;

    if (newRound) {
      this.projectile.stop();
      this.pendingEnemyFire?.remove();
      this.pendingEnemyFire = null;
      this.startedShot = null;
      this.dragging = false;
      this.enemy.setAim(s.player.x < s.enemy.x ? 150 : 30);
    }

    this.terrain.update(s.terrain);
    this.syncTank(this.player, s.player, prev?.player, newRound);
    this.syncTank(this.enemy, s.enemy, prev?.enemy, newRound);
    this.enemy.setHidden(!s.enemyFound, !newRound);
    this.player.setAim(s.aim.angleDeg);
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
    if (shot.shooter === 'player') {
      this.fire(shot);
      return;
    }
    const angle = launchAngle(shot.path);
    if (angle !== null) this.enemy.turnTo(angle, ENEMY_TURN_MS);
    this.pendingEnemyFire = this.time.delayedCall(ENEMY_FIRE_DELAY_MS, () => {
      this.pendingEnemyFire = null;
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

  private onPointerDown(p: Phaser.Input.Pointer): void {
    const s = this.controller.getState();
    if (s.phase !== 'aiming') return;
    const m = muzzle(s.player);
    if (Math.hypot(p.worldX - m.x, p.worldY - toScreenY(m.y, WORLD_HEIGHT)) > GRAB_RADIUS) return;
    this.dragging = true;
    this.aimAt(p);
  }

  private onPointerMove(p: Phaser.Input.Pointer): void {
    if (this.dragging) this.aimAt(p);
  }

  private onPointerUp(): void {
    this.dragging = false;
  }

  private aimAt(p: Phaser.Input.Pointer): void {
    const s = this.controller.getState();
    if (s.phase !== 'aiming') {
      this.dragging = false;
      return;
    }
    const angle = aimAngleFromPointer(muzzle(s.player), { x: p.worldX, y: toScreenY(p.worldY, WORLD_HEIGHT) });
    if (angle === null) return;
    const rounded = Math.round(angle);
    if (rounded !== s.aim.angleDeg) this.controller.setAim(rounded, s.aim.power);
  }
}
