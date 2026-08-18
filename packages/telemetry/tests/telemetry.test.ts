import { describe, expect, it } from 'vitest';
import { emit } from '../src/index.ts';

describe('telemetry emit', () => {
  it('is a no-op', () => {
    expect(() =>
      emit('host.start', { gameId: 'hookline-sprint', gameVersion: '1.0.0', mode: 'practice' }),
    ).not.toThrow();
  });
});
