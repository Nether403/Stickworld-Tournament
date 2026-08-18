import { CHAMPIONSHIP_ENTRANT_GATE, CHAMPIONSHIP_PLACEMENT_CUTOFF } from './limits.js';

export function integerMedian(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  if (n % 2 === 1) return sorted[Math.floor(n / 2)]!;
  return sorted[n / 2 - 1]!;
}

export function championshipPoints(
  rank: number,
  entrants: number,
): { points: number; provisional: boolean } {
  if (entrants < CHAMPIONSHIP_ENTRANT_GATE) return { points: 0, provisional: true };
  if (rank <= CHAMPIONSHIP_PLACEMENT_CUTOFF) {
    return { points: 1000 - Math.floor(((rank - 1) * 100) / 99), provisional: false };
  }
  return {
    points: Math.floor((899 * (entrants - rank)) / (entrants - 100)),
    provisional: false,
  };
}

export function rankDense(scoresEqual: (i: number, j: number) => boolean, n: number): number[] {
  const ranks: number[] = [];
  let place = 1;
  for (let i = 0; i < n; i++) {
    if (i === 0 || !scoresEqual(i, i - 1)) place = i + 1;
    ranks.push(place);
  }
  return ranks;
}

export interface ChampionshipEntrant {
  userId: string;
  handle: string | null;
  gamePoints: number[];
  wins: number;
  top10: number;
  totalAchievedAt: string;
}

export function compareChampionship(a: ChampionshipEntrant, b: ChampionshipEntrant): number {
  const pa = a.gamePoints.reduce((s, n) => s + n, 0);
  const pb = b.gamePoints.reduce((s, n) => s + n, 0);
  if (pb !== pa) return pb - pa;
  if (b.wins !== a.wins) return b.wins - a.wins;
  if (b.top10 !== a.top10) return b.top10 - a.top10;
  const ma = integerMedian(a.gamePoints);
  const mb = integerMedian(b.gamePoints);
  if (mb !== ma) return mb - ma;
  return Date.parse(a.totalAchievedAt) - Date.parse(b.totalAchievedAt);
}
