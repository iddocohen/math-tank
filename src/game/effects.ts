/**
 * Explosion and hit effects (FR-009). The burst is sized by the blast radius. Emitters and tweens belong to the scene,
 * so pausing the scene freezes them.
 */
import Phaser from 'phaser';
import { TEX } from './textures';
import type { TankView } from './TankView';

const PARTICLE_LIFE_MS = 700;
const CARDBOARD_MS = 900;

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

  /** The destroyed enemy (amendment 06, FR-066): a larger burst and a second ring where the enemy tank stood. */
  destroyed(x: number, y: number, blastRadius: number): void {
    this.explosion(x, y, blastRadius * 1.8);
    const ring = this.scene.add.circle(x, y, blastRadius * 1.4).setStrokeStyle(8, 0xffffff, 0.9).setScale(0.3).setDepth(22);
    this.scene.tweens.add({ targets: ring, scale: 1, alpha: 0, duration: 550, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
  }

  /**
   * A decoy bursts like a cardboard dummy (amendment 10, FR-066): flat brown pieces fly up a little, tumble and fall,
   * with no fire and no ring, so it looks clearly different from the enemy's explosion.
   */
  cardboard(x: number, y: number): void {
    const scene = this.scene;
    const colors = [0xc8a165, 0xb08850, 0xd9b77e, 0x9c7442];
    for (let i = 0; i < 12; i++) {
      const w = Phaser.Math.Between(10, 22);
      const h = Phaser.Math.Between(5, 10);
      const piece = scene.add.rectangle(x + Phaser.Math.Between(-20, 20), y + Phaser.Math.Between(-12, 6), w, h, colors[i % colors.length]!).setStrokeStyle(1, 0x6b4a22).setDepth(21);
      const dx = Phaser.Math.Between(-90, 90);
      const rise = Phaser.Math.Between(30, 80);
      scene.tweens.add({ targets: piece, x: piece.x + dx, angle: Phaser.Math.Between(-540, 540), duration: CARDBOARD_MS, ease: 'Linear' });
      scene.tweens.add({
        targets: piece,
        y: piece.y - rise,
        duration: CARDBOARD_MS * 0.3,
        ease: 'Quad.easeOut',
        onComplete: () => {
          scene.tweens.add({ targets: piece, y: piece.y + rise + 50, alpha: 0, duration: CARDBOARD_MS * 0.7, ease: 'Quad.easeIn', onComplete: () => piece.destroy() });
        },
      });
    }
  }

  /** White flash on the child's tank when an enemy shell costs a heart. */
  hitFlash(tank: TankView): void {
    tank.flash();
  }

  /** Small puff where a shell left the battlefield; nothing explodes there. */
  puff(x: number, y: number): void {
    const dot = this.scene.add.circle(x, y, 14, 0xffffff, 0.6).setDepth(20);
    this.scene.tweens.add({ targets: dot, scale: 2, alpha: 0, duration: 400, onComplete: () => dot.destroy() });
  }
}
