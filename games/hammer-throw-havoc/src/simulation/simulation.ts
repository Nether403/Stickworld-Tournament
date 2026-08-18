import {
  createAabbSensor,
  createDynamicCuboid,
  createFixedCuboid,
  createPlantedCapsule,
  createRevoluteJoint,
  destroyImpulseJoint,
  resetDynamicPose,
} from '@stickworld/physics-kit';
import { firstPlaneCrossed, progressDelta, pushEvent, sumSubAttempts } from '@stickworld/scoring';
import {
  aggregateScore,
  assertPhysicsBudget,
  hypot,
  type ScoreEvent,
  type Simulation,
  type SimulationContext,
  SimWorld,
} from '@stickworld/sim-core';
import { hammerThrowHavocManifest } from '../manifest.js';
import {
  ACTION_RELEASE,
  ACTION_SPIN,
  applySpinTorque,
  DEATH_Y,
  FLOOR,
  GATE_HALF,
  GATES,
  GROUP_HAMMER,
  GROUP_THROWER,
  GROUP_WORLD,
  HAMMER_HALF,
  HAMMER_MASS,
  HAMMER_START,
  interactionGroups,
  LINK_REST,
  SLEEP_SPEED,
  SLEEP_TICKS,
  SPIN_CAP,
  SPIN_TORQUE,
  SUB_COUNT,
  THROWER,
  WALL,
} from './course.js';

export interface HammerRenderState {
  hammerX: number;
  hammerY: number;
  hammerVx: number;
  hammerVy: number;
  hammerW: number;
  throwerX: number;
  throwerY: number;
  spinning: boolean;
  released: boolean;
  subIndex: number;
  gatesThisThrow: boolean[];
  score: number;
  tick: number;
  finished: boolean;
  fail: boolean;
}

