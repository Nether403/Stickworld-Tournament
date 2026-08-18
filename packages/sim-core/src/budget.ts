import { BudgetExceededError } from './errors.js';

export interface PhysicsBudget {
  readonly maxRigidBodies: number;
  readonly maxColliders: number;
  readonly maxJoints: number;
  readonly maxReplayBytes: number;
  readonly maxScoreEvents: number;
}

export function assertBudget(name: string, actual: number, max: number): void {
  if (actual > max) {
    throw new BudgetExceededError(name, actual, max);
  }
}

export function assertPhysicsBudget(
  budget: PhysicsBudget,
  actual: {
    rigidBodies: number;
    colliders: number;
    joints: number;
    scoreEvents: number;
  },
): void {
  assertBudget('maxRigidBodies', actual.rigidBodies, budget.maxRigidBodies);
  assertBudget('maxColliders', actual.colliders, budget.maxColliders);
  assertBudget('maxJoints', actual.joints, budget.maxJoints);
  assertBudget('maxScoreEvents', actual.scoreEvents, budget.maxScoreEvents);
}
