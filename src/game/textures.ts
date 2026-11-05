/**
 * Generated textures (FR-001, research R13): drawn by code. Graphics.generateTexture uses the Canvas API and ignores
 * gradient fills, so the sky and the particle glow are drawn on CanvasTextures with the 2D context instead.
 * Amendment 14 (FR-107): the one image file is the CC0 dirt texture, loaded by BattleScene.preload as TEX.dirt; when it
 * did not load, TEX.dirtGenerated, a dirt pattern made here, fills the ground. The sky has a sun. The tank textures stay
 * for the small tank icon of the step animation (NumberLineView); the tanks in battle are drawn from
 * src/core/view/tankDrawing.ts.
 */
import Phaser from 'phaser';
import { createRng } from '../core/rng';

export const TEX = {
  tankBody: 'tank-body',
  /** Amendment 05 (FR-077): the enemy gets an angular body, so shape tells it from the child's tank. */
  tankBodyAngular: 'tank-body-angular',
  turret: 'tank-turret',
  sky: 'sky',
  shell: 'shell',
  spark: 'spark',
  /** The bundled CC0 dirt texture (amendment 14). */
  dirt: 'dirt',
  /** The generated dirt pattern used when the dirt texture did not load. */
  dirtGenerated: 'dirt-generated',
} as const;

/** Body size in world units; the texture's bottom edge is the tank base. */
export const TANK_BODY_WIDTH = 64;
export const TANK_BODY_HEIGHT = 28;
export const TURRET_LENGTH = 38;
export const TURRET_THICKNESS = 8;
/** The sun in the sky (amendment 14). */
const SUN = { x: 1380, y: 120, r: 46 };
/** Size of the generated dirt pattern. */
const DIRT_TILE = 128;

