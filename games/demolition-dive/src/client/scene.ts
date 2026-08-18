import Phaser from 'phaser';
import type { GameView } from '@stickworld/game-host';
import { PIXELS_PER_METRE } from '@stickworld/sim-core';
import { BACKSTOP, BRICK_HALF, FLOOR, aimVector, clampPower, degreesFromVector } from '../simulation/course.js';
import type { DemolitionRenderState } from '../simulation/simulation.js';
import { VIEW_TOKENS } from './tokens.js';

const Y_TOP = 16;

export interface SceneHandlers {
  onAim: (deg: number) => void;
  onPower: (value: number) => void;
  onLaunch: (value: number) => void;
}

function toScreen(x: number, y: number): { x: number; y: number } {
  return { x: x * PIXELS_PER_METRE, y: (Y_TOP - y) * PIXELS_PER_METRE };
}

export class DemolitionScene extends Phaser.Scene {
  private gfx!: Phaser.GameObjects.Graphics;
  private latest: DemolitionRenderState | undefined;
  private handlers: SceneHandlers;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private keyW!: Phaser.Input.Keyboard.Key;
  private keyS!: Phaser.Input.Keyboard.Key;

  constructor(handlers: SceneHandlers) {
    super({ key: 'demolition-dive' });
    this.handlers = handlers;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(VIEW_TOKENS.bg);
    this.gfx = this.add.graphics();
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.isDown) return;
      this.emitAimPower(pointer);
    });
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.x > 800 && pointer.y > 430) {
        this.handlers.onLaunch(1);
        return;
      }
      this.emitAimPower(pointer);
    });
    this.input.on('pointerup', () => this.handlers.onLaunch(0));
    const keyboard = this.input.keyboard;
    if (keyboard) {
      this.keyA = keyboard.addKey('A');
      this.keyD = keyboard.addKey('D');
      this.keyW = keyboard.addKey('W');
      this.keyS = keyboard.addKey('S');
      keyboard.on('keydown-SPACE', () => this.handlers.onLaunch(1));
      keyboard.on('keyup-SPACE', () => this.handlers.onLaunch(0));
    }
  }

  setState(state: DemolitionRenderState): void {
    this.latest = state;
  }

  update(): void {
    if (this.latest && this.keyA) {
      if (this.keyA.isDown) this.handlers.onAim((((this.latest.aim - 3) % 360) + 360) % 360);
      if (this.keyD.isDown) this.handlers.onAim((((this.latest.aim + 3) % 360) + 360) % 360);
      if (this.keyW.isDown) this.handlers.onPower(clampPower(this.latest.power + 2));
      if (this.keyS.isDown) this.handlers.onPower(clampPower(this.latest.power - 2));
    }
    this.draw();
  }

  view(): GameView {
    return {
      onFrame: (args) => {
        this.setState(args.renderState as DemolitionRenderState);
      },
      onPhase: () => {},
    };
  }

  private emitAimPower(pointer: Phaser.Input.Pointer): void {
    if (!this.latest) return;
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const wx = worldPoint.x / PIXELS_PER_METRE;
    const wy = Y_TOP - worldPoint.y / PIXELS_PER_METRE;
    this.handlers.onAim(degreesFromVector(wx - this.latest.torsoX, wy - this.latest.torsoY));
    const height = this.scale.height || 540;
    this.handlers.onPower(clampPower(100 - Math.floor((pointer.y / height) * 100)));
  }

  private draw(): void {
    const g = this.gfx;
    if (!g) return;
    g.clear();
    this.fillBox(g, FLOOR.x, FLOOR.y, FLOOR.hx, FLOOR.hy, VIEW_TOKENS.muted);
    this.fillBox(g, BACKSTOP.x, BACKSTOP.y, BACKSTOP.hx, BACKSTOP.hy, VIEW_TOKENS.muted);
    if (this.latest) {
      for (const brick of this.latest.bricks) {
        if (brick.parked) continue;
        this.fillBox(
          g,
          brick.x,
          brick.y,
          BRICK_HALF.hx,
          BRICK_HALF.hy,
          brick.broken ? VIEW_TOKENS.hazard : VIEW_TOKENS.success,
        );
      }
      g.fillStyle(VIEW_TOKENS.ink, 1);
      for (const part of this.latest.parts) {
        const pos = toScreen(part.x, part.y);
        g.fillCircle(pos.x, pos.y, 6);
      }
      const aim = aimVector(this.latest.aim);
      const torso = toScreen(this.latest.torsoX, this.latest.torsoY);
      g.lineStyle(2, VIEW_TOKENS.accent, 0.8);
      g.beginPath();
      g.moveTo(torso.x, torso.y);
      const tip = toScreen(this.latest.torsoX + aim.x * 2.5, this.latest.torsoY + aim.y * 2.5);
      g.lineTo(tip.x, tip.y);
      g.strokePath();
      this.cameras.main.centerOn(torso.x + 80, toScreen(10, 8).y);
    }
  }

  private fillBox(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    hx: number,
    hy: number,
    color: number,
  ): void {
    const pos = toScreen(x, y);
    g.fillStyle(color, 1);
    g.fillRect(pos.x - hx * PIXELS_PER_METRE, pos.y - hy * PIXELS_PER_METRE, hx * 2 * PIXELS_PER_METRE, hy * 2 * PIXELS_PER_METRE);
  }
}
