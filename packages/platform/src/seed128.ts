export type Seed128 = readonly [number, number, number, number];

export function packSeed(seed: Seed128): Buffer {
  const out = Buffer.alloc(16);
  out.writeUInt32LE(seed[0] >>> 0, 0);
  out.writeUInt32LE(seed[1] >>> 0, 4);
  out.writeUInt32LE(seed[2] >>> 0, 8);
  out.writeUInt32LE(seed[3] >>> 0, 12);
  return out;
}

export function unpackSeed(bytes: Buffer | Uint8Array): Seed128 {
  const buf = Buffer.from(bytes);
  if (buf.length !== 16) throw new Error('seed must be 16 bytes');
  return [buf.readUInt32LE(0), buf.readUInt32LE(4), buf.readUInt32LE(8), buf.readUInt32LE(12)];
}

export function isDegenerateSeed(seed: Seed128): boolean {
  return seed[0] === 0 && seed[1] === 0 && seed[2] === 0 && seed[3] === 0;
}

export function seedFromBytes(bytes: Uint8Array): Seed128 {
  if (bytes.length < 16) throw new Error('need 16 random bytes');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return [
    view.getUint32(0, true),
    view.getUint32(4, true),
    view.getUint32(8, true),
    view.getUint32(12, true),
  ];
}

export function uuidToBytes(id: string): Buffer {
  const hex = id.replaceAll('-', '');
  if (hex.length !== 32) throw new Error('invalid uuid');
  return Buffer.from(hex, 'hex');
}

export function bytesToUuid(bytes: Uint8Array): string {
  const h = Buffer.from(bytes).toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
