import {
  attempts,
  gameBests,
  profiles,
  rankingDirty,
  rankingSnapshots,
  seasonGames,
  seasons,
  verifiedResults,
  type Database,
} from '@stickworld/db';
import { and, asc, eq, gt, inArray, sql } from 'drizzle-orm';
import type { Clock } from './context.js';
import {
  ATTEMPT_TTL_SECONDS,
  RANKING_DIRTY_FLOOR_MS,
  LEADERBOARD_PAGE_DEFAULT,
  LEADERBOARD_PAGE_MAX,
} from './limits.js';
import {
  championshipPoints,
  compareChampionship,
  integerMedian,
  rankDense,
  type ChampionshipEntrant,
} from './ranking.js';
import { afterCursor, decodeCursor, encodeCursor, type LeaderboardCursor } from './cursor.js';
import { ApiError } from './errors.js';

export interface LeaderboardRow {
  rank: number;
  userId: string;
  handle: string | null;
  score: string;
  achievedAt: string;
}

export interface GameSnapshotPayload {
  asOf: string;
  rows: LeaderboardRow[];
}

export interface ChampionshipRow {
  rank: number;
  userId: string;
  handle: string | null;
  points: number;
  wins: number;
  top10: number;
  median: number;
  achievedAt: string;
  games: Record<string, { points: number; rank: number | null; provisional: boolean }>;
}

export interface ChampionshipPayload {
  asOf: string;
  provisional: boolean;
  rows: ChampionshipRow[];
}

type RankingDatabase = Pick<Database, 'select' | 'insert' | 'update'>;

async function markDirty(db: RankingDatabase, seasonId: string, at: Date): Promise<void> {
  await db
    .insert(rankingDirty)
    .values({ seasonId, dirtyAt: at })
    .onConflictDoUpdate({
      target: rankingDirty.seasonId,
      set: { dirtyAt: at },
    });
}

export async function markSeasonDirty(db: Database, seasonId: string, at: Date): Promise<void> {
  await markDirty(db, seasonId, at);
}

async function loadOrderedBests(
  db: RankingDatabase,
  seasonGameId: string,
): Promise<LeaderboardRow[]> {
  const rows = await db
    .select({
      userId: gameBests.userId,
      handle: profiles.handle,
      profileStatus: profiles.status,
      score: gameBests.score,
      achievedAt: verifiedResults.achievedAt,
    })
    .from(gameBests)
    .innerJoin(verifiedResults, eq(verifiedResults.id, gameBests.verifiedResultId))
    .innerJoin(profiles, eq(profiles.userId, gameBests.userId))
    .where(eq(gameBests.seasonGameId, seasonGameId))
    .orderBy(
      sql`${gameBests.score} DESC`,
      sql`${verifiedResults.achievedAt} ASC`,
      sql`${gameBests.userId} ASC`,
    );

  const ranks = rankDense((i, j) => {
    const a = rows[i]!;
    const b = rows[j]!;
    return a.score === b.score && a.achievedAt.getTime() === b.achievedAt.getTime();
  }, rows.length);

  return rows.map((row, i) => ({
    rank: ranks[i]!,
    userId: row.userId,
    handle: row.profileStatus === 'anonymised' ? 'retired' : row.handle,
    score: row.score.toString(),
    achievedAt: row.achievedAt.toISOString(),
  }));
}

async function writeLiveSnapshot(
  db: RankingDatabase,
  seasonId: string,
  scope: 'game' | 'championship' | 'daily',
  subjectId: string,
  payload: unknown,
  asOf: Date,
): Promise<void> {
  const existing = await db
    .select()
    .from(rankingSnapshots)
    .where(
      and(
        eq(rankingSnapshots.seasonId, seasonId),
        eq(rankingSnapshots.scope, scope),
        eq(rankingSnapshots.subjectId, subjectId),
        eq(rankingSnapshots.frozen, false),
      ),
    )
    .then((r) => r[0]);
  if (existing) {
    await db
      .update(rankingSnapshots)
      .set({ payload, asOf })
      .where(eq(rankingSnapshots.id, existing.id));
    return;
  }
  await db.insert(rankingSnapshots).values({
    seasonId,
    scope,
    subjectId,
    payload,
    asOf,
    frozen: false,
  });
}

function standingsFingerprint(payload: ChampionshipPayload): string {
  return JSON.stringify({
    provisional: payload.provisional,
    rows: payload.rows.map((row) => ({
      rank: row.rank,
      userId: row.userId,
      handle: row.handle,
      points: row.points,
      wins: row.wins,
      top10: row.top10,
      median: row.median,
      achievedAt: row.achievedAt,
      games: Object.fromEntries(
        Object.entries(row.games)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([id, g]) => [id, { points: g.points, rank: g.rank, provisional: g.provisional }]),
      ),
    })),
  });
}

