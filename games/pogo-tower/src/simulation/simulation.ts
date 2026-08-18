import {
  createFixedCuboid,
  createKinematicCuboid,
  createLockedCapsule,
  stepMovingPlatform,
} from '@stickworld/physics-kit';
import {
  notePerfect,
  progressDelta,
  pushEvent,
  resetCombo,
  streakHundredths,
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
import { pogoTowerManifest } from '../manifest.js';
import {
  ACTION_LEAN,
  clampLean,
  DEATH_Y,
  DROP_RESET,
  FLOOR,
  LAND_POINTS,
  LEAN_NEUTRAL,
  LEFT_WALL_X,
  leanImpulseX,
  PLAYER_DAMPING,
  PLAYER_HALF_HEIGHT,
  PLAYER_MASS,
  PLAYER_RADIUS,
  POGO_V,
  RIGHT_WALL_X,
  WALL_HX,
  WALL_HY,
  WALL_Y,
} from './course.js';
import { createTower, TOP_Y, type TowerLedge } from './generator.js';

export interface PogoLedgeView {
  x: number;
  y: number;
  hx: number;
  hy: number;
  moving: boolean;
}

export interface PogoRenderState {
  playerX: number;
  playerY: number;
  playerVx: number;
  playerVy: number;
  lean: number;
  landed: boolean[];
  ledges: PogoLedgeView[];
  score: number;
  tick: number;
  finished: boolean;
  fail: boolean;
}

export function createPogoSimulation(context: SimulationContext): Simulation {
  const sim = new SimWorld(context.rapier);
  const R = context.rapier;
  const tags = new Map<number, string>();
  const tower = createTower(context.prng);

  createFixedCuboid(sim, R, FLOOR.x, FLOOR.y, FLOOR.hx, FLOOR.hy, tags, 'floor');
  createFixedCuboid(sim, R, LEFT_WALL_X, WALL_Y, WALL_HX, WALL_HY, tags, 'wall-l');
  createFixedCuboid(sim, R, RIGHT_WALL_X, WALL_Y, WALL_HX, WALL_HY, tags, 'wall-r');

  const ledgeBodies: Array<{
    body: ReturnType<typeof createFixedCuboid>['body'];
    collider: ReturnType<typeof createFixedCuboid>['collider'];
    spec: TowerLedge;
  }> = [];
  for (let i = 0; i < tower.ledges.length; i++) {
    const spec = tower.ledges[i]!;
    const made = spec.moving
      ? createKinematicCuboid(sim, R, spec.x, spec.y, spec.hx, spec.hy, tags, `ledge-${i}`, false)
      : createFixedCuboid(sim, R, spec.x, spec.y, spec.hx, spec.hy, tags, `ledge-${i}`);
    ledgeBodies.push({ body: made.body, collider: made.collider, spec });
  }

  const player = createLockedCapsule(
    sim,
    R,
    tower.spawn.x,
    tower.spawn.y,
    PLAYER_HALF_HEIGHT,
    PLAYER_RADIUS,
    PLAYER_MASS,
    PLAYER_DAMPING,
    tags,
    'player',
  );
  // Spawn is below ledge 0. One pogo-equivalent launch so the climber can reach the tower
  // without treating the floor as a ledge (kit finding).
  player.body.setLinvel({ x: 0, y: POGO_V }, true);

  const constructedBodies = sim.registry.count();
  let tick = 0;
  let finished = false;
  let failed = false;
  let lean = LEAN_NEUTRAL;
  const events: ScoreEvent[] = [];
  const combo: ComboState = { streak: 0, lastPerfectTick: 0 };
  const landed = tower.ledges.map(() => false);
  const contacting = tower.ledges.map(() => false);
  let maxY = tower.spawn.y;
  let altitudeDm = progressDelta(0, tower.spawn.y);
  let apexSinceLand = tower.spawn.y;

  function checkBudget(): void {
    assertPhysicsBudget(pogoTowerManifest.budget, {
      rigidBodies: sim.registry.count(),
      colliders: sim.world.colliders.len(),
      joints: 0,
      scoreEvents: events.length,
    });
  }

  function liveScore(): number {
    return aggregateScore(events);
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
      if (actionId === ACTION_LEAN) lean = clampLean(value);
    },
    step() {
      if (finished) {
        tick += 1;
        return;
      }
      player.body.applyImpulse({ x: leanImpulseX(lean), y: 0 }, true);
      for (const ledge of ledgeBodies) {
        if (!ledge.spec.moving) continue;
        stepMovingPlatform(
          ledge.body,
          ledge.spec.x,
          ledge.spec.y,
          ledge.spec.amplitude,
          ledge.spec.periodTicks,
          tick,
        );
      }
      sim.step();
      tick += 1;
      if (sim.registry.count() !== constructedBodies) {
        throw new Error('pogo-tower created or destroyed a rigid body after tick 0');
      }
      const pos = player.body.translation();
      const vel = player.body.linvel();
      if (pos.y > maxY) maxY = pos.y;
      const climb = progressDelta(altitudeDm, maxY);
      if (climb > 0) {
        altitudeDm += climb;
        pushEvent(events, tick, 'altitude', climb, 100);
      }
      if (pos.y > apexSinceLand) apexSinceLand = pos.y;
      if (apexSinceLand - pos.y > DROP_RESET) resetCombo(combo);

      const nowContacting = tower.ledges.map(() => false);
      sim.world.contactPairsWith(player.collider, (other) => {
        const tag = tags.get(other.handle);
        if (!tag || !tag.startsWith('ledge-')) return;
        const index = Number(tag.slice(6));
        nowContacting[index] = true;
        if (!contacting[index] && vel.y <= 0) {
          player.body.setLinvel({ x: vel.x, y: POGO_V }, true);
          apexSinceLand = pos.y;
          if (!landed[index]) {
            landed[index] = true;
            notePerfect(combo, tick);
            pushEvent(events, tick, 'land', LAND_POINTS, streakHundredths(combo.streak, 20, 5));
          }
        }
      });
      for (let i = 0; i < contacting.length; i++) contacting[i] = nowContacting[i]!;

      if (pos.y < DEATH_Y) {
        pushEvent(events, tick, 'fail', 0, 100);
        failed = true;
        finished = true;
      } else if (maxY >= TOP_Y || tick >= pogoTowerManifest.maxRunTicks) {
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
      const p = player.body.translation();
      const v = player.body.linvel();
      return {
        playerX: p.x,
        playerY: p.y,
        playerVx: v.x,
        playerVy: v.y,
        lean,
        landed: landed.slice(),
        ledges: ledgeBodies.map((ledge) => {
          const t = ledge.body.translation();
          return {
            x: t.x,
            y: t.y,
            hx: ledge.spec.hx,
            hy: ledge.spec.hy,
            moving: ledge.spec.moving,
          };
        }),
        score: liveScore(),
        tick,
        finished,
        fail: failed,
      } satisfies PogoRenderState;
    },
    dispose() {
      sim.free();
    },
  };
}
