import Phaser from 'phaser';
import type { GameView } from '@stickworld/game-host';
import { PIXELS_PER_METRE } from '@stickworld/sim-core';
import { LINTELS, ROOF_HY, ROOFS, STAND_HX, STAND_HY } from '../simulation/course.js';
import type { RooftopRenderState } from '../simulation/simulation.js';
import { VIEW_TOKENS } from './tokens.js';

const Y_TOP = 8;

export interface SceneHandlers {
  onRun: (value: number) => void;
  onJump: (value: number) => void;
  onSlide: (value: number) => void;
}

function toScreen(x: number, y: number): { x: number; y: number } {
  return { x: x * PIXELS_PER_METRE, y: (Y_TOP - y) * PIXELS_PER_METRE };
}

export class RooftopScene extends Phaser.Scene {
  private gfx!: Phaser.GameObjects.Graphics;
  private latest: RooftopRenderState | undefined;
  private handlers: SceneHandlers;

  constructor(handlers: SceneHandlers) {
    super({ key: 'rooftop-relay' });
    this.handlers = handlers;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(VIEW_TOKENS.bg);
    this.gfx = this.add.graphics();
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.handlers.onRun(pointer.x > (this.scale.width || 960) / 2 ? 1 : 2);
      this.handlers.onJump(1);
    });
    this.input.on('pointerup', () => {
      this.handlers.onJump(0);
      this.handlers.onRun(0);
    });
    const keyboard = this.input.keyboard;
    if (keyboard) {
      keyboard.on('keydown-RIGHT', () => this.handlers.onRun(1));
      keyboard.on('keydown-LEFT', () => this.handlers.onRun(2));
      keyboard.on('keyup-RIGHT', () => this.handlers.onRun(0));
      keyboard.on('keyup-LEFT', () => this.handlers.onRun(0));
      keyboard.on('keydown-SPACE', () => this.handlers.onJump(1));
      keyboard.on('keyup-SPACE', () => this.handlers.onJump(0));
      keyboard.on('keydown-C', () => this.handlers.onSlide(1));
      keyboard.on('keyup-C', () => this.handlers.onSlide(0));
    }
  }

  setState(state: RooftopRenderState): void {
    this.latest = state;
  }

  update(): void {
    this.draw();
  }

  view(): GameView {
    return {
      onFrame: (args) => {
        this.setState(args.renderState as RooftopRenderState);
      },
      onPhase: () => {},
    };
  }

  private draw(): void {
    const g = this.gfx;
    if (!g) return;
    g.clear();
    g.fillStyle(VIEW_TOKENS.muted, 1);
    for (const roof of ROOFS) {
      const pos = toScreen(roof.x, roof.y);
      g.fillRect(pos.x - roof.hx * PIXELS_PER_METRE, pos.y - ROOF_HY * PIXELS_PER_METRE, roof.hx * 2 * PIXELS_PER_METRE, ROOF_HY * 2 * PIXELS_PER_METRE);
    }
    g.fillStyle(VIEW_TOKENS.accent, 1);
    for (const lintel of LINTELS) {
      const pos = toScreen(lintel.x, lintel.y);
      g.fillRect(pos.x - lintel.hx * PIXELS_PER_METRE, pos.y - lintel.hy * PIXELS_PER_METRE, lintel.hx * 2 * PIXELS_PER_METRE, lintel.hy * 2 * PIXELS_PER_METRE);
    }
    if (!this.latest) return;
    const p = toScreen(this.latest.playerX, this.latest.playerY);
    g.fillStyle(this.latest.stumbled ? VIEW_TOKENS.hazard : VIEW_TOKENS.ink, 1);
    const hy = this.latest.sliding ? 0.22 : STAND_HY;
    g.fillRect(p.x - STAND_HX * PIXELS_PER_METRE, p.y - hy * PIXELS_PER_METRE, STAND_HX * 2 * PIXELS_PER_METRE, hy * 2 * PIXELS_PER_METRE);
    this.cameras.main.centerOn(p.x, p.y);
  }
}
