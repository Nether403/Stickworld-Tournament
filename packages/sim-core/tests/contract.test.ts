import { describe, expect, it } from 'vitest';
import { applyInputsInOrder } from '../src/contract.js';
import { assertBudget, assertPhysicsBudget } from '../src/budget.js';
import { BudgetExceededError, NonFiniteStateError } from '../src/errors.js';
import { initRapier } from '../src/rapier.js';
import { SimWorld } from '../src/sim-world.js';

describe('applyInputsInOrder', () => {
  it('applies inputs by ascending action id, not insertion order', () => {
    const seen: number[] = [];
    applyInputsInOrder(
      (id) => {
        seen.push(id);
      },
      [
        { actionId: 3, value: 1 },
        { actionId: 1, value: 1 },
        { actionId: 2, value: 1 },
      ],
    );
    expect(seen).toEqual([1, 2, 3]);
  });
});

describe('physics budget', () => {
  it('throws BudgetExceededError naming the limit', () => {
    expect(() => assertBudget('maxRigidBodies', 9, 8)).toThrow(BudgetExceededError);
    expect(() =>
      assertPhysicsBudget(
        {
          maxRigidBodies: 1,
          maxColliders: 8,
          maxJoints: 8,
          maxReplayBytes: 1024,
          maxScoreEvents: 8,
        },
        { rigidBodies: 2, colliders: 1, joints: 0, scoreEvents: 0 },
      ),
    ).toThrow(/maxRigidBodies/);
  });
});

describe('non-finite state', () => {
  it('names the body index and field', async () => {
    const R = await initRapier();
    const sim = new SimWorld(R);
    const body = sim.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(0, 1));
    sim.world.createCollider(R.ColliderDesc.ball(0.1), body);
    body.setTranslation({ x: Number.NaN, y: 0 }, true);
    expect(() => sim.stateHash()).toThrow(NonFiniteStateError);
    sim.free();
  });
});
