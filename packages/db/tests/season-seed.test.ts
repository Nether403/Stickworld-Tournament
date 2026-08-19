import { describe, expect, it } from 'vitest';
import {
  buildCiSeasonSeedPlan,
  buildInviteSeasonSeedPlan,
  parseInviteEmails,
  seedInviteSeason,
} from '../src/seed.js';
import {
  dailyBoards,
  gameVersions,
  games,
  rankedInvites,
  seasonGames,
  seasons,
} from '../src/schema.js';

const startsAt = new Date('2026-09-01T00:00:00.000Z');

function createMemorySeedDb() {
  type Row = Record<string, unknown>;

  const rows = new Map<object, Row[]>();
  let currentSeasonId: string | undefined;
  let lastValues = new Map<object, Row>();
  let nextId = 0;

  const tableRows = (table: object): Row[] => {
    const existing = rows.get(table);
    if (existing) return existing;
    const created: Row[] = [];
    rows.set(table, created);
    return created;
  };

  const uniqueKeys = (table: object, row: Row): unknown[] => {
    if (table === seasons) return [row.slug];
    if (table === games) return [row.slug];
    if (table === gameVersions) return [row.gameId, row.gameVersion];
    if (table === seasonGames) return [row.seasonId, row.gameId, row.seedPolicy];
    if (table === rankedInvites) return [row.email];
    if (table === dailyBoards) return [row.seasonGameId, row.utcDate];
    return [row.id];
  };

  const sameKey = (table: object, left: Row, right: Row): boolean => {
    const leftKeys = uniqueKeys(table, left);
    const rightKeys = uniqueKeys(table, right);
    return leftKeys.every((value, index) => value === rightKeys[index]);
  };

  const db = {
    transaction: async <T>(callback: (tx: typeof db) => Promise<T>): Promise<T> => callback(db),
    delete: async (table: object): Promise<void> => {
      rows.set(table, []);
    },
    insert: (table: object) => ({
      values: (input: Row | Row[]) => {
        const values = Array.isArray(input) ? input : [input];
        const inserted: Row[] = [];
        for (const value of values) {
          lastValues.set(table, value);
          const existing = tableRows(table).find((row) => sameKey(table, row, value));
          if (existing) continue;
          const row = { id: `row-${++nextId}`, ...value };
          tableRows(table).push(row);
          inserted.push(row);
          if (table === seasons) currentSeasonId = String(row.id);
        }
        const result = Promise.resolve();
        return {
          onConflictDoNothing: () =>
            Object.assign(result, {
              returning: async () => inserted,
            }),
        };
      },
    }),
    select: () => ({
      from: (table: object) => ({
        where: async () => {
          if (table === seasonGames) {
            return tableRows(table).filter((row) => row.seasonId === currentSeasonId);
          }
          const expected = lastValues.get(table);
          return expected
            ? tableRows(table).filter((row) => sameKey(table, row, expected))
            : tableRows(table);
        },
      }),
    }),
  };

  return {
    db: db as unknown as Parameters<typeof seedInviteSeason>[0],
    inviteEmails: () => tableRows(rankedInvites).map((row) => String(row.email)),
  };
}