export function createHammerSimulation(context: SimulationContext): Simulation {
  const sim = new SimWorld(context.rapier);
  const R = context.rapier;
  const tags = new Map<number, string>();

  createFixedCuboid(sim, R, FLOOR.x, FLOOR.y, FLOOR.hx, FLOOR.hy, tags, 'floor');
  for (let i = 0; i < GATES.length; i++) {
    const gate = GATES[i]!;
    createAabbSensor(sim, R, gate.x, gate.y, GATE_HALF.hx, GATE_HALF.hy, tags, `gate-${i}`);
  }
  createFixedCuboid(sim, R, WALL.x, WALL.y, WALL.hx, WALL.hy, tags, 'wall');
  const thrower = createPlantedCapsule(sim, R, THROWER.x, THROWER.y, 0.45, 0.18, 70, 0.04, tags, 'thrower');
  const hammer = createDynamicCuboid(
    sim,
    R,
    HAMMER_START.x,
    HAMMER_START.y,
    HAMMER_HALF.hx,
    HAMMER_HALF.hy,
    HAMMER_MASS,
    tags,
    'hammer',
  );
  thrower.collider.setCollisionGroups(interactionGroups(GROUP_THROWER, GROUP_WORLD));
  thrower.collider.setSolverGroups(interactionGroups(GROUP_THROWER, GROUP_WORLD));
  hammer.collider.setCollisionGroups(interactionGroups(GROUP_HAMMER, GROUP_WORLD));
  hammer.collider.setSolverGroups(interactionGroups(GROUP_HAMMER, GROUP_WORLD));
  hammer.body.setGravityScale(0, true);

  function attach(): ReturnType<typeof createRevoluteJoint> {
    return createRevoluteJoint(
      sim.world,
      R,
      thrower.body,
      hammer.body,
      { x: LINK_REST, y: 0 },
      { x: -HAMMER_HALF.hx, y: 0 },
    );
  }

  let link: ReturnType<typeof createRevoluteJoint> | undefined = attach();
  let joints = 1;
  const constructedBodies = sim.registry.count();
  let tick = 0;
  let finished = false;
  let failed = false;
  let spinLevel = 0;
  let releaseLevel = 0;
  let released = false;
  let subIndex = 0;
  let sleepTicks = 0;
  let maxX = HAMMER_START.x;
  let progressDm = 0;
  let prevX = HAMMER_START.x;
  const events: ScoreEvent[] = [];
  const subScores = [0, 0, 0];
  let subStartEvent = 0;
  let gatesThisThrow = GATES.map(() => false);
  const gateXs = GATES.map((g) => g.x);

  function checkBudget(): void {
    assertPhysicsBudget(hammerThrowHavocManifest.budget, {
      rigidBodies: sim.registry.count(),
      colliders: sim.world.colliders.len(),
      joints,
      scoreEvents: events.length,
    });
  }

  function liveScore(): number {
    const closed = sumSubAttempts(subScores);
    if (subIndex >= SUB_COUNT) return closed;
    return closed + aggregateScore(events.slice(subStartEvent)) + progressDm;
  }

  function closeSub(kind: 'sleep' | 'fail' | 'timeout'): void {
    if (progressDm > 0) {
      pushEvent(events, tick, 'distance', progressDm, 100);
      progressDm = 0;
    }
    if (kind === 'fail') {
      pushEvent(events, tick, 'fail', 0, 100);
      failed = true;
    }
    subScores[subIndex] = aggregateScore(events.slice(subStartEvent));
    subIndex += 1;
    if (subIndex >= SUB_COUNT || tick >= hammerThrowHavocManifest.maxRunTicks) {
      finished = true;
      return;
    }
    failed = false;
    released = false;
    sleepTicks = 0;
    gatesThisThrow = GATES.map(() => false);
    maxX = HAMMER_START.x;
    prevX = HAMMER_START.x;
    progressDm = 0;
    subStartEvent = events.length;
    resetDynamicPose(hammer.body, HAMMER_START.x, HAMMER_START.y);
    hammer.body.setGravityScale(0, true);
    if (!link) {
      link = attach();
      joints = 1;
    }
  }

  checkBudget();

  return {
    get tick() {
      return tick;
    },
    get finished() {
      return finished;
    },
    applyInput(actionId: number, value: number) {
      if (finished) return;
      if (actionId === ACTION_SPIN) {
        spinLevel = value ? 1 : 0;
        return;
      }
      if (actionId !== ACTION_RELEASE) return;
      const next = value ? 1 : 0;
      if (next === releaseLevel) return;
      if (releaseLevel === 0 && next === 1 && !released && link) {
        destroyImpulseJoint(sim.world, link);
        link = undefined;
        joints = 0;
        released = true;
        sleepTicks = 0;
        hammer.body.setGravityScale(1, true);
      }
      releaseLevel = next;
    },
    step() {
      if (finished) {
        tick += 1;
        return;
      }
      if (spinLevel && !released) applySpinTorque(hammer.body, SPIN_TORQUE, SPIN_CAP);
      sim.step();
      tick += 1;
      if (sim.registry.count() !== constructedBodies) {
        throw new Error('hammer-throw-havoc created or destroyed a rigid body after tick 0');
      }
      const pos = hammer.body.translation();
      const vel = hammer.body.linvel();
      const speed = hypot(vel.x, vel.y);

      if (released) {
        const delta = progressDelta(progressDm, pos.x > maxX ? pos.x : maxX);
        if (pos.x > maxX) maxX = pos.x;
        if (delta > 0) progressDm += delta;
        for (;;) {
          const idx = firstPlaneCrossed(prevX, pos.x, gateXs, gatesThisThrow);
          if (idx === undefined) break;
          gatesThisThrow[idx] = true;
          pushEvent(events, tick, 'gate', GATES[idx]!.points, 100);
        }
        prevX = pos.x;
        if (speed < SLEEP_SPEED) sleepTicks += 1;
        else sleepTicks = 0;
      }

      if (pos.y < DEATH_Y) closeSub('fail');
      else if (released && sleepTicks >= SLEEP_TICKS) closeSub('sleep');

      if (!finished && tick >= hammerThrowHavocManifest.maxRunTicks) finished = true;
      checkBudget();
    },
    score() {
      return liveScore();
    },
    scoreEvents() {
      return events;
    },
    stateHash() {
      return sim.stateHash();
    },
    renderState() {
      const h = hammer.body.translation();
      const v = hammer.body.linvel();
      const t = thrower.body.translation();
      return {
        hammerX: h.x,
        hammerY: h.y,
        hammerVx: v.x,
        hammerVy: v.y,
        hammerW: hammer.body.angvel(),
        throwerX: t.x,
        throwerY: t.y,
        spinning: spinLevel === 1,
        released,
        subIndex,
        gatesThisThrow: gatesThisThrow.slice(),
        score: liveScore(),
        tick,
        finished,
        fail: failed,
      } satisfies HammerRenderState;
    },
    dispose() {
      sim.free();
    },
  };
}
