import Phaser from 'phaser';
import type { GameView } from '@stickworld/game-host';
import { HooklineScene, type SceneHandlers } from './scene.js';
import { VIEW_TOKENS } from './tokens.js';

export interface MountedHooklineClient {
  view: GameView;
  destroy(): void;
}

export function mountHooklineClient(
  parent: HTMLElement,
  handlers: SceneHandlers,
): MountedHooklineClient {
  const scene = new HooklineScene(handlers);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 960,
    height: 540,
    backgroundColor: VIEW_TOKENS.bg,
    banner: false,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene,
    input: {
      activePointers: 3,
    },
  });

  return {
    view: scene.view(),
    destroy() {
      game.destroy(true);
    },
  };
}

export { VIEW_TOKENS };
export { nearestForwardAnchorAim } from './aim.js';
