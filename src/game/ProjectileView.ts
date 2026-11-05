/**
 * Replays a precomputed shell path (FR-004, research R6) and draws the faint dotted trail of the
 * player's previous shot. A shell that leaves the battlefield gets a marker where it crossed the
 * side edge (US1 scenario 6). Playback advances only in advance(), which the scene calls from
 * update(), so pausing the scene stops the replay.
 */
import Phaser from 'phaser';
import type { Point, ShotInFlight } from '../core/types';
import { dottedTrail, edgeMarker, pathDuration, pathPointAt, toScreenY } from '../core/view/geometry';
import { TEX } from './textures';

/** Playback speed relative to physics time. */
export const REPLAY_SPEED = 1.6;
const TRAIL_SPACING = 18;
const MARKER_SIZE = 22;

interface Replay {
  shot: ShotInFlight;
  elapsed: number;
  duration: number;
  onDone: () => void;
}

export class ProjectileView {
  private readonly shell: Phaser.GameObjects.Image;
  private readonly live: Phaser.GameObjects.Graphics;
  private readonly trail: Phaser.GameObjects.Graphics;
  private readonly marker: Phaser.GameObjects.Graphics;
  private replay: Replay | null = null;
  private trailPath: readonly Point[] | null = null;
  /** Edge markers by shooter; each stays until that shooter fires again. */
  private readonly markers = new Map<ShotInFlight['shooter'], { y: number; side: 'left' | 'right' }>();

  constructor(
    scene: Phaser.Scene,
    private readonly worldWidth: number,
    private readonly worldHeight: number,
  ) {
    this.trail = scene.add.graphics();
    this.live = scene.add.graphics();
    this.marker = scene.add.graphics();
    this.shell = scene.add.image(0, 0, TEX.shell).setVisible(false);
  }

  get playing(): ShotInFlight | null {
    return this.replay?.shot ?? null;
  }

  /** Starts replaying `shot`; `onDone` runs once when the shell reaches the impact point. */
  play(shot: ShotInFlight, onDone: () => void): void {
    this.markers.delete(shot.shooter);
    this.drawMarkers();
    this.live.clear();
    this.replay = { shot, elapsed: 0, duration: pathDuration(shot.path, REPLAY_SPEED), onDone };
    this.shell.setVisible(true);
    this.advance(0);
  }

  /** Stops a replay without calling its callback (new round). */
  stop(): void {
    this.replay = null;
    this.shell.setVisible(false);
    this.live.clear();
    this.markers.clear();
    this.drawMarkers();
  }

  advance(deltaMs: number): void {
    const r = this.replay;
    if (!r) return;
    r.elapsed = Math.min(r.duration, r.elapsed + deltaMs);
    const s = pathPointAt(r.shot.path, r.elapsed, REPLAY_SPEED);
    this.shell.setPosition(s.point.x, this.sy(s.point.y));
    this.drawLive(r.shot.path, s.index, s.point);
    if (!s.done && r.elapsed < r.duration) return;
    this.replay = null;
    this.shell.setVisible(false);
    this.live.clear();
    const m = edgeMarker(r.shot, this.worldWidth);
    if (m) {
      this.markers.set(r.shot.shooter, { y: this.sy(m.y), side: m.side });
      this.drawMarkers();
    }
    r.onDone();
  }

  /** Faint dotted trail of the previous player shot; null removes it. */
  setTrail(path: readonly Point[] | null): void {
    if (path === this.trailPath) return;
    this.trailPath = path;
    const g = this.trail;
    g.clear();
    if (!path) return;
    g.fillStyle(0xffffff, 0.45);
    for (const d of dottedTrail(path, TRAIL_SPACING)) g.fillCircle(d.x, this.sy(d.y), 2.5);
  }

  private drawLive(path: readonly Point[], index: number, head: Point): void {
    const g = this.live;
    g.clear();
    g.lineStyle(3, 0xfff3c4, 0.8);
    g.beginPath();
    const from = Math.max(0, index - 40);
    const start = path[from] as Point;
    g.moveTo(start.x, this.sy(start.y));
    for (let i = from + 1; i <= index; i++) {
      const p = path[i] as Point;
      g.lineTo(p.x, this.sy(p.y));
    }
    g.lineTo(head.x, this.sy(head.y));
    g.strokePath();
  }

  /** Arrows at the side edge pointing out of the battlefield where a shell left it. */
  private drawMarkers(): void {
    const g = this.marker;
    g.clear();
    for (const { y: screenY, side } of this.markers.values()) {
      // A shell may leave above the top of the screen; keep the arrow visible.
      const y = Phaser.Math.Clamp(screenY, MARKER_SIZE, this.worldHeight - MARKER_SIZE);
      const tip = side === 'right' ? this.worldWidth - 4 : 4;
      const back = side === 'right' ? tip - MARKER_SIZE * 1.4 : tip + MARKER_SIZE * 1.4;
      g.fillStyle(0xffd54f, 0.95);
      g.lineStyle(3, 0x1b1f27, 0.8);
      g.fillTriangle(tip, y, back, y - MARKER_SIZE, back, y + MARKER_SIZE);
      g.strokeTriangle(tip, y, back, y - MARKER_SIZE, back, y + MARKER_SIZE);
    }
  }

  private sy(y: number): number {
    return toScreenY(y, this.worldHeight);
  }
}
