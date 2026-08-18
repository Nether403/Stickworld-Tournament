import { MAX_REPLAY_COMPRESSED_BYTES, SCORE_ENVELOPE_ABS } from './limits.js';
import type { ReasonCode } from './reason-codes.js';
import type { InputEvent } from '@stickworld/replay';

export function cheapReplaySize(bytes: Uint8Array): ReasonCode | undefined {
  if (bytes.byteLength > MAX_REPLAY_COMPRESSED_BYTES) return 'TOO_LARGE';
  return undefined;
}

export function cheapScoreEnvelope(claimed: bigint): ReasonCode | undefined {
  const abs = claimed < 0n ? -claimed : claimed;
  if (abs > SCORE_ENVELOPE_ABS) return 'SCORE_ENVELOPE';
  return undefined;
}

export function cheapDuration(totalTicks: number, maxRunTicks: number): ReasonCode | undefined {
  if (totalTicks < 1 || totalTicks > maxRunTicks) return 'DURATION';
  return undefined;
}

export function cheapCadence(events: readonly InputEvent[], totalTicks: number): ReasonCode | undefined {
  const perTick = new Map<number, number>();
  for (const event of events) {
    if (event.tick >= totalTicks) return 'CADENCE';
    perTick.set(event.tick, (perTick.get(event.tick) ?? 0) + 1);
    if ((perTick.get(event.tick) ?? 0) > 8) return 'CADENCE';
  }
  return undefined;
}

export function parseClaimedScore(raw: string): bigint | undefined {
  if (!/^-?\d+$/.test(raw)) return undefined;
  try {
    return BigInt(raw);
  } catch {
    return undefined;
  }
}
