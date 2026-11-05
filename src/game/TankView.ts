/**
 * One tank on screen (FR-007): body, turret rotated by the cannon angle.
 * The player's turret shows the fixed angle (FR-065); `shake` shows a near miss on the body (FR-066).
 * After the terrain changes the tank moves down to the new surface with a short tween.
 * `appear` fades a new enemy in after the old one was destroyed (amendment 06). The enemy is never hidden
 * (amendment 07); a burst decoy is hidden at once and a folded decoy fades out (amendment 10).
 *
 * Amendment 05 (FR-077): the look comes from tankStyle. The child's tank is blue and rounded with a yellow star flag
 * on its antenna; the enemy is dark red and angular with a black flag. `showYouMarker` shows a bouncing
 * arrow with "Du" over the child's tank.
 *
 * Amendment 06 (FR-073, FR-078, FR-080): `setLives` draws the child's hearts directly above the tank, full ones in
 * red and lost ones as an outline, with no text; the enemy has no health bar. `setTarget` draws a small target ring
 * where the pointer line meets the tank, on its center line, with no number.
 *
 * Amendment 09 (FR-026): no tank carries a number plate or shows an order badge.
 *
 * Amendment 10 (FR-026, FR-031, FR-053, FR-064): in comparison turns the enemy and its decoys look the same and take
 * taps: `setTappable` turns on a tap area of at least TAP_MIN_CSS by TAP_MIN_CSS CSS pixels around the tank, which
 * calls the `onTap` handler; `tapCenter` gives its center for the end-to-end tests. `setMark` draws the green ring of
 * help step 3 around the correct tank.
 */
import Phaser from 'phaser';
import type { TankState } from '../core/types';
import { toScreenY } from '../core/view/geometry';
import { tankStyle, type TankStyle } from '../core/view/tankStyle';
import { t } from '../i18n';
import { TANK_BODY_HEIGHT, TEX } from './textures';

/** Turret pivot above the tank base, matching the muzzle height in core/battle/round.ts. */
const TURRET_PIVOT = 28;
/** The hearts sit above the antenna flag and the turret at its fixed angle. */
const BAR_OFFSET = 86;
const HEART_SIZE = 22;
const HEART_GAP = 6;
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
/** The smallest tap area in CSS pixels (FR-053), and the tap area in world units on a large screen. */
const TAP_MIN_CSS = 48;
const TAP_W = 100;
const TAP_H = 90;
/** The green ring of help step 3 around the correct tank in a comparison (amendment 10, FR-031). */
const MARK_COLOR = 0x3fae5a;
const MARK_R = 46;

export class TankView {
  readonly container: Phaser.GameObjects.Container;
  private readonly body: Phaser.GameObjects.Image;
  private readonly turret: Phaser.GameObjects.Image;
  private readonly hearts: Phaser.GameObjects.Graphics;
  private readonly target: Phaser.GameObjects.Graphics;
  private readonly flag: Phaser.GameObjects.Graphics;
  private readonly you: Phaser.GameObjects.Container;
  private youTimer: Phaser.Time.TimerEvent | null = null;
  private readonly style: TankStyle;
  private readonly color: number;
  private tint: number;
  private lastY: number | null = null;
  private lastLives: number | null = null;
  private hidden = false;
  private readonly tapZone: Phaser.GameObjects.Zone;
  private tappable = false;
  private readonly mark: Phaser.GameObjects.Graphics;

  constructor(
    private readonly scene: Phaser.Scene,
    kind: TankState['kind'],
    private readonly worldHeight: number,
    onTap?: () => void,
  ) {
    this.style = tankStyle(kind);
    this.color = this.style.color;
    this.tint = this.color;
    this.turret = scene.add.image(0, -TURRET_PIVOT, TEX.turret).setOrigin(0, 0.5).setTint(this.color);
    const bodyTexture = this.style.body === 'angular' ? TEX.tankBodyAngular : TEX.tankBody;
    this.body = scene.add.image(0, 0, bodyTexture).setOrigin(0.5, 1).setTint(this.color);
    this.flag = scene.add.graphics();
    drawFlag(this.flag, this.style.flag);
    this.hearts = scene.add.graphics();
    this.target = scene.add.graphics().setVisible(false);
    drawTarget(this.target);
    this.you = createYouMarker(scene).setVisible(false);
    this.mark = scene.add.graphics().setVisible(false);
    this.mark.lineStyle(6, MARK_COLOR, 1);
    this.mark.strokeCircle(0, -TANK_BODY_HEIGHT / 2, MARK_R);
    this.tapZone = scene.add.zone(0, 0, TAP_W, TAP_H);
    if (onTap) this.tapZone.on('pointerdown', onTap);
    this.container = scene.add.container(0, 0, [this.mark, this.flag, this.turret, this.body, this.target, this.hearts, this.you, this.tapZone]);
  }

  /** Comparison turns (amendment 10): a tap on the tank fires at its number; off outside comparison searches. */
  setTappable(on: boolean): void {
    if (on === this.tappable) return;
    this.tappable = on;
    if (!on) {
      this.tapZone.disableInteractive();
      return;
    }
    // displayScale is world units per CSS pixel: the area is at least TAP_MIN_CSS CSS pixels in each direction.
    const scale = this.scene.scale.displayScale.x || 1;
    const w = Math.max(TAP_W, TAP_MIN_CSS * scale);
    const h = Math.max(TAP_H, TAP_MIN_CSS * scale);
    this.tapZone.setSize(w, h).setPosition(0, 10 - h / 2);
    this.tapZone.setInteractive({ useHandCursor: true });
    if (this.tapZone.input) this.tapZone.input.hitArea.setTo(0, 0, w, h);
  }

