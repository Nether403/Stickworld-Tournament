import { describe, expect, it } from 'vitest';
import { nudgeAimDegrees, shouldRecordChange } from '../src/index.ts';

describe('shouldRecordChange', () => {
  it('records the first value and skips repeats', () => {
    const last = new Map<number, number>();
    expect(shouldRecordChange(last, 1, 40)).toBe(true);
    expect(shouldRecordChange(last, 1, 40)).toBe(false);
    expect(shouldRecordChange(last, 1, 41)).toBe(true);
    expect(last.get(1)).toBe(41);
  });
});

describe('nudgeAimDegrees', () => {
  it('wraps around 360', () => {
    expect(nudgeAimDegrees(1, true, false, false, false)).toBe(358);
    expect(nudgeAimDegrees(358, false, true, false, false)).toBe(1);
  });
});
