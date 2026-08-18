import Phaser from 'phaser';
import type { GameView } from '@stickworld/game-host';
import { CargoScene, type SceneHandlers } from './scene.js';
import { VIEW_TOKENS } from './tokens.js';

export interface MountedCargoClient {
  view: GameView;
  destroy(): void;
}

export function mountCargoClient(parent: HTMLElement, handlers: SceneHandlers): MountedCargoClient {
  const scene = new CargoScene(handlers);
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
