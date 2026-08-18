import {
  createAabbSensor,
  createCargoCondition,
  createDynamicCuboid,
  createFixedBall,
  createFixedCuboid,
  createLockedCapsule,
  createRopeJoint,
  damageCargoHazard,
  damageCargoSpeed,
  destroyImpulseJoint,
} from '@stickworld/physics-kit';
import { finishBonus, progressDelta, pushEvent } from '@stickworld/scoring';
import {
  hypot,
  aggregateScore,
  assertPhysicsBudget,
  type ScoreEvent,
  type Simulation,
  type SimulationContext,
  SimWorld,
} from '@stickworld/sim-core';
import { cargoChaosManifest } from '../manifest.js';
import {
  ACTION_AIM,
  ACTION_HOOK,
  aimVector,
  ATTACH_RANGE,
  CRATE_HALF,
  CRATE_MASS,
  CRATE_START,
  DEATH_Y,
  FINISH_X,
  FINISH_Y,
  FLOORS,
  HAZARDS,
  HITCH_REST,
  PLAYER_DAMPING,
  PLAYER_HALF_HEIGHT,
  PLAYER_MASS,
  PLAYER_RADIUS,
  PLAYER_START,
  POST_RADIUS,
  POSTS,
} from './course.js';

export interface CargoRenderState {
  playerX: number;
  playerY: number;
  crateX: number;
  crateY: number;
  aim: number;
  hooked: boolean;
  condition: number;
  score: number;
  tick: number;
  finished: boolean;
  fail: boolean;
}

