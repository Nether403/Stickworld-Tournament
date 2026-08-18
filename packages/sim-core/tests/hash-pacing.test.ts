import { describe, expect, it } from 'vitest';
import { formatHash } from '../src/hash.js';
import { initRapier } from '../src/rapier.js';
import { SimWorld } from '../src/sim-world.js';
import { Stepper } from '../src/stepper.js';
import { TIMESTEP } from '../src/version.js';

describe('state hashing', () => {
  it('is pure: 100 mid-run calls do not change the final hash', async () => {
    const R = await initRapier();
    const sim = new SimWorld(R);
    const body = sim.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(0, 2));
    sim.world.createCollider(R.ColliderDesc.ball(0.2), body);
    sim.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(0, -0.25));
    sim.world.createCollider(
      R.ColliderDesc.cuboid(2, 0.25),
      sim.world.getRigidBody(sim.registry.ordered()[1]!)!,
    );

    for (let i = 0; i < 30; i++) sim.step();
    for (let i = 0; i < 100; i++) {
      sim.stateHash();
    }
    const afterProbing = sim.stateHash();
    for (let i = 0; i < 30; i++) sim.step();
    const finalWithProbe = sim.stateHash();
    sim.free();

    const sim2 = new SimWorld(R);
    const b2 = sim2.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(0, 2));
    sim2.world.createCollider(R.ColliderDesc.ball(0.2), b2);
    sim2.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(0, -0.25));
    sim2.world.createCollider(
      R.ColliderDesc.cuboid(2, 0.25),
      sim2.world.getRigidBody(sim2.registry.ordered()[1]!)!,
    );
    for (let i = 0; i < 60; i++) sim2.step();
    const finalWithoutProbe = sim2.stateHash();
    sim2.free();

    expect(formatHash(afterProbing)).toMatch(/^[0-9a-f]{16}$/);
    expect(formatHash(finalWithProbe)).toBe(formatHash(finalWithoutProbe));
  });
});

describe('frame-pacing invariance', () => {
  async function runWithDeltas(deltas: number[]): Promise<string> {
    const R = await initRapier();
    const sim = new SimWorld(R);
    const body = sim.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(0.1, 1.5));
    sim.world.createCollider(R.ColliderDesc.cuboid(0.1, 0.1), body);
    const ground = sim.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(0, -0.25));
    sim.world.createCollider(R.ColliderDesc.cuboid(3, 0.25), ground);
    const stepper = new Stepper();
    const target = 120;
    let guard = 0;
    let di = 0;
    while (stepper.tick < target && guard++ < 10_000) {
      const consumed = stepper.advance(deltas[di % deltas.length]!);
      di += 1;
      for (let i = 0; i < consumed; i++) sim.step();
    }
    const hash = formatHash(sim.stateHash());
    sim.free();
    return hash;
  }

  it('uniform 60 Hz, jittery pacing, and a stall share a final hash', async () => {
    const uniform = await runWithDeltas([TIMESTEP]);
    const jittery = await runWithDeltas([1 / 30, 1 / 144, 1 / 90, 1 / 60]);
    const stall = await runWithDeltas([TIMESTEP, TIMESTEP, 2.0, TIMESTEP]);
    expect(jittery).toBe(uniform);
    expect(stall).toBe(uniform);
  });
});
