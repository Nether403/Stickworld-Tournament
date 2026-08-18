import type RAPIER from '@dimforge/rapier2d-compat';
import { sin } from '../../src/detmath.js';
import { formatHash } from '../../src/hash.js';
import { initRapier, rapierBuildHash, type RapierModule } from '../../src/rapier.js';
import { SimWorld } from '../../src/sim-world.js';
import { TIMESTEP } from '../../src/version.js';

export const CHECKPOINTS = [1, 10, 100, 1_000, 10_000] as const;
export const TOTAL_TICKS = 10_000;

export type HashSeries = Record<(typeof CHECKPOINTS)[number], string>;

export interface StressResult {
  hashes: HashSeries;
  rapierBuildHash: string;
}

function cuboid(
  R: RapierModule,
  sim: SimWorld,
  kind: 'fixed' | 'dynamic' | 'kinematic',
  hx: number,
  hy: number,
  x: number,
  y: number,
): RAPIER.RigidBody {
  const desc =
    kind === 'fixed'
      ? R.RigidBodyDesc.fixed()
      : kind === 'kinematic'
        ? R.RigidBodyDesc.kinematicPositionBased()
        : R.RigidBodyDesc.dynamic();
  const body = sim.createRigidBody(desc.setTranslation(x, y));
  sim.world.createCollider(R.ColliderDesc.cuboid(hx, hy), body);
  return body;
}

function ball(
  R: RapierModule,
  sim: SimWorld,
  radius: number,
  x: number,
  y: number,
  ccd: boolean,
): RAPIER.RigidBody {
  const desc = R.RigidBodyDesc.dynamic().setTranslation(x, y);
  if (ccd) desc.setCcdEnabled(true);
  const body = sim.createRigidBody(desc);
  sim.world.createCollider(R.ColliderDesc.ball(radius), body);
  return body;
}

function revolute(
  R: RapierModule,
  sim: SimWorld,
  a: RAPIER.RigidBody,
  b: RAPIER.RigidBody,
  aAnchor: { x: number; y: number },
  bAnchor: { x: number; y: number },
  limits?: readonly [number, number],
): RAPIER.ImpulseJoint {
  const data = R.JointData.revolute(aAnchor, bAnchor);
  if (limits) {
    data.limitsEnabled = true;
    data.limits = [limits[0], limits[1]];
  }
  return sim.world.createImpulseJoint(data, a, b, true);
}

