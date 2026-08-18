import {
  castTaggedRay,
  createAabbSensor,
  createFixedCuboid,
  createKinematicCuboid,
  createLockedCapsule,
  createRopeJoint,
  destroyImpulseJoint,
  setKinematicAngle,
  setKinematicTranslation,
} from '@stickworld/physics-kit';
import {
  firstPlaneCrossed,
  finishBonus,
  notePerfect,
  progressDelta,
  pushEvent,
  resetCombo,
  type ComboState,
} from '@stickworld/scoring';
import {
  aggregateScore,
  assertPhysicsBudget,
  type ScoreEvent,
  type Simulation,
  type SimulationContext,
  SimWorld,
} from '@stickworld/sim-core';
import { pickaxeAscentManifest } from '../manifest.js';
import {
  ACTION_AIM,
  ACTION_HOOK,
  aimVector,
  ATTACH_RANGE,
  CHECKPOINTS,
  comboHundredths,
  DEATH_Y,
  DROP_RESET,
  FINISH_Y,
  FLOOR,
  hypot,
  LEDGE_HX,
  LEDGE_HY,
  LEDGES,
  LEFT_WALL_X,
  PICKAXE_HX,
  PICKAXE_HY,
  PICKAXE_OFFSET_Y,
  PLAYER_DAMPING,
  PLAYER_HALF_HEIGHT,
  PLAYER_MASS,
  PLAYER_RADIUS,
  PLAYER_START,
  REST_LENGTH,
  RIGHT_WALL_X,
  WALL_HX,
  WALL_HY,
  WALL_Y,
} from './course.js';

export interface PickaxeRenderState {
  playerX: number;
  playerY: number;
  playerVx: number;
  playerVy: number;
  pickaxeX: number;
  pickaxeY: number;
  pickaxeAim: number;
  attached: boolean;
  ropeAnchorX: number | null;
  ropeAnchorY: number | null;
  checkpointsPassed: boolean[];
  comboHundredths: number;
  score: number;
  tick: number;
  finished: boolean;
  fail: boolean;
  aim: number;
}

