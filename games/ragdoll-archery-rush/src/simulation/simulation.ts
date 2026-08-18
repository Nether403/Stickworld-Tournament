import {
  createDynamicCapsule,
  createFixedBall,
  createFixedCuboid,
  createFixedJoint,
  createTenBodyRagdoll,
  destroyImpulseJoint,
  degreesToRadians,
  launchImpulse,
  resetDynamicPose,
} from '@stickworld/physics-kit';
import { notePerfect, pushEvent, resetCombo, streakHundredths, type ComboState } from '@stickworld/scoring';
import {
  aggregateScore,
  assertPhysicsBudget,
  hypot,
  type ScoreEvent,
  type Simulation,
  type SimulationContext,
  SimWorld,
} from '@stickworld/sim-core';
import { ragdollArcheryRushManifest } from '../manifest.js';
import {
  ACTION_AIM,
  ACTION_DRAW,
  ACTION_FIRE,
  aimVector,
  ARROW_AABB,
  ARROW_HALF_HEIGHT,
  ARROW_MASS,
  ARROW_RADIUS,
  arrowSpeed,
  BACKSTOP,
  FLOOR,
  SLEEP_SPEED,
  SLEEP_TICKS,
  TARGET_RADIUS,
  TARGETS,
  TORSO_START,
} from './course.js';

export interface ArcheryRenderState {
  torsoX: number;
  torsoY: number;
  arrowX: number;
  arrowY: number;
  aim: number;
  draw: number;
  inFlight: boolean;
  targetsHit: boolean[];
  score: number;
  tick: number;
  finished: boolean;
}

export function createArcherySimulation(context: SimulationContext): Simulation {
  const sim = new SimWorld(context.rapier);
  const R = context.rapier;
  const tags = new Map<number, string>();

  const ragdoll = createTenBodyRagdoll(sim, R, tags, TORSO_START.x, TORSO_START.y, true);
  const arrow = createDynamicCapsule(
    sim,
    R,
    2.48,
    1.32,
    ARROW_HALF_HEIGHT,
    ARROW_RADIUS,
    ARROW_MASS,
    0.01,
    tags,
    'arrow',
  );
  createFixedCuboid(sim, R, FLOOR.x, FLOOR.y, FLOOR.hx, FLOOR.hy, tags, 'floor');
  createFixedCuboid(sim, R, BACKSTOP.x, BACKSTOP.y, BACKSTOP.hx, BACKSTOP.hy, tags, 'backstop');
  for (let i = 0; i < TARGETS.length; i++) {
    const target = TARGETS[i]!;
    createFixedBall(sim, R, target.x, target.y, TARGET_RADIUS, tags, `target-${i}`);
  }

  let joints = ragdoll.joints;
  let weld: ReturnType<typeof createFixedJoint> | undefined = createFixedJoint(
    sim.world,
    R,
    ragdoll.rLower.body,
    arrow.body,
    { x: 0, y: -0.13 },
    { x: -0.35, y: 0 },
  );
  joints += 1;

  const constructedBodies = sim.registry.count();
  let tick = 0;
  let finished = false;
  let aim = 10;
  let draw = 0;
  let fireLevel = 0;
  let inFlight = false;
  let sleepTicks = 0;
  let hitThisFlight = false;
  const events: ScoreEvent[] = [];
  const combo: ComboState = { streak: 0, lastPerfectTick: 0 };
  const targetsHit = TARGETS.map(() => false);

  function checkBudget(): void {
    assertPhysicsBudget(ragdollArcheryRushManifest.budget, {
      rigidBodies: sim.registry.count(),
      colliders: sim.world.colliders.len(),
      joints,
      scoreEvents: events.length,
    });
  }

  function nockArrow(): void {
    const arm = ragdoll.rLower.body.translation();
    const dir = aimVector(aim);
    resetDynamicPose(arrow.body, arm.x + dir.x * 0.45, arm.y + dir.y * 0.45, degreesToRadians(aim));
    if (!weld) {
      weld = createFixedJoint(
        sim.world,
        R,
        ragdoll.rLower.body,
        arrow.body,
        { x: 0, y: -0.13 },
        { x: -0.35, y: 0 },
      );
      joints += 1;
    }
  }

  function recoverArrow(): void {
    if (weld) return;
    if (!hitThisFlight) resetCombo(combo);
    inFlight = false;
    sleepTicks = 0;
    hitThisFlight = false;
    nockArrow();
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
      if (actionId === ACTION_AIM) {
        aim = value;
        return;
      }
      if (actionId === ACTION_DRAW) {
        draw = value;
        return;
      }
      if (actionId !== ACTION_FIRE) return;
      const next = value ? 1 : 0;
      if (next === fireLevel) return;
      if (fireLevel === 0 && next === 1 && !inFlight) {
        if (weld) {
          destroyImpulseJoint(sim.world, weld);
          weld = undefined;
          joints -= 1;
        }
        launchImpulse(arrow.body, aimVector(aim), arrowSpeed(draw));
        inFlight = true;
        sleepTicks = 0;
        hitThisFlight = false;
      }
      fireLevel = next;
    },
    step() {
      if (finished) {
        tick += 1;
        return;
      }
      if (!inFlight && draw > 0) {
        const dir = aimVector(aim);
        const mag = draw * 0.002;
        ragdoll.torso.body.applyImpulse({ x: -dir.x * mag, y: -dir.y * mag }, true);
        ragdoll.rLower.body.applyImpulse({ x: -dir.x * mag, y: -dir.y * mag }, true);
      }
      sim.step();
      tick += 1;
      if (sim.registry.count() !== constructedBodies) {
        throw new Error('ragdoll-archery-rush created or destroyed a rigid body after tick 0');
      }
      const pos = arrow.body.translation();
      const vel = arrow.body.linvel();
      const speed = hypot(vel.x, vel.y);

      if (inFlight) {
        sim.world.contactPairsWith(arrow.collider, (other) => {
          const tag = tags.get(other.handle);
          if (!tag) return;
          if (tag.startsWith('target-')) {
            const index = Number(tag.slice(7));
            if (!targetsHit[index]) {
              targetsHit[index] = true;
              hitThisFlight = true;
              notePerfect(combo, tick);
              pushEvent(events, tick, 'target', TARGETS[index]!.points, streakHundredths(combo.streak, 25, 4));
            }
          }
        });
        const out =
          pos.x < ARROW_AABB.xMin ||
          pos.x > ARROW_AABB.xMax ||
          pos.y < ARROW_AABB.yMin ||
          pos.y > ARROW_AABB.yMax;
        if (speed < SLEEP_SPEED) sleepTicks += 1;
        else sleepTicks = 0;
        if (out || sleepTicks >= SLEEP_TICKS || arrow.body.isSleeping()) recoverArrow();
      }

      if (tick >= ragdollArcheryRushManifest.maxRunTicks) finished = true;
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
      const torso = ragdoll.torso.body.translation();
      const a = arrow.body.translation();
      return {
        torsoX: torso.x,
        torsoY: torso.y,
        arrowX: a.x,
        arrowY: a.y,
        aim,
        draw,
        inFlight,
        targetsHit: targetsHit.slice(),
        score: aggregateScore(events),
        tick,
        finished,
      } satisfies ArcheryRenderState;
    },
    dispose() {
      sim.free();
    },
  };
}
