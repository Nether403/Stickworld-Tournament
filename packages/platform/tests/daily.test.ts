import { describe, expect, it } from 'vitest';
import { isoWeekMonday } from '../src/daily.js';

describe('isoWeekMonday', () => {
  it('maps a Tuesday to that ISO-week Monday', () => {
    expect(isoWeekMonday(new Date('2026-08-18T12:00:00.000Z'))).toBe('2026-08-17');
  });

  it('keeps a Monday as itself', () => {
    expect(isoWeekMonday(new Date('2026-08-17T00:00:00.000Z'))).toBe('2026-08-17');
  });

  it('maps a Sunday back to the previous Monday', () => {
    expect(isoWeekMonday(new Date('2026-08-23T23:59:59.000Z'))).toBe('2026-08-17');
  });
});
