/**
 * The ruler (number line) along the bottom of the battlefield (FR-015, FR-019, contracts/ui-flows.md battle layout).
 *
 * - Drawn in the ruler band (core/view/layout.ts, screen y 720 to 820) on the bedrock strip below the ground,
 *   and at x 80 to 1520 with numberToX, so each number sits below its battlefield position.
 * - Lines and labels come from ticksFor with the round's ruler level (FR-017); only visible lines are drawn.
 *   On level 1, minor labels closer than MIN_LABEL_SPACING are left out by ticksFor so digits never overlap.
 * - Tapping or dragging anywhere on the ruler calls selectNumber; releasing only previews (FR-019).
 * - The selection gets a vertical guide line, a target marker on the battlefield and a marker on the ruler.
 * - After each player shot: a landing marker with the landing number in large digits (FR-004); in free play a
 *   bracket from the landing number to the enemy's number with the step count (FR-014, decision D12).
 */
import Phaser from 'phaser';
import type { BattleController } from '../core/battle/controller';
import { numberToX, xToNumber } from '../core/numberline/mapping';
import { ticksFor, type RulerLevel } from '../core/numberline/ticks';
import { surfaceY } from '../core/physics/terrain';
import type { RoundState } from '../core/types';
import { toScreenY } from '../core/view/geometry';
import { RULER_BOTTOM, RULER_TOP } from '../core/view/layout';
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
  private readonly selectionText: Phaser.GameObjects.Text;
  private readonly landedText: Phaser.GameObjects.Text;
  private readonly stepsText: Phaser.GameObjects.Text;
  private drawn: Drawn | null = null;
  private dragging = false;
  private last: RoundState | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly controller: BattleController,
    private readonly worldHeight: number,
  ) {
    this.ruler = scene.add.graphics().setDepth(10);
    this.marks = scene.add.graphics().setDepth(11);
    const big = { fontFamily: FONT, fontSize: '56px', fontStyle: 'bold', color: '#ffd54a', stroke: '#14203a', strokeThickness: 8 };
    this.selectionText = scene.add.text(0, 0, '', big).setOrigin(0.5, 1).setDepth(12).setVisible(false);
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
  }

  destroy(): void {
    this.scene.input.off(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    this.scene.input.off(Phaser.Input.Events.GAME_OUT, this.onUp, this);
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

    const { ticks } = ticksFor({ min, max }, rulerLevel, seed);
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

      const enemyVisible = s.enemyFound && s.enemy.alive;
      if (s.mode === 'freePlay' && !shot.hit && enemyVisible && shot.landed !== s.enemy.position) {
        const ex = numberToX(s.enemy.position, min, max);
        const y = RULER_BOTTOM + 14;
        g.lineStyle(4, SELECT, 1);
        g.lineBetween(lx, y - 10, lx, y);
        g.lineBetween(lx, y, ex, y);
        g.lineBetween(ex, y - 10, ex, y);
        const steps = Math.abs(shot.landed - s.enemy.position);
        this.stepsText.setText(t().battle.steps(steps)).setPosition((lx + ex) / 2, y + 4).setVisible(true);
      } else {
        this.stepsText.setVisible(false);
      }
    } else {
      this.landedText.setVisible(false);
      this.stepsText.setVisible(false);
    }

    // Selection: guide line from the ruler up to the battlefield, target marker on the ground, marker on the ruler.
    const choosing = s.phase === 'aiming' || s.phase === 'challenge' || s.phase === 'paused';
    if (s.selection === null || !choosing) {
      this.selectionText.setVisible(false);
      return;
    }
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
    // While dragging, the chosen number shows in large digits above the finger.
    this.selectionText.setText(String(s.selection)).setPosition(x, Math.min(groundY - 40, RULER_TOP - 70)).setVisible(this.dragging);
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
