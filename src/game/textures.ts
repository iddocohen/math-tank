/**
 * Generated textures (FR-001, research R13): everything is drawn by code, there are no image files.
 * Graphics.generateTexture uses the Canvas API and ignores gradient fills, so the sky and the
 * particle glow are drawn on CanvasTextures with the 2D context instead.
 */
import Phaser from 'phaser';

export const TEX = {
  tankBody: 'tank-body',
  turret: 'tank-turret',
  sky: 'sky',
  shell: 'shell',
  spark: 'spark',
} as const;

/** Body size in world units; the texture's bottom edge is the tank base. */
export const TANK_BODY_WIDTH = 64;
export const TANK_BODY_HEIGHT = 28;
export const TURRET_LENGTH = 38;
export const TURRET_THICKNESS = 8;

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
