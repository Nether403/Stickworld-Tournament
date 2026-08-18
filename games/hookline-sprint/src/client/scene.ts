import Phaser from 'phaser';
import type { GameView } from '@stickworld/game-host';
import { nudgeAimDegrees } from '@stickworld/input';
import { PIXELS_PER_METRE } from '@stickworld/sim-core';
import {
  ANCHOR_RADIUS,
  ANCHORS,
  GATES,
  PLAYER_HALF_HEIGHT,
  PLAYER_RADIUS,
  START_LEDGE,
  aimVector,
  degreesFromVector,
} from '../simulation/course.js';
import type { HooklineRenderState } from '../simulation/simulation.js';
import { nearestForwardAnchorAim } from './aim.js';
import { VIEW_TOKENS } from './tokens.js';

const Y_TOP = 16;
const LOOKAHEAD_M = 4;
const GATE_SHAPES = ['chevron', 'diamond', 'plus', 'square'] as const;

export interface SceneHandlers {
  onAim: (deg: number) => void;
  onHook: (value: number) => void;
}

function toScreen(x: number, y: number): { x: number; y: number } {
  return { x: x * PIXELS_PER_METRE, y: (Y_TOP - y) * PIXELS_PER_METRE };
}

function toWorld(sx: number, sy: number): { x: number; y: number } {
  return { x: sx / PIXELS_PER_METRE, y: Y_TOP - sy / PIXELS_PER_METRE };
}

export class HooklineScene extends Phaser.Scene {
  private gfx!: Phaser.GameObjects.Graphics;
  private latest: HooklineRenderState | undefined;
  private handlers: SceneHandlers;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private keyW!: Phaser.Input.Keyboard.Key;
  private keyS!: Phaser.Input.Keyboard.Key;
  private keyLeft!: Phaser.Input.Keyboard.Key;
  private keyRight!: Phaser.Input.Keyboard.Key;
  private keyUp!: Phaser.Input.Keyboard.Key;
  private keyDown!: Phaser.Input.Keyboard.Key;

  constructor(handlers: SceneHandlers) {
    super({ key: 'hookline' });
    this.handlers = handlers;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(VIEW_TOKENS.bg);
    this.gfx = this.add.graphics();
    this.input.addPointer(2);

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      this.emitAimFromPointer(pointer);
    });
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.emitAimFromPointer(pointer);
      this.handlers.onHook(1);
    });
    this.input.on('pointerup', () => {
      this.handlers.onHook(0);
    });

    const keyboard = this.input.keyboard;
    if (keyboard) {
      this.keyA = keyboard.addKey('A');
      this.keyD = keyboard.addKey('D');
      this.keyW = keyboard.addKey('W');
      this.keyS = keyboard.addKey('S');
      this.keyLeft = keyboard.addKey('LEFT');
      this.keyRight = keyboard.addKey('RIGHT');
      this.keyUp = keyboard.addKey('UP');
      this.keyDown = keyboard.addKey('DOWN');
      keyboard.on('keydown-SPACE', () => {
        this.tryKeyboardAttach();
      });
      keyboard.on('keyup-SPACE', () => {
        this.handlers.onHook(0);
      });
      keyboard.on('keydown-E', () => {
        this.tryKeyboardAttach();
      });
      keyboard.on('keyup-E', () => {
        this.handlers.onHook(0);
      });
    }
  }

  setState(state: HooklineRenderState): void {
    this.latest = state;
  }

  update(): void {
    if (this.latest && this.keyA) {
      const left = this.keyA.isDown || this.keyLeft.isDown;
      const right = this.keyD.isDown || this.keyRight.isDown;
      const up = this.keyW.isDown || this.keyUp.isDown;
      const down = this.keyS.isDown || this.keyDown.isDown;
      if (left || right || up || down) {
        this.handlers.onAim(nudgeAimDegrees(this.latest.aim, left, right, up, down));
      }
    }
    this.draw();
  }

  view(): GameView {
    return {
      onFrame: (args) => {
        this.setState(args.renderState as HooklineRenderState);
      },
      onPhase: () => {},
    };
  }

  private tryKeyboardAttach(): void {
    if (!this.latest) return;
    const auto = nearestForwardAnchorAim(
      this.latest.playerX,
      this.latest.playerY,
      this.latest.playerVx,
    );
    if (auto !== undefined) this.handlers.onAim(auto);
    this.handlers.onHook(1);
  }

  private emitAimFromPointer(pointer: Phaser.Input.Pointer): void {
    if (!this.latest) return;
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const world = toWorld(worldPoint.x, worldPoint.y);
    const dx = world.x - this.latest.playerX;
    const dy = world.y - this.latest.playerY;
    this.handlers.onAim(degreesFromVector(dx, dy));
  }

  private draw(): void {
    const g = this.gfx;
    if (!g) return;
    g.clear();
    const ledge = toScreen(START_LEDGE.x, START_LEDGE.y);
    g.fillStyle(VIEW_TOKENS.muted, 1);
    g.fillRect(
      ledge.x - START_LEDGE.hx * PIXELS_PER_METRE,
      ledge.y - START_LEDGE.hy * PIXELS_PER_METRE,
      START_LEDGE.hx * 2 * PIXELS_PER_METRE,
      START_LEDGE.hy * 2 * PIXELS_PER_METRE,
    );

    for (const [i, gate] of GATES.entries()) {
      const pos = toScreen(gate.x, 8);
      const passed = this.latest?.gatesPassed[i] ?? false;
      g.lineStyle(3, passed ? VIEW_TOKENS.muted : VIEW_TOKENS.success, 1);
      this.drawGateShape(g, pos.x, pos.y, GATE_SHAPES[i] ?? 'chevron');
    }

    for (const anchor of ANCHORS) {
      const pos = toScreen(anchor.x, anchor.y);
      g.fillStyle(VIEW_TOKENS.accent, 1);
      g.fillCircle(pos.x, pos.y, ANCHOR_RADIUS * PIXELS_PER_METRE);
    }

    if (!this.latest) return;
    const player = toScreen(this.latest.playerX, this.latest.playerY);
    if (
      this.latest.attached &&
      this.latest.ropeAnchorX !== null &&
      this.latest.ropeAnchorY !== null
    ) {
      const anchor = toScreen(this.latest.ropeAnchorX, this.latest.ropeAnchorY);
      g.lineStyle(2, VIEW_TOKENS.ink, 1);
      g.beginPath();
      g.moveTo(player.x, player.y);
      g.lineTo(anchor.x, anchor.y);
      g.strokePath();
    }

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

    const look = toScreen(this.latest.playerX + LOOKAHEAD_M, this.latest.playerY);
    this.cameras.main.centerOn(look.x, look.y);
  }

  private drawGateShape(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    shape: (typeof GATE_SHAPES)[number],
  ): void {
    const s = 18;
    if (shape === 'square') {
      g.strokeRect(x - s, y - s, s * 2, s * 2);
      return;
    }
    g.beginPath();
    if (shape === 'chevron') {
      g.moveTo(x - s, y - s);
      g.lineTo(x, y);
      g.lineTo(x - s, y + s);
    } else if (shape === 'diamond') {
      g.moveTo(x, y - s);
      g.lineTo(x + s, y);
      g.lineTo(x, y + s);
      g.lineTo(x - s, y);
      g.closePath();
    } else {
      g.moveTo(x - s, y);
      g.lineTo(x + s, y);
      g.moveTo(x, y - s);
      g.lineTo(x, y + s);
    }
    g.strokePath();
  }
}
