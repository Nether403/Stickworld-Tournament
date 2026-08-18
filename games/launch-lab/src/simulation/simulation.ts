import {
  createAabbSensor,
  createFixedCuboid,
  createLockedCapsule,
  launchImpulse,
  resetDynamicPose,
} from '@stickworld/physics-kit';
import { progressDelta, pushEvent, sumSubAttempts } from '@stickworld/scoring';
import {
  aggregateScore,
  assertPhysicsBudget,
  hypot,
  type ScoreEvent,
  type Simulation,
  type SimulationContext,
  SimWorld,
} from '@stickworld/sim-core';
import { launchLabManifest } from '../manifest.js';
import {
  ACTION_AIM,
  ACTION_LAUNCH,
  ACTION_POWER,
  ACTION_TUCK,
  aimVector,
  BACKSTOP,
  DEATH_X,
  DEATH_Y,
  LANDING,
  LANDING_ALL_RINGS,
  LANDING_PARTIAL,
  launchSpeed,
  PAD,
  PLAYER_DAMPING,
  PLAYER_HALF_HEIGHT,
  PLAYER_MASS,
  PLAYER_RADIUS,
  PLAYER_START,
  RING_HALF,
  RING_POINTS,
  RINGS,
  SETTLE_SPEED,
  SETTLE_TICKS,
  SUB_COUNT,
  TUCK_DAMPING,
} from './course.js';

export interface LaunchLabRenderState {
  playerX: number;
  playerY: number;
  playerVx: number;
  playerVy: number;
  aim: number;
  power: number;
  tuck: boolean;
  inFlight: boolean;
  subIndex: number;
  ringsThisSub: boolean[];
  score: number;
  tick: number;
  finished: boolean;
  fail: boolean;
}

export function createLaunchLabSimulation(context: SimulationContext): Simulation {
  const sim = new SimWorld(context.rapier);
  const R = context.rapier;
  const tags = new Map<number, string>();

  createFixedCuboid(sim, R, BACKSTOP.x, BACKSTOP.y, BACKSTOP.hx, BACKSTOP.hy, tags, 'backstop');
  createFixedCuboid(sim, R, PAD.x, PAD.y, PAD.hx, PAD.hy, tags, 'pad');
  for (let i = 0; i < RINGS.length; i++) {
    const ring = RINGS[i]!;
    createAabbSensor(sim, R, ring.x, ring.y, RING_HALF.hx, RING_HALF.hy, tags, `ring-${i}`);
  }
  createFixedCuboid(sim, R, LANDING.x, LANDING.y, LANDING.hx, LANDING.hy, tags, 'landing');
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
  const playerBody = player.body;
  const playerCollider = player.collider;

  let tick = 0;
  let finished = false;
  let failed = false;
  let aim = 0;
  let power = 50;
  let tuckLevel = 0;
  let launchLevel = 0;
  let inFlight = false;
  let subIndex = 0;
  let settleTicks = 0;
  const events: ScoreEvent[] = [];
  const subScores = [0, 0, 0];
  let subStartEvent = 0;
  let ringsThisSub = RINGS.map(() => false);
  let maxX = PLAYER_START.x;
  let progressDm = 0;
  const constructedBodies = sim.registry.count();

  function checkBudget(): void {
    assertPhysicsBudget(launchLabManifest.budget, {
      rigidBodies: sim.registry.count(),
      colliders: sim.world.colliders.len(),
      joints: 0,
      scoreEvents: events.length,
    });
  }

  function liveScore(): number {
    const closed = sumSubAttempts(subScores);
    if (subIndex >= SUB_COUNT) return closed;
    return closed + aggregateScore(events.slice(subStartEvent)) + progressDm;
  }

  function closeSub(kind: 'landing' | 'fail' | 'timeout'): void {
    if (progressDm > 0) {
      pushEvent(events, tick, 'distance', progressDm, 100);
      progressDm = 0;
    }
    if (kind === 'landing') {
      const all = ringsThisSub.every(Boolean);
      pushEvent(events, tick, 'landing', all ? LANDING_ALL_RINGS : LANDING_PARTIAL, 100);
    } else if (kind === 'fail') {
      pushEvent(events, tick, 'fail', 0, 100);
      failed = true;
    }
    subScores[subIndex] = aggregateScore(events.slice(subStartEvent));
    subIndex += 1;
    if (subIndex >= SUB_COUNT || tick >= launchLabManifest.maxRunTicks) {
      finished = true;
      return;
    }
    failed = false;
    inFlight = false;
    settleTicks = 0;
    ringsThisSub = RINGS.map(() => false);
    maxX = PLAYER_START.x;
    progressDm = 0;
    subStartEvent = events.length;
    playerBody.setLinearDamping(PLAYER_DAMPING);
    resetDynamicPose(playerBody, PLAYER_START.x, PLAYER_START.y);
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
      if (actionId === ACTION_POWER) {
        power = value;
        return;
      }
      if (actionId === ACTION_TUCK) {
        tuckLevel = value ? 1 : 0;
        return;
      }
      if (actionId !== ACTION_LAUNCH) return;
      const next = value ? 1 : 0;
      if (next === launchLevel) return;
      if (launchLevel === 0 && next === 1 && !inFlight) {
        launchImpulse(playerBody, aimVector(aim), launchSpeed(power));
        inFlight = true;
        settleTicks = 0;
      }
      launchLevel = next;
    },
    step() {
      if (finished) {
        tick += 1;
        return;
      }
      if (inFlight) {
        playerBody.setLinearDamping(tuckLevel ? TUCK_DAMPING : PLAYER_DAMPING);
      } else {
        playerBody.setLinearDamping(PLAYER_DAMPING);
      }
      sim.step();
      tick += 1;
      if (sim.registry.count() !== constructedBodies) {
        throw new Error('launch-lab created or destroyed a rigid body after tick 0');
      }
      const pos = playerBody.translation();
      const vel = playerBody.linvel();
      const speed = hypot(vel.x, vel.y);

      if (inFlight) {
        const delta = progressDelta(progressDm, pos.x > maxX ? pos.x : maxX);
        if (pos.x > maxX) maxX = pos.x;
        if (delta > 0) progressDm += delta;

        sim.world.intersectionPairsWith(playerCollider, (other) => {
          const tag = tags.get(other.handle);
          if (!tag || !tag.startsWith('ring-')) return;
          const index = Number(tag.slice(5));
          if (ringsThisSub[index]) return;
          ringsThisSub[index] = true;
          pushEvent(events, tick, 'ring', RING_POINTS, 100);
        });

        let onDeck = false;
        sim.world.contactPairsWith(playerCollider, (other) => {
          if (tags.get(other.handle) === 'landing') onDeck = true;
        });
        if (onDeck && speed < SETTLE_SPEED) settleTicks += 1;
        else settleTicks = 0;
      }

      if (pos.y < DEATH_Y || pos.x > DEATH_X) {
        closeSub('fail');
      } else if (inFlight && settleTicks >= SETTLE_TICKS) {
        closeSub('landing');
      }

      if (!finished && tick >= launchLabManifest.maxRunTicks) {
        finished = true;
      }
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
      const pos = playerBody.translation();
      const vel = playerBody.linvel();
      return {
        playerX: pos.x,
        playerY: pos.y,
        playerVx: vel.x,
        playerVy: vel.y,
        aim,
        power,
        tuck: tuckLevel === 1,
        inFlight,
        subIndex,
        ringsThisSub: ringsThisSub.slice(),
        score: liveScore(),
        tick,
        finished,
        fail: failed,
      } satisfies LaunchLabRenderState;
    },
    dispose() {
      sim.free();
    },
  };
}
