import { describe, expect, it } from 'vitest';
import { initRapier, rapierBuildHash } from '../src/rapier.js';
import { RAPIER_BUILD_SHA256, RAPIER_PACKAGE, RAPIER_VERSION } from '../src/version.js';

describe('Rapier pin', () => {
  it('initialises the pinned -compat build and exposes a SHA-256', async () => {
    expect(RAPIER_PACKAGE).toBe('@dimforge/rapier2d-compat');
    expect(RAPIER_VERSION).toBe('0.20.0');
    await initRapier();
    const hash = rapierBuildHash();
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    if (RAPIER_BUILD_SHA256 === 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa') {
      throw new Error(`Commit this Rapier WASM SHA-256 as RAPIER_BUILD_SHA256:\n${hash}`);
    }
    expect(hash).toBe(RAPIER_BUILD_SHA256);
  });
});
