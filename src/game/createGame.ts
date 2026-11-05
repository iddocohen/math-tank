/**
 * Phaser 4 game setup (FR-001, FR-058, research R2). The canvas draws a fixed logical world of
 * 1600 by 900 units and is scaled to fit its parent with the aspect ratio kept.
 * The background is transparent so the page colour shows through around the letterbox.
 * Phaser's own sound system is off: sound effects come from src/audio/sfx.ts (research R13).
 */
import Phaser from 'phaser';
import type { BattleController } from '../core/battle/controller';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../core/battle/round';
import { BattleScene, type BattleSceneOptions } from './BattleScene';

export interface GameHandle {
  game: Phaser.Game;
  destroy(): void;
}

export function createGame(parent: HTMLElement, controller: BattleController, options: BattleSceneOptions = {}): GameHandle {
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
    scene: new BattleScene(controller, options),
  });
  return {
    game,
    destroy: () => game.destroy(true),
  };
}
