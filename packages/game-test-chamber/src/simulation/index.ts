import {
  aggregateScore,
  assertPhysicsBudget,
  type ScoreEvent,
  type Simulation,
  type SimulationContext,
  SimWorld,
} from '@stickworld/sim-core';
import { testChamberManifest } from '../manifest.js';

/**
 * Test Chamber — permanent CI fixture, not a shipping title.
 * Score = gates passed (100 each) + 1 per 60 survival ticks.
 * Physics: hanging mass on a rope plus a 3-body stick, one burst impulse.
 *
 * Per-tick order (R9.4): inputs already applied → pre-step impulse →
 * world.step() → post-step scoring → tick++. Event ticks are the completed
 * tick (1 after the first step).
 */
export function createTestChamberSimulation(context: SimulationContext): Simulation {
  const sim = new SimWorld(context.rapier);
  const R = context.rapier;

  const ground = sim.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(0, -0.25));
  sim.world.createCollider(R.ColliderDesc.cuboid(4, 0.25), ground);

  const anchor = sim.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(0, 2.4));
  sim.world.createCollider(R.ColliderDesc.cuboid(0.05, 0.05), anchor);

  const mass = sim.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(0.15, 1.8));
  sim.world.createCollider(R.ColliderDesc.ball(0.12), mass);
  sim.world.createImpulseJoint(
    R.JointData.rope(1.9, { x: 0, y: 0 }, { x: 0, y: 0 }),
    anchor,
    mass,
    true,
  );

  const torso = sim.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(-0.8, 1.6));
  sim.world.createCollider(R.ColliderDesc.cuboid(0.08, 0.16), torso);
  const head = sim.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(-0.8, 1.86));
  sim.world.createCollider(R.ColliderDesc.cuboid(0.06, 0.06), head);
  const leg = sim.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(-0.8, 1.32));
  sim.world.createCollider(R.ColliderDesc.cuboid(0.05, 0.12), leg);
  sim.world.createImpulseJoint(
    R.JointData.revolute({ x: 0, y: 0.16 }, { x: 0, y: -0.06 }),
    torso,
    head,
    true,
  );
  sim.world.createImpulseJoint(
    R.JointData.revolute({ x: 0, y: -0.16 }, { x: 0, y: 0.12 }),
    torso,
    leg,
    true,
  );

  let tick = 0;
  let finished = false;
  let burst = 0;
  const events: ScoreEvent[] = [];
  const gates = [1.5, 1.1, 0.7];
  const passed = [false, false, false];
  let lastSurvivalBucket = 0;

  function checkBudget(): void {
    assertPhysicsBudget(testChamberManifest.budget, {
      rigidBodies: sim.registry.count(),
      colliders: sim.registry.count(),
      joints: 3,
      scoreEvents: events.length,
    });
  }

  return {
    get tick() {
      return tick;
    },
    get finished() {
      return finished;
    },
    applyInput(actionId: number, value: number) {
      if (actionId === 1 && value) burst = 1;
    },
    step() {
      if (burst) {
        mass.applyImpulse({ x: 0.45, y: 0.08 }, true);
        burst = 0;
      }
      sim.step();
      tick += 1;
      const y = mass.translation().y;
      for (let i = 0; i < gates.length; i++) {
        if (!passed[i] && y < gates[i]!) {
          passed[i] = true;
          events.push({ tick, type: 'gate', points: 100, multiplier: 100 });
        }
      }
      const bucket = Math.trunc(tick / 60);
      if (bucket > lastSurvivalBucket) {
        lastSurvivalBucket = bucket;
        events.push({ tick, type: 'survive', points: 1, multiplier: 100 });
      }
      if (tick >= testChamberManifest.maxRunTicks || y < -0.05) {
        finished = true;
      }
      checkBudget();
    },
    score() {
      return aggregateScore(events);
    },
    scoreEvents() {
      return events;
    },
    stateHash() {
      return sim.stateHash();
    },
    renderState() {
      const t = mass.translation();
      return { massX: t.x, massY: t.y, tick };
    },
    dispose() {
      sim.free();
    },
  };
}