  /** The center of the tap area in world coordinates, for the end-to-end tests (tasks.md D4). */
  tapCenter(): { x: number; y: number } {
    return { x: this.container.x + this.tapZone.x, y: this.container.y + this.tapZone.y };
  }

  /** The green ring around the correct tank at comparison help step 3 (amendment 10, FR-031). */
  setMark(on: boolean): void {
    this.mark.setVisible(on);
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

  /** Shows or hides the target ring where the pointer line meets the tank (amendment 06, FR-073). */
  setTarget(on: boolean): void {
    this.target.setVisible(on);
  }

  /** The child's hearts above the tank (FR-080); null draws none. */
  setLives(lives: number | null, max: number): void {
    if (lives === this.lastLives) return;
    this.lastLives = lives;
    this.hearts.clear();
    if (lives === null) return;
    const width = max * HEART_SIZE + (max - 1) * HEART_GAP;
    for (let i = 0; i < max; i++) {
      const cx = -width / 2 + HEART_SIZE / 2 + i * (HEART_SIZE + HEART_GAP);
      drawHeart(this.hearts, cx, -BAR_OFFSET + HEART_SIZE / 2, HEART_SIZE, i < lives);
    }
  }

  /** A new enemy after the old one was destroyed: hidden first, then it fades in after `delayMs` (amendment 06). */
  appear(delayMs: number): void {
    if (this.hidden) return;
    this.scene.tweens.killTweensOf(this.container);
    this.container.alpha = 0;
    this.scene.tweens.add({ targets: this.container, alpha: 1, delay: delayMs, duration: FADE_MS });
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
    const parts = [this.body, this.turret, this.target, this.flag];
    this.scene.tweens.add({ targets: parts, x: SHAKE_PX, duration: SHAKE_MS, yoyo: true, repeat: 3, ease: 'Sine.easeInOut', onComplete: () => parts.forEach((p) => (p.x = 0)) });
  }

  /**
   * Hidden tanks draw nothing; `fade` blends in or out after `delayMs` instead of switching at once. Any running fade
   * (also a pending `appear`) stops first, so a hidden tank never fades back in.
   */
  setHidden(hidden: boolean, fade: boolean, delayMs = 0): void {
    if (hidden === this.hidden) return;
    this.hidden = hidden;
    const alpha = hidden ? 0 : 1;
    this.scene.tweens.killTweensOf(this.container);
    if (fade) {
      this.scene.tweens.add({ targets: this.container, alpha, delay: delayMs, duration: FADE_MS });
    } else {
      this.container.alpha = alpha;
    }
  }

  /** Short white flash when the tank is hit and loses a heart (FR-009). */
  flash(): void {
    const parts = [this.body, this.turret];
    const on = () => parts.forEach((p) => p.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL));
    const off = () => parts.forEach((p) => p.setTintMode(Phaser.TintModes.MULTIPLY).setTint(this.tint));
    on();
    this.scene.time.delayedCall(90, off);
    this.scene.time.delayedCall(180, on);
    this.scene.time.delayedCall(270, off);
  }

  destroy(): void {
    this.youTimer?.remove();
    this.scene.tweens.killTweensOf([this.container, this.turret, this.body, this.target, this.flag, this.you]);
    this.tapZone.removeAllListeners();
    this.container.destroy();
  }
}

/** A small ring with a dot on the body's center line, where the pointer line meets the tank: the spot to hit. */
function drawTarget(g: Phaser.GameObjects.Graphics): void {
  const y = -TANK_BODY_HEIGHT / 2;
  g.lineStyle(5, 0x1b1f27, 0.9);
  g.strokeCircle(0, y, 9);
  g.lineStyle(3, 0xffffff, 1);
  g.strokeCircle(0, y, 9);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(0, y, 2.5);
}

/** One heart, its center at (cx, cy): filled red when kept, a light outline when lost (FR-080). */
function drawHeart(g: Phaser.GameObjects.Graphics, cx: number, cy: number, size: number, full: boolean): void {
  const r = size / 4;
  const top = cy - size / 2 + r;
  const points: Phaser.Math.Vector2[] = [];
  // Two half circles on top and a point at the bottom.
  for (let a = 180; a <= 360; a += 15) {
    const rad = (a * Math.PI) / 180;
    points.push(new Phaser.Math.Vector2(cx - r + r * Math.cos(rad), top + r * Math.sin(rad)));
  }
  for (let a = 180; a <= 360; a += 15) {
    const rad = (a * Math.PI) / 180;
    points.push(new Phaser.Math.Vector2(cx + r + r * Math.cos(rad), top + r * Math.sin(rad)));
  }
  points.push(new Phaser.Math.Vector2(cx, cy + size / 2));
  g.lineStyle(3, 0x10141c, 0.9);
  if (full) {
    g.fillStyle(0xe53935, 1);
    g.fillPoints(points, true);
    g.strokePoints(points, true);
  } else {
    g.fillStyle(0x10141c, 0.45);
    g.fillPoints(points, true);
    g.lineStyle(2.5, 0xf4f6fb, 0.9);
    g.strokePoints(points, true);
  }
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
