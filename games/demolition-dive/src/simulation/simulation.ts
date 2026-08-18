import {
  createBreakableCuboid,
  createFixedCuboid,
  createTenBodyRagdoll,
  despawnBrokenOutsideAabb,
  launchImpulse,
  PLAY_AABB,
  propagateFractures,
  ragdollParts,
  resetDynamicPose,
  restoreBreakable,
  type BreakableCuboid,
} from '@stickworld/physics-kit';
import { pushEvent, sumSubAttempts } from '@stickworld/scoring';
import {
  aggregateScore,
  assertPhysicsBudget,
  hypot,
  type ScoreEvent,
  type Simulation,
  type SimulationContext,
  SimWorld,
} from '@stickworld/sim-core';
import { demolitionDiveManifest } from '../manifest.js';
import {
  ACTION_AIM,
  ACTION_LAUNCH,
  ACTION_POWER,
  aimVector,
  BACKSTOP,
  BRICK_HALF,
  BRICK_MASS,
  BRICKS,
  chainHundredths,
  DEATH_Y,
  FLOOR,
  launchSpeed,
  SETTLE_SPEED,
  SETTLE_TICKS,
  SUB_COUNT,
  TORSO_START,
} from './course.js';

export interface BrickView {
  x: number;
  y: number;
  broken: boolean;
  parked: boolean;
}

export interface DemolitionRenderState {
  torsoX: number;
  torsoY: number;
  parts: Array<{ x: number; y: number }>;
  bricks: BrickView[];
  aim: number;
  power: number;
  inFlight: boolean;
  subIndex: number;
  score: number;
  tick: number;
  finished: boolean;
  fail: boolean;
}

