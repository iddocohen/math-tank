/**
 * The ruler (number line) along the bottom of the battlefield (FR-015, FR-019, contracts/ui-flows.md battle layout).
 *
 * - Drawn in the ruler band (core/view/layout.ts, screen y 720 to 820) on the bedrock strip below the ground,
 *   and at x 80 to 1520 with numberToX, so each number sits below its battlefield position.
 * - Lines and labels come from ticksFor with the round's ruler level (FR-017); every line is drawn (amendment 20). On levels
 *   1 to 3 the line at half of each major step is a medium line, between the minor and major lengths (T235, FR-016).
 *   On level 1 every line is labeled: when the minor labels do not fit in one row, ticksFor puts them in two staggered
 *   rows (tick.row) and they are drawn with a smaller font; major lines and end points keep the large font in the
 *   first row, and an end point's label may sit slightly outward (tick.shift) (T217, FR-017). Only when two rows do
 *   not fit either (for example 0 to 1000) does ticksFor set labelTypedNumber, and then only the typed number itself
 *   is labeled, once, under the marker on a small dark chip, never its neighbouring lines (T203). While the child
 *   points on the ruler no number is shown (amendment 05, FR-019).
 * - showZoom(view) draws a zoomed ten above the ruler with all its lines and labels, and connector lines from
 *   its two ends to the matching part of the ruler, for the help steps (FR-020, FR-031). hideZoom removes it.
 * - The game canvas carries `data-ruler-labels`, the drawn ruler labels from left to right, for the end-to-end
 *   tests (tasks.md D4: the labels are canvas text, so the DOM has no other way to read them).
 * - Tapping or dragging anywhere on the ruler calls selectNumber; releasing only previews (FR-019).
 * - The selection gets a vertical guide line, a target marker on the battlefield and a marker on the ruler, and no
 *   number (amendment 05). The canvas carries `data-preview-text`, the typed number's label under the preview marker ('' when
 *   none), for the end-to-end tests only.
 * - "Zielkreuz" (amendment 19, FR-134, FR-135): the guide line, the target marker, the ruler marker and the typed label
 *   are drawn only while `aimCrossShown(settings.aimCross, state.rulerLevel)` is true, checked on every update, so an
 *   adaptive level change shows or hides them at once. Choosing and firing work the same. The canvas carries
 *   `data-aim-cross` (`on` or `off`) for the end-to-end tests only.
 * - After each player shot: a landing marker with the landing number in large digits (FR-004); after a hit it fades
 *   out after about 2 seconds and goes at once when a later challenge starts (T233). The canvas carries
 *   `data-landing`, the landing number shown ('' when none), for the end-to-end tests only. After a miss, in
 *   every mode, a bracket from the landing number to the enemy's number with the step count (amendment 07, FR-072).
 *   The canvas carries `data-steps-label`, the bracket's text ('' when
 *   none), for the end-to-end tests only.
 * - After a near miss on the tank body (amendment 06), a bracket from the child's number to the enemy's number,
 *   with "Du: 30 · 1 Schritt" (FR-072); no number is drawn at the enemy end (changed by product owner: no enemy
 *   number after a miss).
 * - Guided searches (T066, amendment 07): the landing marker of a miss stays with its number in large digits until
 *   the next fire; after a hit a short pulse on the ruler at the destroyed enemy's number. The canvas carries `data-hit-pulse` (the pulsed number, '' when
 *   none) for the end-to-end tests only.
 * - Pointer lines (amendment 04, FR-073): a thin dashed vertical line from the center of the enemy tank, which is
 *   always visible, and from every standing decoy in comparison turns (amendment 10), down to the ruler, ending in a small triangle on the ruler line
 *   (core/view/pointerLine.ts). No number is drawn for it and no ruler label is highlighted: the child reads the
 *   number from the ruler. The canvas carries `data-pointer-lines`, the numbers of those tanks, for the end-to-end
 *   tests only; nothing is drawn from it.
 * - "Linien" (amendment 21, FR-144, FR-147): "Gerade" draws the pointer lines above; "Keine Linien" draws none
 *   (`data-pointer-lines` is empty). At help step 1, once the child can choose again, "Keine Linien" shows the help
 *   target's straight line for HELP_LINE_MS and hides it again. The canvas carries `data-line-style` and `data-help-line`
 *   (that number, '' when none) for the end-to-end tests only. The curved styles were removed by the product owner
 *   (amendment 21 item 18).
 * - Addition and subtraction (US3, T082, T083): the starting number is highlighted on the ruler with a blue ring and
 *   its number on a chip, while the child chooses a number. After a help request (state.stepAnimation, stepPath) a
 *   small tank icon moves from the starting number one unit at a time (core/view/stepFrames.ts) and the count of
 *   steps shows above it. It pauses at each stop: each crossed ten in beginner assistance, the intermediate result of
 *   a two-step exercise, and the result, whose numbers are labeled under the line. Every line of the passed area is drawn while it
 *   moves, whatever the ruler level (FR-018). The canvas carries `data-start-highlight` (the highlighted number, ''
 *   when none), `data-step-animation` (the path, '' when none) and `data-step-count` (steps shown so far) for the
 *   end-to-end tests only.
 * - Help steps (US5, T099, T100, FR-018, FR-031), drawn from state.help.content and redrawn when it changes:
 *   step 1, an arrow beside the landing marker pointing toward the answer and a pulsing highlight on the nearest
 *   major line with its number; step 2, the zoomed ten (showZoom, every line and label whatever the ruler level) and
 *   a count from the landing number to the answer: the passed stretch of the ruler lights up one unit at a time with
 *   the running count above it, and inside the zoomed ten each passed line gets its count popping up; step 3, a
 *   marker that moves to the solution and the solution in large digits. Comparison step 2 puts a marker with the
 *   number on the ruler under each option. Addition and subtraction show the step animation at step 2 (above).
 *   The canvas carries `data-help-step`, `data-help-highlight` (the highlighted major line), `data-help-zoom`
 *   ("30,40"), `data-help-count` (steps counted so far), `data-help-options` and `data-help-solution` ('' when
 *   none) for the end-to-end tests only.
 * - "Nur Rechnen" (amendment 17, FR-123): no ruler band, lines, labels or pointer lines (`data-ruler-labels` and
 *   `data-pointer-lines` are empty), and a tap on the ruler area selects nothing. The landing number, the step count
 *   and the help steps still show; help step 2 shows the zoomed ten around the answer (showZoom) while it lasts.
 */
