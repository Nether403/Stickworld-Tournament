import {
  aggregateScore,
  assertPhysicsBudget,
  type ScoreEvent,
  type Simulation,
  type SimulationContext,
  SimWorld,
} from '@stickworld/sim-core';
import { hooklineSprintManifest } from '../manifest.js';
import {
  abs,
  ACTION_AIM,
  ACTION_HOOK,
  ANCHOR_RADIUS,
  ANCHORS,
  ATTACH_RANGE,
  aimVector,
  clampRestLength,
  COMBO_IDLE_TICKS,
  DEATH_X,
  DEATH_Y,
  FINISH_X,
  FINISH_Y,
  GATES,
  hypot,
  isPerfectRelease,
  LEDGE_RESET_AFTER_TICK,
  PLAYER_DAMPING,
  PLAYER_HALF_HEIGHT,
  PLAYER_MASS,
  PLAYER_RADIUS,
  PLAYER_START,
  START_LEDGE,
} from './course.js';
import {
  comboHundredths,
  finishBonus,
  gateIndexCrossed,
  maybeIdleReset,
  notePerfect,
  progressDelta,
  pushEvent,
  resetCombo,
  type ComboState,
} from './scoring.js';

export interface HooklineRenderState {
  playerX: number;
  playerY: number;
  playerVx: number;
  playerVy: number;
  attached: boolean;
  ropeAnchorX: number | null;
  ropeAnchorY: number | null;
  restLength: number | null;
  gatesPassed: boolean[];
  comboHundredths: number;
  score: number;
  tick: number;
  finished: boolean;
  fail: boolean;
  aim: number;
}

