/**
 * Explosion and hit effects (FR-009). The burst is sized by the blast radius. Emitters and tweens belong to the scene,
 * so pausing the scene freezes them.
 *
 * Amendment 14 (FR-113): an explosion also throws debris in the ground's colors and draws an expanding "boom" ring;
 * `shake` shakes the camera by a few CSS pixels for a short time on a hit on a tank. The motion profile follows the
 * operating system's reduced-motion setting: no shake and fewer particles. For the end-to-end tests only (D4), the
 * canvas carries `data-explosions` and `data-screen-shakes`.
 */
import Phaser from 'phaser';
import { TEX } from './textures';
import type { TankView } from './TankView';
import { GROUND_COLORS } from '../core/view/shade';
import { particleCount, type MotionProfile } from '../core/view/motion';

const DEBRIS_COLORS = [GROUND_COLORS.dirt, GROUND_COLORS.soil, GROUND_COLORS.grass, GROUND_COLORS.tuft, 0x8a6a45];

const PARTICLE_LIFE_MS = 700;
const CARDBOARD_MS = 900;

export class Effects {
  private explosions = 0;
  private shakes = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly motion: MotionProfile,
  ) {
    const canvas = scene.game.canvas;
    canvas.dataset.explosions = '0';
    canvas.dataset.screenShakes = '0';
  }

  /** A tiny screen shake on a hit on a tank (FR-113); none with reduced motion. */
  shake(): void {
    if (!this.motion.shake) return;
    const cam = this.scene.cameras.main;
    // displayScale is world units per CSS pixel, so the offset is shakeCssPx CSS pixels on every screen size.
    const px = this.motion.shakeCssPx * (this.scene.scale.displayScale.x || 1);
    cam.shake(this.motion.shakeMs, new Phaser.Math.Vector2(px / cam.width, px / cam.height), true);
    this.shakes++;
    this.scene.game.canvas.dataset.screenShakes = String(this.shakes);
  }

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
    // The drawn "boom" ring: a thick light outline that grows and thins out (amendment 14).
    const boom = scene.add.circle(x, y, blastRadius * 0.9).setStrokeStyle(7, 0xfff4d0, 0.95).setScale(0.25).setDepth(22);
    scene.tweens.add({ targets: boom, scale: 1.15, alpha: 0, duration: 320, ease: 'Quad.easeOut', onComplete: () => boom.destroy() });
    this.debris(x, y, scale);
    this.explosions++;
    scene.game.canvas.dataset.explosions = String(this.explosions);

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
    emitter.explode(particleCount(Math.round(28 * scale), this.motion));
    scene.time.delayedCall(PARTICLE_LIFE_MS + 100, () => emitter.destroy());
  }

  /** Clods of earth in the ground's colors that fly up and fall back (amendment 14, FR-113). */
  private debris(x: number, y: number, scale: number): void {
    const scene = this.scene;
    const n = particleCount(Math.round(14 * scale), this.motion);
    for (let i = 0; i < n; i++) {
      const size = Phaser.Math.Between(4, 9) * Math.min(1.6, scale);
      const clod = scene.add
        .polygon(x, y, [0, 0, size, size * 0.2, size * 0.8, size, -size * 0.1, size * 0.7], DEBRIS_COLORS[i % DEBRIS_COLORS.length]!)
        .setDepth(21);
      const dx = Phaser.Math.Between(-140, 140) * scale;
      const rise = Phaser.Math.Between(40, 130) * scale;
      const t = Phaser.Math.Between(650, 900);
      scene.tweens.add({ targets: clod, x: x + dx, angle: Phaser.Math.Between(-400, 400), duration: t, ease: 'Linear' });
      scene.tweens.add({
        targets: clod,
        y: y - rise,
        duration: t * 0.4,
        ease: 'Quad.easeOut',
        onComplete: () => scene.tweens.add({ targets: clod, y: y + 30, alpha: 0, duration: t * 0.6, ease: 'Quad.easeIn', onComplete: () => clod.destroy() }),
      });
    }
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
    for (let i = 0; i < particleCount(12, this.motion); i++) {
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
}
