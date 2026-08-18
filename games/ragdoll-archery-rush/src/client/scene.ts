import Phaser from 'phaser';
import type { GameView } from '@stickworld/game-host';
import { PIXELS_PER_METRE } from '@stickworld/sim-core';
import { BACKSTOP, FLOOR, TARGET_RADIUS, TARGETS, aimVector, degreesFromVector } from '../simulation/course.js';
import type { ArcheryRenderState } from '../simulation/simulation.js';
import { VIEW_TOKENS } from './tokens.js';

const Y_TOP = 16;

export interface SceneHandlers {
  onAim: (deg: number) => void;
  onDraw: (value: number) => void;
  onFire: (value: number) => void;
}

function toScreen(x: number, y: number): { x: number; y: number } {
  return { x: x * PIXELS_PER_METRE, y: (Y_TOP - y) * PIXELS_PER_METRE };
}

export class ArcheryScene extends Phaser.Scene {
  private gfx!: Phaser.GameObjects.Graphics;
  private latest: ArcheryRenderState | undefined;
  private handlers: SceneHandlers;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private keyW!: Phaser.Input.Keyboard.Key;
  private keyS!: Phaser.Input.Keyboard.Key;

  constructor(handlers: SceneHandlers) {
    super({ key: 'ragdoll-archery-rush' });
    this.handlers = handlers;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(VIEW_TOKENS.bg);
    this.gfx = this.add.graphics();
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => this.emitAimDraw(pointer));
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.x > 800 && pointer.y > 430) {
        this.handlers.onFire(1);
        return;
      }
      this.emitAimDraw(pointer);
    });
    this.input.on('pointerup', () => this.handlers.onFire(0));
    const keyboard = this.input.keyboard;
    if (keyboard) {
      this.keyA = keyboard.addKey('A');
      this.keyD = keyboard.addKey('D');
      this.keyW = keyboard.addKey('W');
      this.keyS = keyboard.addKey('S');
      keyboard.on('keydown-SPACE', () => this.handlers.onFire(1));
      keyboard.on('keyup-SPACE', () => this.handlers.onFire(0));
    }
  }

  setState(state: ArcheryRenderState): void {
    this.latest = state;
  }

  update(): void {
    if (this.latest && this.keyA) {
      if (this.keyA.isDown) this.handlers.onAim((((this.latest.aim - 3) % 360) + 360) % 360);
      if (this.keyD.isDown) this.handlers.onAim((((this.latest.aim + 3) % 360) + 360) % 360);
      if (this.keyW.isDown) this.handlers.onDraw(Math.min(100, this.latest.draw + 2));
      if (this.keyS.isDown) this.handlers.onDraw(Math.max(0, this.latest.draw - 2));
    }
    this.draw();
  }

  view(): GameView {
    return {
      onFrame: (args) => {
        this.setState(args.renderState as ArcheryRenderState);
      },
      onPhase: () => {},
    };
  }

  private emitAimDraw(pointer: Phaser.Input.Pointer): void {
    if (!this.latest) return;
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const wx = worldPoint.x / PIXELS_PER_METRE;
    const wy = Y_TOP - worldPoint.y / PIXELS_PER_METRE;
    const dx = wx - this.latest.torsoX;
    const dy = wy - this.latest.torsoY;
    this.handlers.onAim(degreesFromVector(dx, dy));
    const dist = Math.hypot(dx, dy);
    this.handlers.onDraw(Math.max(0, Math.min(100, Math.floor(dist * 12))));
  }

  private draw(): void {
    const g = this.gfx;
    if (!g) return;
    g.clear();
    const floor = toScreen(FLOOR.x, FLOOR.y);
    g.fillStyle(VIEW_TOKENS.muted, 1);
    g.fillRect(floor.x - FLOOR.hx * PIXELS_PER_METRE, floor.y - FLOOR.hy * PIXELS_PER_METRE, FLOOR.hx * 2 * PIXELS_PER_METRE, FLOOR.hy * 2 * PIXELS_PER_METRE);
    const wall = toScreen(BACKSTOP.x, BACKSTOP.y);
    g.fillRect(wall.x - BACKSTOP.hx * PIXELS_PER_METRE, wall.y - BACKSTOP.hy * PIXELS_PER_METRE, BACKSTOP.hx * 2 * PIXELS_PER_METRE, BACKSTOP.hy * 2 * PIXELS_PER_METRE);
    for (const [i, target] of TARGETS.entries()) {
      const pos = toScreen(target.x, target.y);
      g.fillStyle(this.latest?.targetsHit[i] ? VIEW_TOKENS.muted : VIEW_TOKENS.accent, 1);
      g.fillCircle(pos.x, pos.y, TARGET_RADIUS * PIXELS_PER_METRE);
    }
    if (!this.latest) return;
    const torso = toScreen(this.latest.torsoX, this.latest.torsoY);
    g.fillStyle(VIEW_TOKENS.ink, 1);
    g.fillCircle(torso.x, torso.y, 8);
    const arrow = toScreen(this.latest.arrowX, this.latest.arrowY);
    g.fillCircle(arrow.x, arrow.y, 4);
    const aim = aimVector(this.latest.aim);
    g.lineStyle(2, VIEW_TOKENS.success, 0.8);
    g.beginPath();
    g.moveTo(torso.x, torso.y);
    const tip = toScreen(this.latest.torsoX + aim.x * 2, this.latest.torsoY + aim.y * 2);
    g.lineTo(tip.x, tip.y);
    g.strokePath();
    this.cameras.main.centerOn(torso.x + 200, torso.y);
  }
}
