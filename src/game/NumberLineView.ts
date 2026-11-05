/**
 * The ruler (number line) along the bottom of the battlefield (FR-015, FR-019, contracts/ui-flows.md battle layout).
 *
 * - Drawn in the ruler band (core/view/layout.ts, screen y 720 to 820) on the bedrock strip below the ground,
 *   and at x 80 to 1520 with numberToX, so each number sits below its battlefield position.
 * - Lines and labels come from ticksFor with the round's ruler level (FR-017); only visible lines are drawn.
 *   On level 1, minor labels closer than MIN_LABEL_SPACING are left out by ticksFor so digits never overlap;
 *   ticksFor then sets labelTypedNumber, and only the typed number itself is labeled, once, under the marker on a
 *   small dark chip, never its neighbouring lines (T203, FR-017). While the child points on the ruler no number is
 *   shown (amendment 05, FR-019).
 * - showZoom(view) draws a zoomed ten above the ruler with all its lines and labels, and connector lines from
 *   its two ends to the matching part of the ruler, for the help steps (FR-020, FR-031). hideZoom removes it.
 * - The game canvas carries `data-ruler-labels`, the drawn ruler labels from left to right, for the end-to-end
 *   tests (tasks.md D4: the labels are canvas text, so the DOM has no other way to read them).
 * - Tapping or dragging anywhere on the ruler calls selectNumber; releasing only previews (FR-019).
 * - The selection gets a vertical guide line, a target marker on the battlefield and a marker on the ruler, and no
 *   number (amendment 05). The canvas carries `data-preview-text`, the typed number's label under the preview marker ('' when
 *   none), for the end-to-end tests only.
 * - After each player shot: a landing marker with the landing number in large digits (FR-004); in free play a
 *   bracket from the landing number to the enemy's number with the step count (FR-014, decision D12).
 * - After a near miss on the tank body (amendment 06), a bracket from the child's number to the enemy's number,
 *   with "Du: 30 · Gegner: 31 · 1 Schritt" (FR-072). Not while a guided search hides the enemy: getState() then has
 *   no enemy number, and the ruler shows only the landing marker (T215, FR-010).
 * - Guided searches (T066, decision D12): nothing on the ruler hints at the hidden enemy; the landing marker of a
 *   miss stays with its number in large digits until the next fire; no free-play bracket; after a hit a short pulse
 *   on the ruler at the destroyed enemy's number. The canvas carries `data-hit-pulse` (the pulsed number, '' when
 *   none) for the end-to-end tests only.
 * - Pointer lines (amendment 04, FR-073): a thin dashed vertical line from the center of every visible tank (the
 *   enemy once found, and every decoy) down to the ruler, ending in a small triangle on the ruler line
 *   (core/view/pointerLine.ts). No number is drawn for it and no ruler label is highlighted: the child reads the
 *   number from the ruler. The canvas carries `data-pointer-lines`, the numbers of those tanks, for the end-to-end
 *   tests only; nothing is drawn from it.
 */
import Phaser from 'phaser';
import type { BattleController } from '../core/battle/controller';
import { numberToX, xToNumber } from '../core/numberline/mapping';
import { ticksFor, typedNumberLabels, type RulerLevel, type Tick } from '../core/numberline/ticks';
import { surfaceY } from '../core/physics/terrain';
import { tankCenter, visibleEnemy } from '../core/battle/round';
import type { RoundState, TankState } from '../core/types';
import { toScreenY } from '../core/view/geometry';
import { RULER_BOTTOM, RULER_TOP } from '../core/view/layout';
import { pointerLine } from '../core/view/pointerLine';
import { t } from '../i18n';

const AXIS_Y = 742;
const MAJOR_TICK = 26;
const MINOR_TICK = 14;
const LABEL_Y = 772;
/** Presses this far above or below the ruler still count as on the line. */
const GRAB_MARGIN = 24;