export function createDemolitionSimulation(context: SimulationContext): Simulation {
  const sim = new SimWorld(context.rapier);
  const R = context.rapier;
  const tags = new Map<number, string>();

  createFixedCuboid(sim, R, FLOOR.x, FLOOR.y, FLOOR.hx, FLOOR.hy, tags, 'floor');
  createFixedCuboid(sim, R, BACKSTOP.x, BACKSTOP.y, BACKSTOP.hx, BACKSTOP.hy, tags, 'backstop');

  const pieces: BreakableCuboid[] = [];
  for (let i = 0; i < BRICKS.length; i++) {
    const brick = BRICKS[i]!;
    pieces.push(
      createBreakableCuboid(
        sim,
        R,
        brick.x,
        brick.y,
        BRICK_HALF.hx,
        BRICK_HALF.hy,
        BRICK_MASS,
        brick.value,
        tags,
        `break-${i}`,
      ),
    );
  }

  const ragdoll = createTenBodyRagdoll(sim, R, tags, TORSO_START.x, TORSO_START.y, false);
  const parts = ragdollParts(ragdoll);
  const ragdollColliders = parts.map((part) => part.collider);
  const authored = parts.map((part) => {
    const pos = part.body.translation();
    return { x: pos.x, y: pos.y, angle: part.body.rotation() };
  });
  for (let i = 0; i < parts.length; i++) parts[i]!.body.setGravityScale(0, true);

  const constructedBodies = sim.registry.count();
  let tick = 0;
  let finished = false;
  let failed = false;
  let aim = 320;
  let power = 80;
  let launchLevel = 0;
  let inFlight = false;
  let subIndex = 0;
  let settleTicks = 0;
  let brokeThisDive = false;
  const events: ScoreEvent[] = [];
  const subScores = [0, 0, 0];
  let subStartEvent = 0;
  const joints = ragdoll.joints;

  function checkBudget(): void {
    assertPhysicsBudget(demolitionDiveManifest.budget, {
      rigidBodies: sim.registry.count(),
      colliders: sim.world.colliders.len(),
      joints,
      scoreEvents: events.length,
    });
  }

  function liveScore(): number {
    const closed = sumSubAttempts(subScores);
    if (subIndex >= SUB_COUNT) return closed;
    return closed + aggregateScore(events.slice(subStartEvent));
  }

  function speedOf(body: { linvel: () => { x: number; y: number } }): number {
    const v = body.linvel();
    return hypot(v.x, v.y);
  }

  function diveSettled(): boolean {
    for (let i = 0; i < parts.length; i++) {
      if (speedOf(parts[i]!.body) >= SETTLE_SPEED) return false;
    }
    for (let i = 0; i < pieces.length; i++) {
      const piece = pieces[i]!;
      if (!piece.broken || piece.parked) continue;
      if (speedOf(piece.body) >= SETTLE_SPEED) return false;
    }
    return true;
  }

  function holdRagdoll(): void {
    for (let i = 0; i < parts.length; i++) {
      const pose = authored[i]!;
      resetDynamicPose(parts[i]!.body, pose.x, pose.y, pose.angle);
      parts[i]!.body.setGravityScale(0, true);
    }
  }

  function closeSub(kind: 'sleep' | 'fail' | 'out' | 'timeout'): void {
    if (kind === 'fail') {
      pushEvent(events, tick, 'fail', 0, 100);
      failed = true;
    }
    subScores[subIndex] = aggregateScore(events.slice(subStartEvent));
    subIndex += 1;
    if (subIndex >= SUB_COUNT || tick >= demolitionDiveManifest.maxRunTicks) {
      finished = true;
      return;
    }
    failed = false;
    inFlight = false;
    settleTicks = 0;
    brokeThisDive = false;
    subStartEvent = events.length;
    for (let i = 0; i < pieces.length; i++) restoreBreakable(pieces[i]!, R);
    holdRagdoll();
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
      if (actionId === ACTION_POWER) {
        power = value < 0 ? 0 : value > 100 ? 100 : value;
        return;
      }
      if (actionId !== ACTION_LAUNCH) return;
      const next = value ? 1 : 0;
      if (next === launchLevel) return;
      if (launchLevel === 0 && next === 1 && !inFlight) {
        const dir = aimVector(aim);
        const speed = launchSpeed(power);
        for (let i = 0; i < parts.length; i++) {
          parts[i]!.body.setGravityScale(1, true);
          launchImpulse(parts[i]!.body, dir, speed);
        }
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
      sim.step();
      tick += 1;
      if (sim.registry.count() !== constructedBodies) {
        throw new Error('demolition-dive created or destroyed a rigid body after tick 0');
      }
      if (inFlight) {
        const newly = propagateFractures(sim.world, R, pieces, ragdollColliders);
        for (let i = 0; i < newly.length; i++) {
          const hit = newly[i]!;
          const piece = pieces[hit.index]!;
          brokeThisDive = true;
          pushEvent(events, tick, 'break', piece.value, chainHundredths(hit.depth));
        }
        despawnBrokenOutsideAabb(pieces, PLAY_AABB);

        const torso = ragdoll.torso.body.translation();
        if (torso.y < DEATH_Y && !brokeThisDive) closeSub('fail');
        else if (
          torso.x < PLAY_AABB.xMin ||
          torso.x > PLAY_AABB.xMax ||
          torso.y < PLAY_AABB.yMin ||
          torso.y > PLAY_AABB.yMax
        ) {
          closeSub('out');
        } else if (diveSettled()) {
          settleTicks += 1;
          if (settleTicks >= SETTLE_TICKS) closeSub('sleep');
        } else {
          settleTicks = 0;
        }
      }

      if (!finished && tick >= demolitionDiveManifest.maxRunTicks) finished = true;
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
      const torso = ragdoll.torso.body.translation();
      return {
        torsoX: torso.x,
        torsoY: torso.y,
        parts: parts.map((part) => {
          const pos = part.body.translation();
          return { x: pos.x, y: pos.y };
        }),
        bricks: pieces.map((piece) => {
          const pos = piece.body.translation();
          return { x: pos.x, y: pos.y, broken: piece.broken, parked: piece.parked };
        }),
        aim,
        power,
        inFlight,
        subIndex,
        score: liveScore(),
        tick,
        finished,
        fail: failed,
      } satisfies DemolitionRenderState;
    },
    dispose() {
      sim.free();
    },
  };
}
