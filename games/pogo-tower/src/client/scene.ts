import Phaser from 'phaser';
import type { GameView } from '@stickworld/game-host';
import { PIXELS_PER_METRE } from '@stickworld/sim-core';
import { FLOOR, LEFT_WALL_X, RIGHT_WALL_X } from '../simulation/course.js';
import type { PogoRenderState } from '../simulation/simulation.js';
import { VIEW_TOKENS } from './tokens.js';

const Y_TOP = 32;

export interface SceneHandlers {
  onLean: (value: number) => void;
}

function toScreen(x: number, y: number): { x: number; y: number } {
  return { x: x * PIXELS_PER_METRE, y: (Y_TOP - y) * PIXELS_PER_METRE };
}

export class PogoScene extends Phaser.Scene {
  private gfx!: Phaser.GameObjects.Graphics;
  private latest: PogoRenderState | undefined;
  private handlers: SceneHandlers;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;

  constructor(handlers: SceneHandlers) {
    super({ key: 'pogo-tower' });
    this.handlers = handlers;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(VIEW_TOKENS.bg);
    this.gfx = this.add.graphics();
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      const width = this.scale.width || 960;
      this.handlers.onLean(Math.max(0, Math.min(200, Math.floor((pointer.x / width) * 200))));
    });
    const keyboard = this.input.keyboard;
    if (keyboard) {
      this.keyA = keyboard.addKey('A');
      this.keyD = keyboard.addKey('D');
    }
  }

  setState(state: PogoRenderState): void {
    this.latest = state;
  }

  update(): void {
    if (this.latest && this.keyA) {
      let lean = this.latest.lean;
      if (this.keyA.isDown) lean -= 4;
      if (this.keyD.isDown) lean += 4;
      if (lean < 0) lean = 0;
      if (lean > 200) lean = 200;
      if (this.keyA.isDown || this.keyD.isDown) this.handlers.onLean(lean);
    }
    this.draw();
  }

  view(): GameView {
    return {
      onFrame: (args) => {
        this.setState(args.renderState as PogoRenderState);
      },
      onPhase: () => {},
    };
  }

  private draw(): void {
    const g = this.gfx;
    if (!g) return;
    g.clear();
    const floor = toScreen(FLOOR.x, FLOOR.y);
    g.fillStyle(VIEW_TOKENS.muted, 1);
    g.fillRect(
      floor.x - FLOOR.hx * PIXELS_PER_METRE,
      floor.y - FLOOR.hy * PIXELS_PER_METRE,
      FLOOR.hx * 2 * PIXELS_PER_METRE,
      FLOOR.hy * 2 * PIXELS_PER_METRE,
    );
    g.fillRect(LEFT_WALL_X * PIXELS_PER_METRE - 4, 0, 8, 2000);
    g.fillRect(RIGHT_WALL_X * PIXELS_PER_METRE - 4, 0, 8, 2000);
    if (!this.latest) return;
    for (const [i, ledge] of this.latest.ledges.entries()) {
      const pos = toScreen(ledge.x, ledge.y);
      g.fillStyle(this.latest.landed[i] ? VIEW_TOKENS.success : ledge.moving ? VIEW_TOKENS.accent : VIEW_TOKENS.muted, 1);
      g.fillRect(
        pos.x - ledge.hx * PIXELS_PER_METRE,
        pos.y - ledge.hy * PIXELS_PER_METRE,
        ledge.hx * 2 * PIXELS_PER_METRE,
        ledge.hy * 2 * PIXELS_PER_METRE,
      );
    }
    const player = toScreen(this.latest.playerX, this.latest.playerY);
    g.fillStyle(this.latest.fail ? VIEW_TOKENS.hazard : VIEW_TOKENS.ink, 1);
    g.fillCircle(player.x, player.y, 10);
    this.cameras.main.centerOn(player.x, player.y);
  }
}
