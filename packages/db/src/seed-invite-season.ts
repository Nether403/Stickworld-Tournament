import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createDirectPool, createDb } from './client.js';
import { loadWorkspaceEnv } from './env.js';
import { buildInviteSeasonSeedPlan, parseInviteEmails, seedInviteSeason } from './seed.js';

function optionValue(args: readonly string[], name: string): string {
  const index = args.indexOf(name);
  const value = index >= 0 ? args[index + 1] : undefined;
  if (!value || value.startsWith('--')) throw new Error(`missing required ${name}`);
  return value;
}

function parseUtcDate(value: string): Date {
  if (!/(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    throw new Error('--starts-at must include a UTC offset');
  }
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new Error('--starts-at must be a valid timestamp');
  return parsed;
}

function usage(): string {
  return [
    'usage: pnpm --filter @stickworld/db seed:invite-season --',
    '  --slug <internal-0|beta-0> --starts-at <ISO timestamp> --invite-file <path> [--apply]',
  ].join(' ');
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log(usage());
    return;
  }

  const slug = optionValue(args, '--slug');
  const startsAt = parseUtcDate(optionValue(args, '--starts-at'));
  const invitePath = resolve(optionValue(args, '--invite-file'));
  const inviteEmails = parseInviteEmails(readFileSync(invitePath, 'utf8'));
  const plan = buildInviteSeasonSeedPlan({ slug, startsAt, inviteEmails });
  const summary = {
    slug: plan.season.slug,
    startsAt: plan.season.startsAt.toISOString(),
    endsAt: plan.season.endsAt.toISOString(),
    entryPolicy: plan.season.entryPolicy,
    rulesVersion: plan.season.rulesVersion,
    inviteCount: plan.inviteEmails.length,
    championshipRegistryIds: plan.games
      .filter((game) => game.seedPolicies.includes('fixed-course'))
      .map((game) => game.registryId),
    weeklyRegistryIds: plan.games
      .filter((game) => game.seedPolicies.includes('weekly-seed'))
      .map((game) => game.registryId),
  };
  console.log(JSON.stringify(summary, null, 2));

  if (!args.includes('--apply')) {
    console.log('dry run only; pass --apply with STICKWORLD_SEED_INVITE_SEASON=1 to write');
    return;
  }
  if (process.env.STICKWORLD_SEED_INVITE_SEASON !== '1') {
    throw new Error('refusing write without STICKWORLD_SEED_INVITE_SEASON=1');
  }

  loadWorkspaceEnv();
  const pool = createDirectPool();
  const db = createDb(pool);
  try {
    await seedInviteSeason(db, { slug, startsAt, inviteEmails });
  } finally {
    await pool.end();
  }
  console.log(`seeded ${plan.season.slug}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  console.error(usage());
  process.exitCode = 1;
});