import Phaser from 'phaser';
import type { BattleController } from '../core/battle/controller';
import { landedOf } from '../core/battle/guided';
import { aimCrossShown } from '../core/battle/aimCross';
import { DEFAULT_LAYOUT, numberToX, xToNumber } from '../core/numberline/mapping';
import { labelFontSize, ticksFor, typedNumberLabels, type RulerLevel, type Tick, type TickSize } from '../core/numberline/ticks';
import { surfaceY } from '../core/physics/terrain';
import { acceptsInput, tankCenter, visibleEnemy, WORLD_WIDTH } from '../core/battle/round';
import { MODE_TRAITS } from '../core/modes';
import { followHit, HIT_FEEDBACK_MS, hitOutdated, type HitOwner } from '../core/view/hitFeedback';
import type { HelpContent, RoundState, TankState } from '../core/types';
import { clamp } from '../core/util';
import { toScreenY } from '../core/view/geometry';
import { RULER_BOTTOM, RULER_TOP } from '../core/view/layout';
import {
  AXIS_Y,
  CHIP_FONT,
  CHIP_PRIORITY,
  chipBox,
  COUNT_HEAD_HALF,
  helpTextScene,
  LABEL_ROW_2_Y,
  LABEL_Y,
  LANDED_BOTTOM,
  layoutChips,
  rulerLabelBoxes,
  stepCountBox,
  STEP_COUNT_FONT,
  STEP_COUNT_STROKE,
  type Chip,
  type RulerLabelBox,
} from '../core/view/rulerText';
import { pointerLine } from '../core/view/pointerLine';
import { cssColor } from '../core/view/shade';
import { stepFrames, stepMs, type StepFrame } from '../core/view/stepFrames';
import { TEX } from './textures';
import { t } from '../i18n';

const MAJOR_TICK = 26;
/** Medium lines at half of each major step on levels 1 to 3 (T235, FR-016). */
const MEDIUM_TICK = 20;
const MINOR_TICK = 14;
/** Presses this far above or below the ruler still count as on the line. */
const GRAB_MARGIN = 24;

const RULER_BG = 0x14203a;
const LINE = 0xf4f6fb;
const SELECT = 0xffd54a;
const LANDED = 0xff8a65;
const POINTER = 0xf4f6fb;
const PULSE = 0x9be89f;
const PULSE_MS = 700;
/** Help step 1 with "Keine Linien" (amendment 21 item 16, FR-147): the help target's straight line shows this long. */
const HELP_LINE_MS = 2000;
/** A hit's landing marker fades out over the last HIT_FADE_MS of HIT_FEEDBACK_MS (T233). */
const HIT_FADE_MS = 500;
const HIT_FADE_DELAY_MS = HIT_FEEDBACK_MS - HIT_FADE_MS;
/** The starting number of an addition or subtraction, and the step animation's marker (US3). */
const START = 0x7ec8ff;
/** The step animation pauses this long at each stop (a crossed ten, the intermediate result). */
const STOP_PAUSE_MS = 700;
/** The zoomed ten: a box this wide and tall, its top this far below the top of the world. */
const ZOOM_WIDTH = 640;
const ZOOM_HEIGHT = 110;
const ZOOM_TOP = 180;
const ZOOM_PAD = 40;
/** The zoomed ten keeps this far from both edges of the world: half the ruler's own margin (40). */
const ZOOM_EDGE = DEFAULT_LAYOUT.left / 2;
const ZOOM_BG = 0x14203a;
/** Help steps (US5): the highlight colour, the pulse and the time the solution marker takes to reach the answer. */
const HELP = 0x9be89f;
const HELP_PULSE_MS = 600;
const SOLUTION_MOVE_MS = 900;
const ARROW_FROM = 44;
const ARROW_TO = 140;
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';

/** A chip's colours: the number's colour and the plate's. */
interface ChipStyle {
  fg: string;
  bg: number;
}

/** Where a chip comes from; each source is replaced as a whole. */
type ChipSource = 'help' | 'start' | 'steps' | 'typed';

interface Drawn {
  min: number;
  max: number;
  seed: number;
  /** "Nur Rechnen" draws no ruler band (amendment 17). */
  hidden: boolean;
  rulerLevel: RulerLevel;
}

