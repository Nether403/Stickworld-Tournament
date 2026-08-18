import { describe, expect, it } from 'vitest';
import { crc32 } from '../src/crc32.js';
import { decodeReplay } from '../src/decode.js';
import { encodeReplay, encodeUncompressed, packGameVersion } from '../src/encode.js';
import {
  BadMagicError,
  CrcMismatchError,
  GzipError,
  InputValueOutOfRangeError,
  ReplayTooLargeError,
  ScoreMismatchError,
  StateHashMismatchError,
  TickCountMismatchError,
  TickOrderViolationError,
  TruncatedReplayError,
  UnknownActionError,
  UnsupportedFormatVersionError,
} from '../src/errors.js';
import { gzipCompress } from '../src/gzip.js';
import { playReplay } from '../src/player.js';
import { Recorder } from '../src/recorder.js';
import { readUnsigned, writeUnsigned, zigzagDecode, zigzagEncode } from '../src/varint.js';
import type { ReplayHeader } from '../src/format.js';
import { HEADER_SIZE, MAX_COMPRESSED_BYTES } from '../src/format.js';
import { aggregateScore, type Simulation } from '@stickworld/sim-core';
import type { ScoreEvent } from '@stickworld/sim-core';

const actions = [
  { id: 1, name: 'jump', kind: 'bool' as const },
  { id: 2, name: 'aim', kind: 'int' as const, min: -100, max: 100, scale: 10 },
];

function header(partial: Partial<ReplayHeader> = {}): ReplayHeader {
  return {
    formatVersion: 1,
    gameRegistryId: 1,
    gameVersion: packGameVersion(1, 0, 0),
    simulationVersion: 1,
    scoringVersion: 1,
    rapierBuildHashPrefix: new Uint8Array(8),
    seed: [1, 2, 3, 4],
    attemptId: new Uint8Array(16),
    tickRate: 60,
    totalTicks: 10,
    claimedScore: 0n,
    eventCount: 0,
    finalStateHash: 0n,
    ...partial,
  };
}

class FakeSim implements Simulation {
  tick = 0;
  finished = false;
  private acc = 1;
  private readonly events: ScoreEvent[] = [];
  applyInput(actionId: number, value: number): void {
    this.acc = Math.imul(this.acc, 16777619) ^ (actionId + value * 17);
  }
  step(): void {
    this.tick += 1;
    if (this.tick % 10 === 0) {
      this.events.push({ tick: this.tick, type: 'pulse', points: 1, multiplier: 100 });
    }
  }
  score(): number {
    return aggregateScore(this.events);
  }
  scoreEvents(): readonly ScoreEvent[] {
    return this.events;
  }
  stateHash(): bigint {
    return BigInt(this.acc >>> 0);
  }
  renderState(): unknown {
    return { tick: this.tick, acc: this.acc };
  }
  dispose(): void {}
}

class FrozenSim extends FakeSim {
  override step(): void {}
}

describe('varint', () => {
  it('round-trips unsigned and zigzag values', () => {
    for (const n of [0, 1, 127, 128, 300, 16384, 0x7fffffff]) {
      const out: number[] = [];
      writeUnsigned(n, out);
      const read = readUnsigned(new Uint8Array(out), 0);
      expect(read?.value).toBe(n >>> 0);
    }
    for (const n of [0, 1, -1, 50, -50, 1_000_000, -1_000_000]) {
      expect(zigzagDecode(zigzagEncode(n))).toBe(n);
    }
  });
});

describe('crc32', () => {
  it('matches the known answer for 123456789', () => {
    const bytes = new TextEncoder().encode('123456789');
    expect(crc32(bytes)).toBe(0xcbf43926);
  });
});

describe('recorder + encode/decode', () => {
  it('round-trips a recorded stream', async () => {
    const recorder = new Recorder(actions);
    recorder.record(0, 1, 1);
    recorder.record(3, 2, 1.23);
    const events = recorder.snapshot();
    expect(events[1]?.value).toBe(12);
    const gz = await encodeReplay(header({ eventCount: events.length }), events);
    const decoded = await decodeReplay(gz);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.events).toEqual(events);
  });

  it('rejects non-monotonic recorder input', () => {
    const recorder = new Recorder(actions);
    recorder.record(4, 1, 1);
    expect(() => recorder.record(2, 1, 1)).toThrow(TickOrderViolationError);
  });

  it('rejects unknown actions', () => {
    const recorder = new Recorder(actions);
    expect(() => recorder.record(0, 9, 1)).toThrow(UnknownActionError);
  });

  it('rejects analog values outside the declared range', () => {
    const recorder = new Recorder(actions);
    expect(() => recorder.record(0, 2, 50)).toThrow(InputValueOutOfRangeError);
  });
});

describe('playReplay', () => {
  it('reproduces score and hash for random valid streams', async () => {
    for (let n = 0; n < 20; n++) {
      const first = new FakeSim();
      const recorder = new Recorder(actions);
      const ticks = 40 + n;
      for (let t = 0; t < ticks; t++) {
        if (t % 3 === 0) {
          recorder.record(t, 1, 1);
          first.applyInput(1, 1);
        }
        first.step();
      }
      const events = recorder.snapshot();
      const h = header({
        totalTicks: ticks,
        claimedScore: BigInt(first.score()),
        finalStateHash: first.stateHash(),
        eventCount: events.length,
      });
      const gz = await encodeReplay(h, events);
      const decoded = await decodeReplay(gz);
      expect(decoded.ok).toBe(true);
      if (!decoded.ok) return;
      const second = new FakeSim();
      const played = playReplay(second, decoded.header, decoded.events, actions);
      expect(played.score).toBe(first.score());
      expect(played.stateHash).toBe(first.stateHash());
    }
  });
});

