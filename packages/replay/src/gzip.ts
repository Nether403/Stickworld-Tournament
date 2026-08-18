function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
}

export async function gzipCompress(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([toArrayBuffer(bytes)]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function gzipDecompress(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([toArrayBuffer(bytes)]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
