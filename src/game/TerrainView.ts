/**
 * Draws the ground (FR-005, research R5) and below it a flat bedrock strip from the floor line to the bottom of the
 * world. The ground never drops below the floor, so the ruler drawn on the strip always sits below the ground and the
 * tanks (tasks.md T184).
 * Heightmaps are never changed in place, so a new array means the ground changed; update() then redraws in the same
 * call, which puts the new crater on screen in the next rendered frame.
 * Amendment 13 (FR-101): after a destroyed enemy the new hills fade in over the old ground.
 *
 * Amendment 14 (FR-107, FR-108, SC-002): the ground is drawn with the Canvas 2D API into a canvas texture, once per
 * landscape and once per crater, never per frame: two layers of distant hills behind it (from the terrain seed), the
 * dirt texture as a pattern clipped to the hill outline (or a generated dirt pattern when the texture did not load),
 * darker soil layers lower down, pebbles, scorched crater edges and a thick grass edge with tufts. Two such textures
 * take turns for the cross-fade. For the end-to-end tests only (D4) the canvas carries `data-ground-texture`
 * (`dirt` or `generated`) and `data-ground-draws` (ground images drawn so far).
 */
import Phaser from 'phaser';
import type { Heightmap } from '../core/types';
import { FLOOR } from '../core/physics/terrain';
import { terrainPolygon, toScreenY } from '../core/view/geometry';
import { distantHills, pebbles, scorchMarks, tufts, type HillLayer, type Pebble, type Tuft } from '../core/view/groundArt';
import { cssColor, GROUND_COLORS } from '../core/view/shade';
import { clamp } from '../core/util';
import { TEX } from './textures';

const BEDROCK_EDGE = '#2a1d13';
/** Columns between polygon points; 2 keeps crater edges smooth at full size. */
const SAMPLE_STEP = 2;
/** The dirt texture is drawn at half size, so its cracks fit the tanks. */
const PATTERN_SCALE = 0.5;
/** Grass edge thickness (FR-107: at least 10). */
const GRASS_WIDTH = 12;
const SCORCH_WIDTH = 18;
/** Soil layers: lines that follow the surface at these depths. */
const LAYER_DEPTHS = [70, 150];

/** A cross-fade to new ground (amendment 13, FR-101): it starts after `delayMs` and takes `durationMs`. */
export interface TerrainFade {
  delayMs: number;
  durationMs: number;
}

interface Slot {
  texture: Phaser.Textures.CanvasTexture;
  image: Phaser.GameObjects.Image;
}


