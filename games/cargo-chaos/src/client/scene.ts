import Phaser from 'phaser';
import type { GameView } from '@stickworld/game-host';
import { PIXELS_PER_METRE } from '@stickworld/sim-core';
import { POSTS } from '../simulation/course.js';
import type { CargoRenderState } from '../simulation/simulation.js';
import { VIEW_TOKENS } from './tokens.js';

const Y_TOP = 8;

export interface SceneHandlers {
  onAim: (value: number) => void;
  onHook: (value: number) => void;
}

function toScreen(x: number, y: number): { x: number; y: number } {
  return { x: x * PIXELS_PER_METRE, y: (Y_TOP - y) * PIXELS_PER_METRE };
}

export class CargoScene extends Phaser.Scene {
  private gfx!: Phaser.GameObjects.Graphics;
  private latest: CargoRenderState | undefined;
  private handlers: SceneHandlers;

  constructor(handlers: SceneHandlers) {
    super({ key: 'cargo-chaos' });
    this.handlers = handlers;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(VIEW_TOKENS.bg);
    this.gfx = this.add.graphics();
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.latest) return;
      const origin = toScreen(this.latest.playerX, this.latest.playerY);
      const deg = Math.atan2(origin.y - pointer.y, pointer.x - origin.x) * (180 / Math.PI);
      const wrapped = ((Math.round(deg) % 360) + 360) % 360;
      this.handlers.onAim(wrapped);
    });
    this.input.on('pointerdown', () => this.handlers.onHook(1));
    this.input.on('pointerup', () => this.handlers.onHook(0));
    const keyboard = this.input.keyboard;
    if (keyboard) {
      keyboard.on('keydown-SPACE', () => this.handlers.onHook(1));
      keyboard.on('keyup-SPACE', () => this.handlers.onHook(0));
    }
  }

  setState(state: CargoRenderState): void {
    this.latest = state;
  }

  update(): void {
    this.draw();
  }

  view(): GameView {
    return {
      onFrame: (args) => {
        this.setState(args.renderState as CargoRenderState);
      },
      onPhase: () => {},
    };
  }

  private draw(): void {
    const g = this.gfx;
    if (!g) return;
    g.clear();
    g.fillStyle(VIEW_TOKENS.muted, 1);
    g.fillCircle(4 * PIXELS_PER_METRE, (Y_TOP - 0.25) * PIXELS_PER_METRE, 4);
    g.fillStyle(VIEW_TOKENS.success, 1);
    for (const post of POSTS) {
      const pos = toScreen(post.x, post.y);
      g.fillCircle(pos.x, pos.y, 6);
    }
    if (!this.latest) return;
    const player = toScreen(this.latest.playerX, this.latest.playerY);
    const crate = toScreen(this.latest.crateX, this.latest.crateY);
    g.lineStyle(2, this.latest.hooked ? VIEW_TOKENS.accent : VIEW_TOKENS.muted, 1);
    g.lineBetween(player.x, player.y, crate.x, crate.y);
    g.fillStyle(this.latest.fail ? VIEW_TOKENS.hazard : VIEW_TOKENS.ink, 1);
    g.fillCircle(player.x, player.y, 10);
    g.fillStyle(VIEW_TOKENS.accent, 1);
    g.fillRect(crate.x - 8, crate.y - 8, 16, 16);
    this.cameras.main.centerOn(player.x, player.y);
  }
}