export function createPickaxeSimulation(context: SimulationContext): Simulation {
  const sim = new SimWorld(context.rapier);
  const R = context.rapier;
  const tags = new Map<number, string>();

  createFixedCuboid(sim, R, LEFT_WALL_X, WALL_Y, WALL_HX, WALL_HY, tags, 'wall');
  createFixedCuboid(sim, R, RIGHT_WALL_X, WALL_Y, WALL_HX, WALL_HY, tags, 'wall');
  createFixedCuboid(sim, R, FLOOR.x, FLOOR.y, FLOOR.hx, FLOOR.hy, tags, 'floor');
  for (const ledge of LEDGES) {
    createFixedCuboid(sim, R, ledge.x, ledge.y, LEDGE_HX, LEDGE_HY, tags, 'ledge');
  }
  for (const y of CHECKPOINTS) {
    createAabbSensor(sim, R, 5, y, 5, 0.05, tags, 'checkpoint');
  }

  const climber = createLockedCapsule(
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
  const pickaxe = createKinematicCuboid(
    sim,
    R,
    PLAYER_START.x,
    PLAYER_START.y + PICKAXE_OFFSET_Y,
    PICKAXE_HX,
    PICKAXE_HY,
    tags,
    'pickaxe',
    true,
  );

  let tick = 0;
  let finished = false;
  let failed = false;
  let aim = 90;
  let hookLevel = 0;
  let rope: ReturnType<typeof sim.world.createImpulseJoint> | undefined;
  let ropeAnchor: { x: number; y: number } | null = null;
  let joints = 0;
  const events: ScoreEvent[] = [];
  const combo: ComboState = { streak: 0, lastPerfectTick: 0 };
  const checkpointsPassed = CHECKPOINTS.map(() => false);
  let maxY: number = PLAYER_START.y;
  let prevMaxY: number = PLAYER_START.y;
  let progressDm = 0;
  let apexSinceCheckpoint: number = PLAYER_START.y;
  let dropped = false;

  function checkBudget(): void {
    assertPhysicsBudget(pickaxeAscentManifest.budget, {
      rigidBodies: sim.registry.count(),
      colliders: sim.world.colliders.len(),
      joints,
      scoreEvents: events.length,
    });
  }

  function posePickaxe(): { origin: { x: number; y: number }; tip: { x: number; y: number }; dir: { x: number; y: number } } {
    const pos = climber.body.translation();
    const dir = aimVector(aim);
    const len = hypot(dir.x, dir.y);
    const nx = len === 0 ? 1 : dir.x / len;
    const ny = len === 0 ? 0 : dir.y / len;
    const origin = { x: pos.x, y: pos.y + PICKAXE_OFFSET_Y };
    const center = { x: origin.x + nx * PICKAXE_HX, y: origin.y + ny * PICKAXE_HX };
    const tip = { x: origin.x + nx * PICKAXE_HX * 2, y: origin.y + ny * PICKAXE_HX * 2 };
    setKinematicTranslation(pickaxe.body, center.x, center.y);
    setKinematicAngle(pickaxe.body, aim);
    return { origin, tip, dir: { x: nx, y: ny } };
  }

  function tryAttach(): void {
    if (rope) return;
    const posed = posePickaxe();
    const hit = castTaggedRay(
      sim.world,
      R,
      posed.tip,
      posed.dir,
      ATTACH_RANGE,
      climber.collider,
      climber.body,
      tags,
      'ledge',
    );
    if (!hit) return;
    const parent = hit.collider.parent();
    if (!parent) return;
    const hitX = posed.tip.x + posed.dir.x * hit.toi;
    const hitY = posed.tip.y + posed.dir.y * hit.toi;
    const ledgePos = parent.translation();
    rope = createRopeJoint(
      sim.world,
      R,
      climber.body,
      parent,
      REST_LENGTH,
      { x: 0, y: 0 },
      { x: hitX - ledgePos.x, y: hitY - ledgePos.y },
    );
    joints = 1;
    ropeAnchor = { x: hitX, y: hitY };
  }

  function release(): void {
    if (!rope) {
      ropeAnchor = null;
      return;
    }
    destroyImpulseJoint(sim.world, rope);
    rope = undefined;
    joints = 0;
    ropeAnchor = null;
  }

  posePickaxe();
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
      if (actionId !== ACTION_HOOK) return;
      const next = value ? 1 : 0;
      if (next === hookLevel) return;
      if (hookLevel === 0 && next === 1) tryAttach();
      if (hookLevel === 1 && next === 0) release();
      hookLevel = next;
    },
    step() {
      if (finished) {
        tick += 1;
        return;
      }
      posePickaxe();
      sim.step();
      tick += 1;
      const pos = climber.body.translation();
      if (pos.y > maxY) maxY = pos.y;
      if (pos.y > apexSinceCheckpoint) apexSinceCheckpoint = pos.y;
      if (apexSinceCheckpoint - pos.y > DROP_RESET) {
        dropped = true;
        resetCombo(combo);
      }

      const delta = progressDelta(progressDm, maxY);
      if (delta > 0) {
        progressDm += delta;
        pushEvent(events, tick, 'altitude', delta, 100);
      }

      for (;;) {
        const index = firstPlaneCrossed(prevMaxY, maxY, CHECKPOINTS, checkpointsPassed);
        if (index === undefined) break;
        checkpointsPassed[index] = true;
        const streak = comboHundredths(combo.streak);
        pushEvent(events, tick, 'checkpoint', 400, streak);
        if (!dropped) {
          pushEvent(events, tick, 'clean-climb', 150, streak);
          notePerfect(combo, tick);
        }
        dropped = false;
        apexSinceCheckpoint = pos.y;
      }
      prevMaxY = maxY;

      if (pos.y < DEATH_Y) {
        failed = true;
        finished = true;
        pushEvent(events, tick, 'fail', 0, 100);
        resetCombo(combo);
      } else if (pos.y >= FINISH_Y) {
        finished = true;
        pushEvent(events, tick, 'finish', finishBonus(tick, pickaxeAscentManifest.maxRunTicks), 100);
      } else if (tick >= pickaxeAscentManifest.maxRunTicks) {
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
      const pos = climber.body.translation();
      const vel = climber.body.linvel();
      const pick = pickaxe.body.translation();
      return {
        playerX: pos.x,
        playerY: pos.y,
        playerVx: vel.x,
        playerVy: vel.y,
        pickaxeX: pick.x,
        pickaxeY: pick.y,
        pickaxeAim: aim,
        attached: Boolean(rope),
        ropeAnchorX: ropeAnchor?.x ?? null,
        ropeAnchorY: ropeAnchor?.y ?? null,
        checkpointsPassed: checkpointsPassed.slice(),
        comboHundredths: comboHundredths(combo.streak),
        score: aggregateScore(events),
        tick,
        finished,
        fail: failed,
        aim,
      } satisfies PickaxeRenderState;
    },
    dispose() {
      sim.free();
    },
  };
}
