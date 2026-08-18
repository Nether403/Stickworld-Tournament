export const MAGIC = new Uint8Array([0x53, 0x57, 0x52, 0x31]); // SWR1
export const HEADER_SIZE = 88;
export const FORMAT_VERSION = 1;
export const MAX_COMPRESSED_BYTES = 64 * 1024;
export const MAX_UNCOMPRESSED_BYTES = 256 * 1024;
export const MAX_EVENTS = 50_000;

export const OFFSET = {
  magic: 0,
  formatVersion: 4,
  gameRegistryId: 6,
  gameVersion: 8,
  simulationVersion: 12,
  scoringVersion: 14,
  rapierBuildHashPrefix: 16,
  seed: 24,
  attemptId: 40,
  tickRate: 56,
  totalTicks: 58,
  claimedScore: 62,
  eventCount: 70,
  finalStateHash: 74,
  reserved: 82,
} as const;

export interface ReplayHeader {
  formatVersion: number;
  gameRegistryId: number;
  gameVersion: number;
  simulationVersion: number;
  scoringVersion: number;
  rapierBuildHashPrefix: Uint8Array;
  seed: readonly [number, number, number, number];
  attemptId: Uint8Array;
  tickRate: number;
  totalTicks: number;
  claimedScore: bigint;
  eventCount: number;
  finalStateHash: bigint;
}

export interface InputEvent {
  tick: number;
  actionId: number;
  value: number;
}