export class NumberLineView {
  private readonly ruler: Phaser.GameObjects.Graphics;
  private readonly marks: Phaser.GameObjects.Graphics;
  /** "Keine Linien" (FR-147): the straight line help step 1 shows briefly, the tank it belongs to, and the help it showed for. */
  private readonly helpLine: Phaser.GameObjects.Graphics;
  private helpLineTank: string | null = null;
  private helpLineKey: string | null = null;
  private labels: Phaser.GameObjects.Text[] = [];
  /** The ruler's own labels by number and their boxes, so a chip can hide the labels under it (T228). */
  private labelByValue = new Map<number, Phaser.GameObjects.Text>();
  private labelBoxes: RulerLabelBox[] = [];
  /**
   * Chips (T228): numbers on a plate on the first label row, from the help steps, the starting number, the stops of
   * the step animation and the typed number on a crowded ruler. layoutChips keeps the ones that do not overlap and
   * hides the ruler labels under them.
   */
  private readonly chipSources: Record<ChipSource, { chip: Chip; style: ChipStyle }[]> = { help: [], start: [], steps: [], typed: [] };
  private readonly chipPlates: Phaser.GameObjects.Graphics;
  private readonly chipTexts: Phaser.GameObjects.Text[] = [];
  private readonly zoom: Phaser.GameObjects.Graphics;
  private zoomLabels: Phaser.GameObjects.Text[] = [];
  /** The ruler's lines as drawn, and whether a typed number gets its own label under the marker. */
  private ruled: { ticks: Tick[]; labelTypedNumber: boolean } = { ticks: [], labelTypedNumber: false };
  private readonly landedText: Phaser.GameObjects.Text;
  /** A hit's landing marker, which fades out (T233), and the hit it belongs to. */
  private readonly hitMarkGraphics: Phaser.GameObjects.Graphics;
  private hitMark: { owner: HitOwner; done: boolean } | null = null;
  private readonly stepsText: Phaser.GameObjects.Text;
  private drawn: Drawn | null = null;
  private dragging = false;
  private last: RoundState | null = null;
  /** The ring that pulses on the ruler at the destroyed enemy's number after a hit. */
  private readonly pulse: Phaser.GameObjects.Graphics;
  private pulsedShot: RoundState['lastShot'] = null;
  /** The starting number's ring on the ruler (US3, T083); its number is a chip. */
  private readonly startChip: Phaser.GameObjects.Graphics;
  /** Step animation (T082): passed lines and stops, the tank icon, the step count and the stop labels. */
  private readonly stepLines: Phaser.GameObjects.Graphics;
  private readonly stepIcon: Phaser.GameObjects.Image;
  private readonly stepCount: Phaser.GameObjects.Text;
  private stepTimer: Phaser.Time.TimerEvent | null = null;
  /** The stepAnimation array being shown, so a state update never starts it twice. */
  private animated: number[] | null = null;
  /** Help steps (T099, T100): the content being shown, its drawings, texts and timer. */
  private helpShown: HelpContent | null = null;
  private readonly helpLines: Phaser.GameObjects.Graphics;
  private readonly helpPulse: Phaser.GameObjects.Graphics;
  private readonly helpArrow: Phaser.GameObjects.Graphics;
  private readonly helpMarker: Phaser.GameObjects.Graphics;
  private helpTexts: Phaser.GameObjects.Text[] = [];
  private helpTimer: Phaser.Time.TimerEvent | null = null;
  /** Where showZoom drew the zoomed ten, so the count can pop up over its lines. */
  private zoomed: { view: { min: number; max: number }; zx: (v: number) => number; axisY: number } | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly controller: BattleController,
    private readonly worldHeight: number,
  ) {
    this.ruler = scene.add.graphics().setDepth(10);
    this.marks = scene.add.graphics().setDepth(11);
    this.helpLine = scene.add.graphics().setDepth(12);
    scene.game.canvas.dataset.helpLine = '';
    this.zoom = scene.add.graphics().setDepth(13);
    this.pulse = scene.add.graphics().setDepth(12).setVisible(false);
    this.chipPlates = scene.add.graphics().setDepth(12);
    this.hitMarkGraphics = scene.add.graphics().setDepth(11).setVisible(false);
    const big = { fontFamily: FONT, fontSize: '56px', fontStyle: 'bold', color: '#ffd54a', stroke: '#14203a', strokeThickness: 8 };
    this.landedText = scene.add.text(0, 0, '', { ...big, color: '#ff8a65' }).setOrigin(0.5, 1).setDepth(12).setVisible(false);
    this.stepsText = scene.add
      .text(0, 0, '', { fontFamily: FONT, fontSize: '28px', fontStyle: 'bold', color: '#ffffff', stroke: '#14203a', strokeThickness: 6 })
      .setOrigin(0.5, 0)
      .setDepth(12)
      .setVisible(false);

    this.startChip = scene.add.graphics().setDepth(12).setVisible(false);
    this.stepLines = scene.add.graphics().setDepth(12);
    this.stepIcon = scene.add.image(0, 0, TEX.tankBody).setOrigin(0.5, 1).setScale(0.7).setTint(START).setDepth(14).setVisible(false);
    this.stepCount = scene.add
      .text(0, 0, '', { fontFamily: FONT, fontSize: `${STEP_COUNT_FONT}px`, fontStyle: 'bold', color: '#ffffff', stroke: '#14203a', strokeThickness: STEP_COUNT_STROKE })
      .setOrigin(0.5, 0.5)
      .setDepth(14)
      .setVisible(false);

    this.helpLines = scene.add.graphics().setDepth(12);
    this.helpPulse = scene.add.graphics().setDepth(12).setVisible(false);
    this.helpArrow = scene.add.graphics().setDepth(12).setVisible(false);
    this.helpMarker = scene.add.graphics().setDepth(14).setVisible(false);
    this.resetHelpData();

    scene.game.canvas.dataset.stepAnimation = '';
    scene.game.canvas.dataset.stepCount = '0';

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
    const hidden = !MODE_TRAITS[s.mode].showsRuler;
    if (!d || d.min !== min || d.max !== max || d.seed !== s.seed || d.rulerLevel !== rulerLevel || d.hidden !== hidden) {
      this.drawn = { min, max, seed: s.seed, rulerLevel, hidden };
      this.dragging = false;
      if (hidden) this.hideRuler();
      else this.drawRuler(min, max, rulerLevel);
    }
    this.drawMarks(s, min, max);
    this.pulseHit(s, min, max);
    this.drawStart(s, min, max);
    if (s.stepAnimation !== this.animated) this.startSteps(s.stepAnimation, min, max);
    const help = s.phase === 'roundOver' ? null : s.help.content;
    if (help !== this.helpShown) this.showHelp(help, s, min, max);
  }

  /** Draws one help step (US5, FR-031), after clearing the previous one; null clears only. */
  private showHelp(h: HelpContent | null, s: RoundState, min: number, max: number): void {
    this.clearHelp();
    this.helpShown = h;
    if (!h) return;
    const data = this.scene.game.canvas.dataset;
    data.helpStep = String(h.step);
    const landed = landedOf(s);
    if (h.direction && landed !== null) this.helpDirection(numberToX(landed, min, max), h.direction);
    if (h.nearestMajor !== null) this.helpHighlight(h.nearestMajor, min, max);
    if (h.zoom) {
      this.showZoom(h.zoom);
      data.helpZoom = `${h.zoom.min},${h.zoom.max}`;
    }
    if (h.count) this.helpCount(h.count.from, h.count.to, min, max);
    if (h.optionMarkers) this.helpOptions(h.optionMarkers, min, max);
    if (h.solution !== null) this.helpSolution(h.solution, landed ?? h.nearestMajor, min, max);
  }

  /** Step 1: an arrow beside the landing marker toward the answer, nudging back and forth. */
  private helpDirection(lx: number, direction: 'right' | 'left'): void {
    const sign = direction === 'right' ? 1 : -1;
    const y = RULER_TOP - 36;
    const g = this.helpArrow.setPosition(0, 0).setVisible(true);
    g.lineStyle(8, HELP, 1);
    g.lineBetween(lx + sign * ARROW_FROM, y, lx + sign * (ARROW_TO - 18), y);
    g.fillStyle(HELP, 1);
    g.fillTriangle(lx + sign * ARROW_TO, y, lx + sign * (ARROW_TO - 26), y - 18, lx + sign * (ARROW_TO - 26), y + 18);
    this.scene.tweens.add({ targets: g, x: sign * 14, duration: HELP_PULSE_MS, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  /** Step 1: the nearest major line to the answer, drawn tall and pulsing, with its number on a chip. */
  private helpHighlight(n: number, min: number, max: number): void {
    const x = numberToX(n, min, max);
    const g = this.helpPulse.setPosition(x, AXIS_Y).setAlpha(1).setVisible(true);
    g.lineStyle(7, HELP, 1);
    g.lineBetween(0, -MAJOR_TICK, 0, MAJOR_TICK * 0.6);
    g.strokeCircle(0, 0, 20);
    this.helpChip('nearestMajor', x, n, CHIP_PRIORITY.nearestMajor);
    this.scene.tweens.add({ targets: g, alpha: 0.3, duration: HELP_PULSE_MS, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.scene.game.canvas.dataset.helpHighlight = String(n);
  }

  /** A help number on a dark chip under the ruler line; the ruler labels under it are hidden (T228). */
  private helpChip(key: string, x: number, n: number, priority: number): void {
    const help = this.chipSources.help.filter((c) => c.chip.key !== key);
    help.push({ chip: { key, x, text: String(n), priority }, style: { fg: cssColor(HELP), bg: RULER_BG } });
    this.setChips('help', help);
  }

  /** Replaces the chips of one source and draws all chips again. */
  private setChips(source: ChipSource, chips: { chip: Chip; style: ChipStyle }[]): void {
    const old = this.chipSources[source];
    const same = old.length === chips.length && old.every((c, i) => c.chip.key === chips[i]!.chip.key && c.chip.x === chips[i]!.chip.x && c.chip.text === chips[i]!.chip.text);
    this.chipSources[source] = chips;
    if (!same) this.renderChips();
  }

  /** Draws the kept chips and hides the ruler labels under them (T228, FR-017, FR-031). */
  private renderChips(): void {
    const all = [...this.chipSources.typed, ...this.chipSources.start, ...this.chipSources.steps, ...this.chipSources.help];
    const { shown, hiddenLabels } = layoutChips(
      this.labelBoxes,
      all.map((c) => c.chip),
    );
    const g = this.chipPlates.clear();
    shown.forEach((chip, i) => {
      const style = all.find((c) => c.chip === chip)!.style;
      const b = chipBox(chip.x, chip.text, chip.fontSize);
      g.fillStyle(style.bg, 1).fillRoundedRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0, 8);
      const fontSize = `${chip.fontSize ?? CHIP_FONT}px`;
      // Chip texts are kept and reused, so a change does not create new text objects (each one is a canvas texture).
      const pooled = this.chipTexts[i];
      if (pooled) {
        pooled.setFontSize(fontSize).setColor(style.fg).setText(chip.text).setPosition(chip.x, LABEL_Y).setVisible(true);
      } else {
        const text = this.scene.add
          .text(chip.x, LABEL_Y, chip.text, { fontFamily: FONT, fontSize, fontStyle: 'bold', color: style.fg })
          .setOrigin(0.5, 0)
          .setDepth(13);
        this.chipTexts.push(text);
      }
    });
    for (const text of this.chipTexts.slice(shown.length)) text.setVisible(false);
    for (const [value, label] of this.labelByValue) label.setVisible(!hiddenLabels.has(value));
    this.scene.game.canvas.dataset.hiddenLabels = [...hiddenLabels].sort((a, b) => a - b).join(',');
    this.scene.game.canvas.dataset.chips = shown.map((c) => c.text).join(',');
  }

  /**
   * Step 2: counts from `from` to `to` one unit at a time. The passed stretch of the ruler lights up with the running
   * count above it; inside the zoomed ten every passed line gets its count popping up.
   */
  private helpCount(from: number, to: number, min: number, max: number): void {
    const steps = Math.abs(to - from);
    const dir = Math.sign(to - from);
    const ms = stepMs(steps);
    const x0 = numberToX(from, min, max);
    // The running count stands beside the head of the counted stretch, inside the ruler band (T229).
    const placeCount = (x: number, text: string) => {
      const b = stepCountBox(x, dir, text, COUNT_HEAD_HALF);
      running.setText(text).setPosition((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2);
    };
    const running = this.helpText(x0, AXIS_Y, '0', STEP_COUNT_FONT, 0xffffff).setOrigin(0.5, 0.5);
    placeCount(x0, '0');
    const data = this.scene.game.canvas.dataset;
    data.helpCount = '0';
    let count = 0;
    const next = (): void => {
      count++;
      const value = from + dir * count;
      const x = numberToX(value, min, max);
      const g = this.helpLines;
      g.lineStyle(6, HELP, 1);
      g.lineBetween(numberToX(value - dir, min, max), AXIS_Y, x, AXIS_Y);
      g.lineStyle(3, HELP, 1);
      g.lineBetween(x, AXIS_Y - MINOR_TICK / 2, x, AXIS_Y + MINOR_TICK / 2);
      placeCount(x, String(count));
      const z = this.zoomed;
      if (z && value >= z.view.min && value <= z.view.max) {
        const pop = this.helpText(z.zx(value), z.axisY - 14, String(count), 24, HELP).setOrigin(0.5, 1).setScale(0.2);
        this.scene.tweens.add({ targets: pop, scale: 1, duration: Math.min(220, ms), ease: 'Back.easeOut' });
      }
      data.helpCount = String(count);
      this.helpTimer = count < steps ? this.scene.time.delayedCall(ms, next) : null;
    };
    if (steps > 0) this.helpTimer = this.scene.time.delayedCall(STOP_PAUSE_MS, next);
  }

  /** Comparison step 2: a marker on the ruler under each option's number, with the number on a chip. */
  private helpOptions(options: number[], min: number, max: number): void {
    const g = this.helpLines;
    for (const n of options) {
      const x = numberToX(n, min, max);
      g.fillStyle(HELP, 1);
      g.fillTriangle(x - 14, RULER_TOP - 14, x + 14, RULER_TOP - 14, x, AXIS_Y - 6);
      g.lineStyle(5, HELP, 1);
      g.lineBetween(x, AXIS_Y - MAJOR_TICK / 2, x, AXIS_Y + MAJOR_TICK / 2);
      this.helpChip(`option:${n}`, x, n, CHIP_PRIORITY.option);
    }
    this.scene.game.canvas.dataset.helpOptions = options.join(',');
  }

  /**
   * Step 3: a marker moves along the ruler to the solution, which is then shown in large digits beside the enemy's
   * pointer line, never over a tank (T229, helpTextScene).
   */
  private helpSolution(n: number, from: number | null, min: number, max: number): void {
    const x = numberToX(n, min, max);
    const s = this.last;
    const place = s ? helpTextScene(this.sceneInput(s, min, max)).solution : null;
    const start = numberToX(from ?? (min + max) / 2, min, max);
    const g = this.helpMarker.setPosition(start, 0).setVisible(true);
    g.fillStyle(HELP, 1);
    g.fillTriangle(-18, RULER_TOP - 20, 18, RULER_TOP - 20, 0, AXIS_Y - 4);
    g.lineStyle(6, HELP, 1);
    g.strokeCircle(0, AXIS_Y, 16);
    const big = (place ? this.helpText((place.x0 + place.x1) / 2, place.y1, String(n), 72, HELP) : this.helpText(x, LANDED_BOTTOM, String(n), 72, HELP)).setOrigin(0.5, 1).setAlpha(0);
    this.scene.tweens.add({
      targets: g,
      x,
      duration: SOLUTION_MOVE_MS,
      ease: 'Quad.easeInOut',
      onComplete: () => {
        big.setAlpha(1);
        this.helpChip('solution', x, n, CHIP_PRIORITY.solution);
      },
    });
    this.scene.game.canvas.dataset.helpSolution = String(n);
  }

  /** The inputs of helpTextScene from the round state: tanks on screen, the step path and the landing number. */
  private sceneInput(s: RoundState, min: number, max: number): Parameters<typeof helpTextScene>[0] {
    const enemy = visibleEnemy(s);
    const ground = (tank: TankState) => ({ x: tank.x, groundY: toScreenY(tank.y, this.worldHeight) });
    return {
      range: { min, max },
      level: s.rulerLevel,
      challenge: s.challenge,
      help: s.help.content,
      stepPath: s.stepAnimation,
      landed: landedOf(s),
      labels: this.drawn && !this.drawn.hidden ? this.labelBoxes : undefined,
      enemy: enemy ? ground(enemy) : null,
      player: ground(s.player),
      worldWidth: WORLD_WIDTH,
    };
  }

  private helpText(x: number, y: number, text: string, size: number, color: number): Phaser.GameObjects.Text {
    const t = this.scene.add
      .text(x, y, text, { fontFamily: FONT, fontSize: `${size}px`, fontStyle: 'bold', color: cssColor(color), stroke: '#14203a', strokeThickness: 7 })
      .setDepth(14);
    this.helpTexts.push(t);
    return t;
  }

  private clearHelp(): void {
    this.helpTimer?.remove();
    this.helpTimer = null;
    for (const g of [this.helpPulse, this.helpArrow, this.helpMarker]) {
      this.scene.tweens.killTweensOf(g);
      g.clear().setVisible(false).setPosition(0, 0).setAlpha(1);
    }
    this.helpLines.clear();
    this.setChips('help', []);
    for (const text of this.helpTexts) {
      this.scene.tweens.killTweensOf(text);
      text.destroy();
    }
    this.helpTexts = [];
    if (this.helpShown?.zoom) this.hideZoom();
    this.helpShown = null;
    this.resetHelpData();
  }

  private resetHelpData(): void {
    const data = this.scene.game.canvas.dataset;
    data.helpStep = '';
    data.helpHighlight = '';
    data.helpZoom = '';
    data.helpCount = '';
    data.helpOptions = '';
    data.helpSolution = '';
  }

  /** The starting number of an addition or subtraction: a ring on the ruler and its number on a chip (T083). */
  private drawStart(s: RoundState, min: number, max: number): void {
    const c = s.challenge;
    const choosing = s.phase === 'challenge' || s.phase === 'paused';
    const start = choosing && c && (c.kind === 'addition' || c.kind === 'subtraction') ? c.operands[0] : undefined;
    this.startChip.clear().setVisible(false);
    this.scene.game.canvas.dataset.startHighlight = start === undefined ? '' : String(start);
    if (start === undefined) {
      this.setChips('start', []);
      return;
    }
    const x = numberToX(start, min, max);
    const g = this.startChip.setVisible(true);
    g.lineStyle(5, START, 1);
    g.strokeCircle(x, AXIS_Y, 14);
    this.setChips('start', [{ chip: { key: 'start', x, text: String(start), priority: CHIP_PRIORITY.start }, style: { fg: '#14203a', bg: START } }]);
  }

  /** Starts the step animation along `path`, or clears it when path is null (T082, FR-024). */
  private startSteps(path: number[] | null, min: number, max: number): void {
    this.stopSteps();
    this.animated = path;
    const canvas = this.scene.game.canvas;
    canvas.dataset.stepAnimation = path ? path.join(',') : '';
    canvas.dataset.stepCount = '0';
    if (!path || path.length < 2) return;
    const frames = stepFrames(path);
    const ms = stepMs(frames.length);
    const x0 = numberToX(path[0]!, min, max);
    this.stepIcon.setPosition(x0, AXIS_Y - 2).setVisible(true);
    let i = 0;
    const next = (): void => {
      const frame = frames[i++];
      if (!frame) {
        this.stepTimer = null;
        return;
      }
      this.showStep(path[0]!, frame, min, max);
      this.stepTimer = this.scene.time.delayedCall(frame.stop ? ms + STOP_PAUSE_MS : ms, next);
    };
    this.stepTimer = this.scene.time.delayedCall(STOP_PAUSE_MS, next);
  }

  /** One unit step: every line from the start to here, the icon on the new number, the count above it. */
  private showStep(start: number, frame: StepFrame, min: number, max: number): void {
    const g = this.stepLines;
    const x = numberToX(frame.value, min, max);
    g.lineStyle(3, START, 1);
    g.lineBetween(numberToX(start, min, max), AXIS_Y, x, AXIS_Y);
    g.lineStyle(frame.stop ? 4 : 2, LINE, 1);
    const len = frame.stop ? MAJOR_TICK : MINOR_TICK;
    g.lineBetween(x, AXIS_Y - len / 2, x, AXIS_Y + len / 2);
    this.stepIcon.setPosition(x, AXIS_Y - 2);
    // The count stands beside the walking marker, behind it, never over a tank (T229).
    const b = stepCountBox(x, Math.sign(frame.value - start), String(frame.count));
    this.stepCount.setText(String(frame.count)).setPosition((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2).setVisible(true);
    if (frame.stop) this.stepLabel(frame.value, min, max);
    this.scene.game.canvas.dataset.stepCount = String(frame.count);
  }

  /** A stop's number on a dark chip under the ruler line; the ruler labels under it are hidden (T228). */
  private stepLabel(n: number, min: number, max: number): void {
    const chip: Chip = { key: `stop:${n}`, x: numberToX(n, min, max), text: String(n), priority: CHIP_PRIORITY.stop };
    this.setChips('steps', [...this.chipSources.steps, { chip, style: { fg: cssColor(START), bg: RULER_BG } }]);
  }

  private stopSteps(): void {
    this.stepTimer?.remove();
    this.stepTimer = null;
    this.stepLines.clear();
    this.stepIcon.setVisible(false);
    this.stepCount.setVisible(false);
    this.setChips('steps', []);
  }

  /** A short pulse on the ruler where the destroyed enemy stood, once per hit (T066). */
  private pulseHit(s: RoundState, min: number, max: number): void {
    const shot = s.lastShot;
    if (!shot?.hit || shot === this.pulsedShot) return;
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
    const { ticks } = ticksFor(view, level, { allLines: true });
    const fromX = numberToX(view.min, min, max);
    const toX = numberToX(view.max, min, max);
    const center = clamp((fromX + toX) / 2, ZOOM_EDGE + ZOOM_WIDTH / 2, WORLD_WIDTH - ZOOM_EDGE - ZOOM_WIDTH / 2);
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
      const [len, width] = lineSize(tick.size);
      g.lineStyle(width, LINE, 1);
      g.lineBetween(x, axisY - len / 2, x, axisY + len / 2);
      const label = this.scene.add
        .text(x, axisY + 22, String(tick.value), { fontFamily: FONT, fontSize: tick.major ? '26px' : '22px', fontStyle: 'bold', color: '#f4f6fb' })
        .setOrigin(0.5, 0)
        .setDepth(13);
      this.zoomLabels.push(label);
    }
    this.zoomed = { view, zx, axisY };
  }

  hideZoom(): void {
    this.zoomed = null;
    this.zoom.clear();
    for (const label of this.zoomLabels) label.destroy();
    this.zoomLabels = [];
  }

  destroy(): void {
    this.scene.input.off(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    this.scene.input.off(Phaser.Input.Events.GAME_OUT, this.onUp, this);
    this.clearHelp();
    this.hideZoom();
    this.stopSteps();
    this.scene.tweens.killTweensOf(this.pulse);
    this.scene.tweens.killTweensOf(this.helpLine);
  }

  /** "Nur Rechnen" (amendment 17, FR-123): no ruler band, lines or labels. */
  private hideRuler(): void {
    for (const label of this.labels) label.destroy();
    this.labels = [];
    this.labelByValue.clear();
    this.ruler.clear();
    this.ruled = { ticks: [], labelTypedNumber: false };
    this.labelBoxes = [];
    this.renderChips();
    this.scene.game.canvas.dataset.rulerLabels = '';
    this.scene.game.canvas.dataset.rulerLines = '0';
  }

  private drawRuler(min: number, max: number, rulerLevel: RulerLevel): void {
    for (const label of this.labels) label.destroy();
    this.labels = [];
    this.labelByValue.clear();
    const g = this.ruler;
    const x0 = numberToX(min, min, max);
    const x1 = numberToX(max, min, max);
    g.clear();
    g.fillStyle(RULER_BG, 0.78);
    g.fillRoundedRect(x0 - 48, RULER_TOP - 8, x1 - x0 + 96, RULER_BOTTOM - RULER_TOP + 16, 14);
    g.lineStyle(4, LINE, 1);
    g.lineBetween(x0, AXIS_Y, x1, AXIS_Y);

    const ruled = ticksFor({ min, max }, rulerLevel);
    const { ticks, labelTypedNumber, labelRows } = ruled;
    this.ruled = { ticks, labelTypedNumber };
    // Every level draws every line (amendment 20); the level only chooses the labels.
    for (const tick of ticks) {
      const x = numberToX(tick.value, min, max);
      const end = tick.value === min || tick.value === max;
      const [len, width] = lineSize(end ? 'major' : tick.size);
      g.lineStyle(width, LINE, 1);
      g.lineBetween(x, AXIS_Y - len / 2, x, AXIS_Y + len / 2);
      if (!tick.labeled) continue;
      const size = labelFontSize(tick, labelRows, { min, max });
      const label = this.scene.add
        .text(x + tick.shift, tick.row === 1 ? LABEL_ROW_2_Y : LABEL_Y, String(tick.value), { fontFamily: FONT, fontSize: `${size}px`, fontStyle: 'bold', color: '#f4f6fb' })
        .setOrigin(0.5, 0)
        .setDepth(10);
      this.labels.push(label);
      this.labelByValue.set(tick.value, label);
    }
    this.labelBoxes = rulerLabelBoxes({ min, max }, rulerLevel, ruled);
    this.renderChips();
    this.scene.game.canvas.dataset.rulerLines = String(ticks.length);
    this.scene.game.canvas.dataset.rulerLabels = ticks
      .filter((tick) => tick.labeled)
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
    this.scene.game.canvas.dataset.previewText = n === undefined ? '' : String(n);
    if (n === undefined) {
      this.setChips('typed', []);
      return;
    }
    const chip: Chip = { key: 'typed', x: numberToX(n, min, max), text: String(n), priority: CHIP_PRIORITY.typed, fontSize: 22 };
    this.setChips('typed', [{ chip, style: { fg: '#ffd54a', bg: RULER_BG } }]);
  }

  private drawMarks(s: RoundState, min: number, max: number): void {
    const g = this.marks;
    g.clear();
    const inFlight = s.phase === 'playerShot';

    // Landing marker and distance bracket: after a miss until the next player shot; after a hit it fades out after
    // about 2 seconds and goes at once when a later challenge starts (T233, FR-004).
    const shot = s.lastShot;
    const hitShown = shot?.hit ? this.hitMarkShown(shot, s, min, max) : (this.clearHitMark(), false);
    if (shot && !inFlight && !shot.hit) {
      const lx = this.drawLandingMark(g, shot.landed, min, max);

      // The step count refers to the enemy, or in comparison turns to the nearest standing tank (amendment 10).
      const to = shot.targetNumber;
      if (shot.nearMiss) {
        // A near miss on a tank body: the child's number and the distance, no enemy number (amendment 06, FR-072).
        this.drawBracket(lx, numberToX(shot.targetNumber, min, max), t().battle.compare(shot.fired, shot.targetNumber));
      } else if (to !== shot.landed && shot.wave) {
        // A miss at a wave: the landing number and the steps to the nearest standing enemy, no enemy number (FR-140).
        this.drawBracket(lx, numberToX(to, min, max), t().battle.compare(shot.landed, to));
      } else if (to !== shot.landed) {
        // Every miss, in every mode: the steps from the landing number to the tank (amendments 07 and 10, FR-072).
        this.drawBracket(lx, numberToX(to, min, max), t().battle.steps(Math.abs(shot.landed - to)));
      } else {
        this.hideSteps();
      }
    } else {
      if (!hitShown) {
        this.landedText.setVisible(false);
        this.scene.game.canvas.dataset.landing = '';
      }
      this.hideSteps();
    }

    this.drawPointerLines(s);

    // Selection: guide line from the ruler up to the battlefield, target marker on the ground, marker on the ruler.
    // Hidden by "Zielkreuz" (amendment 19): no guide line, target marker, ruler marker or typed label.
    const cross = aimCrossShown(this.controller.getRoundSettings().aimCross, s.rulerLevel);
    this.scene.game.canvas.dataset.aimCross = cross ? 'on' : 'off';
    const choosing = acceptsInput(s.phase) || s.phase === 'paused';
    this.drawTypedLabel(choosing && cross ? s.selection : null, s.entry.typed !== '', min, max);
    if (s.selection === null || !choosing || !cross) return;
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

  /**
   * The landing marker of a hit (T233): shown when the hit is first seen, faded out from HIT_FADE_DELAY_MS over
   * HIT_FADE_MS, and removed at once when a later challenge starts. Returns whether it is still shown.
   */
  private hitMarkShown(shot: NonNullable<RoundState['lastShot']>, s: RoundState, min: number, max: number): boolean {
    const owner = followHit(this.hitMark?.owner ?? null, s)!;
    if (this.hitMark?.owner.shot !== shot) {
      this.clearHitMark();
      const g = this.hitMarkGraphics.clear().setAlpha(1).setVisible(true);
      this.drawLandingMark(g, shot.landed, min, max);
      this.hitMark = { owner, done: false };
      this.scene.tweens.add({
        targets: [g, this.landedText],
        alpha: 0,
        delay: HIT_FADE_DELAY_MS,
        duration: HIT_FADE_MS,
        onComplete: () => this.clearHitMark(true),
      });
    }
    this.hitMark.owner = owner;
    if (!this.hitMark.done && hitOutdated(owner, s)) this.clearHitMark(true);
    return !this.hitMark.done;
  }

  /** The landing marker at `landed`: a triangle on the ruler and the number in large digits. Returns its x. */
  private drawLandingMark(g: Phaser.GameObjects.Graphics, landed: number, min: number, max: number): number {
    const lx = numberToX(landed, min, max);
    g.fillStyle(LANDED, 1);
    g.fillTriangle(lx - 12, RULER_TOP - 6, lx + 12, RULER_TOP - 6, lx, AXIS_Y - 4);
    this.landedText.setAlpha(1).setText(String(landed)).setPosition(lx, LANDED_BOTTOM).setVisible(true);
    this.scene.game.canvas.dataset.landing = String(landed);
    return lx;
  }

  /** Removes a hit's landing marker; `keep` remembers the hit, so it is not shown again. */
  private clearHitMark(keep = false): void {
    if (!this.hitMark) return;
    this.scene.tweens.killTweensOf([this.hitMarkGraphics, this.landedText]);
    this.hitMarkGraphics.clear().setVisible(false).setAlpha(1);
    this.landedText.setVisible(false).setAlpha(1);
    this.scene.game.canvas.dataset.landing = '';
    if (keep) this.hitMark.done = true;
    else this.hitMark = null;
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
    this.scene.game.canvas.dataset.stepsLabel = text;
  }

  private hideSteps(): void {
    this.stepsText.setVisible(false);
    this.scene.game.canvas.dataset.stepsLabel = '';
  }

  /**
   * Dashed lines with an end triangle from each visible tank's center to the ruler, with no number (FR-073): the
   * enemy and, in comparison turns, every standing decoy (amendment 10). "Keine Linien" draws none (FR-147).
   */
  private drawPointerLines(s: RoundState): void {
    const enemy = visibleEnemy(s);
    // "Nur Rechnen" has no ruler for the lines to point at (amendment 17).
    // Amendment 21: every standing enemy of a wave has its line too.
    const visible: TankState[] = !MODE_TRAITS[s.mode].showsRuler
      ? []
      : [...(enemy ? [enemy] : []), ...s.wave.filter((t) => t.alive), ...s.decoys.filter((d) => d.alive)].sort((a, b) => a.position - b.position);
    const style = this.controller.getRoundSettings().lineStyle;
    const data = this.scene.game.canvas.dataset;
    data.lineStyle = style;
    if (style === 'straight') {
      this.hideHelpLine();
      data.pointerLines = visible.map((tank) => tank.position).join(',');
      for (const tank of visible) this.drawStraightLine(this.marks, tank);
      return;
    }
    // "Keine Linien" (amendment 21 item 16, FR-147): the child reads the number straight below the tank. Help step 1
    // shows the help target's line once per help change, once the child can choose again.
    data.pointerLines = '';
    const helpKey = `${s.challenge?.id}|${s.enemy.id}|${s.help.wrongAnswers}|${s.help.level}`;
    const target = visible.find((tank) => tank.id === s.enemy.id);
    if (target && s.phase === 'challenge' && s.help.content?.step === 1 && helpKey !== this.helpLineKey) {
      this.helpLineKey = helpKey;
      this.showHelpLine(target);
    } else if (this.helpLineTank !== null && !visible.some((tank) => tank.id === this.helpLineTank)) {
      this.hideHelpLine();
    }
  }

  /** One dashed pointer line with its end triangle from the tank's center down to the ruler (FR-073). */
  private drawStraightLine(g: Phaser.GameObjects.Graphics, tank: TankState): void {
    const c = tankCenter(tank);
    const line = pointerLine({ x: c.x, y: toScreenY(c.y, this.worldHeight) }, AXIS_Y);
    g.lineStyle(2, POINTER, 0.8);
    g.fillStyle(POINTER, 0.9);
    for (const d of line.dashes) g.lineBetween(d.x, d.y0, d.x, d.y1);
    const [a, b, tip] = line.triangle;
    g.fillTriangle(a.x, a.y, b.x, b.y, tip.x, tip.y);
  }

  /** "Keine Linien" (FR-147): the tank's straight pointer line for HELP_LINE_MS, fading out at the end. */
  private showHelpLine(tank: TankState): void {
    const g = this.helpLine;
    this.scene.tweens.killTweensOf(g);
    g.clear().setAlpha(1);
    this.drawStraightLine(g, tank);
    this.helpLineTank = tank.id;
    this.scene.game.canvas.dataset.helpLine = String(tank.position);
    this.scene.tweens.add({ targets: g, alpha: 0, delay: HELP_LINE_MS - 300, duration: 300, onComplete: () => this.hideHelpLine() });
  }

  private hideHelpLine(): void {
    if (this.helpLineTank === null) return;
    this.scene.tweens.killTweensOf(this.helpLine);
    this.helpLine.clear().setAlpha(1);
    this.helpLineTank = null;
    this.scene.game.canvas.dataset.helpLine = '';
  }

  private onDown(p: Phaser.Input.Pointer): void {
    if (p.worldY < RULER_TOP - GRAB_MARGIN || p.worldY > RULER_BOTTOM + GRAB_MARGIN) return;
    const s = this.controller.getState();
    if (!acceptsInput(s.phase) || !MODE_TRAITS[s.mode].showsRuler) return;
    this.dragging = true;
    this.select(p);
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (this.dragging) this.select(p);
  }

  /** The drawing does not depend on the drag, so releasing changes nothing on screen. */
  private onUp(): void {
    this.dragging = false;
  }

  /**
   * Selects the number under the pointer; the controller's state update redraws. The same number does nothing, unless
   * it was typed: pointing at it still clears the typed digits and counts as pointer input (FR-019, FR-076).
   */
  private select(p: Phaser.Input.Pointer): void {
    const { min, max } = this.controller.getRoundSettings().range;
    const n = xToNumber(p.worldX, min, max);
    const s = this.controller.getState();
    if (n !== s.selection || s.entry.typed !== '') this.controller.selectNumber(n);
  }
}

/** Length and stroke width of a ruler line by its size (T235): major, medium (half a major step) or minor. */
function lineSize(size: TickSize): [number, number] {
  if (size === 'major') return [MAJOR_TICK, 4];
  return size === 'medium' ? [MEDIUM_TICK, 3] : [MINOR_TICK, 2];
}
