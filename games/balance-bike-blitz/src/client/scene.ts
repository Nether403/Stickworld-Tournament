import Phaser from 'phaser';
import type { GameView } from '@stickworld/game-host';
import { PIXELS_PER_METRE } from '@stickworld/sim-core';
import type { BikeRenderState } from '../simulation/simulation.js';
import { VIEW_TOKENS } from './tokens.js';

const Y_TOP = 8;

export interface SceneHandlers {
  onThrottle: (value: number) => void;
  onBrake: (value: number) => void;
  onLean: (value: number) => void;
}

function toScreen(x: number, y: number): { x: number; y: number } {
  return { x: x * PIXELS_PER_METRE, y: (Y_TOP - y) * PIXELS_PER_METRE };
}

export class BikeScene extends Phaser.Scene {
  private gfx!: Phaser.GameObjects.Graphics;
  private latest: BikeRenderState | undefined;
  private handlers: SceneHandlers;

  constructor(handlers: SceneHandlers) {
    super({ key: 'balance-bike-blitz' });
    this.handlers = handlers;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(VIEW_TOKENS.bg);
    this.gfx = this.add.graphics();
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      const width = this.scale.width || 960;
      this.handlers.onLean(Math.max(0, Math.min(200, Math.floor((pointer.x / width) * 200))));
    });
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.x > (this.scale.width || 960) / 2) this.handlers.onThrottle(1);
      else this.handlers.onBrake(1);
    });
    this.input.on('pointerup', () => {
      this.handlers.onThrottle(0);
      this.handlers.onBrake(0);
    });
    const keyboard = this.input.keyboard;
    if (keyboard) {
      keyboard.on('keydown-RIGHT', () => this.handlers.onThrottle(1));
      keyboard.on('keyup-RIGHT', () => this.handlers.onThrottle(0));
      keyboard.on('keydown-LEFT', () => this.handlers.onBrake(1));
      keyboard.on('keyup-LEFT', () => this.handlers.onBrake(0));
    }
  }

  setState(state: BikeRenderState): void {
    this.latest = state;
  }

  update(): void {
    this.draw();
  }

  view(): GameView {
    return {
      onFrame: (args) => {
        this.setState(args.renderState as BikeRenderState);
      },
      onPhase: () => {},
    };
  }

  private draw(): void {
    const g = this.gfx;
    if (!g) return;
    g.clear();
    g.fillStyle(VIEW_TOKENS.muted, 1);
    g.fillRect(0, (Y_TOP - 0.5) * PIXELS_PER_METRE, 2500, 40);
    if (!this.latest) return;
    const frame = toScreen(this.latest.frameX, this.latest.frameY);
    const rear = toScreen(this.latest.rearX, this.latest.rearY);
    const front = toScreen(this.latest.frontX, this.latest.frontY);
    g.fillStyle(this.latest.fail ? VIEW_TOKENS.hazard : VIEW_TOKENS.ink, 1);
    g.fillCircle(rear.x, rear.y, 9);
    g.fillCircle(front.x, front.y, 9);
    g.fillStyle(VIEW_TOKENS.accent, 1);
    g.fillRect(frame.x - 10, frame.y - 4, 20, 8);
    this.cameras.main.centerOn(frame.x, frame.y);
  }
}
