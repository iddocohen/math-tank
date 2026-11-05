/**
 * One tank on screen (FR-006, FR-007): body, turret rotated by the aim angle, health bar.
 * After the terrain changes the tank moves down to the new surface with a short tween.
 * Fade in and out and a fully hidden state are here for the search turns of later phases.
 */
import Phaser from 'phaser';
import type { TankState } from '../core/types';
import { toScreenY } from '../core/view/geometry';
import { TANK_BODY_HEIGHT, TEX } from './textures';

const COLORS: Record<TankState['kind'], number> = {
  player: 0x3d7be0,
  enemy: 0xd9534f,
  decoy: 0x9aa3ad,
};
/** Turret pivot above the tank base, matching the muzzle height in core/battle/round.ts. */
const TURRET_PIVOT = 28;
const BAR_WIDTH = 56;
const BAR_HEIGHT = 8;
const BAR_OFFSET = TANK_BODY_HEIGHT + 30;
const SETTLE_MS = 450;
const FADE_MS = 500;

export class TankView {
  readonly container: Phaser.GameObjects.Container;
  private readonly body: Phaser.GameObjects.Image;
  private readonly turret: Phaser.GameObjects.Image;
  private readonly bar: Phaser.GameObjects.Graphics;
  private readonly color: number;
  private tint: number;
  private lastY: number | null = null;
  private lastHealth = -1;
  private hidden = false;

  constructor(
    private readonly scene: Phaser.Scene,
    kind: TankState['kind'],
    private readonly worldHeight: number,
  ) {
    this.color = COLORS[kind];
    this.tint = this.color;
    this.turret = scene.add.image(0, -TURRET_PIVOT, TEX.turret).setOrigin(0, 0.5).setTint(this.color);
    this.body = scene.add.image(0, 0, TEX.tankBody).setOrigin(0.5, 1).setTint(this.color);
    this.bar = scene.add.graphics();
    this.container = scene.add.container(0, 0, [this.turret, this.body, this.bar]);
  }

  /**
   * Shows the tank state. `instant` places it without tweening (new round or first draw).
   */
  sync(tank: TankState, instant: boolean): void {
    const y = toScreenY(tank.y, this.worldHeight);
    this.container.x = tank.x;
    if (instant || this.lastY === null) {
      this.scene.tweens.killTweensOf(this.container);
      this.container.y = y;
      if (!this.hidden) this.container.alpha = 1;
    } else if (y !== this.lastY) {
      this.scene.tweens.add({ targets: this.container, y, duration: SETTLE_MS, ease: 'Quad.easeIn' });
    }
    this.lastY = y;

    if (tank.health !== this.lastHealth) {
      this.lastHealth = tank.health;
      this.drawBar(tank.health);
    }
    this.tint = tank.alive ? this.color : 0x555555;
    this.body.setTint(this.tint);
    this.turret.setTint(this.tint);
  }

  /** Physics angle (0 right, 90 up, 180 left); Phaser angles turn clockwise on screen. */
  setAim(angleDeg: number): void {
    this.turret.setAngle(-angleDeg);
  }

  /** Turns the turret over `ms` milliseconds, e.g. before the enemy fires. */
  turnTo(angleDeg: number, ms: number): void {
    this.scene.tweens.add({ targets: this.turret, angle: -angleDeg, duration: ms, ease: 'Sine.easeInOut' });
  }

  /** Hidden tanks draw nothing; `fade` blends in or out instead of switching at once. */
  setHidden(hidden: boolean, fade: boolean): void {
    if (hidden === this.hidden) return;
    this.hidden = hidden;
    const alpha = hidden ? 0 : 1;
    if (fade) {
      this.scene.tweens.add({ targets: this.container, alpha, duration: FADE_MS });
    } else {
      this.container.alpha = alpha;
    }
  }

  /** Short white flash when the tank takes damage (FR-009). */
  flash(): void {
    const parts = [this.body, this.turret];
    const on = () => parts.forEach((p) => p.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL));
    const off = () => parts.forEach((p) => p.setTintMode(Phaser.TintModes.MULTIPLY).setTint(this.tint));
    on();
    this.scene.time.delayedCall(90, off);
    this.scene.time.delayedCall(180, on);
    this.scene.time.delayedCall(270, off);
  }

  private drawBar(health: number): void {
    const g = this.bar;
    const x = -BAR_WIDTH / 2;
    const y = -BAR_OFFSET;
    const fill = health > 50 ? 0x4caf50 : health > 25 ? 0xf0ad4e : 0xe57373;
    g.clear();
    g.fillStyle(0x1b1f27, 0.6);
    g.fillRoundedRect(x - 2, y - 2, BAR_WIDTH + 4, BAR_HEIGHT + 4, 4);
    if (health > 0) {
      g.fillStyle(fill, 1);
      g.fillRoundedRect(x, y, (BAR_WIDTH * health) / 100, BAR_HEIGHT, 3);
    }
  }

  destroy(): void {
    this.scene.tweens.killTweensOf([this.container, this.turret]);
    this.container.destroy();
  }
}
