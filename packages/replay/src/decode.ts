import { crc32 } from './crc32.js';
import {
  BadMagicError,
  CrcMismatchError,
  GzipError,
  ReplayError,
  ReplayTooLargeError,
  TickOrderViolationError,
  TruncatedReplayError,
  UnsupportedFormatVersionError,
} from './errors.js';
import {
  FORMAT_VERSION,
  HEADER_SIZE,
  MAGIC,
  MAX_COMPRESSED_BYTES,
  MAX_EVENTS,
  MAX_UNCOMPRESSED_BYTES,
  OFFSET,
  type InputEvent,
  type ReplayHeader,
} from './format.js';
import { gzipDecompress } from './gzip.js';
import { readUnsigned, zigzagDecode } from './varint.js';

export type DecodeResult =
  | { ok: true; header: ReplayHeader; events: InputEvent[]; raw: Uint8Array }
  | { ok: false; error: ReplayError };

function magicOk(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === MAGIC[0] &&
    bytes[1] === MAGIC[1] &&
    bytes[2] === MAGIC[2] &&
    bytes[3] === MAGIC[3]
  );
}

function readHeader(bytes: Uint8Array): ReplayHeader | ReplayError {
  if (bytes.length < HEADER_SIZE + 4) return new TruncatedReplayError();
  if (!magicOk(bytes)) return new BadMagicError();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const formatVersion = view.getUint16(OFFSET.formatVersion, true);
  if (formatVersion !== FORMAT_VERSION) return new UnsupportedFormatVersionError(formatVersion);
  const seed: [number, number, number, number] = [
    view.getUint32(OFFSET.seed, true),
    view.getUint32(OFFSET.seed + 4, true),
    view.getUint32(OFFSET.seed + 8, true),
    view.getUint32(OFFSET.seed + 12, true),
  ];
  return {
    formatVersion,
    gameRegistryId: view.getUint16(OFFSET.gameRegistryId, true),
    gameVersion: view.getUint32(OFFSET.gameVersion, true),
    simulationVersion: view.getUint16(OFFSET.simulationVersion, true),
    scoringVersion: view.getUint16(OFFSET.scoringVersion, true),
    rapierBuildHashPrefix: bytes.slice(OFFSET.rapierBuildHashPrefix, OFFSET.rapierBuildHashPrefix + 8),
    seed,
    attemptId: bytes.slice(OFFSET.attemptId, OFFSET.attemptId + 16),
    tickRate: view.getUint16(OFFSET.tickRate, true),
    totalTicks: view.getUint32(OFFSET.totalTicks, true),
    claimedScore: view.getBigInt64(OFFSET.claimedScore, true),
    eventCount: view.getUint32(OFFSET.eventCount, true),
    finalStateHash: view.getBigUint64(OFFSET.finalStateHash, true),
  };
}

function parseBody(bytes: Uint8Array, eventCount: number): InputEvent[] | ReplayError {
  const events: InputEvent[] = [];
  let pos = HEADER_SIZE;
  let tick = 0;
  for (let i = 0; i < eventCount; i++) {
    const delta = readUnsigned(bytes, pos);
    if (!delta) return new TruncatedReplayError();
    pos = delta.next;
    if (pos >= bytes.length - 4) return new TruncatedReplayError();
    const actionId = bytes[pos]!;
    pos += 1;
    const valueBits = readUnsigned(bytes, pos);
    if (!valueBits) return new TruncatedReplayError();
    pos = valueBits.next;
    tick += delta.value;
    const previous = events[events.length - 1];
    if (
      previous &&
      (tick < previous.tick || (tick === previous.tick && actionId < previous.actionId))
    ) {
      return new TickOrderViolationError();
    }
    events.push({ tick, actionId, value: zigzagDecode(valueBits.value) });
  }
  if (pos + 4 !== bytes.length) return new TruncatedReplayError();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const expected = view.getUint32(pos, true);
  if (crc32(bytes, 0, pos) !== expected) return new CrcMismatchError();
  return events;
}

export async function decodeReplay(compressed: Uint8Array): Promise<DecodeResult> {
  if (compressed.byteLength > MAX_COMPRESSED_BYTES) {
    return { ok: false, error: new ReplayTooLargeError() };
  }
  let raw: Uint8Array;
  try {
    raw = await gzipDecompress(compressed);
  } catch {
    return { ok: false, error: new GzipError() };
  }
  if (raw.byteLength > MAX_UNCOMPRESSED_BYTES) {
    return { ok: false, error: new ReplayTooLargeError() };
  }
  const header = readHeader(raw);
  if (header instanceof ReplayError) return { ok: false, error: header };
  if (header.eventCount > MAX_EVENTS) return { ok: false, error: new ReplayTooLargeError() };
  const events = parseBody(raw, header.eventCount);
  if (events instanceof ReplayError) return { ok: false, error: events };
  if (events.length !== header.eventCount) return { ok: false, error: new TruncatedReplayError() };
  return { ok: true, header, events, raw };
}
