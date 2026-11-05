/**
 * Explosion and hit effects (FR-009). The burst is sized by the blast radius, so a charged shot
 * (radius 90) looks bigger than a normal one (radius 60). Emitters and tweens belong to the scene,
 * so pausing the scene freezes them.
 */
import Phaser from 'phaser';
import { TEX } from './textures';
import type { TankView } from './TankView';

const PARTICLE_LIFE_MS = 700;

export class Effects {
  constructor(private readonly scene: Phaser.Scene) {}

  /** Burst of particles plus an expanding ring at a screen point. */
  explosion(x: number, y: number, blastRadius: number): void {
    const scene = this.scene;
    const scale = blastRadius / 60;

    const ring = scene.add.circle(x, y, blastRadius, 0xffe08a, 0.55).setScale(0.2).setDepth(20);
    scene.tweens.add({
      targets: ring,
      scale: 1,
      alpha: 0,
      duration: 380,
      ease: 'Cubic.easeOut',
      onComplete: () => ring.destroy(),
    });

    const emitter = scene.add
      .particles(x, y, TEX.spark, {
        speed: { min: 80 * scale, max: 320 * scale },
        angle: { min: 180, max: 360 },
        gravityY: 400,
        lifespan: { min: PARTICLE_LIFE_MS * 0.5, max: PARTICLE_LIFE_MS },
        scale: { start: 0.9 * scale, end: 0 },
        alpha: { start: 1, end: 0 },
        tint: [0xffd54f, 0xff8a3d, 0xff5a36, 0x8d6e63],
        emitting: false,
      })
      .setDepth(21);
    emitter.explode(Math.round(28 * scale));
    scene.time.delayedCall(PARTICLE_LIFE_MS + 100, () => emitter.destroy());
  }

  /** White flash on a tank that took damage. */
  hitFlash(tank: TankView): void {
    tank.flash();
  }

  /** Small puff where a shell left the battlefield; nothing explodes there. */
  puff(x: number, y: number): void {
    const dot = this.scene.add.circle(x, y, 14, 0xffffff, 0.6).setDepth(20);
    this.scene.tweens.add({ targets: dot, scale: 2, alpha: 0, duration: 400, onComplete: () => dot.destroy() });
  }
}
