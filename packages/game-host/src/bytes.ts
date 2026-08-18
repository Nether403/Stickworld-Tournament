export function uuidToBytes(id: string): Uint8Array {
  const hex = id.replaceAll('-', '');
  if (hex.length !== 32) throw new Error('invalid uuid');
  const out = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function hexPrefix(hex: string, bytes = 8): Uint8Array {
  const out = new Uint8Array(bytes);
  for (let i = 0; i < bytes; i++) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

export function packGameVersionString(version: string): number {
  const [maj, min, pat] = version.split('.').map((part) => Number(part));
  return (((maj ?? 0) & 0xff) << 16) | (((min ?? 0) & 0xff) << 8) | ((pat ?? 0) & 0xff);
}