export class TerrainView {
  private current: Slot;
  /** The new ground during a cross-fade, drawn above the old one and faded in. */
  private next: Slot;
  private fade: Phaser.Tweens.Tween | null = null;
  private drawn: Heightmap | null = null;
  private drawnSeed: number | null = null;
  private marks: Uint8Array | null = null;
  private pebbles: Pebble[] = [];
  private tufts: Tuft[] = [];
  private hills: HillLayer[] = [];
  private seedOfDetails: number | null = null;
  private draws = 0;
  private readonly pattern: CanvasPattern | null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly worldHeight: number,
    private readonly worldWidth: number,
  ) {
    this.current = this.slot('ground-a');
    this.next = this.slot('ground-b');
    this.next.image.setAlpha(0);
    const textureKey = scene.textures.exists(TEX.dirt) ? TEX.dirt : TEX.dirtGenerated;
    this.pattern = this.makePattern(textureKey);
    scene.game.canvas.dataset.groundTexture = textureKey === TEX.dirt ? 'dirt' : 'generated';
    scene.game.canvas.dataset.groundDraws = '0';
  }

  private slot(key: string): Slot {
    const tex = this.scene.textures;
    if (tex.exists(key)) tex.remove(key);
    const texture = tex.createCanvas(key, this.worldWidth, this.worldHeight)!;
    const image = this.scene.add.image(0, 0, key).setOrigin(0, 0);
    return { texture, image };
  }

  private makePattern(key: string): CanvasPattern | null {
    const source = this.scene.textures.get(key).getSourceImage() as CanvasImageSource;
    const pattern = this.current.texture.context.createPattern(source, 'repeat');
    if (pattern && typeof DOMMatrix !== 'undefined') pattern.setTransform(new DOMMatrix().scale(PATTERN_SCALE));
    return pattern;
  }

  /**
   * Draws the ground. With `fade` the old ground stays until the new one has faded in over it (new hills after a
   * destroyed enemy, amendment 13); without it the change shows at once (a crater). A change during a fade ends the
   * fade first. A new `terrainSeed` is a new landscape: no scorch marks, new pebbles, tufts and distant hills.
   */
  update(terrain: Heightmap, terrainSeed: number, fade?: TerrainFade): void {
    if (terrain === this.drawn) return;
    const newLandscape = terrainSeed !== this.drawnSeed;
    this.marks = scorchMarks(newLandscape ? null : this.drawn, terrain, newLandscape ? null : this.marks);
    this.drawn = terrain;
    this.drawnSeed = terrainSeed;
    this.endFade();
    if (!fade) {
      this.draw(this.current, terrain, terrainSeed);
      return;
    }
    this.draw(this.next, terrain, terrainSeed);
    this.scene.children.moveAbove(this.next.image, this.current.image);
    this.next.image.setAlpha(0);
    this.fade = this.scene.tweens.add({
      targets: this.next.image,
      alpha: 1,
      delay: fade.delayMs,
      duration: fade.durationMs,
      ease: 'Sine.easeInOut',
      onComplete: () => this.endFade(),
    });
  }

  /** Ends a running cross-fade: the ground drawn last becomes the only one, without drawing it again. */
  private endFade(): void {
    if (!this.fade) return;
    this.fade.remove();
    this.fade = null;
    const old = this.current;
    this.current = this.next;
    this.next = old;
    this.current.image.setAlpha(1);
    this.next.image.setAlpha(0);
  }

  private draw(slot: Slot, terrain: Heightmap, seed: number): void {
    if (this.seedOfDetails !== seed) {
      this.seedOfDetails = seed;
      this.pebbles = pebbles(seed, this.worldWidth);
      this.tufts = tufts(seed, this.worldWidth);
      this.hills = distantHills(seed, this.worldWidth, this.worldHeight);
    }
    const ctx = slot.texture.context;
    const h = this.worldHeight;
    const w = this.worldWidth;
    const sy = (x: number) => toScreenY(terrain[clamp(Math.round(x), 0, terrain.length - 1)] as number, h);
    const floorY = toScreenY(FLOOR, h);
    ctx.clearRect(0, 0, w, h);

    // Two layers of distant hills (FR-107).
    for (const layer of this.hills) {
      ctx.beginPath();
      ctx.moveTo(0, floorY);
      for (const [x, y] of layer.points) ctx.lineTo(x, y);
      ctx.lineTo(w, floorY);
      ctx.closePath();
      ctx.fillStyle = cssColor(layer.color);
      ctx.fill();
    }

    // The ground, cut to the hill outline.
    const pts = terrainPolygon(terrain, h, SAMPLE_STEP);
    const outline = new Path2D();
    pts.forEach((p, i) => (i === 0 ? outline.moveTo(p.x, p.y) : outline.lineTo(p.x, p.y)));
    outline.closePath();
    ctx.save();
    ctx.clip(outline);
    ctx.fillStyle = this.pattern ?? cssColor(GROUND_COLORS.dirt);
    ctx.fillRect(0, 0, w, h);
    // A warm shade so the texture sits with the grass and the sky.
    ctx.fillStyle = 'rgba(70, 40, 15, 0.22)';
    ctx.fillRect(0, 0, w, h);
    // Soil layers: lines along the surface lower down, and darker soil toward the floor.
    for (const depth of LAYER_DEPTHS) {
      ctx.beginPath();
      for (let x = 0; x <= w; x += 8) ctx.lineTo(x, sy(x) + depth + 10 * Math.sin(x / 90 + depth));
      ctx.lineWidth = 22;
      ctx.strokeStyle = 'rgba(70, 42, 20, 0.28)';
      ctx.stroke();
    }
    const top = Math.min(...pts.map((p) => p.y));
    const grad = ctx.createLinearGradient(0, top, 0, floorY);
    grad.addColorStop(0, 'rgba(60, 35, 15, 0)');
    grad.addColorStop(1, 'rgba(60, 35, 15, 0.6)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, top, w, floorY - top);
    // Pebbles.
    for (const p of this.pebbles) {
      const y = sy(p.x) + p.depth;
      ctx.beginPath();
      ctx.ellipse(p.x, y, p.rx, p.ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = cssColor(p.color);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(p.x - p.rx * 0.3, y - p.ry * 0.35, p.rx * 0.45, p.ry * 0.35, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.fill();
    }
    ctx.restore();

    // Scorched crater edges (FR-108), then grass on the rest of the surface.
    const marks = this.marks;
    const runs = (scorched: boolean): Array<[number, number]> => {
      const out: Array<[number, number]> = [];
      let start = -1;
      for (let x = 0; x <= terrain.length; x++) {
        const on = x < terrain.length && (marks?.[x] === 1) === scorched;
        if (on && start < 0) start = x;
        if (!on && start >= 0) {
          out.push([start, x - 1]);
          start = -1;
        }
      }
      return out;
    };
    const strokeRuns = (list: Array<[number, number]>, width: number, color: string, dy = 0) => {
      ctx.lineWidth = width;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.strokeStyle = color;
      for (const [a, b] of list) {
        ctx.beginPath();
        for (let x = a; x <= b; x += SAMPLE_STEP) ctx.lineTo(x, sy(x) + dy);
        ctx.lineTo(b, sy(b) + dy);
        ctx.stroke();
      }
    };
    const grass = runs(false);
    const scorched = runs(true);
    // Scorch only inside the ground, so it never darkens the sky above a crater.
    ctx.save();
    ctx.clip(outline);
    strokeRuns(scorched, SCORCH_WIDTH * 2, 'rgba(43, 29, 18, 0.35)', 10);
    strokeRuns(scorched, SCORCH_WIDTH, 'rgba(43, 29, 18, 0.85)', 4);
    ctx.restore();
    strokeRuns(grass, GRASS_WIDTH, cssColor(GROUND_COLORS.grass));
    strokeRuns(grass, 3, '#82c35a', -4);
    for (const tuft of this.tufts) {
      const x = Math.round(tuft.x);
      if (x >= terrain.length || marks?.[x] === 1) continue;
      const y = sy(x) - 3;
      ctx.fillStyle = cssColor(GROUND_COLORS.tuft);
      for (const dx of [-3, 0, 3]) {
        ctx.beginPath();
        ctx.moveTo(x + dx - 1.6, y);
        ctx.lineTo(x + dx + tuft.lean * 3 + dx * 0.6, y - tuft.height * (dx === 0 ? 1 : 0.7));
        ctx.lineTo(x + dx + 1.6, y);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Bedrock strip from the floor line down, the full width of the world.
    ctx.fillStyle = cssColor(GROUND_COLORS.bedrock);
    ctx.fillRect(0, floorY, w, h - floorY);
    ctx.lineWidth = 4;
    ctx.lineCap = 'butt';
    ctx.strokeStyle = BEDROCK_EDGE;
    ctx.beginPath();
    ctx.moveTo(0, floorY);
    ctx.lineTo(w, floorY);
    ctx.stroke();

    slot.texture.refresh();
    this.draws++;
    this.scene.game.canvas.dataset.groundDraws = String(this.draws);
  }

  setDepth(depth: number): this {
    this.current.image.setDepth(depth);
    this.next.image.setDepth(depth);
    return this;
  }
}
