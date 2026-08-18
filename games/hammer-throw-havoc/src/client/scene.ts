import Phaser from 'phaser';
import type { GameView } from '@stickworld/game-host';
import { PIXELS_PER_METRE } from '@stickworld/sim-core';
import { FLOOR, GATES, HAMMER_HALF, WALL } from '../simulation/course.js';
import type { HammerRenderState } from '../simulation/simulation.js';
import { VIEW_TOKENS } from './tokens.js';

const Y_TOP = 16;

export interface SceneHandlers {
  onSpin: (value: number) => void;
  onRelease: (value: number) => void;
}

function toScreen(x: number, y: number): { x: number; y: number } {
  return { x: x * PIXELS_PER_METRE, y: (Y_TOP - y) * PIXELS_PER_METRE };
}

export class HammerScene extends Phaser.Scene {
  private gfx!: Phaser.GameObjects.Graphics;
  private latest: HammerRenderState | undefined;
  private handlers: SceneHandlers;
  private keyD!: Phaser.Input.Keyboard.Key;
  private keyRight!: Phaser.Input.Keyboard.Key;

  constructor(handlers: SceneHandlers) {
    super({ key: 'hammer-throw-havoc' });
    this.handlers = handlers;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(VIEW_TOKENS.bg);
    this.gfx = this.add.graphics();
    this.input.on('pointerdown', () => {
      this.handlers.onRelease(0);
      this.handlers.onSpin(1);
    });
    this.input.on('pointerup', () => {
      this.handlers.onSpin(0);
      this.handlers.onRelease(1);
    });
    const keyboard = this.input.keyboard;
    if (keyboard) {
      this.keyD = keyboard.addKey('D');
      this.keyRight = keyboard.addKey('RIGHT');
      keyboard.on('keydown-D', () => this.handlers.onSpin(1));
      keyboard.on('keydown-RIGHT', () => this.handlers.onSpin(1));
      keyboard.on('keyup-D', () => {
        if (!this.keyRight.isDown) this.handlers.onSpin(0);
      });
      keyboard.on('keyup-RIGHT', () => {
        if (!this.keyD.isDown) this.handlers.onSpin(0);
      });
      keyboard.on('keydown-SPACE', () => this.handlers.onRelease(1));
      keyboard.on('keyup-SPACE', () => this.handlers.onRelease(0));
    }
  }

  setState(state: HammerRenderState): void {
    this.latest = state;
  }

  update(): void {
    this.draw();
  }

  view(): GameView {
    return {
      onFrame: (args) => {
        this.setState(args.renderState as HammerRenderState);
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
    g.fillRect(floor.x - FLOOR.hx * PIXELS_PER_METRE, floor.y - FLOOR.hy * PIXELS_PER_METRE, FLOOR.hx * 2 * PIXELS_PER_METRE, FLOOR.hy * 2 * PIXELS_PER_METRE);
    const wall = toScreen(WALL.x, WALL.y);
    g.fillRect(wall.x - WALL.hx * PIXELS_PER_METRE, wall.y - WALL.hy * PIXELS_PER_METRE, WALL.hx * 2 * PIXELS_PER_METRE, WALL.hy * 2 * PIXELS_PER_METRE);
    for (const [i, gate] of GATES.entries()) {
      const pos = toScreen(gate.x, gate.y);
      g.lineStyle(3, this.latest?.gatesThisThrow[i] ? VIEW_TOKENS.muted : VIEW_TOKENS.success, 1);
      g.strokeRect(pos.x - 4, pos.y - 40, 8, 80);
    }
    if (!this.latest) return;
    const thrower = toScreen(this.latest.throwerX, this.latest.throwerY);
    g.fillStyle(VIEW_TOKENS.ink, 1);
    g.fillCircle(thrower.x, thrower.y, 10);
    const hammer = toScreen(this.latest.hammerX, this.latest.hammerY);
    g.fillStyle(VIEW_TOKENS.accent, 1);
    g.fillRect(hammer.x - HAMMER_HALF.hx * PIXELS_PER_METRE, hammer.y - HAMMER_HALF.hy * PIXELS_PER_METRE, HAMMER_HALF.hx * 2 * PIXELS_PER_METRE, HAMMER_HALF.hy * 2 * PIXELS_PER_METRE);
    this.cameras.main.centerOn(hammer.x, thrower.y);
  }
}
