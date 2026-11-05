/**
 * Replays a precomputed shell path (FR-004, research R6) and draws the faint dotted trail of the
 * player's previous shot. A shell that leaves the battlefield gets a marker where it crossed the
 * side edge (US1 scenario 6). Playback advances only in advance(), which the scene calls from
 * update(), so pausing the scene stops the replay.
 * Amendment 11 (FR-093): the child's shells draw the garage trail (`playerTrail`): sparkles, rainbow lines or
 * bubbles along the live path; the enemy's shells keep the plain trail. Amendment 14 (FR-112): the trail lines are 5
 * world units thick.
 * Bug report B2 (FR-043a): in a comparison turn the decoys' shells fly together with the enemy's shell; `onDone` runs
 * once the last shell of the volley has landed, so the timing does not show which shell is the enemy's.
 */
import Phaser from 'phaser';
import type { Point, ShotInFlight } from '../core/types';
import { dottedTrail, edgeMarker, pathDuration, pathPointAt, toScreenY } from '../core/view/geometry';
import { TEX } from './textures';
import type { TrailId } from '../core/rewards/items';
import { trailStyle, type TrailStyle } from '../core/rewards/looks';

/** Playback speed relative to physics time. */
export const REPLAY_SPEED = 1.6;
const TRAIL_SPACING = 18;
const MARKER_SIZE = 22;
/** Shell trail thickness and the gap between rainbow lines (amendment 14, FR-112: at least 5, it was 3). */
const TRAIL_WIDTH = 5;
const TRAIL_GAP = 4;

/** One shell of a replay: the enemy's or player's shell, or a decoy's shell in a comparison volley. */
interface Track {
  path: readonly Point[];
  impact: Point;
  duration: number;
  image: Phaser.GameObjects.Image;
  landed: boolean;
}

interface Replay {
  shot: ShotInFlight;
  elapsed: number;
  /** The shot's own shell first, then the decoys' shells. */
  tracks: Track[];
  onDone: () => void;
  onShellLanded: (index: number, impact: Point) => void;
}

export class ProjectileView {
  private readonly shell: Phaser.GameObjects.Image;
  /** Shell images for the decoys' shells of a volley, reused between volleys. */
  private readonly extraShells: Phaser.GameObjects.Image[] = [];
  private readonly live: Phaser.GameObjects.Graphics;
  private readonly trail: Phaser.GameObjects.Graphics;
  private readonly marker: Phaser.GameObjects.Graphics;
  private replay: Replay | null = null;
  private trailPath: readonly Point[] | null = null;
  /** Edge markers by shooter; each stays until that shooter fires again. */
  private readonly markers = new Map<ShotInFlight['shooter'], { y: number; side: 'left' | 'right' }>();
  private readonly playerStyle: TrailStyle;
  private readonly plainStyle = trailStyle('plain');

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly worldWidth: number,
    private readonly worldHeight: number,
    playerTrail: TrailId = 'plain',
  ) {
    this.playerStyle = trailStyle(playerTrail);
    this.trail = scene.add.graphics();
    this.live = scene.add.graphics();
    this.marker = scene.add.graphics();
    this.shell = scene.add.image(0, 0, TEX.shell).setVisible(false);
  }

  get playing(): ShotInFlight | null {
    return this.replay?.shot ?? null;
  }

  /**
   * Starts replaying `shot` and the decoys' shells of a comparison volley; `onShellLanded` runs when each shell lands
   * (index 0 is the shot's own shell) and `onDone` runs once when every shell has reached its impact point.
   */
  play(shot: ShotInFlight, onDone: () => void, onShellLanded: (index: number, impact: Point) => void = () => {}): void {
    this.markers.delete(shot.shooter);
    this.drawMarkers();
    this.live.clear();
    this.hideShells();
    const shells = [shot, ...shot.decoyShells];
    const tracks = shells.map((t, i) => ({
      path: t.path,
      impact: t.impact,
      duration: pathDuration(t.path, REPLAY_SPEED),
      image: i === 0 ? this.shell : this.extraShell(i - 1),
      landed: false,
    }));
    for (const t of tracks) t.image.setVisible(true);
    this.replay = { shot, elapsed: 0, tracks, onDone, onShellLanded };
    this.advance(0);
  }

  /** Stops a replay without calling its callback (new round). */
  stop(): void {
    this.replay = null;
    this.hideShells();
    this.live.clear();
    this.markers.clear();
    this.drawMarkers();
  }

  advance(deltaMs: number): void {
    const r = this.replay;
    if (!r) return;
    const longest = Math.max(...r.tracks.map((t) => t.duration));
    r.elapsed = Math.min(longest, r.elapsed + deltaMs);
    const style = r.shot.shooter === 'player' ? this.playerStyle : this.plainStyle;
    this.live.clear();
    r.tracks.forEach((t, i) => {
      if (t.landed) return;
      const s = pathPointAt(t.path, Math.min(r.elapsed, t.duration), REPLAY_SPEED);
      if (!s.done && r.elapsed < t.duration) {
        t.image.setPosition(s.point.x, this.sy(s.point.y));
        this.drawLive(t.path, s.index, s.point, style);
        return;
      }
      t.landed = true;
      t.image.setVisible(false);
      r.onShellLanded(i, t.impact);
    });
    if (!r.tracks.every((t) => t.landed)) return;
    this.replay = null;
    this.live.clear();
    const m = edgeMarker(r.shot, this.worldWidth);
    if (m) {
      this.markers.set(r.shot.shooter, { y: this.sy(m.y), side: m.side });
      this.drawMarkers();
    }
    r.onDone();
  }

  private extraShell(i: number): Phaser.GameObjects.Image {
    let image = this.extraShells[i];
    if (!image) {
      image = this.scene.add.image(0, 0, TEX.shell).setVisible(false);
      this.extraShells[i] = image;
    }
    return image;
  }

  private hideShells(): void {
    this.shell.setVisible(false);
    for (const image of this.extraShells) image.setVisible(false);
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

  private drawLive(path: readonly Point[], index: number, head: Point, style: TrailStyle): void {
    const g = this.live;
    const from = Math.max(0, index - 40);
    const lines = style.line.length;
    style.line.forEach((color, k) => {
      // Several colors (rainbow) lie side by side, TRAIL_GAP units apart; every line is TRAIL_WIDTH thick (amendment 14).
      const dy = (k - (lines - 1) / 2) * TRAIL_GAP;
      g.lineStyle(TRAIL_WIDTH, color, lines > 1 ? 0.95 : 0.85);
      g.beginPath();
      const start = path[from] as Point;
      g.moveTo(start.x, this.sy(start.y) + dy);
      for (let i = from + 1; i <= index; i++) {
        const p = path[i] as Point;
        g.lineTo(p.x, this.sy(p.y) + dy);
      }
      g.lineTo(head.x, this.sy(head.y) + dy);
      g.strokePath();
    });
    if (style.dots === 'none') return;
    for (let i = from + 1; i <= index; i += 4) {
      const p = path[i] as Point;
      const age = (index - i) / 40;
      if (style.dots === 'sparkles') {
        const side = i % 8 < 4 ? -7 : 7;
        g.fillStyle(i % 8 < 4 ? 0xffd23f : 0xffffff, 1 - age * 0.7);
        g.fillCircle(p.x, this.sy(p.y) + side, 2.5);
      } else {
        g.lineStyle(2, 0xbfe8ff, 1 - age * 0.7);
        g.strokeCircle(p.x, this.sy(p.y) + 5, 2 + age * 7);
      }
    }
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