function buildWorld(
  R: RapierModule,
  platformDrive: (tick: number) => number,
): {
  sim: SimWorld;
  platform: RAPIER.RigidBody;
  breakable: RAPIER.ImpulseJoint;
} {
  const sim = new SimWorld(R);
  cuboid(R, sim, 'fixed', 8, 0.25, 0, -0.25);

  for (let i = 0; i < 6; i++) {
    cuboid(R, sim, 'dynamic', 0.12, 0.12, 0.02 * i, 0.3 + i * 0.26);
  }

  const torso = cuboid(R, sim, 'dynamic', 0.12, 0.22, -1.5, 1.4);
  const head = cuboid(R, sim, 'dynamic', 0.08, 0.08, -1.5, 1.75);
  const uArmL = cuboid(R, sim, 'dynamic', 0.05, 0.12, -1.72, 1.45);
  const lArmL = cuboid(R, sim, 'dynamic', 0.045, 0.12, -1.72, 1.2);
  const uArmR = cuboid(R, sim, 'dynamic', 0.05, 0.12, -1.28, 1.45);
  const lArmR = cuboid(R, sim, 'dynamic', 0.045, 0.12, -1.28, 1.2);
  const uLegL = cuboid(R, sim, 'dynamic', 0.055, 0.14, -1.58, 1.05);
  const lLegL = cuboid(R, sim, 'dynamic', 0.05, 0.14, -1.58, 0.78);
  const uLegR = cuboid(R, sim, 'dynamic', 0.055, 0.14, -1.42, 1.05);
  const lLegR = cuboid(R, sim, 'dynamic', 0.05, 0.14, -1.42, 0.78);

  revolute(R, sim, torso, head, { x: 0, y: 0.22 }, { x: 0, y: -0.08 }, [-0.4, 0.4]);
  revolute(R, sim, torso, uArmL, { x: -0.12, y: 0.18 }, { x: 0, y: 0.12 }, [-1.2, 0.6]);
  revolute(R, sim, uArmL, lArmL, { x: 0, y: -0.12 }, { x: 0, y: 0.12 }, [-2, 0]);
  revolute(R, sim, torso, uArmR, { x: 0.12, y: 0.18 }, { x: 0, y: 0.12 }, [-0.6, 1.2]);
  revolute(R, sim, uArmR, lArmR, { x: 0, y: -0.12 }, { x: 0, y: 0.12 }, [-2, 0]);
  revolute(R, sim, torso, uLegL, { x: -0.06, y: -0.22 }, { x: 0, y: 0.14 }, [-0.4, 1.2]);
  revolute(R, sim, uLegL, lLegL, { x: 0, y: -0.14 }, { x: 0, y: 0.14 }, [-2, 0.1]);
  revolute(R, sim, torso, uLegR, { x: 0.06, y: -0.22 }, { x: 0, y: 0.14 }, [-0.4, 1.2]);
  revolute(R, sim, uLegR, lLegR, { x: 0, y: -0.14 }, { x: 0, y: 0.14 }, [-2, 0.1]);

  const ropeA = ball(R, sim, 0.06, 1.2, 2.2, false);
  const ropeB = ball(R, sim, 0.06, 1.2, 1.4, false);
  const anchor = cuboid(R, sim, 'fixed', 0.04, 0.04, 1.2, 2.4);
  sim.world.createImpulseJoint(
    R.JointData.rope(0.25, { x: 0, y: 0 }, { x: 0, y: 0 }),
    anchor,
    ropeA,
    true,
  );
  sim.world.createImpulseJoint(
    R.JointData.rope(0.9, { x: 0, y: 0 }, { x: 0, y: 0 }),
    ropeA,
    ropeB,
    true,
  );

  const projectile = ball(R, sim, 0.04, -3, 1.2, true);
  projectile.setLinvel({ x: 18, y: 2 }, true);

  const platform = cuboid(R, sim, 'kinematic', 0.6, 0.08, 2.4, 0.6);
  platform.setNextKinematicTranslation({ x: 2.4 + platformDrive(0), y: 0.6 });

  const breakA = cuboid(R, sim, 'dynamic', 0.1, 0.1, 3.2, 1.1);
  const breakB = cuboid(R, sim, 'dynamic', 0.1, 0.1, 3.45, 1.1);
  const breakable = revolute(
    R,
    sim,
    breakA,
    breakB,
    { x: 0.1, y: 0 },
    { x: -0.1, y: 0 },
    [-0.2, 0.2],
  );

  return { sim, platform, breakable };
}

function emptySeries(): HashSeries {
  return {
    1: '',
    10: '',
    100: '',
    1000: '',
    10000: '',
  };
}

export async function runStress01(options?: {
  drive?: (tick: number) => number;
  ticks?: number;
}): Promise<StressResult> {
  const R = await initRapier();
  const drive = options?.drive ?? ((tick: number) => sin(tick * TIMESTEP * 2));
  const ticks = options?.ticks ?? TOTAL_TICKS;
  const { sim, platform, breakable } = buildWorld(R, drive);
  const hashes = emptySeries();

  for (let tick = 1; tick <= ticks; tick++) {
    platform.setNextKinematicTranslation({
      x: 2.4 + drive(tick),
      y: 0.6,
    });
    sim.step();
    if (tick === 2500) {
      sim.world.removeImpulseJoint(breakable, true);
    }
    if (tick === 1 || tick === 10 || tick === 100 || tick === 1000 || tick === 10_000) {
      hashes[tick as keyof HashSeries] = formatHash(sim.stateHash());
    }
  }

  sim.free();
  return { hashes, rapierBuildHash: rapierBuildHash() };
}

export function detmathDrive(tick: number): number {
  return sin(tick * TIMESTEP * 2);
}

/** Spec R6.6 negative control: Math.sin on a poorly-conditioned argument. */
export function mathSinDrive(tick: number): number {
  return Math.sin(1e12 + tick * TIMESTEP * 2);
}
