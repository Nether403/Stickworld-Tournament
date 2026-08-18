import { describe, expect, it } from 'vitest';
import {
  championshipPoints,
  compareChampionship,
  integerMedian,
  rankDense,
  type ChampionshipEntrant,
} from '../src/ranking.js';

describe('championshipPoints', () => {
  it('gates below 50 entrants as provisional zeros', () => {
    expect(championshipPoints(1, 49)).toEqual({ points: 0, provisional: true });
  });

  it('uses the placement table for 1st and 100th', () => {
    expect(championshipPoints(1, 50).points).toBe(1000);
    expect(championshipPoints(100, 100).points).toBe(900);
    expect(championshipPoints(1, 50).provisional).toBe(false);
  });

  it('puts rank 101 just below 900 and last place at 0', () => {
    expect(championshipPoints(100, 200).points).toBe(900);
    expect(championshipPoints(101, 200).points).toBe(890);
    expect(championshipPoints(101, 200).points).toBeLessThan(900);
    expect(championshipPoints(200, 200).points).toBe(0);
  });
});

describe('integerMedian', () => {
  it('takes the middle value for odd n', () => {
    expect(integerMedian([3, 1, 2])).toBe(2);
  });

  it('takes the lower central value for even n', () => {
    expect(integerMedian([1, 2, 3, 4])).toBe(2);
    expect(integerMedian([0, 0, 0, 0, 0, 0, 0, 0, 0, 1000])).toBe(0);
  });
});

describe('compareChampionship', () => {
  const ten = (points: number[]): ChampionshipEntrant => ({
    userId: 'x',
    handle: 'x',
    gamePoints: points,
    wins: 0,
    top10: 0,
    totalAchievedAt: '2026-01-02T00:00:00.000Z',
  });

  it('breaks remaining ties with integer median of ten game totals, then earliest total', () => {
    const evenSpread = ten(Array.from({ length: 10 }, () => 100));
    const spike = ten([1000, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(evenSpread.gamePoints.reduce((s, n) => s + n, 0)).toBe(1000);
    expect(spike.gamePoints.reduce((s, n) => s + n, 0)).toBe(1000);
    expect(integerMedian(evenSpread.gamePoints)).toBe(100);
    expect(integerMedian(spike.gamePoints)).toBe(0);
    expect(compareChampionship(evenSpread, spike)).toBeLessThan(0);

    const earlier = { ...evenSpread, userId: 'early', totalAchievedAt: '2026-01-01T00:00:00.000Z' };
    const later = { ...evenSpread, userId: 'late', totalAchievedAt: '2026-01-03T00:00:00.000Z' };
    expect(compareChampionship(later, earlier)).toBeGreaterThan(0);
  });
});

describe('rankDense', () => {
  it('shares place then skips (RANK semantics)', () => {
    const scores = [10, 10, 8];
    expect(rankDense((i, j) => scores[i] === scores[j], 3)).toEqual([1, 1, 3]);
  });
});