export async function recomputeSeason(
  db: RankingDatabase,
  clock: Clock,
  seasonId: string,
  options: { force?: boolean } = {},
): Promise<boolean> {
  const season = await db
    .select()
    .from(seasons)
    .where(eq(seasons.id, seasonId))
    .then((r) => r[0]);
  if (!season || season.status === 'closed') return false;
  const dirty = await db
    .select()
    .from(rankingDirty)
    .where(eq(rankingDirty.seasonId, seasonId))
    .then((r) => r[0]);
  const now = clock.now();
  if (!options.force) {
    if (!dirty?.dirtyAt) return false;
    if (
      dirty.lastRecomputedAt &&
      now.getTime() - dirty.lastRecomputedAt.getTime() < RANKING_DIRTY_FLOOR_MS
    ) {
      return false;
    }
  }
  const startedAt = now;
  const sgs = await db.select().from(seasonGames).where(eq(seasonGames.seasonId, seasonId));
  const gamePayloads = new Map<string, GameSnapshotPayload>();
  for (const sg of sgs) {
    const rows = await loadOrderedBests(db, sg.id);
    const payload: GameSnapshotPayload = { asOf: startedAt.toISOString(), rows };
    gamePayloads.set(sg.id, payload);
    const scope = sg.seedPolicy === 'daily-seed' ? 'daily' : 'game';
    await writeLiveSnapshot(db, seasonId, scope, sg.id, payload, startedAt);
  }

  const fixed = sgs.filter((sg) => sg.seedPolicy === 'fixed-course');
  const userIds = new Set<string>();
  const handleByUser = new Map<string, string | null>();
  for (const sg of fixed) {
    for (const row of gamePayloads.get(sg.id)?.rows ?? []) {
      userIds.add(row.userId);
      handleByUser.set(row.userId, row.handle);
    }
  }
  const byUser: (ChampionshipEntrant & { games: ChampionshipRow['games'] })[] = [];
  let anyProvisional = false;
  for (const userId of userIds) {
    const cur: ChampionshipEntrant & { games: ChampionshipRow['games'] } = {
      userId,
      handle: handleByUser.get(userId) ?? null,
      gamePoints: [],
      wins: 0,
      top10: 0,
      totalAchievedAt: new Date(0).toISOString(),
      games: {},
    };
    for (const sg of fixed) {
      const rows = gamePayloads.get(sg.id)?.rows ?? [];
      const n = rows.length;
      const row = rows.find((r) => r.userId === userId);
      if (!row) {
        cur.gamePoints.push(0);
        cur.games[sg.id] = { points: 0, rank: null, provisional: n < 50 };
        continue;
      }
      const pts = championshipPoints(row.rank, n);
      if (pts.provisional) anyProvisional = true;
      cur.gamePoints.push(pts.points);
      if (row.rank === 1) cur.wins += 1;
      if (row.rank <= 10) cur.top10 += 1;
      if (Date.parse(row.achievedAt) > Date.parse(cur.totalAchievedAt)) {
        cur.totalAchievedAt = row.achievedAt;
      }
      cur.games[sg.id] = { points: pts.points, rank: row.rank, provisional: pts.provisional };
    }
    byUser.push(cur);
  }
  const list = byUser.sort(compareChampionship);
  const ranks = rankDense((i, j) => compareChampionship(list[i]!, list[j]!) === 0, list.length);
  const champ: ChampionshipPayload = {
    asOf: startedAt.toISOString(),
    provisional: anyProvisional || list.length === 0,
    rows: list.map((row, i) => ({
      rank: ranks[i]!,
      userId: row.userId,
      handle: row.handle,
      points: row.gamePoints.reduce((s, n) => s + n, 0),
      wins: row.wins,
      top10: row.top10,
      median: integerMedian(row.gamePoints),
      achievedAt: row.totalAchievedAt,
      games: row.games,
    })),
  };
  const existingChamp = await db
    .select()
    .from(rankingSnapshots)
    .where(
      and(
        eq(rankingSnapshots.seasonId, seasonId),
        eq(rankingSnapshots.scope, 'championship'),
        eq(rankingSnapshots.subjectId, seasonId),
        eq(rankingSnapshots.frozen, false),
      ),
    )
    .then((r) => r[0]);
  const previous = existingChamp?.payload as ChampionshipPayload | undefined;
  const standingsChanged =
    !previous || standingsFingerprint(previous) !== standingsFingerprint(champ);
  if (standingsChanged) {
    await writeLiveSnapshot(db, seasonId, 'championship', seasonId, champ, startedAt);
  }
  await db
    .insert(rankingDirty)
    .values({ seasonId, dirtyAt: startedAt, lastRecomputedAt: startedAt })
    .onConflictDoUpdate({
      target: rankingDirty.seasonId,
      set: {
        lastRecomputedAt: startedAt,
        dirtyAt: sql`CASE WHEN ${rankingDirty.dirtyAt} <= ${startedAt} THEN NULL ELSE ${rankingDirty.dirtyAt} END`,
      },
    });
  return true;
}

export async function recomputeAllDirty(db: Database, clock: Clock): Promise<void> {
  const seasonsRows = await db.select({ id: seasons.id }).from(seasons);
  for (const row of seasonsRows) {
    await recomputeSeason(db, clock, row.id);
  }
}