describe('season seed plans', () => {
  it('keeps the default CI season open', () => {
    const plan = buildCiSeasonSeedPlan();

    expect(plan.season).toMatchObject({
      slug: 'ci',
      entryPolicy: 'open',
      rulesVersion: 1,
      status: 'active',
    });
  });

  it('builds internal-0 as a seven-day invite season', () => {
    const plan = buildInviteSeasonSeedPlan({
      slug: 'internal-0',
      startsAt,
      inviteEmails: ['Staff.One@example.com', 'staff.two@example.com'],
    });

    expect(plan.season).toMatchObject({
      slug: 'internal-0',
      entryPolicy: 'invite',
      rulesVersion: 2,
      status: 'active',
    });
    expect(plan.season.endsAt.toISOString()).toBe('2026-09-08T00:00:00.000Z');
    expect(plan.inviteEmails).toEqual(['staff.one@example.com', 'staff.two@example.com']);
  });

  it('builds beta-0 with exactly 24 invites and a fourteen-day window', () => {
    const inviteEmails = Array.from({ length: 24 }, (_, index) => `beta-${index + 1}@example.com`);
    const plan = buildInviteSeasonSeedPlan({
      slug: 'beta-0',
      startsAt,
      inviteEmails,
    });

    expect(plan.season).toMatchObject({
      slug: 'beta-0',
      entryPolicy: 'invite',
      rulesVersion: 2,
      status: 'active',
    });
    expect(plan.season.endsAt.toISOString()).toBe('2026-09-15T00:00:00.000Z');
    expect(plan.inviteEmails).toHaveLength(24);
  });

  it('rejects a beta plan unless it has exactly 24 unique invites', () => {
    expect(() =>
      buildInviteSeasonSeedPlan({
        slug: 'beta-0',
        startsAt,
        inviteEmails: ['one@example.com'],
      }),
    ).toThrow('beta-0 requires exactly 24 unique invite emails');
  });

  it('cannot plan a public season', () => {
    expect(() =>
      buildInviteSeasonSeedPlan({
        slug: 'season-1',
        startsAt,
        inviteEmails: ['operator@example.com'],
      }),
    ).toThrow('supported slugs are internal-0 and beta-0');
  });

  it('seeds nine fixed-course championship games and keeps Pogo weekly-only', () => {
    const plan = buildInviteSeasonSeedPlan({
      slug: 'internal-0',
      startsAt,
      inviteEmails: ['operator@example.com'],
    });
    const fixedRegistryIds = plan.games
      .filter((game) => game.seedPolicies.includes('fixed-course'))
      .map((game) => game.registryId);
    const pogo = plan.games.find((game) => game.slug === 'pogo-tower');

    expect(fixedRegistryIds).toEqual([1, 2, 3, 4, 5, 7, 8, 9, 10]);
    expect(pogo?.seedPolicies).toEqual(['weekly-seed']);
  });

  it('replaces internal invites with exactly the beta invite file', async () => {
    const memory = createMemorySeedDb();
    const staffEmails = ['staff.one@example.com', 'staff.two@example.com'];
    const betaEmails = Array.from(
      { length: 24 },
      (_, index) => `beta-${index + 1}@example.com`,
    );

    await seedInviteSeason(memory.db, {
      slug: 'internal-0',
      startsAt,
      inviteEmails: staffEmails,
    });
    expect(memory.inviteEmails()).toEqual(staffEmails);

    await seedInviteSeason(memory.db, {
      slug: 'beta-0',
      startsAt,
      inviteEmails: betaEmails,
    });

    expect(memory.inviteEmails()).toHaveLength(24);
    expect(memory.inviteEmails()).toEqual(betaEmails);
    expect(memory.inviteEmails()).not.toContain(staffEmails[0]);
    expect(memory.inviteEmails()).not.toContain(staffEmails[1]);
  });
});

describe('invite email parsing', () => {
  it('normalises lines, ignores comments, and rejects duplicates', () => {
    expect(
      parseInviteEmails('# staff only\n Staff.One@example.com \n\nsecond@example.com\n'),
    ).toEqual(['staff.one@example.com', 'second@example.com']);
    expect(() => parseInviteEmails('same@example.com\nSAME@example.com\n')).toThrow(
      'duplicate invite email',
    );
  });

  it('reports an invalid invite by index without exposing its address', () => {
    const invalidAddress = 'private-address';

    expect(() => parseInviteEmails(`${invalidAddress}\n`)).toThrow('invalid invite email at index 1');
    expect(() => parseInviteEmails(`${invalidAddress}\n`)).not.toThrow(invalidAddress);
  });
});
