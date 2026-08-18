import RAPIER from '@dimforge/rapier2d-compat';
import { RapierBuildMismatchError } from './errors.js';
import { RAPIER_BUILD_SHA256 } from './version.js';

export type RapierModule = typeof RAPIER;

let cached: RapierModule | undefined;
let cachedHash: string | undefined;

function hexSha256(source: Uint8Array): Promise<string> {
  const copy = new ArrayBuffer(source.byteLength);
  new Uint8Array(copy).set(source);
  return globalThis.crypto.subtle.digest('SHA-256', copy).then((digest) => {
    const digestBytes = new Uint8Array(digest);
    let hex = '';
    for (let i = 0; i < digestBytes.length; i++) {
      hex += digestBytes[i]!.toString(16).padStart(2, '0');
    }
    return hex;
  });
}

function installWasmCapture(): () => Uint8Array {
  const original = WebAssembly.instantiate.bind(WebAssembly);
  let captured: Uint8Array | undefined;

  const wrapped = ((
    ...args: Parameters<typeof WebAssembly.instantiate>
  ): ReturnType<typeof WebAssembly.instantiate> => {
    const source = args[0];
    if (source instanceof Uint8Array) {
      captured = source;
    } else if (source instanceof ArrayBuffer) {
      captured = new Uint8Array(source);
    }
    return original(...args);
  }) as typeof WebAssembly.instantiate;

  WebAssembly.instantiate = wrapped;

  return () => {
    WebAssembly.instantiate = original;
    if (!captured || captured.byteLength < 8) {
      throw new Error('Rapier init did not produce captured WASM bytes');
    }
    return captured;
  };
}

export async function initRapier(): Promise<RapierModule> {
  if (cached && cachedHash) {
    return cached;
  }
  const finishCapture = installWasmCapture();
  await RAPIER.init();
  const wasm = finishCapture();
  const hash = await hexSha256(wasm);
  if (RAPIER_BUILD_SHA256.length === 64 && hash !== RAPIER_BUILD_SHA256) {
    throw new RapierBuildMismatchError(hash, RAPIER_BUILD_SHA256);
  }
  cached = RAPIER;
  cachedHash = hash;
  return RAPIER;
}

export function rapierBuildHash(): string {
  if (!cachedHash) {
    throw new Error('initRapier() must be called before rapierBuildHash()');
  }
  return cachedHash;
}

export function getRapier(): RapierModule {
  if (!cached) {
    throw new Error('initRapier() must be called before getRapier()');
  }
  return cached;
}
