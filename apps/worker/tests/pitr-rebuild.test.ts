import { describe, expect, it } from 'vitest';
import * as pitrRebuildModule from '../src/pitr-rebuild.js';

type PitrRebuildGuards = {
  assertPitrRebuildOptIn?: (value: string | undefined) => void;
  assertClosedSeasonForPitr?: (season: { slug: string; status: string }) => void;
};

const guards = pitrRebuildModule as PitrRebuildGuards;

describe('PITR rebuild command guards', () => {
  it('requires an explicit destructive-operation opt-in', () => {
    expect(guards.assertPitrRebuildOptIn).toBeTypeOf('function');
    expect(() => guards.assertPitrRebuildOptIn?.(undefined)).toThrow('STICKWORLD_PITR_REBUILD=1');
    expect(() => guards.assertPitrRebuildOptIn?.('0')).toThrow('STICKWORLD_PITR_REBUILD=1');
    expect(() => guards.assertPitrRebuildOptIn?.('1')).not.toThrow();
  });

  it('allows rebuilds only for closed seasons', () => {
    expect(guards.assertClosedSeasonForPitr).toBeTypeOf('function');
    expect(() =>
      guards.assertClosedSeasonForPitr?.({ slug: 'summer-2026', status: 'active' }),
    ).toThrow('season summer-2026 is active; PITR rebuild requires a closed season');
    expect(() =>
      guards.assertClosedSeasonForPitr?.({ slug: 'summer-2026', status: 'closed' }),
    ).not.toThrow();
  });
});
