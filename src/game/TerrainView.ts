/**
 * Draws the heightmap as a filled polygon (FR-005, research R5).
 * Heightmaps are never changed in place, so a new array means the ground changed; update() then
 * redraws in the same call, which puts the new crater on screen in the next rendered frame.
 */
import Phaser from 'phaser';
import type { Heightmap } from '../core/types';
import { terrainPolygon } from '../core/view/geometry';

const GROUND = 0x7a5532;
const GRASS = 0x5c9d3a;
/** Columns between polygon points; 2 keeps crater edges smooth at full size. */
const SAMPLE_STEP = 2;

export class TerrainView {
  private readonly g: Phaser.GameObjects.Graphics;
  private drawn: Heightmap | null = null;

  constructor(
    scene: Phaser.Scene,
    private readonly worldHeight: number,
  ) {
    this.g = scene.add.graphics();
  }

  update(terrain: Heightmap): void {
    if (terrain === this.drawn) return;
    this.drawn = terrain;
    const pts = terrainPolygon(terrain, this.worldHeight, SAMPLE_STEP).map((p) => new Phaser.Math.Vector2(p.x, p.y));
    const g = this.g;
    g.clear();
    g.fillStyle(GROUND, 1);
    g.fillPoints(pts, true, true);
    // Grass along the surface only (skip the two bottom corners).
    g.lineStyle(8, GRASS, 1);
    g.strokePoints(pts.slice(1, -1), false, false);
  }

  setDepth(depth: number): this {
    this.g.setDepth(depth);
    return this;
  }
}
