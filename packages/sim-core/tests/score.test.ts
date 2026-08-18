import { describe, expect, it } from 'vitest';
import { aggregateScore, diffScoreEvents } from '../src/score.js';

describe('score aggregation', () => {
  it('uses integer hundredths and ignores float order issues', () => {
    expect(
      aggregateScore([
        { tick: 1, type: 'gate', points: 10, multiplier: 150 },
        { tick: 2, type: 'gate', points: 10, multiplier: 150 },
      ]),
    ).toBe(30);
  });

  it('diffs the first divergent event', () => {
    const server = [{ tick: 3, type: 'gate', points: 5, multiplier: 100 }];
    const client = [{ tick: 3, type: 'gate', points: 50, multiplier: 100 }];
    const diff = diffScoreEvents(client, server);
    expect(diff?.tick).toBe(3);
    expect(diff?.client?.points).toBe(50);
    expect(diff?.server?.points).toBe(5);
  });
});
