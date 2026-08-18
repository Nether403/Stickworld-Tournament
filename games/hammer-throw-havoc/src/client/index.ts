import Phaser from 'phaser';
import type { GameView } from '@stickworld/game-host';
import { HammerScene, type SceneHandlers } from './scene.js';
import { VIEW_TOKENS } from './tokens.js';

export interface MountedHammerClient {
  view: GameView;
  destroy(): void;
}

export function mountHammerClient(parent: HTMLElement, handlers: SceneHandlers): MountedHammerClient {
  const scene = new HammerScene(handlers);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 960,
    height: 540,
    backgroundColor: VIEW_TOKENS.bg,
    banner: false,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene,
    input: { activePointers: 3 },
  });
  return {
    view: scene.view(),
    destroy() {
      game.destroy(true);
    },
  };
}

export { VIEW_TOKENS };
