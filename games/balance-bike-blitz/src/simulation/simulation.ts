import {
  createFixedCuboid,
  createFixedCuboidRotated,
  createWheelAssembly,
  degreesToRadians,
} from '@stickworld/physics-kit';
import {
  finishBonus,
  firstPlaneCrossed,
  notePerfect,
  progressDelta,
  pushEvent,
  resetCombo,
  streakHundredths,
  type ComboState,
} from '@stickworld/scoring';
import {
  abs,
  aggregateScore,
  assertPhysicsBudget,
  type ScoreEvent,
  type Simulation,
  type SimulationContext,
  SimWorld,
} from '@stickworld/sim-core';
import { balanceBikeBlitzManifest } from '../manifest.js';
import {
  ACTION_BRAKE,
  ACTION_LEAN,
  ACTION_THROTTLE,
  AIR_CHUNK,
  AIR_POINTS,
  CHECKPOINTS,
  CRASH_HOLD,
  CRASH_RAD,
  DEATH_Y,
  FINISH_X,
  LEAN_NEUTRAL,
  LEAN_TORQUE,
  START,
  THROTTLE_TORQUE,
} from './course.js';

export interface BikeRenderState {
  frameX: number;
  frameY: number;
  frameAngle: number;
  rearX: number;
  rearY: number;
  frontX: number;
  frontY: number;
  throttle: boolean;
  brake: boolean;
  lean: number;
  score: number;
  tick: number;
  finished: boolean;
  fail: boolean;
}

function wheelGrounded(
  sim: SimWorld,
  collider: { handle: number },
  tags: Map<number, string>,
): boolean {
  let hit = false;
  sim.world.contactPairsWith(collider, (other) => {
    const tag = tags.get(other.handle);
    if (tag && (tag.startsWith('floor') || tag.startsWith('ramp') || tag === 'beam' || tag === 'deck')) {
      hit = true;
    }
  });
  return hit;
}

export function createBikeSimulation(context: SimulationContext): Simulation {
  const sim = new SimWorld(context.rapier);
  const R = context.rapier;
  const tags = new Map<number, string>();

  createFixedCuboid(sim, R, 8, 0.25, 8, 0.25, tags, 'floor-1');
  createFixedCuboidRotated(sim, R, 18, 1.0, 3, 0.2, degreesToRadians(12), tags, 'ramp-1');
  createFixedCuboid(sim, R, 28, 0.25, 4, 0.25, tags, 'floor-2');
  createFixedCuboidRotated(sim, R, 36, 1.4, 3, 0.2, degreesToRadians(-8), tags, 'ramp-2');
  createFixedCuboid(sim, R, 46, 2.0, 4, 0.12, tags, 'beam');
  createFixedCuboid(sim, R, 58, 0.25, 8, 0.25, tags, 'deck');

  const bike = createWheelAssembly(sim, R, START.x, START.y, tags);
  const constructedBodies = sim.registry.count();
  let tick = 0;
  let finished = false;
  let failed = false;
  let throttle = 0;
  let brake = 0;
  let lean = LEAN_NEUTRAL;
  let crashTicks = 0;
  let airTicks = 0;
  const events: ScoreEvent[] = [];
  const combo: ComboState = { streak: 0, lastPerfectTick: 0 };
  const passed = CHECKPOINTS.map(() => false);
  let maxX = START.x;
  let prevX = START.x;
  let progressDm = progressDelta(0, START.x);

  function checkBudget(): void {
    assertPhysicsBudget(balanceBikeBlitzManifest.budget, {
      rigidBodies: sim.registry.count(),
      colliders: sim.world.colliders.len(),
      joints: bike.joints,
      scoreEvents: events.length,
    });
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
      if (actionId === ACTION_THROTTLE) throttle = value ? 1 : 0;
      if (actionId === ACTION_BRAKE) brake = value ? 1 : 0;
      if (actionId === ACTION_LEAN) {
        lean = value < 0 ? 0 : value > 200 ? 200 : value;
      }
    },
    step() {
      if (finished) {
        tick += 1;
        return;
      }
      if (throttle) bike.rear.body.applyTorqueImpulse(THROTTLE_TORQUE, true);
      if (brake) {
        bike.rear.body.setAngvel(0, true);
        bike.front.body.setAngvel(0, true);
      }
      bike.frame.body.applyTorqueImpulse((lean - LEAN_NEUTRAL) * LEAN_TORQUE, true);
      sim.step();
      tick += 1;
      if (sim.registry.count() !== constructedBodies) {
        throw new Error('balance-bike-blitz created or destroyed a rigid body after tick 0');
      }
      const pos = bike.frame.body.translation();
      const angle = bike.frame.body.rotation();
      if (pos.x > maxX) maxX = pos.x;
      const climb = progressDelta(progressDm, maxX);
      if (climb > 0) {
        progressDm += climb;
        pushEvent(events, tick, 'progress', climb, 100);
      }
      for (;;) {
        const idx = firstPlaneCrossed(prevX, pos.x, CHECKPOINTS, passed);
        if (idx === undefined) break;
        passed[idx] = true;
        notePerfect(combo, tick);
        pushEvent(events, tick, 'checkpoint', 250, streakHundredths(combo.streak, 20, 5));
      }
      prevX = pos.x;

      const rearDown = wheelGrounded(sim, bike.rear.collider, tags);
      const frontDown = wheelGrounded(sim, bike.front.collider, tags);
      if (!rearDown && !frontDown) {
        airTicks += 1;
        if (airTicks % AIR_CHUNK === 0) {
          pushEvent(events, tick, 'air', AIR_POINTS, streakHundredths(combo.streak, 20, 5));
        }
      } else {
        airTicks = 0;
      }

      if (abs(angle) > CRASH_RAD) crashTicks += 1;
      else crashTicks = 0;

      if (pos.y < DEATH_Y || crashTicks >= CRASH_HOLD) {
        pushEvent(events, tick, 'fail', 0, 100);
        resetCombo(combo);
        failed = true;
        finished = true;
      } else if (pos.x >= FINISH_X) {
        pushEvent(events, tick, 'finish', finishBonus(tick, balanceBikeBlitzManifest.maxRunTicks), 100);
        finished = true;
      } else if (tick >= balanceBikeBlitzManifest.maxRunTicks) {
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
      const frame = bike.frame.body.translation();
      const rear = bike.rear.body.translation();
      const front = bike.front.body.translation();
      return {
        frameX: frame.x,
        frameY: frame.y,
        frameAngle: bike.frame.body.rotation(),
        rearX: rear.x,
        rearY: rear.y,
        frontX: front.x,
        frontY: front.y,
        throttle: throttle === 1,
        brake: brake === 1,
        lean,
        score: aggregateScore(events),
        tick,
        finished,
        fail: failed,
      } satisfies BikeRenderState;
    },
    dispose() {
      sim.free();
    },
  };
}
