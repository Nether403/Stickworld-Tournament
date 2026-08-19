import { describe, expect, it } from 'vitest';
import {
  buildCiSeasonSeedPlan,
  buildInviteSeasonSeedPlan,
  parseInviteEmails,
} from '../src/seed.js';

const startsAt = new Date('2026-09-01T00:00:00.000Z');

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
});