/** Creates any texture that does not exist yet; safe to call from every scene start. */
export function ensureTextures(scene: Phaser.Scene, worldWidth: number, worldHeight: number): void {
  const tex = scene.textures;

  if (!tex.exists(TEX.tankBody)) {
    const g = scene.make.graphics({}, false);
    const w = TANK_BODY_WIDTH;
    const h = TANK_BODY_HEIGHT;
    // Tracks
    g.fillStyle(0x3a3f47, 1);
    g.fillRoundedRect(2, h - 10, w - 4, 10, 5);
    g.fillStyle(0x6b717c, 1);
    for (let x = 9; x < w - 4; x += 11) g.fillCircle(x, h - 5, 3);
    // Hull (white, tinted per tank kind)
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(6, h - 18, w - 12, 10, 4);
    // Dome
    g.fillCircle(w / 2, h - 18, 10);
    g.generateTexture(TEX.tankBody, w, h);
    g.destroy();
  }

  if (!tex.exists(TEX.tankBodyAngular)) {
    const g = scene.make.graphics({}, false);
    const w = TANK_BODY_WIDTH;
    const h = TANK_BODY_HEIGHT;
    // Tracks: a straight-edged band with square road wheels.
    g.fillStyle(0x2a2d33, 1);
    g.fillPoints(vecs([{ x: 0, y: h - 10 }, { x: w, y: h - 10 }, { x: w - 5, y: h }, { x: 5, y: h }]), true);
    g.fillStyle(0x55595f, 1);
    for (let x = 7; x < w - 6; x += 11) g.fillRect(x, h - 8, 6, 6);
    // Hull (white, tinted per tank kind): a wedge with sharp corners.
    g.fillStyle(0xffffff, 1);
    g.fillPoints(vecs([{ x: 2, y: h - 10 }, { x: w - 2, y: h - 10 }, { x: w - 9, y: h - 19 }, { x: 9, y: h - 19 }]), true);
    // Angular turret base: a trapezoid instead of the round dome.
    g.fillPoints(vecs([{ x: w / 2 - 13, y: h - 19 }, { x: w / 2 + 13, y: h - 19 }, { x: w / 2 + 8, y: h - 28 }, { x: w / 2 - 8, y: h - 28 }]), true);
    g.generateTexture(TEX.tankBodyAngular, w, h);
    g.destroy();
  }

  if (!tex.exists(TEX.turret)) {
    const g = scene.make.graphics({}, false);
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(0, 0, TURRET_LENGTH, TURRET_THICKNESS, 3);
    g.fillStyle(0xdddddd, 1);
    g.fillRect(TURRET_LENGTH - 6, 0, 6, TURRET_THICKNESS);
    g.generateTexture(TEX.turret, TURRET_LENGTH, TURRET_THICKNESS);
    g.destroy();
  }

  if (!tex.exists(TEX.shell)) {
    const g = scene.make.graphics({}, false);
    g.fillStyle(0x2b2b2b, 1);
    g.fillCircle(7, 7, 7);
    g.fillStyle(0xfff3c4, 1);
    g.fillCircle(5, 5, 2.5);
    g.generateTexture(TEX.shell, 14, 14);
    g.destroy();
  }

  if (!tex.exists(TEX.sky)) {
    const canvas = tex.createCanvas(TEX.sky, worldWidth, worldHeight);
    if (canvas) {
      const ctx = canvas.context;
      const grad = ctx.createLinearGradient(0, 0, 0, worldHeight);
      grad.addColorStop(0, '#4f8fd6');
      grad.addColorStop(0.6, '#a9d4f5');
      grad.addColorStop(1, '#e6f4ff');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, worldWidth, worldHeight);
      // The sun with a soft glow (amendment 14, FR-107).
      const glow = ctx.createRadialGradient(SUN.x, SUN.y, SUN.r * 0.6, SUN.x, SUN.y, SUN.r * 2.4);
      glow.addColorStop(0, 'rgba(255, 244, 196, 0.85)');
      glow.addColorStop(1, 'rgba(255, 244, 196, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(SUN.x - SUN.r * 2.5, SUN.y - SUN.r * 2.5, SUN.r * 5, SUN.r * 5);
      ctx.fillStyle = '#fff1b8';
      ctx.beginPath();
      ctx.arc(SUN.x, SUN.y, SUN.r, 0, Math.PI * 2);
      ctx.fill();
      // Two soft clouds
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      for (const [cx, cy, s] of [
        [320, 140, 1],
        [1180, 210, 0.8],
      ] as const) {
        for (const [dx, dy, r] of [
          [0, 0, 38],
          [40, -14, 30],
          [78, 2, 34],
          [36, 12, 30],
        ] as const) {
          ctx.beginPath();
          ctx.arc(cx + dx * s, cy + dy * s, r * s, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      canvas.refresh();
    }
  }

  if (!tex.exists(TEX.dirtGenerated)) {
    // A dirt pattern made in code: a brown base with seeded light and dark blotches and a few cracks. It tiles,
    // because every blotch is drawn again shifted by the tile size where it crosses an edge.
    const size = DIRT_TILE;
    const canvas = tex.createCanvas(TEX.dirtGenerated, size, size);
    if (canvas) {
      const ctx = canvas.context;
      const rng = createRng(14);
      ctx.fillStyle = '#ad7d44';
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 260; i++) {
        const x = rng.next() * size;
        const y = rng.next() * size;
        const r = 2 + rng.next() * 9;
        const light = rng.next() < 0.5;
        ctx.fillStyle = light ? `rgba(214, 170, 110, ${0.15 + rng.next() * 0.2})` : `rgba(96, 62, 28, ${0.12 + rng.next() * 0.2})`;
        for (const dx of [-size, 0, size]) {
          for (const dy of [-size, 0, size]) {
            ctx.beginPath();
            ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      canvas.refresh();
    }
  }

  if (!tex.exists(TEX.spark)) {
    const size = 32;
    const canvas = tex.createCanvas(TEX.spark, size, size);
    if (canvas) {
      const ctx = canvas.context;
      const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.4, 'rgba(255,255,255,0.8)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
      canvas.refresh();
    }
  }
}

function vecs(points: Array<{ x: number; y: number }>): Phaser.Math.Vector2[] {
  return points.map((p) => new Phaser.Math.Vector2(p.x, p.y));
}
