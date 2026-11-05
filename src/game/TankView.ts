/**
 * One tank on screen (FR-006, FR-007): body, turret rotated by the cannon angle, health bar.
 * The player's turret shows the fixed angle (FR-065); `shake` shows a near miss without damage (FR-066).
 * After the terrain changes the tank moves down to the new surface with a short tween.
 * Fade in and out and a fully hidden state are here for the search turns of later phases.
 * `setBullseye` draws a target on the tank's center line while "Genau treffen" is on (amendment 04, FR-074).
 *
 * Amendment 05 (FR-077, FR-078): the look comes from tankStyle. The child's tank is blue and rounded with a yellow
 * star flag on its antenna; the enemy and decoys are dark red and angular with a black flag. The health bar sits
 * directly above the tank in the tank's color, with no text. `showYouMarker` shows a bouncing arrow with "Du" over
 * the child's tank.
 */
import Phaser from 'phaser';
import type { TankState } from '../core/types';
import { toScreenY } from '../core/view/geometry';
import { tankStyle, type TankStyle } from '../core/view/tankStyle';
import { t } from '../i18n';
import { TANK_BODY_HEIGHT, TEX } from './textures';

/** Turret pivot above the tank base, matching the muzzle height in core/battle/round.ts. */
const TURRET_PIVOT = 28;
const BAR_WIDTH = 64;
const BAR_HEIGHT = 10;
/** Above the antenna flag and the turret at its fixed angle. */
const BAR_OFFSET = 86;
/** Antenna at the rear of the hull, flag at its top. */
const ANTENNA_X = -20;
const ANTENNA_TOP = -TANK_BODY_HEIGHT - 36;
const FLAG_W = 22;
const FLAG_H = 15;
/** The "Du" arrow: its tip this far above the tank base, bouncing by YOU_BOUNCE. */
const YOU_TIP = BAR_OFFSET + 10;
const YOU_BOUNCE = 14;
const YOU_COLOR = 0xffd54a;
const SETTLE_MS = 450;
const FADE_MS = 500;
const SHAKE_PX = 6;
const SHAKE_MS = 50;

export class TankView {
  readonly container: Phaser.GameObjects.Container;
  private readonly body: Phaser.GameObjects.Image;
  private readonly turret: Phaser.GameObjects.Image;
  private readonly bar: Phaser.GameObjects.Graphics;
  private readonly bullseye: Phaser.GameObjects.Graphics;
  private readonly flag: Phaser.GameObjects.Graphics;
  private readonly you: Phaser.GameObjects.Container;
  private youTimer: Phaser.Time.TimerEvent | null = null;
  private readonly style: TankStyle;
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
    this.style = tankStyle(kind);
    this.color = this.style.color;
    this.tint = this.color;
    this.turret = scene.add.image(0, -TURRET_PIVOT, TEX.turret).setOrigin(0, 0.5).setTint(this.color);
    const bodyTexture = this.style.body === 'angular' ? TEX.tankBodyAngular : TEX.tankBody;
    this.body = scene.add.image(0, 0, bodyTexture).setOrigin(0.5, 1).setTint(this.color);
    this.flag = scene.add.graphics();
    drawFlag(this.flag, this.style.flag);
    this.bar = scene.add.graphics();
    this.bullseye = scene.add.graphics().setVisible(false);
    drawBullseye(this.bullseye);
    this.you = createYouMarker(scene).setVisible(false);
    this.container = scene.add.container(0, 0, [this.flag, this.turret, this.body, this.bullseye, this.bar, this.you]);
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

  /** Shows or hides the bullseye on the tank's center line ("Genau treffen", FR-074). */
  setBullseye(on: boolean): void {
    this.bullseye.setVisible(on);
  }

