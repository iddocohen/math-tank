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
 *
 * Amendment 11 (FR-093): the child's tank takes a `look` from the garage: its color (dark blue with stripes adds light
 * stripes on the hull), its flag and a hat on the dome, drawn from the shapes in src/core/rewards/looks.ts. The enemy
 * and decoys never take a look.
 *
 * Amendment 13 (FR-100, FR-101): `warn` wobbles the child's tank and pulses its hearts once, with no text, one miss
 * before the enemy hits. `sync` can wait before the tank settles, so it settles after the new hills faded in.
 *
 * Amendment 14 (FR-109 to FR-111): body and turret are drawn from src/core/view/tankDrawing.ts, the shapes the garage
 * preview draws too, with a highlight and a shadow from the tank's color. While the tank settles its wheels turn, and
 * a dust puff rises when it lands. `fire` shows a short barrel recoil, a white muzzle flash and a grey smoke puff. The
 * flag and the hat sit at the anchors of amendment 11 inside the same container, so they move with the body.
 */
import Phaser from 'phaser';
import type { TankState } from '../core/types';
import { toScreenY } from '../core/view/geometry';
import { tankStyle, type TankStyle } from '../core/view/tankStyle';
import { t } from '../i18n';
import { TANK_BODY_HEIGHT } from './textures';
import { STANDARD_LOOK, type Look } from '../core/rewards/items';
import { colorStripes, flagShapes, hatShapes, tankColor, type Shape } from '../core/rewards/looks';
import { antennaShapes, MUZZLE_LENGTH, TANK_ANCHORS, tankBodyShapes, turretShapes } from '../core/view/tankDrawing';

/** Turret pivot above the tank base, matching the muzzle height in core/battle/round.ts. */
const TURRET_PIVOT = TANK_ANCHORS.turretPivot;
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
/** The warning wobble (amendment 13, FR-100): the tank tips this many degrees each way; the hearts grow by this factor. */
const WOBBLE_DEG = 5;
const WOBBLE_MS = 90;
const PULSE_SCALE = 1.35;
const PULSE_MS = 220;
/** The smallest tap area in CSS pixels (FR-053), and the tap area in world units on a large screen. */
const TAP_MIN_CSS = 48;
const TAP_W = 100;
const TAP_H = 90;
/** The green ring of help step 3 around the correct tank in a comparison (amendment 10, FR-031). */
const MARK_COLOR = 0x3fae5a;
const MARK_R = 46;
/** Wheel radius for the turning wheels while settling (amendment 14). */
const WHEEL_R = 3.6;
/** Firing (amendment 14, FR-111): recoil distance and time, flash and smoke. */
const RECOIL_PX = 6;
const RECOIL_MS = 70;
const FLASH_MS = 220;
const SMOKE_MS = 700;
const DEAD_COLOR = 0x555555;
/** The help target's ring in a wave (amendment 21): grows to this size and back over twice this time. */
const TARGET_PULSE_SCALE = 1.6;
const TARGET_PULSE_MS = 450;

export class TankView {
  readonly container: Phaser.GameObjects.Container;
  private readonly body: Phaser.GameObjects.Graphics;
  private readonly turret: Phaser.GameObjects.Graphics;
  private readonly bodyKind: 'rounded' | 'angular';
  private readonly stripes: boolean;
  private wheelAngle = 0;
  private bodyColor: number;
  /** The drawn body's lines (spokes and stripes), the only shapes that change while the wheels turn. */
  private bodyLines = '';
  private turretColor: number;
  private recoil = { k: 0 };
  private readonly hearts: Phaser.GameObjects.Graphics;
  private readonly target: Phaser.GameObjects.Graphics;
  private readonly flag: Phaser.GameObjects.Graphics;
  private readonly you: Phaser.GameObjects.Container;
  private youTimer: Phaser.Time.TimerEvent | null = null;
  private readonly style: TankStyle;
  private readonly color: number;
  private tint: number;
  private turretAngle = 0;
  private lastY: number | null = null;
  private lastLives: number | null = null;
  private hidden = false;
  private pulsing = false;
  /** Amendment 21: the small flag in the color of the tank's line in "Gebogen und verschlungen". */
  private readonly lineFlag: Phaser.GameObjects.Graphics;
  private lineFlagColor: number | null = null;
  private readonly tapZone: Phaser.GameObjects.Zone;
  private tappable = false;
  private readonly mark: Phaser.GameObjects.Graphics;
  private readonly hat: Phaser.GameObjects.Graphics;

