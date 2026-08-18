import type { PhysicsBudget } from './budget.js';
import type { Prng, Seed128 } from './prng.js';
import type { RapierModule } from './rapier.js';
import type { ScoreEvent } from './score.js';

export type RankedFormat = 'fixed-course' | 'daily-seed' | 'weekly-seed';

export interface ActionDescriptor {
  readonly id: number;
  readonly name: string;
  readonly kind: 'bool' | 'int';
  readonly min?: number;
  readonly max?: number;
  readonly scale?: number;
}

export type AttemptShape =
  | { readonly kind: 'single' }
  | { readonly kind: 'best-of'; readonly count: number };

export interface GameManifest {
  readonly id: string;
  readonly registryId: number;
  readonly gameVersion: string;
  readonly simulationVersion: number;
  readonly scoringVersion: number;
  readonly rankedFormat: RankedFormat;
  readonly attemptShape: AttemptShape;
  readonly maxRunTicks: number;
  readonly tickRate: 60;
  readonly actions: readonly ActionDescriptor[];
  readonly budget: PhysicsBudget;
}

export interface Simulation {
  readonly tick: number;
  readonly finished: boolean;
  applyInput(actionId: number, value: number): void;
  step(): void;
  score(): number;
  scoreEvents(): readonly ScoreEvent[];
  stateHash(): bigint;
  renderState(): unknown;
  dispose(): void;
}

export interface SimulationContext {
  readonly seed: Seed128;
  readonly rapier: RapierModule;
  readonly prng: Prng;
}

export interface StickworldGame {
  readonly manifest: GameManifest;
  createSimulation(context: SimulationContext): Simulation;
}

/**
 * Per-tick contract (competition-affecting):
 * 1. apply inputs for this tick, ascending action id
 * 2. game pre-step
 * 3. world.step()
 * 4. game post-step / scoring
 * 5. tick++
 */
export function applyInputsInOrder(
  apply: (actionId: number, value: number) => void,
  inputs: readonly { actionId: number; value: number }[],
): void {
  const sorted = inputs.slice().sort((a, b) => a.actionId - b.actionId);
  for (const input of sorted) {
    apply(input.actionId, input.value);
  }
}