describe('size budget', () => {
  it('encodes a 90-second single-action run under 5 KB', async () => {
    const events = Array.from({ length: 5400 }, (_, tick) => ({ tick, actionId: 1, value: 1 }));
    const gz = await encodeReplay(header({ totalTicks: 5400, eventCount: events.length }), events);
    expect(gz.byteLength).toBeLessThan(5 * 1024);
  });
});

describe('adversarial corpus', () => {
  it('returns the typed error taxonomy instead of throwing', async () => {
    const events = [{ tick: 0, actionId: 1, value: 1 }];
    const ok = await encodeReplay(header({ eventCount: 1 }), events);

    const truncated = await decodeReplay(ok.subarray(0, 4));
    expect(truncated.ok).toBe(false);
    if (!truncated.ok) {
      expect(truncated.error instanceof TruncatedReplayError || truncated.error instanceof GzipError).toBe(
        true,
      );
    }

    const oversized = new Uint8Array(MAX_COMPRESSED_BYTES + 1);
    oversized[0] = 0x1f;
    oversized[1] = 0x8b;
    const tooLarge = await decodeReplay(oversized);
    expect(tooLarge.ok).toBe(false);
    if (!tooLarge.ok) expect(tooLarge.error).toBeInstanceOf(ReplayTooLargeError);

    const notGzip = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
    const gzipFail = await decodeReplay(notGzip);
    expect(gzipFail.ok).toBe(false);
    if (!gzipFail.ok) expect(gzipFail.error).toBeInstanceOf(GzipError);

    const raw = encodeUncompressed(header({ eventCount: 1 }), events);
    raw[0] = 0x00;
    const badMagic = await decodeReplay(await gzipCompress(raw));
    expect(badMagic.ok).toBe(false);
    if (!badMagic.ok) expect(badMagic.error).toBeInstanceOf(BadMagicError);

    const rawCrc = encodeUncompressed(header({ eventCount: 1 }), events);
    rawCrc[rawCrc.length - 1] ^= 0xff;
    const badCrc = await decodeReplay(await gzipCompress(rawCrc));
    expect(badCrc.ok).toBe(false);
    if (!badCrc.ok) expect(badCrc.error).toBeInstanceOf(CrcMismatchError);

    const rawVer = encodeUncompressed(header({ eventCount: 1 }), events);
    new DataView(rawVer.buffer).setUint16(4, 99, true);
    const crcOff = rawVer.length - 4;
    new DataView(rawVer.buffer).setUint32(crcOff, crc32(rawVer, 0, crcOff), true);
    const badVer = await decodeReplay(await gzipCompress(rawVer));
    expect(badVer.ok).toBe(false);
    if (!badVer.ok) expect(badVer.error).toBeInstanceOf(UnsupportedFormatVersionError);

    const truncatedRaw = encodeUncompressed(header({ eventCount: 1 }), events).subarray(
      0,
      HEADER_SIZE + 2,
    );
    const trunc = await decodeReplay(await gzipCompress(truncatedRaw));
    expect(trunc.ok).toBe(false);
    if (!trunc.ok) {
      expect(
        trunc.error instanceof TruncatedReplayError || trunc.error instanceof CrcMismatchError,
      ).toBe(true);
    }

    const unordered = encodeUncompressed(header({ eventCount: 2, totalTicks: 5 }), [
      { tick: 1, actionId: 2, value: 1 },
      { tick: 1, actionId: 1, value: 1 },
    ]);
    const order = await decodeReplay(await gzipCompress(unordered));
    expect(order.ok).toBe(false);
    if (!order.ok) expect(order.error).toBeInstanceOf(TickOrderViolationError);

    const unknown = header({ totalTicks: 1, claimedScore: 0n, finalStateHash: 1n, eventCount: 1 });
    expect(() => playReplay(new FakeSim(), unknown, [{ tick: 0, actionId: 9, value: 1 }], actions)).toThrow(
      UnknownActionError,
    );

    expect(() =>
      playReplay(new FakeSim(), unknown, [{ tick: 0, actionId: 2, value: 500 }], actions),
    ).toThrow(InputValueOutOfRangeError);

    const first = new FakeSim();
    first.step();
    const mismatchHeader = header({
      totalTicks: 1,
      claimedScore: 99n,
      finalStateHash: first.stateHash(),
    });
    expect(() => playReplay(new FakeSim(), mismatchHeader, [], actions)).toThrow(ScoreMismatchError);

    const hashHeader = header({
      totalTicks: 1,
      claimedScore: 0n,
      finalStateHash: 0xdeadbeefn,
    });
    expect(() => playReplay(new FakeSim(), hashHeader, [], actions)).toThrow(StateHashMismatchError);

    expect(() =>
      playReplay(new FrozenSim(), header({ totalTicks: 3, claimedScore: 0n, finalStateHash: 1n }), [], actions),
    ).toThrow(TickCountMismatchError);
  });
});