export async function closeSeason(db: Database, clock: Clock, seasonId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const season = await tx
      .select({ status: seasons.status })
      .from(seasons)
      .where(eq(seasons.id, seasonId))
      .for('update')
      .then((rows) => rows[0]);
    if (!season || season.status === 'closed') return;

    await tx.update(seasons).set({ status: 'closing' }).where(eq(seasons.id, seasonId));
    const now = clock.now();
    const inFlight = await tx
      .select({ id: attempts.id })
      .from(attempts)
      .innerJoin(seasonGames, eq(seasonGames.id, attempts.seasonGameId))
      .where(
        and(
          eq(seasonGames.seasonId, seasonId),
          inArray(attempts.status, ['issued', 'active']),
          gt(attempts.expiresAt, now),
          sql`${attempts.issuedAt} + (${ATTEMPT_TTL_SECONDS} * interval '1 second') > ${now}`,
        ),
      )
      .limit(1);
    if (inFlight.length > 0) return;

    await recomputeSeason(tx, clock, seasonId, { force: true });
    await tx
      .update(rankingSnapshots)
      .set({ frozen: true })
      .where(and(eq(rankingSnapshots.seasonId, seasonId), eq(rankingSnapshots.frozen, false)));
    await tx.update(seasons).set({ status: 'closed' }).where(eq(seasons.id, seasonId));
  });
}

async function overlayCurrentHandles<
  T extends { rows: Array<{ userId: string; handle: string | null }> },
>(db: Database, payload: T): Promise<T> {
  const userIds = [...new Set(payload.rows.map((row) => row.userId))];
  if (userIds.length === 0) return payload;
  const currentProfiles = await db
    .select({ userId: profiles.userId, handle: profiles.handle, status: profiles.status })
    .from(profiles)
    .where(inArray(profiles.userId, userIds));
  const currentHandles = new Map(
    currentProfiles.map((profile) => [
      profile.userId,
      profile.status === 'anonymised' ? 'retired' : profile.handle,
    ]),
  );
  return {
    ...payload,
    rows: payload.rows.map((row) => ({
      ...row,
      handle: currentHandles.has(row.userId) ? currentHandles.get(row.userId)! : row.handle,
    })),
  } as T;
}

export async function readLeaderboard(
  db: Database,
  seasonId: string,
  seasonGameId: string,
  query: { cursor?: string; limit?: number; viewerUserId?: string },
): Promise<{
  asOf: string;
  rows: LeaderboardRow[];
  nextCursor: string | null;
  viewer: LeaderboardRow | null;
}> {
  const snap = await db
    .select()
    .from(rankingSnapshots)
    .where(
      and(
        eq(rankingSnapshots.seasonId, seasonId),
        eq(rankingSnapshots.subjectId, seasonGameId),
        inArray(rankingSnapshots.scope, ['game', 'daily']),
      ),
    )
    .orderBy(asc(rankingSnapshots.frozen))
    .limit(1)
    .then((r) => r[0]);
  if (!snap) return { asOf: new Date(0).toISOString(), rows: [], nextCursor: null, viewer: null };
  const payload = await overlayCurrentHandles(db, snap.payload as GameSnapshotPayload);
  const limit = Math.min(
    Math.max(query.limit ?? LEADERBOARD_PAGE_DEFAULT, 1),
    LEADERBOARD_PAGE_MAX,
  );
  let cursor: LeaderboardCursor | undefined;
  if (query.cursor) {
    cursor = decodeCursor(query.cursor);
    if (!cursor) throw new ApiError('BAD_CURSOR');
  }
  const filtered = cursor
    ? payload.rows.filter((row) =>
        afterCursor(BigInt(row.score), new Date(row.achievedAt), row.userId, cursor),
      )
    : payload.rows;
  const page = filtered.slice(0, limit);
  const last = page[page.length - 1];
  const nextCursor =
    page.length === limit && last
      ? encodeCursor({ score: last.score, achievedAt: last.achievedAt, userId: last.userId })
      : null;
  const viewer = query.viewerUserId
    ? (payload.rows.find((row) => row.userId === query.viewerUserId) ?? null)
    : null;
  return { asOf: payload.asOf, rows: page, nextCursor, viewer };
}

export async function readStandings(db: Database, seasonId: string): Promise<ChampionshipPayload> {
  const snap = await db
    .select()
    .from(rankingSnapshots)
    .where(
      and(
        eq(rankingSnapshots.seasonId, seasonId),
        eq(rankingSnapshots.scope, 'championship'),
        eq(rankingSnapshots.subjectId, seasonId),
      ),
    )
    .orderBy(asc(rankingSnapshots.frozen))
    .limit(1)
    .then((r) => r[0]);
  if (!snap) {
    return { asOf: new Date(0).toISOString(), provisional: true, rows: [] };
  }
  return overlayCurrentHandles(db, snap.payload as ChampionshipPayload);
}
