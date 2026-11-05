/**
 * Draws the heightmap as a filled polygon (FR-005, research R5), and below it a flat bedrock strip from the
 * floor line to the bottom of the world. The ground never drops below the floor, so the ruler drawn on the
 * strip always sits below the ground and the tanks (tasks.md T184).
 * Heightmaps are never changed in place, so a new array means the ground changed; update() then
 * redraws in the same call, which puts the new crater on screen in the next rendered frame.
 * Amendment 13 (FR-101): after a destroyed enemy the new hills fade in over the old ground.
 */
import Phaser from 'phaser';
import type { Heightmap } from '../core/types';
import { FLOOR } from '../core/physics/terrain';
import { terrainPolygon, toScreenY } from '../core/view/geometry';

const GROUND = 0x7a5532;
const GRASS = 0x5c9d3a;
const BEDROCK = 0x3b2a1c;
const BEDROCK_EDGE = 0x2a1d13;
/** Columns between polygon points; 2 keeps crater edges smooth at full size. */
const SAMPLE_STEP = 2;

/** A cross-fade to new ground (amendment 13, FR-101): it starts after `delayMs` and takes `durationMs`. */
export interface TerrainFade {
  delayMs: number;
  durationMs: number;
}

export class TerrainView {
  private readonly g: Phaser.GameObjects.Graphics;
  /** The new ground during a cross-fade, drawn above the old one and faded in. */
  private readonly next: Phaser.GameObjects.Graphics;
  private fade: Phaser.Tweens.Tween | null = null;
  private drawn: Heightmap | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly worldHeight: number,
  ) {
    this.g = scene.add.graphics();
    this.next = scene.add.graphics().setAlpha(0);
  }

  /**
   * Draws the ground. With `fade` the old ground stays until the new one has faded in over it (new hills after a
   * destroyed enemy, amendment 13); without it the change shows at once (a crater). A change during a fade ends the
   * fade first.
   */
  update(terrain: Heightmap, fade?: TerrainFade): void {
    if (terrain === this.drawn) return;
    this.drawn = terrain;
    this.endFade();
    if (!fade) {
      this.draw(this.g, terrain);
      return;
    }
    this.draw(this.next, terrain);
    this.next.setAlpha(0);
    this.fade = this.scene.tweens.add({
      targets: this.next,
      alpha: 1,
      delay: fade.delayMs,
      duration: fade.durationMs,
      ease: 'Sine.easeInOut',
      onComplete: () => this.endFade(),
    });
  }

  /** Ends a running cross-fade: the ground drawn last becomes the only one. */
  private endFade(): void {
    if (!this.fade) return;
    this.fade.remove();
    this.fade = null;
    if (this.drawn) this.draw(this.g, this.drawn);
    this.next.clear().setAlpha(0);
  }

  private draw(g: Phaser.GameObjects.Graphics, terrain: Heightmap): void {
    const pts = terrainPolygon(terrain, this.worldHeight, SAMPLE_STEP).map((p) => new Phaser.Math.Vector2(p.x, p.y));
    g.clear();
    g.fillStyle(GROUND, 1);
    g.fillPoints(pts, true, true);
    // Grass along the surface only (skip the two bottom corners).
    g.lineStyle(8, GRASS, 1);
    g.strokePoints(pts.slice(1, -1), false, false);
    // Bedrock strip from the floor line down, the full width of the world.
    const floorY = toScreenY(FLOOR, this.worldHeight);
    const width = terrain.length;
    g.fillStyle(BEDROCK, 1);
    g.fillRect(0, floorY, width, this.worldHeight - floorY);
    g.lineStyle(4, BEDROCK_EDGE, 1);
    g.lineBetween(0, floorY, width, floorY);
  }

  setDepth(depth: number): this {
    this.g.setDepth(depth);
    this.next.setDepth(depth);
    return this;
  }
}
