export const REASON_MESSAGES = {
  BAD_MAGIC: 'Replay is not a Stickworld replay.',
  UNSUPPORTED_FORMAT: 'Replay format is not supported.',
  TRUNCATED: 'Replay is incomplete.',
  CRC_MISMATCH: 'Replay failed integrity check.',
  TOO_LARGE: 'Replay exceeds size budget.',
  UNKNOWN_ACTION: 'Replay contains an unknown input.',
  VALUE_OUT_OF_RANGE: 'Replay contains an out-of-range input.',
  TICK_ORDER: 'Replay inputs are out of order.',
  TICK_COUNT: 'Replay duration does not match the header.',
  BUDGET_EXCEEDED: 'Simulation exceeded its physics budget.',
  NON_FINITE_STATE: 'Simulation produced a non-finite state.',
  STATE_HASH_MISMATCH: 'Re-simulated physics do not match the replay.',
  SCORE_MISMATCH: 'Re-simulated score does not match the claim.',
  GZIP: 'Replay payload is not valid gzip.',
  UNAUTHENTICATED: 'Sign in required.',
  FORBIDDEN: 'Attempt not found.',
  HANDLE_TAKEN: 'That handle is taken.',
  HANDLE_INVALID: 'That handle is not allowed.',
  RATE_LIMITED: 'Slow down.',
  UGC_REPORT_RATE: 'Too many reports. Try again later.',
  ATTEMPT_EXPIRED: 'That attempt expired.',
  ATTEMPT_CONSUMED: 'That attempt was already used.',
  ATTEMPT_NOT_FOUND: 'Attempt not found.',
  TOKEN_INVALID: 'Attempt token is invalid.',
  WRONG_VERSION: 'Game version does not match this attempt.',
  WRONG_USER: 'Attempt not found.',
  SEED_DEGENERATE: 'Server refused to issue a degenerate seed.',
  DAILY_CAP: 'Daily attempt cap reached.',
  NOT_INVITED: 'This ranked season is invite-only.',
  SEASON_INACTIVE: 'This season is not accepting ranked runs.',
  SCORE_ENVELOPE: 'Claimed score is outside the allowed range.',
  CADENCE: 'Input cadence is implausible.',
  DURATION: "Run duration is outside the game's limits.",
  HANDLE_COOLDOWN: 'You can change your handle again later.',
  WORKER_FAULT: 'Verification failed. Try submitting again.',
  BAD_CURSOR: 'Invalid cursor.',
  ALREADY_ANONYMISED: 'This profile is already anonymised.',
  INTERNAL: 'Something went wrong.',
} as const;

export type ReasonCode = keyof typeof REASON_MESSAGES;

export const NON_LEAKY: ReadonlySet<ReasonCode> = new Set([
  'WRONG_USER',
  'ATTEMPT_NOT_FOUND',
  'FORBIDDEN',
]);

export function publicMessage(code: ReasonCode): string {
  return REASON_MESSAGES[code];
}

export function httpStatus(code: ReasonCode): number {
  switch (code) {
    case 'UNAUTHENTICATED':
      return 401;
    case 'RATE_LIMITED':
    case 'UGC_REPORT_RATE':
    case 'DAILY_CAP':
    case 'HANDLE_COOLDOWN':
      return 429;
    case 'HANDLE_TAKEN':
    case 'ALREADY_ANONYMISED':
      return 409;
    case 'SEASON_INACTIVE':
    case 'NOT_INVITED':
    case 'FORBIDDEN':
      return code === 'FORBIDDEN' ? 404 : 403;
    case 'ATTEMPT_NOT_FOUND':
    case 'WRONG_USER':
      return 404;
    case 'INTERNAL':
    case 'WORKER_FAULT':
      return 500;
    default:
      return 400;
  }
}
