export class StickworldError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = new.target.name;
    this.code = code;
  }
}

export class NonFiniteStateError extends StickworldError {
  readonly bodyIndex: number;
  readonly field: string;
  constructor(bodyIndex: number, field: string) {
    super(
      'NON_FINITE_STATE',
      `Non-finite physics state at body ${bodyIndex} field ${field}`,
    );
    this.bodyIndex = bodyIndex;
    this.field = field;
  }
}

export class RapierBuildMismatchError extends StickworldError {
  constructor(actual: string, expected: string) {
    super(
      'RAPIER_BUILD_MISMATCH',
      `Rapier WASM SHA-256 ${actual} does not match committed ${expected}. ` +
        'A Rapier change invalidates historical replays and is a competition-affecting ' +
        'change requiring a version bump and new leaderboards.',
    );
  }
}

export class DegenerateSeedError extends StickworldError {
  constructor() {
    super('DEGENERATE_SEED', 'PRNG seed must not be all-zero');
  }
}

export class BudgetExceededError extends StickworldError {
  readonly budget: string;
  constructor(budget: string, actual: number, max: number) {
    super('BUDGET_EXCEEDED', `${budget} budget exceeded: ${actual} > ${max}`);
    this.budget = budget;
  }
}
