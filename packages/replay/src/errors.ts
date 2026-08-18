export class ReplayError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = new.target.name;
    this.code = code;
  }
}

export class BadMagicError extends ReplayError {
  constructor() {
    super('BAD_MAGIC', 'Replay magic is not SWR1');
  }
}
export class UnsupportedFormatVersionError extends ReplayError {
  constructor(version: number) {
    super('UNSUPPORTED_FORMAT', `Unsupported replay format version ${version}`);
  }
}
export class TruncatedReplayError extends ReplayError {
  constructor() {
    super('TRUNCATED', 'Replay is truncated');
  }
}
export class CrcMismatchError extends ReplayError {
  constructor() {
    super('CRC_MISMATCH', 'Replay CRC-32 does not match');
  }
}
export class ReplayTooLargeError extends ReplayError {
  constructor() {
    super('TOO_LARGE', 'Replay exceeds size budget');
  }
}
export class UnknownActionError extends ReplayError {
  constructor(actionId: number) {
    super('UNKNOWN_ACTION', `Unknown action id ${actionId}`);
  }
}
export class InputValueOutOfRangeError extends ReplayError {
  constructor(actionId: number, value: number) {
    super('VALUE_OUT_OF_RANGE', `Action ${actionId} value ${value} out of range`);
  }
}
export class TickOrderViolationError extends ReplayError {
  constructor() {
    super('TICK_ORDER', 'Input ticks are not monotonic');
  }
}
export class TickCountMismatchError extends ReplayError {
  constructor() {
    super('TICK_COUNT', 'Driven ticks do not match header totalTicks');
  }
}
export class StateHashMismatchError extends ReplayError {
  constructor() {
    super('STATE_HASH_MISMATCH', 'Re-simulated state hash does not match the replay');
  }
}
export class ScoreMismatchError extends ReplayError {
  constructor() {
    super('SCORE_MISMATCH', 'Re-simulated score does not match claimed score');
  }
}
export class GzipError extends ReplayError {
  constructor() {
    super('GZIP', 'Replay gzip payload is invalid');
  }
}
