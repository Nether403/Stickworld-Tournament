import type RAPIER from '@dimforge/rapier2d-compat';
import type { BodyRegistry } from './bodies.js';
import { NonFiniteStateError } from './errors.js';

const FNV_OFFSET = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const U64_MASK = 0xffffffffffffffffn;

const FIELDS = [
  'translation.x',
  'translation.y',
  'rotation',
  'linvel.x',
  'linvel.y',
  'angvel',
] as const;

function fnv1a64(hash: bigint, bytes: Uint8Array): bigint {
  let h = hash;
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b === undefined) continue;
    h ^= BigInt(b);
    h = (h * FNV_PRIME) & U64_MASK;
  }
  return h;
}

function writeF32(
  view: Float32Array,
  index: number,
  value: number,
  bodyIndex: number,
  field: string,
): void {
  if (!Number.isFinite(value)) {
    throw new NonFiniteStateError(bodyIndex, field);
  }
  view[index] = value === 0 ? 0 : value;
}

export function stateHash(world: RAPIER.World, registry: BodyRegistry): bigint {
  const scratch = new Float32Array(6);
  const bytes = new Uint8Array(scratch.buffer);
  let hash = FNV_OFFSET;
  const handles = registry.ordered();
  for (let i = 0; i < handles.length; i++) {
    const handle = handles[i]!;
    const body = world.getRigidBody(handle);
    if (!body) continue;
    const t = body.translation();
    const v = body.linvel();
    writeF32(scratch, 0, t.x, i, FIELDS[0]);
    writeF32(scratch, 1, t.y, i, FIELDS[1]);
    writeF32(scratch, 2, body.rotation(), i, FIELDS[2]);
    writeF32(scratch, 3, v.x, i, FIELDS[3]);
    writeF32(scratch, 4, v.y, i, FIELDS[4]);
    writeF32(scratch, 5, body.angvel(), i, FIELDS[5]);
    hash = fnv1a64(hash, bytes);
  }
  return hash;
}

export function formatHash(hash: bigint): string {
  return hash.toString(16).padStart(16, '0');
}
