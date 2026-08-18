import {
  createFixedCuboid,
  createKinematicCharacter,
  setCuboidHalfExtents,
  stepCharacterController,
} from '@stickworld/physics-kit';
import {
  comboHundredths,
  finishBonus,
  firstPlaneCrossed,
  notePerfect,
  progressDelta,
  pushEvent,
  resetCombo,
  type ComboState,
} from '@stickworld/scoring';
import {
  GRAVITY_Y,
  TIMESTEP,
  aggregateScore,
  assertPhysicsBudget,
  type ScoreEvent,
  type Simulation,
  type SimulationContext,
  SimWorld,
} from '@stickworld/sim-core';
import { rooftopRelayManifest } from '../manifest.js';
import {
  ACTION_JUMP,
  ACTION_RUN,
  ACTION_SLIDE,
  BACK_SPEED,
  BUFFER_TICKS,
  CHECKPOINTS,
  COYOTE_TICKS,
  DEATH_Y,
  FINISH_X,
  FWD_SPEED,
  JUMP_V,
  LINTELS,
  ROOF_HY,
  ROOFS,
  SLIDE_HY,
  STAND_HX,
  STAND_HY,
  START,
  STUMBLE_TICKS,
} from './course.js';

export interface RooftopRenderState {
  playerX: number;
  playerY: number;
  playerVx: number;
  playerVy: number;
  sliding: boolean;
  stumbled: boolean;
  run: number;
  score: number;
  tick: number;
  finished: boolean;
  fail: boolean;
}

export function createRooftopSimulation(context: SimulationContext): Simulation {
  const sim = new SimWorld(context.rapier);
  const R = context.rapier;
  const tags = new Map<number, string>();

  for (let i = 0; i < ROOFS.length; i++) {
    const roof = ROOFS[i]!;
    createFixedCuboid(sim, R, roof.x, roof.y, roof.hx, ROOF_HY, tags, `roof-${i}`);
  }
  for (let i = 0; i < LINTELS.length; i++) {
    const lintel = LINTELS[i]!;
    createFixedCuboid(sim, R, lintel.x, lintel.y, lintel.hx, lintel.hy, tags, `lintel-${i}`);
  }

  const character = createKinematicCharacter(
    sim,
    R,
    START.x,
    START.y,
    STAND_HX,
    STAND_HY,
    tags,
    'player',
  );

  const constructedBodies = sim.registry.count();
  let tick = 0;
  let finished = false;
  let failed = false;
  let run = 0;
  let jumpLevel = 0;
  let slideLevel = 0;
  let sliding = false;
  let vy = 0;
  let grounded = false;
  let coyote = 0;
  let jumpBuffer = 0;
  let stumbleLeft = 0;
  const events: ScoreEvent[] = [];
  const combo: ComboState = { streak: 0, lastPerfectTick: 0 };
  const passed = CHECKPOINTS.map(() => false);
  let maxX = START.x;
  let prevX = START.x;
  let progressDm = progressDelta(0, START.x);

  function checkBudget(): void {
    assertPhysicsBudget(rooftopRelayManifest.budget, {
      rigidBodies: sim.registry.count(),
      colliders: sim.world.colliders.len(),
      joints: 0,
      scoreEvents: events.length,
    });
  }

  function setSlide(next: boolean): void {
    if (next === sliding) return;
    const pos = character.body.translation();
    if (next) {
      setCuboidHalfExtents(character.collider, STAND_HX, SLIDE_HY);
      character.body.setTranslation({ x: pos.x, y: pos.y - (STAND_HY - SLIDE_HY) }, true);
    } else {
      setCuboidHalfExtents(character.collider, STAND_HX, STAND_HY);
      character.body.setTranslation({ x: pos.x, y: pos.y + (STAND_HY - SLIDE_HY) }, true);
    }
    sliding = next;
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
      if (actionId === ACTION_RUN) {
        run = value < 0 ? 0 : value > 2 ? 2 : value;
        return;
      }
      if (actionId === ACTION_JUMP) {
        const next = value ? 1 : 0;
        if (jumpLevel === 0 && next === 1) jumpBuffer = BUFFER_TICKS;
        jumpLevel = next;
        return;
      }
      if (actionId === ACTION_SLIDE) slideLevel = value ? 1 : 0;
    },
    step() {
      if (finished) {
        tick += 1;
        return;
      }
      setSlide(slideLevel === 1);
      if (grounded) coyote = COYOTE_TICKS;
      else if (coyote > 0) coyote -= 1;
      if (jumpBuffer > 0 && (grounded || coyote > 0)) {
        vy = JUMP_V;
        jumpBuffer = 0;
        coyote = 0;
        grounded = false;
      } else if (jumpBuffer > 0) {
        jumpBuffer -= 1;
      }
      vy += GRAVITY_Y * TIMESTEP;
      const horiz = run === 1 ? FWD_SPEED : run === 2 ? -BACK_SPEED : 0;
      const moved = stepCharacterController(
        character.controller,
        character.body,
        character.collider,
        { x: horiz * TIMESTEP, y: vy * TIMESTEP },
      );
      sim.step();
      tick += 1;
      if (sim.registry.count() !== constructedBodies) {
        throw new Error('rooftop-relay created or destroyed a rigid body after tick 0');
      }
      grounded = moved.grounded;
      if (grounded && vy < 0) vy = 0;
      if (stumbleLeft > 0) stumbleLeft -= 1;
      sim.world.contactPairsWith(character.collider, (other) => {
        const tag = tags.get(other.handle);
        if (tag && tag.startsWith('lintel-') && stumbleLeft === 0) stumbleLeft = STUMBLE_TICKS;
      });

      const pos = character.body.translation();
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
        pushEvent(events, tick, 'checkpoint', 300, comboHundredths(combo.streak));
      }
      prevX = pos.x;

      if (pos.y < DEATH_Y) {
        pushEvent(events, tick, 'fail', 0, 100);
        resetCombo(combo);
        failed = true;
        finished = true;
      } else if (pos.x >= FINISH_X) {
        pushEvent(events, tick, 'finish', finishBonus(tick, rooftopRelayManifest.maxRunTicks), 100);
        finished = true;
      } else if (tick >= rooftopRelayManifest.maxRunTicks) {
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
      const p = character.body.translation();
      return {
        playerX: p.x,
        playerY: p.y,
        playerVx: run === 1 ? FWD_SPEED : run === 2 ? -BACK_SPEED : 0,
        playerVy: vy,
        sliding,
        stumbled: stumbleLeft > 0,
        run,
        score: aggregateScore(events),
        tick,
        finished,
        fail: failed,
      } satisfies RooftopRenderState;
    },
    dispose() {
      character.controller.free();
      sim.free();
    },
  };
}
