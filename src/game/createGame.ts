/**
 * Phaser 4 game setup (FR-001, FR-058, research R2). The canvas draws a fixed logical world of
 * 1600 by 900 units and is scaled to fit its parent with the aspect ratio kept.
 * The background is transparent so the page colour shows through around the letterbox.
 * Phaser's own sound system is off: sound effects come from src/audio/sfx.ts (research R13).
 *
 * Bug "iPhone rotation in Chrome" (Phase 24): Phaser fits the canvas again on window `resize` and `orientationchange`
 * and otherwise only when its twice-a-second check sees the parent change size. Chrome on iOS can send no resize
 * event after a turn, and a fit made while the layout was changing can leave the canvas at the old size although
 * Phaser has already stored the parent's new size, so its check never fits again. A ResizeObserver on the parent
 * fits the canvas whenever the parent's size changes.
 */
import Phaser from 'phaser';
import type { BattleController } from '../core/battle/controller';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../core/battle/round';
import { BattleScene, type BattleSceneOptions } from './BattleScene';
import type { Look } from '../core/rewards/items';

export interface GameHandle {
  game: Phaser.Game;
  /** Changes the child's tank and shell look during the round (amendment 23). */
  setLook(look: Look): void;
  destroy(): void;
}

export function createGame(parent: HTMLElement, controller: BattleController, options: BattleSceneOptions = {}): GameHandle {
  const scene = new BattleScene(controller, options);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    transparent: true,
    banner: false,
    audio: { noAudio: true },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: WORLD_WIDTH,
      height: WORLD_HEIGHT,
    },
    scene,
  });
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(() => fit(game)) : null;
  observer?.observe(parent);
  return {
    game,
    setLook: (look) => scene.setLook(look),
    destroy: () => {
      observer?.disconnect();
      game.destroy(true);
    },
  };
}

function fit(game: Phaser.Game): void {
  const scale = game.scale;
  // Before boot the scale manager has no canvas yet; it fits the canvas itself when it starts.
  if (!scale?.canvas) return;
  scale.getParentBounds();
  scale.refresh();
}