const RULER_BG = 0x14203a;
const LINE = 0xf4f6fb;
const SELECT = 0xffd54a;
const LANDED = 0xff8a65;
const POINTER = 0xf4f6fb;
const PULSE = 0x9be89f;
const PULSE_MS = 700;
/** The zoomed ten: a box this wide and tall, its top this far below the top of the world. */
const ZOOM_WIDTH = 640;
const ZOOM_HEIGHT = 110;
const ZOOM_TOP = 150;
const ZOOM_PAD = 40;
const ZOOM_BG = 0x14203a;
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';

interface Drawn {
  min: number;
  max: number;
  seed: number;
  rulerLevel: RulerLevel;
}

export class NumberLineView {
  private readonly ruler: Phaser.GameObjects.Graphics;
  private readonly marks: Phaser.GameObjects.Graphics;
  private labels: Phaser.GameObjects.Text[] = [];
  /** The typed number's label under the preview marker on a crowded level 1 ruler, and its dark chip. */
  private readonly typedChip: Phaser.GameObjects.Graphics;
  private readonly typedText: Phaser.GameObjects.Text;
  private readonly zoom: Phaser.GameObjects.Graphics;
  private zoomLabels: Phaser.GameObjects.Text[] = [];
  /** The ruler's lines as drawn, and whether a typed number gets its own label under the marker. */
  private ruled: { ticks: Tick[]; labelTypedNumber: boolean } = { ticks: [], labelTypedNumber: false };
  private readonly landedText: Phaser.GameObjects.Text;
  private readonly stepsText: Phaser.GameObjects.Text;
  private drawn: Drawn | null = null;
  private dragging = false;
  private last: RoundState | null = null;
  /** The ring that pulses on the ruler at the destroyed enemy's number after a hit. */
  private readonly pulse: Phaser.GameObjects.Graphics;
  private pulsedShot: RoundState['lastShot'] = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly controller: BattleController,
    private readonly worldHeight: number,
  ) {
    this.ruler = scene.add.graphics().setDepth(10);
    this.marks = scene.add.graphics().setDepth(11);
    this.zoom = scene.add.graphics().setDepth(13);
    this.pulse = scene.add.graphics().setDepth(12).setVisible(false);
    this.typedChip = scene.add.graphics().setDepth(12).setVisible(false);
    this.typedText = scene.add
      .text(0, 0, '', { fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: '#ffd54a' })
      .setOrigin(0.5, 0)
      .setDepth(12)
      .setVisible(false);
    const big = { fontFamily: FONT, fontSize: '56px', fontStyle: 'bold', color: '#ffd54a', stroke: '#14203a', strokeThickness: 8 };
    this.landedText = scene.add.text(0, 0, '', { ...big, color: '#ff8a65' }).setOrigin(0.5, 1).setDepth(12).setVisible(false);
    this.stepsText = scene.add
      .text(0, 0, '', { fontFamily: FONT, fontSize: '28px', fontStyle: 'bold', color: '#ffffff', stroke: '#14203a', strokeThickness: 6 })
      .setOrigin(0.5, 0)
      .setDepth(12)
      .setVisible(false);

    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    scene.input.on(Phaser.Input.Events.GAME_OUT, this.onUp, this);
  }

  update(s: RoundState): void {
    this.last = s;
    const settings = this.controller.getRoundSettings();
    const { min, max } = settings.range;
    const rulerLevel = s.rulerLevel;
    const d = this.drawn;
    if (!d || d.min !== min || d.max !== max || d.seed !== s.seed || d.rulerLevel !== rulerLevel) {
      this.drawn = { min, max, seed: s.seed, rulerLevel };
      this.dragging = false;
      this.drawRuler(min, max, rulerLevel, s.seed);
    }
    this.drawMarks(s, min, max);
    this.pulseHit(s, min, max);
  }

  /** A short pulse on the ruler where the destroyed enemy stood, once per hit (T066). */
  private pulseHit(s: RoundState, min: number, max: number): void {
    const shot = s.lastShot;
    if (!shot?.hit || shot === this.pulsedShot || shot.enemyNumber === null) return;
    this.pulsedShot = shot;
    const x = numberToX(shot.enemyNumber, min, max);
    this.scene.game.canvas.dataset.hitPulse = String(shot.enemyNumber);
    const g = this.pulse;
    this.scene.tweens.killTweensOf(g);
    g.clear().setPosition(x, AXIS_Y).setScale(0.4).setAlpha(1).setVisible(true);
    g.lineStyle(6, PULSE, 1);
    g.strokeCircle(0, 0, 28);
    this.scene.tweens.add({
      targets: g,
      scale: 1.6,
      alpha: 0,
      duration: PULSE_MS,
      ease: 'Quad.easeOut',
      onComplete: () => {
        g.setVisible(false);
        this.scene.game.canvas.dataset.hitPulse = '';
      },
    });
  }

  /** Draws the zoomed ten `view` above the ruler, every line labeled, with connectors to the ruler (FR-020). */
  showZoom(view: { min: number; max: number }): void {
    this.hideZoom();
    const { min, max } = this.controller.getRoundSettings().range;
    const level = this.last?.rulerLevel ?? 1;
    const { ticks } = ticksFor(view, level, this.last?.seed ?? 0, { allLines: true });
    const fromX = numberToX(view.min, min, max);
    const toX = numberToX(view.max, min, max);
    const center = Math.min(1560 - ZOOM_WIDTH / 2, Math.max(40 + ZOOM_WIDTH / 2, (fromX + toX) / 2));
    const left = center - ZOOM_WIDTH / 2;
    const axisY = ZOOM_TOP + 46;
    const zx = (v: number) => left + ZOOM_PAD + ((v - view.min) / (view.max - view.min)) * (ZOOM_WIDTH - 2 * ZOOM_PAD);

    const g = this.zoom;
    // Connector lines from both ends of the zoomed ten down to the matching part of the ruler.
    g.lineStyle(3, SELECT, 0.9);
    g.lineBetween(zx(view.min), ZOOM_TOP + ZOOM_HEIGHT, fromX, AXIS_Y);
    g.lineBetween(zx(view.max), ZOOM_TOP + ZOOM_HEIGHT, toX, AXIS_Y);
    g.lineStyle(6, SELECT, 1);
    g.lineBetween(fromX, AXIS_Y, toX, AXIS_Y);
    g.fillStyle(ZOOM_BG, 0.92);
    g.fillRoundedRect(left, ZOOM_TOP, ZOOM_WIDTH, ZOOM_HEIGHT, 14);
    g.lineStyle(3, SELECT, 1);
    g.strokeRoundedRect(left, ZOOM_TOP, ZOOM_WIDTH, ZOOM_HEIGHT, 14);
    g.lineStyle(4, LINE, 1);
    g.lineBetween(zx(view.min), axisY, zx(view.max), axisY);
    for (const tick of ticks) {
      const x = zx(tick.value);
      const len = tick.major ? MAJOR_TICK : MINOR_TICK;
      g.lineStyle(tick.major ? 4 : 2, LINE, 1);
      g.lineBetween(x, axisY - len / 2, x, axisY + len / 2);
      const label = this.scene.add
        .text(x, axisY + 22, String(tick.value), { fontFamily: FONT, fontSize: tick.major ? '26px' : '22px', fontStyle: 'bold', color: '#f4f6fb' })
        .setOrigin(0.5, 0)
        .setDepth(13);
      this.zoomLabels.push(label);
    }
  }

  hideZoom(): void {
    this.zoom.clear();
    for (const label of this.zoomLabels) label.destroy();
    this.zoomLabels = [];
  }

  destroy(): void {
    this.scene.input.off(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    this.scene.input.off(Phaser.Input.Events.GAME_OUT, this.onUp, this);
    this.hideZoom();
    this.scene.tweens.killTweensOf(this.pulse);
  }

  private drawRuler(min: number, max: number, rulerLevel: RulerLevel, seed: number): void {
    for (const label of this.labels) label.destroy();
    this.labels = [];
    const g = this.ruler;
    const x0 = numberToX(min, min, max);
    const x1 = numberToX(max, min, max);
    g.clear();
    g.fillStyle(RULER_BG, 0.78);
    g.fillRoundedRect(x0 - 48, RULER_TOP - 8, x1 - x0 + 96, RULER_BOTTOM - RULER_TOP + 16, 14);
    g.lineStyle(4, LINE, 1);
    g.lineBetween(x0, AXIS_Y, x1, AXIS_Y);

    const { ticks, labelTypedNumber } = ticksFor({ min, max }, rulerLevel, seed);
    this.ruled = { ticks, labelTypedNumber };
    for (const tick of ticks) {
      if (!tick.visible) continue;
      const x = numberToX(tick.value, min, max);
      const end = tick.value === min || tick.value === max;
      const len = tick.major || end ? MAJOR_TICK : MINOR_TICK;
      g.lineStyle(tick.major || end ? 4 : 2, LINE, 1);
      g.lineBetween(x, AXIS_Y - len / 2, x, AXIS_Y + len / 2);
      if (!tick.labeled) continue;
      const size = tick.major || end ? 26 : 20;
      const label = this.scene.add
        .text(x, LABEL_Y, String(tick.value), { fontFamily: FONT, fontSize: `${size}px`, fontStyle: 'bold', color: '#f4f6fb' })
        .setOrigin(0.5, 0)
        .setDepth(10);
      this.labels.push(label);
    }
    this.scene.game.canvas.dataset.rulerLabels = ticks
      .filter((tick) => tick.visible && tick.labeled)
      .map((tick) => tick.value)
      .join(',');
  }

  /**
   * Level 1 on a crowded ruler: the typed number's own label, once, under the preview marker on a dark rounded chip,
   * so it covers whatever lies below it and never runs together with other labels (T203, FR-017). A pointer preview
   * gets no label, so pointing never shows a number (amendment 05).
   */
  private drawTypedLabel(selection: number | null, typed: boolean, min: number, max: number): void {
    const [n] = typedNumberLabels(this.ruled, selection, typed);
    this.typedChip.clear().setVisible(false);
    this.typedText.setVisible(false);
    this.scene.game.canvas.dataset.previewText = n === undefined ? '' : String(n);
    if (n === undefined) return;
    const x = numberToX(n, min, max);
    this.typedText.setText(String(n)).setPosition(x, LABEL_Y).setVisible(true);
    const padX = 8;
    const padY = 3;
    const w = this.typedText.width + 2 * padX;
    const h = this.typedText.height + 2 * padY;
    this.typedChip.fillStyle(RULER_BG, 1).fillRoundedRect(x - w / 2, LABEL_Y - padY, w, h, 8).setVisible(true);
  }

  private drawMarks(s: RoundState, min: number, max: number): void {
    const g = this.marks;
    g.clear();
    const inFlight = s.phase === 'playerShot';

    // Landing marker and free-play distance bracket, until the next player shot.
    const shot = s.lastShot;
    if (shot && !inFlight) {
      const lx = numberToX(shot.landed, min, max);
      g.fillStyle(LANDED, 1);
      g.fillTriangle(lx - 12, RULER_TOP - 6, lx + 12, RULER_TOP - 6, lx, AXIS_Y - 4);
      this.landedText.setText(String(shot.landed)).setPosition(lx, RULER_TOP - 10).setVisible(true);

      const enemy = visibleEnemy(s);
      if (shot.nearMiss && shot.enemyNumber !== null) {
        // A near miss on the tank body: both numbers and the distance (amendment 06, FR-072).
        this.drawBracket(lx, numberToX(shot.enemyNumber, min, max), t().battle.compare(shot.fired, shot.enemyNumber));
      } else if (s.mode === 'freePlay' && !shot.hit && enemy && shot.landed !== enemy.position) {
        this.drawBracket(lx, numberToX(enemy.position, min, max), t().battle.steps(Math.abs(shot.landed - enemy.position)));
      } else {
        this.stepsText.setVisible(false);
      }
    } else {
      this.landedText.setVisible(false);
      this.stepsText.setVisible(false);
    }

    this.drawPointerLines(s);

    // Selection: guide line from the ruler up to the battlefield, target marker on the ground, marker on the ruler.
    const choosing = s.phase === 'aiming' || s.phase === 'challenge' || s.phase === 'paused';
    this.drawTypedLabel(choosing ? s.selection : null, s.entry.typed !== '', min, max);
    if (s.selection === null || !choosing) return;
    const x = numberToX(s.selection, min, max);
    const groundY = toScreenY(surfaceY(s.terrain, x), this.worldHeight);
    g.lineStyle(3, SELECT, 0.9);
    g.lineBetween(x, Math.min(groundY, RULER_TOP), x, AXIS_Y);
    g.lineStyle(5, SELECT, 1);
    g.strokeCircle(x, groundY - 4, 18);
    g.lineBetween(x - 26, groundY - 4, x + 26, groundY - 4);
    g.lineBetween(x, groundY - 30, x, groundY + 22);
    g.fillStyle(SELECT, 1);
    g.fillCircle(x, AXIS_Y, 10);
  }

  /** Bracket below the ruler from x0 to x1 with a text under its middle. */
  private drawBracket(x0: number, x1: number, text: string): void {
    const g = this.marks;
    const y = RULER_BOTTOM + 14;
    g.lineStyle(4, SELECT, 1);
    g.lineBetween(x0, y - 10, x0, y);
    g.lineBetween(x0, y, x1, y);
    g.lineBetween(x1, y - 10, x1, y);
    this.stepsText.setText(text).setPosition((x0 + x1) / 2, y + 4).setVisible(true);
  }

  /** Dashed lines with an end triangle from each visible tank's center to the ruler, with no number (FR-073). */
  private drawPointerLines(s: RoundState): void {
    const g = this.marks;
    const enemy = visibleEnemy(s);
    const visible: TankState[] = [...(enemy ? [enemy] : []), ...s.decoys.filter((d) => d.alive)];
    g.lineStyle(2, POINTER, 0.8);
    g.fillStyle(POINTER, 0.9);
    for (const tank of visible) {
      const c = tankCenter(tank);
      const line = pointerLine({ x: c.x, y: toScreenY(c.y, this.worldHeight) }, AXIS_Y);
      for (const d of line.dashes) g.lineBetween(d.x, d.y0, d.x, d.y1);
      const [a, b, tip] = line.triangle;
      g.fillTriangle(a.x, a.y, b.x, b.y, tip.x, tip.y);
    }
    this.scene.game.canvas.dataset.pointerLines = visible.map((tank) => tank.position).join(',');
  }

  private onDown(p: Phaser.Input.Pointer): void {
    if (p.worldY < RULER_TOP - GRAB_MARGIN || p.worldY > RULER_BOTTOM + GRAB_MARGIN) return;
    const s = this.controller.getState();
    if (s.phase !== 'aiming' && s.phase !== 'challenge') return;
    this.dragging = true;
    this.select(p);
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (this.dragging) this.select(p);
  }

  private onUp(): void {
    if (!this.dragging) return;
    this.dragging = false;
    if (this.last) this.update(this.last);
  }

  private select(p: Phaser.Input.Pointer): void {
    const { min, max } = this.controller.getRoundSettings().range;
    const n = xToNumber(p.worldX, min, max);
    if (n !== this.controller.getState().selection) this.controller.selectNumber(n);
    else if (this.last) this.update(this.last);
  }
}
