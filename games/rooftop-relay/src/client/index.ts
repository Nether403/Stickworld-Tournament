import Phaser from 'phaser';
import type { GameView } from '@stickworld/game-host';
import { RooftopScene, type SceneHandlers } from './scene.js';
import { VIEW_TOKENS } from './tokens.js';

export interface MountedRooftopClient {
  view: GameView;
  destroy(): void;
}

export function mountRooftopClient(parent: HTMLElement, handlers: SceneHandlers): MountedRooftopClient {
  const scene = new RooftopScene(handlers);
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
