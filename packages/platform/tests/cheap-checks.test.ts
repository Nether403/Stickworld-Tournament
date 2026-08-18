import { describe, expect, it } from 'vitest';
import { cheapCadence, cheapDuration, cheapScoreEnvelope, parseClaimedScore } from '../src/cheap-checks.js';

describe('cheap checks', () => {
  it('parses int64 decimal strings', () => {
    expect(parseClaimedScore('302')).toBe(302n);
    expect(parseClaimedScore('nope')).toBeUndefined();
  });

  it('rejects envelope, duration, and cadence violations', () => {
    expect(cheapScoreEnvelope(1_000_000_000_001n)).toBe('SCORE_ENVELOPE');
    expect(cheapDuration(0, 600)).toBe('DURATION');
    expect(cheapDuration(601, 600)).toBe('DURATION');
    const events = Array.from({ length: 9 }, () => ({ tick: 1, actionId: 1, value: 1 }));
    expect(cheapCadence(events, 10)).toBe('CADENCE');
    expect(cheapCadence([{ tick: 10, actionId: 1, value: 1 }], 10)).toBe('CADENCE');
  });
});
