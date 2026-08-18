import { Prng } from '@stickworld/sim-core';

export const LEDGE_COUNT = 16;
export const LEDGE_Y0 = 2;
export const LEDGE_DY = 1.8;
export const LEDGE_HY = 0.10;
export const SPAWN = { x: 5.0, y: 1.6 } as const;
export const TOP_Y = LEDGE_Y0 + (LEDGE_COUNT - 1) * LEDGE_DY;

export interface TowerLedge {
  x: number;
  y: number;
  hx: number;
  hy: number;
  moving: boolean;
  amplitude: number;
  periodTicks: number;
}

export interface Tower {
  spawn: { x: number; y: number };
  ledges: TowerLedge[];
}

/** Published draw order. Extra `nextUint32` calls only when a ledge is moving. */
export function createTower(prng: Pick<Prng, 'nextUint32'>): Tower {
  const ledges: TowerLedge[] = [];
  for (let i = 0; i < LEDGE_COUNT; i++) {
    const x = 3 + (prng.nextUint32() % 401) / 100;
    const y = LEDGE_Y0 + i * LEDGE_DY;
    const hx = 0.9 - i * 0.03;
    const moving = prng.nextUint32() % 4 === 0;
    let amplitude = 0;
    let periodTicks = 0;
    if (moving) {
      amplitude = (prng.nextUint32() % 81) / 100;
      periodTicks = 90 + (prng.nextUint32() % 91);
    }
    ledges.push({ x, y, hx, hy: LEDGE_HY, moving, amplitude, periodTicks });
  }
  return { spawn: { x: SPAWN.x, y: SPAWN.y }, ledges };
}

export function dumpTowerGeometry(tower: Tower): string {
  return `${JSON.stringify(
    tower.ledges.map((ledge) => ({
      x: ledge.x,
      y: ledge.y,
      hx: ledge.hx,
      hy: ledge.hy,
      moving: ledge.moving,
      amplitude: ledge.amplitude,
      periodTicks: ledge.periodTicks,
    })),
  )}\n`;
}