export function createHooklineSimulation(context: SimulationContext): Simulation {
  const sim = new SimWorld(context.rapier);
  const R = context.rapier;

  const tags = new Map<number, string>();

  const ledgeBody = sim.createRigidBody(
    R.RigidBodyDesc.fixed().setTranslation(START_LEDGE.x, START_LEDGE.y),
  );
  const ledgeCollider = sim.world.createCollider(
    R.ColliderDesc.cuboid(START_LEDGE.hx, START_LEDGE.hy),
    ledgeBody,
  );
  tags.set(ledgeCollider.handle, 'ledge');

  for (const pos of ANCHORS) {
    const body = sim.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(pos.x, pos.y));
    const collider = sim.world.createCollider(R.ColliderDesc.ball(ANCHOR_RADIUS), body);
    tags.set(collider.handle, 'anchor');
  }

  for (const gate of GATES) {
    const body = sim.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(gate.x, 8));
    const collider = sim.world.createCollider(
      R.ColliderDesc.cuboid(0.05, 10).setSensor(true),
      body,
    );
    tags.set(collider.handle, 'gate');
  }

  const player = sim.createRigidBody(
    R.RigidBodyDesc.dynamic()
      .setTranslation(PLAYER_START.x, PLAYER_START.y)
      .setLinearDamping(PLAYER_DAMPING)
      .lockRotations(),
  );
  const playerCollider = sim.world.createCollider(
    R.ColliderDesc.capsule(PLAYER_HALF_HEIGHT, PLAYER_RADIUS).setMass(PLAYER_MASS),
    player,
  );
  tags.set(playerCollider.handle, 'player');

  let tick = 0;
  let finished = false;
  let failed = false;
  let aim = 0;
  let hookLevel = 0;
  let rope: ReturnType<typeof sim.world.createImpulseJoint> | undefined;
  let restLength: number | null = null;
  let ropeAnchor: { x: number; y: number } | null = null;
  let joints = 0;
  const events: ScoreEvent[] = [];
  const combo: ComboState = { streak: 0, lastPerfectTick: 0 };
  const gatesPassed = GATES.map(() => false);
  let maxX: number = PLAYER_START.x;
  let prevX: number = PLAYER_START.x;
  let progressDm = 0;
  let swingMaxAbsVx = 0;

  function checkBudget(): void {
    assertPhysicsBudget(hooklineSprintManifest.budget, {
      rigidBodies: sim.registry.count(),
      colliders: sim.world.colliders.len(),
      joints,
      scoreEvents: events.length,
    });
  }

  function tryAttach(): void {
    if (rope) return;
    const origin = player.translation();
    const dir = aimVector(aim);
    const len = hypot(dir.x, dir.y);
    if (len === 0) return;
    const ray = new R.Ray({ x: origin.x, y: origin.y }, { x: dir.x / len, y: dir.y / len });
    const hit = sim.world.castRay(
      ray,
      ATTACH_RANGE,
      true,
      R.QueryFilterFlags.EXCLUDE_SENSORS,
      0xffffffff,
      playerCollider,
      player,
      (collider) => tags.get(collider.handle) === 'anchor',
    );
    if (!hit || tags.get(hit.collider.handle) !== 'anchor') return;
    const parent = hit.collider.parent();
    if (!parent) return;
    const anchorPos = parent.translation();
    const distance = hypot(origin.x - anchorPos.x, origin.y - anchorPos.y);
    const rest = clampRestLength(distance);
    rope = sim.world.createImpulseJoint(
      R.JointData.rope(rest, { x: 0, y: 0 }, { x: 0, y: 0 }),
      player,
      parent,
      true,
    );
    joints = 1;
    restLength = rest;
    ropeAnchor = { x: anchorPos.x, y: anchorPos.y };
    swingMaxAbsVx = abs(player.linvel().x);
  }

  function release(): void {
    if (!rope) {
      restLength = null;
      ropeAnchor = null;
      return;
    }
    const absVx = abs(player.linvel().x);
    if (isPerfectRelease(absVx, swingMaxAbsVx)) {
      pushEvent(events, tick, 'perfect-release', 200, comboHundredths(combo.streak));
      notePerfect(combo, tick);
    }
    sim.world.removeImpulseJoint(rope, true);
    rope = undefined;
    joints = 0;
    restLength = null;
    ropeAnchor = null;
    swingMaxAbsVx = 0;
  }

  function touchingStartLedge(): boolean {
    let hit = false;
    sim.world.contactPairsWith(playerCollider, (other) => {
      if (tags.get(other.handle) === 'ledge') hit = true;
    });
    return hit;
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
      sim.step();
      tick += 1;
      const pos = player.translation();
      const vel = player.linvel();
      if (rope) {
        const ax = abs(vel.x);
        if (ax > swingMaxAbsVx) swingMaxAbsVx = ax;
      }

      const delta = progressDelta(progressDm, pos.x > maxX ? pos.x : maxX);
      if (pos.x > maxX) maxX = pos.x;
      if (delta > 0) {
        progressDm += delta;
        pushEvent(events, tick, 'progress', delta, 100);
      }

      for (;;) {
        const gate = gateIndexCrossed(prevX, pos.x, gatesPassed);
        if (gate === undefined) break;
        gatesPassed[gate] = true;
        pushEvent(events, tick, 'gate', GATES[gate]!.points, comboHundredths(combo.streak));
      }
      prevX = pos.x;

      maybeIdleReset(combo, tick, COMBO_IDLE_TICKS);
      if (tick > LEDGE_RESET_AFTER_TICK && touchingStartLedge()) {
        resetCombo(combo);
      }

      if (pos.y < DEATH_Y || pos.x < DEATH_X) {
        failed = true;
        finished = true;
        pushEvent(events, tick, 'fail', 0, 100);
        resetCombo(combo);
      } else if (pos.x >= FINISH_X && pos.y > FINISH_Y) {
        finished = true;
        pushEvent(events, tick, 'finish', finishBonus(tick, hooklineSprintManifest.maxRunTicks), 100);
      } else if (tick >= hooklineSprintManifest.maxRunTicks) {
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
      const pos = player.translation();
      const vel = player.linvel();
      return {
        playerX: pos.x,
        playerY: pos.y,
        playerVx: vel.x,
        playerVy: vel.y,
        attached: Boolean(rope),
        ropeAnchorX: ropeAnchor?.x ?? null,
        ropeAnchorY: ropeAnchor?.y ?? null,
        restLength,
        gatesPassed: gatesPassed.slice(),
        comboHundredths: comboHundredths(combo.streak),
        score: aggregateScore(events),
        tick,
        finished,
        fail: failed,
        aim,
      } satisfies HooklineRenderState;
    },
    dispose() {
      sim.free();
    },
  };
}
