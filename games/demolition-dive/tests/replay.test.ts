import { describe, expect, it } from 'vitest';
import { decodeReplay } from '@stickworld/replay';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const fixture = join(dirname(fileURLToPath(import.meta.url)), '../fixtures/sample.swr');

describe('Demolition Dive sample replay', () => {
  it('decodes the committed fixture once it exists', async () => {
    if (!existsSync(fixture)) return;
    const bytes = new Uint8Array(readFileSync(fixture));
    const decoded = await decodeReplay(bytes);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.header.gameRegistryId).toBe(10);
    expect(bytes.byteLength).toBeLessThanOrEqual(81920);
  });
});