  constructor(
    private readonly scene: Phaser.Scene,
    kind: TankState['kind'],
    private readonly worldHeight: number,
    onTap?: () => void,
    look: Look = STANDARD_LOOK,
  ) {
    this.style = tankStyle(kind);
    const player = kind === 'player';
    this.color = player ? tankColor(look.color) : this.style.color;
    this.tint = this.color;
    this.bodyKind = this.style.body;
    this.stripes = player && colorStripes(look.color);
    this.bodyColor = -1;
    this.turretColor = -1;
    this.turret = scene.add.graphics().setPosition(0, -TURRET_PIVOT);
    this.body = scene.add.graphics();
    this.drawTank(this.color);
    this.flag = scene.add.graphics();
    if (player) {
      drawShapes(this.flag, antennaShapes());
      drawShapes(this.flag, flagShapes(look.flag));
    } else {
      drawFlag(this.flag, this.style.flag);
    }
    this.hat = scene.add.graphics();
    if (player) drawShapes(this.hat, hatShapes(look.hat));
    // Drawn around their own center, so the warning pulse grows them in place.
    this.hearts = scene.add.graphics().setY(-BAR_OFFSET + HEART_SIZE / 2);
    this.target = scene.add.graphics().setVisible(false);
    drawTarget(this.target);
    this.target.setY(-TANK_BODY_HEIGHT / 2);
    this.you = createYouMarker(scene).setVisible(false);
    this.lineFlag = scene.add.graphics().setVisible(false);
    this.mark = scene.add.graphics().setVisible(false);
    this.mark.lineStyle(6, MARK_COLOR, 1);
    this.mark.strokeCircle(0, -TANK_BODY_HEIGHT / 2, MARK_R);
    this.tapZone = scene.add.zone(0, 0, TAP_W, TAP_H);
    if (onTap) this.tapZone.on('pointerdown', onTap);
    this.container = scene.add.container(0, 0, [this.mark, this.flag, this.turret, this.body, this.hat, this.lineFlag, this.target, this.hearts, this.you, this.tapZone]);
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
   * Shows the tank state. `instant` places it without tweening (new round or first draw); otherwise the tank settles
   * to a new height after `settleDelayMs`.
   */
  sync(tank: TankState, instant: boolean, settleDelayMs = 0): void {
    const y = toScreenY(tank.y, this.worldHeight);
    this.container.x = tank.x;
    if (instant || this.lastY === null) {
      this.scene.tweens.killTweensOf(this.container);
      this.container.setAngle(0);
      this.container.y = y;
      if (!this.hidden) this.container.alpha = 1;
    } else if (y !== this.lastY) {
      // The wheels turn with the distance moved, and a dust puff rises on landing (amendment 14, FR-111).
      let from = this.container.y;
      this.scene.tweens.add({
        targets: this.container,
        y,
        delay: settleDelayMs,
        duration: SETTLE_MS,
        ease: 'Quad.easeIn',
        onUpdate: () => {
          this.wheelAngle += (this.container.y - from) / WHEEL_R;
          from = this.container.y;
          this.drawTank(this.tint, true);
        },
        onComplete: () => this.dust(),
      });
    }
    this.lastY = y;
    this.tint = tank.alive ? this.color : DEAD_COLOR;
    this.drawTank(this.tint);
  }

  /**
   * Draws body and turret in `color`; the turret only when its color changed, the body also when the wheels turned so
   * far that the drawn spokes change (they repeat after a quarter turn and are rounded, so most frames draw nothing).
   */
  private drawTank(color: number, wheelsMoved = false): void {
    if (color !== this.bodyColor || wheelsMoved) {
      const shapes = tankBodyShapes(this.bodyKind, color, this.wheelAngle, this.stripes);
      const lines = lineKey(shapes);
      if (color !== this.bodyColor || lines !== this.bodyLines) {
        this.bodyColor = color;
        this.bodyLines = lines;
        this.body.clear();
        drawShapes(this.body, shapes);
      }
    }
    if (color !== this.turretColor) {
      this.turretColor = color;
      this.turret.clear();
      drawShapes(this.turret, turretShapes(color));
    }
  }

  /** A small dust puff at both tracks when the tank lands. */
  private dust(): void {
    const scene = this.scene;
    for (const dx of [-26, -12, 12, 26]) {
      const puff = scene.add.circle(this.container.x + dx, this.container.y - 3, 5, 0xc9b28f, 0.75).setDepth(5);
      scene.tweens.add({
        targets: puff,
        x: puff.x + dx * 0.6,
        y: puff.y - 10,
        scale: 2.2,
        alpha: 0,
        duration: 450,
        ease: 'Quad.easeOut',
        onComplete: () => puff.destroy(),
      });
    }
  }

  /**
   * Firing (amendment 14, FR-111): the barrel recoils briefly, a white flash shows at the muzzle and a grey smoke puff
   * drifts up. Neutral colors, so the garage trails stay visible.
   */
  fire(): void {
    const scene = this.scene;
    const rad = Phaser.Math.DegToRad(this.turretAngle);
    const dir = { x: Math.cos(rad), y: Math.sin(rad) };
    const mx = this.container.x + dir.x * (MUZZLE_LENGTH + 4);
    const my = this.container.y - TURRET_PIVOT + dir.y * (MUZZLE_LENGTH + 4);
    scene.tweens.killTweensOf(this.recoil);
    this.recoil.k = 0;
    scene.tweens.add({
      targets: this.recoil,
      k: 1,
      duration: RECOIL_MS,
      yoyo: true,
      ease: 'Quad.easeOut',
      onUpdate: () => this.turret.setPosition(-dir.x * RECOIL_PX * this.recoil.k, -TURRET_PIVOT - dir.y * RECOIL_PX * this.recoil.k),
      onComplete: () => this.turret.setPosition(0, -TURRET_PIVOT),
    });
    const flash = scene.add.star(mx, my, 7, 7, 18, 0xffffff, 1).setAngle(this.turretAngle).setDepth(22);
    const core = scene.add.circle(mx, my, 7, 0xfffbe8, 1).setDepth(22);
    scene.tweens.add({ targets: [flash, core], scale: 1.5, alpha: 0, duration: FLASH_MS, ease: 'Quad.easeOut', onComplete: () => [flash, core].forEach((o) => o.destroy()) });
    for (let i = 0; i < 3; i++) {
      const smoke = scene.add.circle(mx + dir.x * i * 6, my + dir.y * i * 6, 7 + i * 2, i === 1 ? 0x9a9a9a : 0xb4b4b4, 0.7).setDepth(21);
      scene.tweens.add({
        targets: smoke,
        x: smoke.x + dir.x * 14 + (i - 1) * 6,
        y: smoke.y - 26 - i * 8,
        scale: 2.4,
        alpha: 0,
        delay: i * 40,
        duration: SMOKE_MS,
        ease: 'Sine.easeOut',
        onComplete: () => smoke.destroy(),
      });
    }
  }

  /** Physics angle (0 right, 90 up, 180 left); Phaser angles turn clockwise on screen. */
  setBarrelAngle(angleDeg: number): void {
    this.turretAngle = -angleDeg;
    this.turret.setAngle(-angleDeg);
  }

  /** Turns the turret over `ms` milliseconds, e.g. before the enemy fires. */
  turnTo(angleDeg: number, ms: number): void {
    this.turretAngle = -angleDeg;
    this.scene.tweens.add({ targets: this.turret, angle: -angleDeg, duration: ms, ease: 'Sine.easeInOut' });
  }

  /**
   * Amendment 21 (FR-141): the target ring of the help target pulses while help shows. Off stops the pulse and keeps
   * the ring at its normal size.
   */
  setTargetPulse(on: boolean): void {
    if (on === this.pulsing) return;
    this.pulsing = on;
    this.scene.tweens.killTweensOf(this.target);
    this.target.setScale(1);
    if (on) this.scene.tweens.add({ targets: this.target, scale: TARGET_PULSE_SCALE, duration: TARGET_PULSE_MS, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  /**
   * Amendment 21 (FR-144): a small flag on a pole over the tank in the color of its line, so the tangled lines stay
   * traceable; null hides it.
   */
  setLineFlag(color: number | null): void {
    if (color === this.lineFlagColor) return;
    this.lineFlagColor = color;
    const g = this.lineFlag.clear().setVisible(color !== null);
    if (color === null) return;
    const top = -TANK_BODY_HEIGHT - 46;
    g.lineStyle(3, 0x1b1f27, 1);
    g.lineBetween(-4, -TANK_BODY_HEIGHT - 8, -4, top);
    g.fillStyle(0x1b1f27, 1);
    g.fillTriangle(-6, top - 2, 24, top + 9, -6, top + 20);
    g.fillStyle(color, 1);
    g.fillTriangle(-3, top + 1, 19, top + 9, -3, top + 17);
  }

  /** A destroyed enemy of a wave fades out after `delayMs` (amendment 21); `appear` brings it back with the next wave. */
  fadeOut(delayMs: number): void {
    if (this.hidden) return;
    this.scene.tweens.killTweensOf(this.container);
    this.scene.tweens.add({ targets: this.container, alpha: 0, delay: delayMs, duration: FADE_MS });
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
      drawHeart(this.hearts, cx, 0, HEART_SIZE, i < lives);
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
    const parts = [this.body, this.turret, this.target, this.flag, this.hat];
    this.scene.tweens.add({ targets: parts, x: SHAKE_PX, duration: SHAKE_MS, yoyo: true, repeat: 3, ease: 'Sine.easeInOut', onComplete: () => parts.forEach((p) => (p.x = 0)) });
  }

  /**
   * Hides the tank for good: `fade` blends it out instead of hiding it at once. Any running fade (also a pending
   * `appear`) stops first, so a hidden tank never fades back in.
   */
  hide(fade: boolean): void {
    if (this.hidden) return;
    this.hidden = true;
    this.scene.tweens.killTweensOf(this.container);
    if (fade) {
      this.scene.tweens.add({ targets: this.container, alpha: 0, duration: FADE_MS });
    } else {
      this.container.alpha = 0;
    }
  }

  /** The warning one miss before the enemy hits (amendment 13, FR-100): a short wobble and one heart pulse, no text. */
  warn(): void {
    this.scene.tweens.add({
      targets: this.container,
      angle: { from: -WOBBLE_DEG, to: WOBBLE_DEG },
      duration: WOBBLE_MS,
      yoyo: true,
      repeat: 2,
      ease: 'Sine.easeInOut',
      onComplete: () => this.container.setAngle(0),
    });
    this.scene.tweens.add({ targets: this.hearts, scale: PULSE_SCALE, duration: PULSE_MS, yoyo: true, ease: 'Sine.easeOut', onComplete: () => this.hearts.setScale(1) });
  }

  /** Short white flash when the tank is hit and loses a heart (FR-009). */
  flash(): void {
    const on = () => this.drawTank(0xffffff);
    const off = () => this.drawTank(this.tint);
    on();
    this.scene.time.delayedCall(90, off);
    this.scene.time.delayedCall(180, on);
    this.scene.time.delayedCall(270, off);
  }

  destroy(): void {
    this.youTimer?.remove();
    this.scene.tweens.killTweensOf([this.container, this.turret, this.body, this.target, this.lineFlag, this.flag, this.hat, this.you, this.hearts, this.recoil]);
    this.tapZone.removeAllListeners();
    this.container.destroy();
  }
}

/** A small ring with a dot on the body's center line, where the pointer line meets the tank: the spot to hit. */
function drawTarget(g: Phaser.GameObjects.Graphics): void {
  // Drawn around the graphics' own origin, which sits on the body's center line, so the pulse grows it in place.
  const y = 0;
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

/** Garage and tank shapes (amendments 11 and 14) are in tank coordinates with y up; the container has y down. */
function drawShapes(g: Phaser.GameObjects.Graphics, shapes: Shape[]): void {
  for (const s of shapes) {
    switch (s.type) {
      case 'poly': {
        const pts = s.points.map(([x, y]) => new Phaser.Math.Vector2(x, -y));
        g.fillStyle(s.fill, s.alpha ?? 1);
        g.fillPoints(pts, true);
        if (s.stroke !== undefined) {
          g.lineStyle(1.5, s.stroke, 1);
          g.strokePoints(pts, true);
        }
        break;
      }
      case 'circle':
        g.fillStyle(s.fill, s.alpha ?? 1);
        g.fillCircle(s.x, -s.y, s.r);
        if (s.stroke !== undefined) {
          g.lineStyle(1, s.stroke, 1);
          g.strokeCircle(s.x, -s.y, s.r);
        }
        break;
      case 'line':
        g.lineStyle(s.width, s.color, 1);
        g.lineBetween(s.from[0], -s.from[1], s.to[0], -s.to[1]);
        break;
    }
  }
}

/** The end points of every line shape, as text, to tell whether two drawings of the same body differ. */
function lineKey(shapes: Shape[]): string {
  let key = '';
  for (const s of shapes) if (s.type === 'line') key += `${s.from[0]},${s.from[1]},${s.to[0]},${s.to[1]};`;
  return key;
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
