import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const attemptStatus = pgEnum('attempt_status', [
  'issued',
  'active',
  'submitted',
  'abandoned',
  'expired',
]);
export const verificationStatus = pgEnum('verification_status', [
  'pending',
  'verified',
  'rejected',
]);
export const jobState = pgEnum('job_state', ['queued', 'locked', 'done', 'failed']);
export const seasonStatus = pgEnum('season_status', ['scheduled', 'active', 'closing', 'closed']);
export const seedPolicy = pgEnum('seed_policy', ['fixed-course', 'daily-seed', 'weekly-seed']);
export const snapshotScope = pgEnum('snapshot_scope', ['game', 'championship', 'daily', 'best6']);
export const profileStatus = pgEnum('profile_status', ['active', 'suspended', 'anonymised']);
export const profileRole = pgEnum('profile_role', ['player', 'moderator']);
export const seasonEntryPolicy = pgEnum('season_entry_policy', ['invite', 'open']);
export const ugcReportStatus = pgEnum('ugc_report_status', ['open', 'dismissed', 'actioned']);
export const moderationActionType = pgEnum('moderation_action', [
  'dismiss',
  'force_release_handle',
  'suspend',
  'unsuspend',
]);

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return 'bytea';
  },
});

const citext = customType<{ data: string; driverData: string }>({
  dataType() {
    return 'citext';
  },
});

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
};

export const profiles = pgTable('profiles', {
  userId: uuid('user_id').primaryKey().defaultRandom(),
  authUserId: text('auth_user_id').notNull().unique(),
  handle: citext('handle').unique(),
  handleClaimedAt: timestamp('handle_claimed_at', { withTimezone: true }),
  handleChangedAt: timestamp('handle_changed_at', { withTimezone: true }),
  status: profileStatus('status').notNull().default('active'),
  role: profileRole('role').notNull().default('player'),
  email: citext('email').unique(),
  ...timestamps,
});

export const seasons = pgTable('seasons', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
  status: seasonStatus('status').notNull(),
  rulesVersion: integer('rules_version').notNull(),
  entryPolicy: seasonEntryPolicy('entry_policy').notNull().default('open'),
  ...timestamps,
});

export const rankedInvites = pgTable('ranked_invites', {
  email: citext('email').primaryKey(),
  invitedAt: timestamp('invited_at', { withTimezone: true }).notNull(),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
  consumedUserId: uuid('consumed_user_id').references(() => profiles.userId),
});

export const ugcReports = pgTable(
  'ugc_reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reporterUserId: uuid('reporter_user_id').references(() => profiles.userId),
    reporterIpHash: text('reporter_ip_hash').notNull(),
    targetUserId: uuid('target_user_id')
      .notNull()
      .references(() => profiles.userId),
    reasonCode: text('reason_code').notNull(),
    details: text('details').notNull().default(''),
    status: ugcReportStatus('status').notNull().default('open'),
    ...timestamps,
  },
  (t) => [index('ugc_reports_queue').on(t.status, t.createdAt)],
);

export const moderationActions = pgTable(
  'moderation_actions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reportId: uuid('report_id').references(() => ugcReports.id),
    actorUserId: uuid('actor_user_id')
      .notNull()
      .references(() => profiles.userId),
    targetUserId: uuid('target_user_id')
      .notNull()
      .references(() => profiles.userId),
    action: moderationActionType('action').notNull(),
    reasonCode: text('reason_code').notNull(),
    reasonText: text('reason_text').notNull(),
    ...timestamps,
  },
  (t) => [index('moderation_actions_target').on(t.targetUserId, t.createdAt)],
);

export const games = pgTable(
  'games',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull().unique(),
    registryId: integer('registry_id').notNull().unique(),
    ...timestamps,
  },
  (t) => [check('games_registry_id_u16', sql`${t.registryId} >= 0 AND ${t.registryId} <= 65535`)],
);

