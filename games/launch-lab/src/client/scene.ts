import Phaser from 'phaser';
import type { GameView } from '@stickworld/game-host';
import { PIXELS_PER_METRE } from '@stickworld/sim-core';
import {
  BACKSTOP,
  LANDING,
  PAD,
  PLAYER_HALF_HEIGHT,
  PLAYER_RADIUS,
  RING_HALF,
  RINGS,
  aimVector,
  clampPower,
} from '../simulation/course.js';
import type { LaunchLabRenderState } from '../simulation/simulation.js';
import { VIEW_TOKENS } from './tokens.js';

const Y_TOP = 16;

export interface SceneHandlers {
  onAim: (deg: number) => void;
  onPower: (value: number) => void;
  onTuck: (value: number) => void;
  onLaunch: (value: number) => void;
}

function toScreen(x: number, y: number): { x: number; y: number } {
  return { x: x * PIXELS_PER_METRE, y: (Y_TOP - y) * PIXELS_PER_METRE };
}

export class LaunchLabScene extends Phaser.Scene {
  private gfx!: Phaser.GameObjects.Graphics;
  private latest: LaunchLabRenderState | undefined;
  private handlers: SceneHandlers;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private keyW!: Phaser.Input.Keyboard.Key;
  private keyS!: Phaser.Input.Keyboard.Key;
  private keyShift!: Phaser.Input.Keyboard.Key;

  constructor(handlers: SceneHandlers) {
    super({ key: 'launch-lab' });
    this.handlers = handlers;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(VIEW_TOKENS.bg);
    this.gfx = this.add.graphics();
    this.input.addPointer(2);

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
    this.input.on('pointerup', () => {
      this.handlers.onLaunch(0);
    });

    const keyboard = this.input.keyboard;
    if (keyboard) {
      this.keyA = keyboard.addKey('A');
      this.keyD = keyboard.addKey('D');
      this.keyW = keyboard.addKey('W');
      this.keyS = keyboard.addKey('S');
      this.keyShift = keyboard.addKey('SHIFT');
      keyboard.on('keydown-SPACE', () => {
        this.handlers.onLaunch(1);
      });
      keyboard.on('keyup-SPACE', () => {
        this.handlers.onLaunch(0);
      });
    }
  }

  setState(state: LaunchLabRenderState): void {
    this.latest = state;
  }

  update(): void {
    if (this.latest && this.keyA) {
      const left = this.keyA.isDown;
      const right = this.keyD.isDown;
      if (left || right) {
        let aim = this.latest.aim;
        if (left) aim -= 3;
        if (right) aim += 3;
        aim = ((aim % 360) + 360) % 360;
        this.handlers.onAim(aim);
      }
      if (this.keyW.isDown) this.handlers.onPower(clampPower(this.latest.power + 2));
      if (this.keyS.isDown) this.handlers.onPower(clampPower(this.latest.power - 2));
      this.handlers.onTuck(this.keyShift.isDown ? 1 : 0);
    }
    this.draw();
  }

  view(): GameView {
    return {
      onFrame: (args) => {
        this.setState(args.renderState as LaunchLabRenderState);
      },
      onPhase: () => {},
    };
  }

  private emitAimPower(pointer: Phaser.Input.Pointer): void {
    const width = this.scale.width || 960;
    const height = this.scale.height || 540;
    const aim = Math.floor(((pointer.x / width) * 360) % 360);
    const power = clampPower(100 - Math.floor((pointer.y / height) * 100));
    this.handlers.onAim(aim);
    this.handlers.onPower(power);
  }

  private draw(): void {
    const g = this.gfx;
    if (!g) return;
    g.clear();
    this.fillBox(g, BACKSTOP.x, BACKSTOP.y, BACKSTOP.hx, BACKSTOP.hy, VIEW_TOKENS.muted);
    this.fillBox(g, PAD.x, PAD.y, PAD.hx, PAD.hy, VIEW_TOKENS.muted);
    this.fillBox(g, LANDING.x, LANDING.y, LANDING.hx, LANDING.hy, VIEW_TOKENS.success);
    for (const [i, ring] of RINGS.entries()) {
      const passed = this.latest?.ringsThisSub[i] ?? false;
      const pos = toScreen(ring.x, ring.y);
      g.lineStyle(3, passed ? VIEW_TOKENS.muted : VIEW_TOKENS.accent, 1);
      g.strokeRect(
        pos.x - RING_HALF.hx * PIXELS_PER_METRE,
        pos.y - RING_HALF.hy * PIXELS_PER_METRE,
        RING_HALF.hx * 2 * PIXELS_PER_METRE,
        RING_HALF.hy * 2 * PIXELS_PER_METRE,
      );
    }
    if (!this.latest) return;
    const player = toScreen(this.latest.playerX, this.latest.playerY);
    g.fillStyle(VIEW_TOKENS.ink, 1);
    const capH = PLAYER_HALF_HEIGHT * PIXELS_PER_METRE;
    const capR = PLAYER_RADIUS * PIXELS_PER_METRE;
    g.fillRect(player.x - capR, player.y - capH, capR * 2, capH * 2);
    g.fillCircle(player.x, player.y - capH, capR);
    const aim = aimVector(this.latest.aim);
    g.lineStyle(2, VIEW_TOKENS.accent, 0.8);
    g.beginPath();
    g.moveTo(player.x, player.y);
    const tip = toScreen(this.latest.playerX + aim.x * 2, this.latest.playerY + aim.y * 2);
    g.lineTo(tip.x, tip.y);
    g.strokePath();
    this.cameras.main.centerOn(player.x + 120, player.y);
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