  /**
   * The "Du" arrow over the child's tank for `ms` milliseconds (FR-077); calling it again restarts it.
   * `onEnd` runs when it disappears.
   */
  showYouMarker(ms: number, onEnd?: () => void): void {
    this.youTimer?.remove();
    this.scene.tweens.killTweensOf(this.you);
    this.you.setVisible(true).setY(0);
    this.scene.tweens.add({ targets: this.you, y: -YOU_BOUNCE, duration: 350, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.youTimer = this.scene.time.delayedCall(ms, () => {
      this.youTimer = null;
      this.scene.tweens.killTweensOf(this.you);
      this.you.setVisible(false);
      onEnd?.();
    });
  }

  /** Short side-to-side shake of body and turret; the container keeps its position on the number. */
  shake(): void {
    const parts = [this.body, this.turret, this.bullseye, this.flag];
    this.scene.tweens.add({ targets: parts, x: SHAKE_PX, duration: SHAKE_MS, yoyo: true, repeat: 3, ease: 'Sine.easeInOut', onComplete: () => parts.forEach((p) => (p.x = 0)) });
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
    g.clear();
    // Dark outline and empty track, then the fill in the tank's own color (FR-078); no text.
    g.fillStyle(0x10141c, 0.85);
    g.fillRoundedRect(x - 3, y - 3, BAR_WIDTH + 6, BAR_HEIGHT + 6, 5);
    g.fillStyle(0xffffff, 0.25);
    g.fillRoundedRect(x, y, BAR_WIDTH, BAR_HEIGHT, 3);
    if (health > 0) {
      g.fillStyle(this.style.barColor, 1);
      g.fillRoundedRect(x, y, (BAR_WIDTH * health) / 100, BAR_HEIGHT, 3);
    }
  }

  destroy(): void {
    this.youTimer?.remove();
    this.scene.tweens.killTweensOf([this.container, this.turret, this.body, this.bullseye, this.flag, this.you]);
    this.container.destroy();
  }
}

/** Two rings and a dot on the body's center line: the exact number is the only place that hits. */
function drawBullseye(g: Phaser.GameObjects.Graphics): void {
  const y = -TANK_BODY_HEIGHT / 2;
  g.fillStyle(0xffffff, 1);
  g.fillCircle(0, y, 11);
  g.fillStyle(0xd32f2f, 1);
  g.fillCircle(0, y, 8);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(0, y, 5);
  g.fillStyle(0xd32f2f, 1);
  g.fillCircle(0, y, 2.5);
}

/** Antenna with its flag: a yellow flag with a dark blue star for the child, a black pennant for the enemy (FR-077). */
function drawFlag(g: Phaser.GameObjects.Graphics, flag: TankStyle['flag']): void {
  const base = -TANK_BODY_HEIGHT + 8;
  g.lineStyle(3, 0x2b2f36, 1);
  g.lineBetween(ANTENNA_X, base, ANTENNA_X, ANTENNA_TOP);
  const x = ANTENNA_X + 1;
  const y = ANTENNA_TOP;
  if (flag === 'yellowStar') {
    g.fillStyle(0xffd23f, 1);
    g.fillRect(x, y, FLAG_W, FLAG_H);
    g.lineStyle(1.5, 0x1b1f27, 1);
    g.strokeRect(x, y, FLAG_W, FLAG_H);
    g.fillStyle(0x1d3f8f, 1);
    g.fillPoints(starPoints(x + FLAG_W / 2, y + FLAG_H / 2, 6, 2.6), true);
  } else {
    g.fillStyle(0x111111, 1);
    g.fillTriangle(x, y, x + FLAG_W + 2, y + FLAG_H / 2, x, y + FLAG_H);
  }
}

function starPoints(cx: number, cy: number, outer: number, inner: number): Phaser.Math.Vector2[] {
  const points: Phaser.Math.Vector2[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    points.push(new Phaser.Math.Vector2(cx + r * Math.cos(a), cy + r * Math.sin(a)));
  }
  return points;
}

/** A large arrow pointing down at the tank, with "Du" above it (FR-077). */
function createYouMarker(scene: Phaser.Scene): Phaser.GameObjects.Container {
  const g = scene.add.graphics();
  const tip = -YOU_TIP;
  g.fillStyle(YOU_COLOR, 1);
  g.lineStyle(4, 0x14203a, 1);
  const arrow = [
    [0, tip],
    [-24, tip - 26],
    [-10, tip - 26],
    [-10, tip - 52],
    [10, tip - 52],
    [10, tip - 26],
    [24, tip - 26],
  ].map(([x, y]) => new Phaser.Math.Vector2(x, y));
  g.fillPoints(arrow, true);
  g.strokePoints(arrow, true);
  const label = scene.add
    .text(0, tip - 56, t().battle.you, {
      fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
      fontSize: '40px',
      fontStyle: 'bold',
      color: '#ffd54a',
      stroke: '#14203a',
      strokeThickness: 8,
    })
    .setOrigin(0.5, 1);
  return scene.add.container(0, 0, [g, label]);
}