export const gameVersions = pgTable(
  'game_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id),
    gameVersion: text('game_version').notNull(),
    simulationVersion: integer('simulation_version').notNull(),
    scoringVersion: integer('scoring_version').notNull(),
    rapierBuildHash: text('rapier_build_hash').notNull(),
    detmathVersion: integer('detmath_version').notNull(),
    replayFormatVersion: integer('replay_format_version').notNull(),
    configJson: jsonb('config_json')
      .notNull()
      .default(sql`'{}'::jsonb`),
    releasedAt: timestamp('released_at', { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [
    unique('game_versions_pin').on(t.gameId, t.gameVersion, t.simulationVersion, t.scoringVersion),
    check('game_versions_hash_len', sql`length(${t.rapierBuildHash}) = 64`),
  ],
);

export const seasonGames = pgTable(
  'season_games',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    seasonId: uuid('season_id')
      .notNull()
      .references(() => seasons.id),
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id),
    gameVersionId: uuid('game_version_id')
      .notNull()
      .references(() => gameVersions.id),
    seedPolicy: seedPolicy('seed_policy').notNull(),
    activeFrom: timestamp('active_from', { withTimezone: true }).notNull(),
    activeTo: timestamp('active_to', { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [unique('season_games_unique').on(t.seasonId, t.gameId, t.seedPolicy)],
);

export const attempts = pgTable(
  'attempts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.userId),
    seasonGameId: uuid('season_game_id')
      .notNull()
      .references(() => seasonGames.id),
    gameVersionId: uuid('game_version_id')
      .notNull()
      .references(() => gameVersions.id),
    seed: bytea('seed').notNull(),
    nonce: bytea('nonce').notNull().unique(),
    issuedAt: timestamp('issued_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    status: attemptStatus('status').notNull().default('issued'),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    check('attempts_seed_len', sql`octet_length(${t.seed}) = 16`),
    check('attempts_nonce_len', sql`octet_length(${t.nonce}) = 16`),
    index('attempts_user_issued').on(t.userId, t.issuedAt.desc()),
  ],
);

export const runs = pgTable(
  'runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    attemptId: uuid('attempt_id')
      .notNull()
      .unique()
      .references(() => attempts.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.userId),
    claimedScore: bigint('claimed_score', { mode: 'bigint' }).notNull(),
    totalTicks: integer('total_ticks').notNull(),
    replay: bytea('replay').notNull(),
    finalStateHash: bytea('final_state_hash').notNull(),
    ...timestamps,
  },
  (t) => [
    check('runs_ticks_positive', sql`${t.totalTicks} > 0`),
    check('runs_hash_len', sql`octet_length(${t.finalStateHash}) = 8`),
  ],
);

export const scoreSubmissions = pgTable('score_submissions', {
  runId: uuid('run_id')
    .primaryKey()
    .references(() => runs.id),
  verificationStatus: verificationStatus('verification_status').notNull().default('pending'),
  reasonCode: text('reason_code'),
  firstDivergentTick: integer('first_divergent_tick'),
  verifiedScore: bigint('verified_score', { mode: 'bigint' }),
  verifiedHash: bytea('verified_hash'),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  ...timestamps,
});

export const verifiedResults = pgTable(
  'verified_results',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.userId),
    seasonGameId: uuid('season_game_id')
      .notNull()
      .references(() => seasonGames.id),
    runId: uuid('run_id')
      .notNull()
      .unique()
      .references(() => runs.id),
    score: bigint('score', { mode: 'bigint' }).notNull(),
    tiebreakMetrics: jsonb('tiebreak_metrics')
      .notNull()
      .default(sql`'{}'::jsonb`),
    achievedAt: timestamp('achieved_at', { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [index('verified_results_board').on(t.seasonGameId, t.score.desc(), t.achievedAt.asc())],
);

export const gameBests = pgTable(
  'game_bests',
  {
    seasonGameId: uuid('season_game_id')
      .notNull()
      .references(() => seasonGames.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.userId),
    verifiedResultId: uuid('verified_result_id')
      .notNull()
      .references(() => verifiedResults.id),
    score: bigint('score', { mode: 'bigint' }).notNull(),
    ...timestamps,
  },
  (t) => [
    primaryKey({ columns: [t.seasonGameId, t.userId] }),
    index('game_bests_board').on(t.seasonGameId, t.score.desc()),
  ],
);

export const rankingSnapshots = pgTable(
  'ranking_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    seasonId: uuid('season_id')
      .notNull()
      .references(() => seasons.id),
    scope: snapshotScope('scope').notNull(),
    subjectId: uuid('subject_id').notNull(),
    payload: jsonb('payload').notNull(),
    asOf: timestamp('as_of', { withTimezone: true }).notNull(),
    frozen: boolean('frozen').notNull().default(false),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('ranking_snapshots_live')
      .on(t.seasonId, t.scope, t.subjectId)
      .where(sql`${t.frozen} = false`),
  ],
);

export const rankingDirty = pgTable('ranking_dirty', {
  seasonId: uuid('season_id')
    .primaryKey()
    .references(() => seasons.id),
  dirtyAt: timestamp('dirty_at', { withTimezone: true }),
  lastRecomputedAt: timestamp('last_recomputed_at', { withTimezone: true }),
  ...timestamps,
});

export const verificationJobs = pgTable(
  'verification_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    runId: uuid('run_id')
      .notNull()
      .unique()
      .references(() => runs.id),
    state: jobState('state').notNull().default('queued'),
    attempts: integer('attempts').notNull().default(0),
    lockedAt: timestamp('locked_at', { withTimezone: true }),
    lockedBy: text('locked_by'),
    lastError: text('last_error'),
    ...timestamps,
  },
  (t) => [index('jobs_claim').on(t.state, t.id)],
);

export const auditEvents = pgTable('audit_events', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  actor: uuid('actor'),
  action: text('action').notNull(),
  target: text('target').notNull(),
  requestMeta: jsonb('request_meta')
    .notNull()
    .default(sql`'{}'::jsonb`),
  ...timestamps,
});

export const dailyBoards = pgTable(
  'daily_boards',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    seasonGameId: uuid('season_game_id')
      .notNull()
      .references(() => seasonGames.id),
    utcDate: date('utc_date', { mode: 'string' }).notNull(),
    seed: bytea('seed').notNull(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    unique('daily_boards_unique').on(t.seasonGameId, t.utcDate),
    check('daily_boards_seed_len', sql`octet_length(${t.seed}) = 16`),
  ],
);

export const rateLimitHits = pgTable(
  'rate_limit_hits',
  {
    key: text('key').notNull(),
    windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
    count: integer('count').notNull(),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] })],
);

export const schema = {
  attemptStatus,
  verificationStatus,
  jobState,
  seasonStatus,
  seedPolicy,
  snapshotScope,
  profileStatus,
  profileRole,
  seasonEntryPolicy,
  ugcReportStatus,
  moderationActionType,
  profiles,
  seasons,
  rankedInvites,
  ugcReports,
  moderationActions,
  games,
  gameVersions,
  seasonGames,
  attempts,
  runs,
  scoreSubmissions,
  verifiedResults,
  gameBests,
  rankingSnapshots,
  rankingDirty,
  verificationJobs,
  auditEvents,
  dailyBoards,
  rateLimitHits,
};
