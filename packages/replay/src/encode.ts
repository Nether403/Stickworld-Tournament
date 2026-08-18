import { crc32 } from './crc32.js';
import { ReplayTooLargeError } from './errors.js';
import {
  FORMAT_VERSION,
  HEADER_SIZE,
  MAGIC,
  MAX_COMPRESSED_BYTES,
  MAX_EVENTS,
  OFFSET,
  type InputEvent,
  type ReplayHeader,
} from './format.js';
import { gzipCompress } from './gzip.js';
import { writeUnsigned, zigzagEncode } from './varint.js';

export function packGameVersion(major: number, minor: number, patch: number): number {
  return ((major & 0xff) << 16) | ((minor & 0xff) << 8) | (patch & 0xff);
}

function writeHeader(view: DataView, bytes: Uint8Array, header: ReplayHeader): void {
  bytes.set(MAGIC, OFFSET.magic);
  view.setUint16(OFFSET.formatVersion, header.formatVersion, true);
  view.setUint16(OFFSET.gameRegistryId, header.gameRegistryId, true);
  view.setUint32(OFFSET.gameVersion, header.gameVersion, true);
  view.setUint16(OFFSET.simulationVersion, header.simulationVersion, true);
  view.setUint16(OFFSET.scoringVersion, header.scoringVersion, true);
  bytes.set(header.rapierBuildHashPrefix.subarray(0, 8), OFFSET.rapierBuildHashPrefix);
  view.setUint32(OFFSET.seed, header.seed[0] >>> 0, true);
  view.setUint32(OFFSET.seed + 4, header.seed[1] >>> 0, true);
  view.setUint32(OFFSET.seed + 8, header.seed[2] >>> 0, true);
  view.setUint32(OFFSET.seed + 12, header.seed[3] >>> 0, true);
  bytes.set(header.attemptId.subarray(0, 16), OFFSET.attemptId);
  view.setUint16(OFFSET.tickRate, header.tickRate, true);
  view.setUint32(OFFSET.totalTicks, header.totalTicks, true);
  view.setBigInt64(OFFSET.claimedScore, header.claimedScore, true);
  view.setUint32(OFFSET.eventCount, header.eventCount, true);
  view.setBigUint64(OFFSET.finalStateHash, header.finalStateHash, true);
}

export function encodeUncompressed(header: ReplayHeader, events: readonly InputEvent[]): Uint8Array {
  if (events.length > MAX_EVENTS) throw new ReplayTooLargeError();
  const body: number[] = [];
  let prevTick = 0;
  for (const event of events) {
    writeUnsigned(event.tick - prevTick, body);
    body.push(event.actionId & 0xff);
    writeUnsigned(zigzagEncode(event.value), body);
    prevTick = event.tick;
  }
  const raw = new Uint8Array(HEADER_SIZE + body.length + 4);
  const view = new DataView(raw.buffer);
  writeHeader(view, raw, { ...header, formatVersion: FORMAT_VERSION, eventCount: events.length });
  raw.set(body, HEADER_SIZE);
  const crc = crc32(raw, 0, HEADER_SIZE + body.length);
  view.setUint32(HEADER_SIZE + body.length, crc, true);
  return raw;
}

function zeroGzipMtime(bytes: Uint8Array): Uint8Array {
  const out = bytes.slice();
  if (out.length >= 8 && out[0] === 0x1f && out[1] === 0x8b) {
    out[4] = 0;
    out[5] = 0;
    out[6] = 0;
    out[7] = 0;
  }
  return out;
}

export async function encodeReplay(
  header: ReplayHeader,
  events: readonly InputEvent[],
): Promise<Uint8Array> {
  const raw = encodeUncompressed(header, events);
  const gz = zeroGzipMtime(await gzipCompress(raw));
  if (gz.byteLength > MAX_COMPRESSED_BYTES) throw new ReplayTooLargeError();
  return gz;
}
