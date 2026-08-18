export function writeUnsigned(value: number, out: number[]): void {
  let v = value >>> 0;
  while (v >= 0x80) {
    out.push((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  out.push(v);
}

export function readUnsigned(
  buf: Uint8Array,
  offset: number,
): { value: number; next: number } | undefined {
  let result = 0;
  let shift = 0;
  let pos = offset;
  while (pos < buf.length) {
    const byte = buf[pos]!;
    pos += 1;
    result |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) {
      return { value: result >>> 0, next: pos };
    }
    shift += 7;
    if (shift > 28) return undefined;
  }
  return undefined;
}

export function zigzagEncode(n: number): number {
  return ((n << 1) ^ (n >> 31)) >>> 0;
}

export function zigzagDecode(n: number): number {
  return (n >>> 1) ^ -(n & 1);
}