export function createCargoSimulation(context: SimulationContext): Simulation {
  const sim = new SimWorld(context.rapier);
  const R = context.rapier;
  const tags = new Map<number, string>();

  for (let i = 0; i < FLOORS.length; i++) {
    const floor = FLOORS[i]!;
    createFixedCuboid(sim, R, floor.x, floor.y, floor.hx, floor.hy, tags, `floor-${i}`);
  }
  const posts: Array<{ body: ReturnType<typeof createFixedBall>['body'] }> = [];
  for (let i = 0; i < POSTS.length; i++) {
    const post = POSTS[i]!;
    posts.push(createFixedBall(sim, R, post.x, post.y, POST_RADIUS, tags, 'post'));
  }
  for (let i = 0; i < HAZARDS.length; i++) {
    const hazard = HAZARDS[i]!;
    createAabbSensor(sim, R, hazard.x, hazard.y, hazard.hx, hazard.hy, tags, `hazard-${i}`);
  }

  const player = createLockedCapsule(
    sim,
    R,
    PLAYER_START.x,
    PLAYER_START.y,
    PLAYER_HALF_HEIGHT,
    PLAYER_RADIUS,
    PLAYER_MASS,
    PLAYER_DAMPING,
    tags,
    'player',
  );
  const crate = createDynamicCuboid(
    sim,
    R,
    CRATE_START.x,
    CRATE_START.y,
    CRATE_HALF,
    CRATE_HALF,
    CRATE_MASS,
    tags,
    'crate',
  );
  createRopeJoint(sim.world, R, player.body, crate.body, HITCH_REST);
  let hookJoint: ReturnType<typeof createRopeJoint> | undefined;
  let joints = 1;
  const condition = createCargoCondition(100);
  const hazardHit = HAZARDS.map(() => false);
  const constructedBodies = sim.registry.count();
  let tick = 0;
  let finished = false;
  let failed = false;
  let aim = 0;
  let hookLevel = 0;
  let conditionEmitted = false;
  const events: ScoreEvent[] = [];
  let maxX = CRATE_START.x;
  let progressDm = progressDelta(0, CRATE_START.x);

  function checkBudget(): void {
    assertPhysicsBudget(cargoChaosManifest.budget, {
      rigidBodies: sim.registry.count(),
      colliders: sim.world.colliders.len(),
      joints,
      scoreEvents: events.length,
    });
  }

  function tryAttach(): void {
    if (hookJoint) return;
    const origin = player.body.translation();
    const dir = aimVector(aim);
    const dirLen = hypot(dir.x, dir.y);
    if (dirLen === 0) return;
    const ux = dir.x / dirLen;
    const uy = dir.y / dirLen;
    // Crate sits on the aim ray to the first post, so a physics raycast hits the crate.
    // Attach to the nearest in-range post inside the aim cone (kit finding).
    let bestDist = ATTACH_RANGE + 1;
    let bestBody: (typeof posts)[number]['body'] | undefined;
    for (const post of posts) {
      const pos = post.body.translation();
      const dx = pos.x - origin.x;
      const dy = pos.y - origin.y;
      const dist = hypot(dx, dy);
      if (dist === 0 || dist > ATTACH_RANGE) continue;
      const dot = (dx / dist) * ux + (dy / dist) * uy;
      if (dot < 0.7) continue;
      if (dist < bestDist) {
        bestDist = dist;
        bestBody = post.body;
      }
    }
    if (!bestBody) return;
    let rest = bestDist;
    const pulled = bestDist - bestDist / 4;
    if (pulled > 0.5) rest = pulled;
    hookJoint = createRopeJoint(sim.world, R, player.body, bestBody, rest);
    joints = 2;
  }

  function releaseHook(): void {
    if (!hookJoint) return;
    destroyImpulseJoint(sim.world, hookJoint);
    hookJoint = undefined;
    joints = 1;
  }

  function emitCondition(): void {
    if (conditionEmitted) return;
    conditionEmitted = true;
    pushEvent(events, tick, 'condition', condition.value, 100);
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
        aim = value < 0 ? 0 : value > 359 ? 359 : value;
        return;
      }
      if (actionId !== ACTION_HOOK) return;
      const next = value ? 1 : 0;
      if (next === hookLevel) return;
      if (hookLevel === 0 && next === 1) tryAttach();
      if (hookLevel === 1 && next === 0) releaseHook();
      hookLevel = next;
    },
    step() {
      if (finished) {
        tick += 1;
        return;
      }
      sim.step();
      tick += 1;
      if (sim.registry.count() !== constructedBodies) {
        throw new Error('cargo-chaos created or destroyed a rigid body after tick 0');
      }
      const cratePos = crate.body.translation();
      const crateVel = crate.body.linvel();
      damageCargoSpeed(condition, hypot(crateVel.x, crateVel.y), tick);
      sim.world.contactPairsWith(crate.collider, (other) => {
        const tag = tags.get(other.handle);
        if (!tag || !tag.startsWith('hazard-')) return;
        const index = Number(tag.slice(7));
        if (hazardHit[index]) return;
        hazardHit[index] = true;
        damageCargoHazard(condition, 15);
      });
      sim.world.intersectionPairsWith(crate.collider, (other) => {
        const tag = tags.get(other.handle);
        if (!tag || !tag.startsWith('hazard-')) return;
        const index = Number(tag.slice(7));
        if (hazardHit[index]) return;
        hazardHit[index] = true;
        damageCargoHazard(condition, 15);
      });

      if (cratePos.x > maxX) maxX = cratePos.x;
      const climb = progressDelta(progressDm, maxX);
      if (climb > 0) {
        progressDm += climb;
        pushEvent(events, tick, 'progress', climb, 100);
      }

      const playerPos = player.body.translation();
      if (playerPos.y < DEATH_Y || condition.value <= 0) {
        emitCondition();
        pushEvent(events, tick, 'fail', 0, 100);
        failed = true;
        finished = true;
      } else if (cratePos.x >= FINISH_X && cratePos.y > FINISH_Y) {
        emitCondition();
        pushEvent(events, tick, 'finish', finishBonus(tick, cargoChaosManifest.maxRunTicks), 100);
        finished = true;
      } else if (tick >= cargoChaosManifest.maxRunTicks) {
        emitCondition();
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
      const p = player.body.translation();
      const c = crate.body.translation();
      return {
        playerX: p.x,
        playerY: p.y,
        crateX: c.x,
        crateY: c.y,
        aim,
        hooked: Boolean(hookJoint),
        condition: condition.value,
        score: aggregateScore(events),
        tick,
        finished,
        fail: failed,
      } satisfies CargoRenderState;
    },
    dispose() {
      sim.free();
    },
  };
}
