# Spec 2 — Tournament Platform and Ranking

**Status:** full-depth design written; **awaiting human approval before execution**
**Depth:** complete (design.md + tasks.md match Spec 1 style)
**Covers:** Plan tasks 5–9, 11, 13
**Depends on:** Spec 1 complete and merged (PR #1, Branch A)
**Blocks:** Spec 3
**Stack:** `docs/adr/0004-spec2-platform-stack.md`

---

## Why this spec is now full depth

Spec 1 landed on **Branch A** (`docs/adr/0001-determinism-fork.md`): Node, Chromium,
Firefox, and WebKit are bit-identical on `stress-01`. The verification worker stays
Node. No fork revision of Specs 2–5 is required on the determinism axis.

The earlier scope draft was **not enough to implement from** (it said so: no DDL,
no numeric limits, no HMAC format, no rate numbers, no package layout). This
revision supplies that. Do not write `apps/web`, Drizzle, or Neon project code
until this spec is approved.

---

## Requirements

### R1 — Schema as source of truth

1. Postgres on Neon SHALL be the sole source of truth. Every derived structure —
   leaderboard snapshots, championship standings, caches — SHALL be reconstructable
   from base tables.
2. Tables SHALL exist exactly as named in design.md §4: `profiles`, `seasons`,
   `games`, `game_versions`, `season_games`, `attempts`, `runs`,
   `score_submissions`, `verified_results`, `game_bests`, `ranking_snapshots`,
   `ranking_dirty`, `verification_jobs`, `audit_events`, `daily_boards`,
   `rate_limit_hits`.
3. `attempt`, `run`, and `personal best` SHALL be strictly distinct concepts. A
   player may abandon an attempt; a completed attempt becomes a run; **only a
   verified run may become a personal best.** Trigger `assert_verified_run` SHALL
   enforce that last clause. Application code is not sufficient.
4. Replays SHALL be stored as gzip-compressed `bytea` on `runs`, not in object
   storage. Neon's Object Storage is Beta and SHALL be kept off the
   integrity-critical path. Compressed size SHALL be ≤ 64 KiB
   (`MAX_REPLAY_COMPRESSED_BYTES`).
5. `ranked_score` / `claimed_score` / `verified_score` / `score` SHALL be `bigint`,
   matching the replay header's `int64`.
6. Every attempt SHALL record the exact `game_version_id`, 16-byte seed, and
   Rapier build hash (via the pinned `game_versions` row) it was issued against,
   so any historical run remains re-simulable. Issued seeds SHALL reject all-zero.
7. Rejected and superseded runs SHALL be retained for audit and investigation,
   never deleted on the write path.
8. Seed data SHALL register Test Chamber (`games.slug = 'test-chamber'`,
   `registry_id = 0`) with `game_versions` pinned to Spec 1 constants, plus one
   `fixed-course` and one `daily-seed` `season_games` row on season `ci`.
9. Every table SHALL have `created_at timestamptz not null default now()`, except
   `rate_limit_hits` (windowed counter) and `ranking_dirty` (uses `dirty_at`).

### R2 — Migrations and Neon branching

1. Migrations SHALL be versioned, reviewed, and applied through Drizzle Kit in
   `packages/db`. Direct (non-pooled) URL for migrations; pooled `pg` URL for the
   app and worker.
2. CI SHALL create a Neon database branch per pull request, apply migrations to
   it, run schema and ranking tests against it, and tear it down. Missing secrets
   on a fork SHALL skip with an explicit message; this repository's CI SHALL
   require them.
3. Ranking recomputation SHALL be testable against production-shaped data on a
   branch without touching production. This is the primary reason Neon was chosen
   and it SHALL be exercised.
4. Long-lived Railway processes SHALL connect via the pooled (PgBouncer)
   connection string using `node-postgres` (`pg`). Transaction-mode pooler
   limitations SHALL be accounted for in migration tooling, which uses the
   direct connection.
5. Production Neon compute autosuspend SHALL be **off**. Preview/CI branches MAY
   autosuspend. Recorded in ADR-0004.

### R3 — Identity

1. Authentication SHALL use Neon Managed Better Auth with OAuth providers
   **Google and GitHub** only at launch (ADR-0004). Discord is **not** a Neon
   CLI first-party provider (`google` | `github` | `vercel` as of 2026-08-18
   docs) and SHALL NOT be added in this spec. Email/password and magic-link
   SHALL remain out of scope.
2. Confirm during setup (one line in ADR-0004 if new): Neon Auth can send email,
   and Spec 2 still does not use it.
3. An internal `profiles.user_id` UUID SHALL be the primary key everywhere; the
   provider identity SHALL be `profiles.auth_user_id` (unique, mapped), so auth
   stays loosely coupled and replaceable.
4. Handles SHALL be unique, 3–20 chars, match `HANDLE_PATTERN`, checked against
   the reserved-word list, and rejected when NFKC(form) ≠ input.
5. Guests MAY play practice mode later (Spec 3). Ranked attempts SHALL require a
   session **and** a claimed handle. Unauthenticated ranked routes return
   `UNAUTHENTICATED`.
6. Changing handle SHALL be allowed at most once per 30 days
   (`HANDLE_CHANGE_COOLDOWN_DAYS`, `profiles.handle_changed_at`). First claim
   counts as the change.

### R4 — Attempt issuance

1. `POST /v1/games/:gameId/attempts` SHALL return `attemptId`, a server-generated
   128-bit seed as four uint32, `gameVersion`, `expiresAt`
   (`now() + ATTEMPT_TTL_SECONDS`), HMAC-signed `token` bound to user and game
   version, and `dailyCapRemaining`. `:gameId` is the slug (`test-chamber`).
2. The client SHALL NOT choose or influence the seed. RNG is `crypto.getRandomValues`
   in the API process only, never in sim-core.
3. Each attempt SHALL carry a single-use 16-byte `nonce`. Reuse SHALL be rejected
   (`ATTEMPT_CONSUMED`).
4. Rate limits SHALL be exactly: 10 issues / user / minute, 60 / user / hour,
   30 / IP / minute; 20 finishes / user / minute. Daily ranked cap SHALL be 5
   attempts per user per game per UTC day (`DAILY_ATTEMPT_CAP`).
5. WHEN an attempt is expired, already consumed, belongs to another user, targets
   the wrong season or game version, or carries a tampered token, THEN issuance
   or submission SHALL be rejected with a distinct internal reason. Externally,
   `WRONG_USER`, `ATTEMPT_NOT_FOUND`, and `FORBIDDEN` SHALL share the message
   "Attempt not found".
6. Token format SHALL be `base64url(json).base64url(hmac_sha256_utf8(json, secret))`
   with `ATTEMPT_HMAC_SECRET` and optional `ATTEMPT_HMAC_SECRET_PREV`. Secrets
   SHALL never be committed.

### R5 — Submission and verification

1. `POST /v1/attempts/:attemptId/finish` SHALL accept `{ token, replay, claimedScore }`
   where `replay` is base64 of gzip SWR1 and `claimedScore` is a decimal string.
2. **Every ranked run SHALL be verified by re-simulation** via
   `@stickworld/replay` `decodeReplay` + `playReplay` and the Test Chamber
   registry map (`registry_id = 0`). No tiered "elite scores only" model, and no
   ML anomaly detection.
3. Cheap checks SHALL run synchronously before enqueueing: schema, ownership,
   expiry, nonce, replay size, HMAC, input cadence (design §6), duration bounds,
   score envelope (`SCORE_ENVELOPE_ABS`).
4. The queue SHALL be `verification_jobs` consumed with
   `SELECT ... FOR UPDATE SKIP LOCKED`. No Redis, no third vendor. Railway is the
   only worker host. Worker concurrency SHALL be 1. No Rapier WASM in the API
   process.
5. The worker SHALL decode the replay, load the exact pinned game version and
   Rapier build, re-simulate, and compare recomputed score **and** final state
   hash.
6. The rejection reason taxonomy SHALL be design.md §6 (Spec 1 §8.5 plus
   platform codes). Reasons SHALL be specific enough to explain to a player and
   to investigate with.
7. Verification SHALL be idempotent. A worker crash mid-job SHALL release the
   lock (stale after 2 minutes) and retry without double-crediting. After 5
   claim attempts the job SHALL become `failed` and the submission `rejected`
   with `WORKER_FAULT`. A verified row SHALL never be written for that path.
8. The client's claimed score SHALL NOT be trusted for any purpose except
   producing a diff for the rejection reason. Honest Test Chamber fixture
   `packages/game-test-chamber/fixtures/sample.swr` SHALL verify to score **302**
   and hash **`e6ee35729a0c77b3`** (or a later golden committed with an ADR).

### R6 — Per-game leaderboards

1. Leaderboard eligibility SHALL be a player's best **verified** score for a
   `season_game` (`game_bests`).
2. Ranking SHALL be score descending, then that game's published tiebreakers,
   then `achieved_at`. Spec 2 Test Chamber declares no extra tiebreakers.
3. `RANK()` SHALL be used so genuine ties share a place.
4. Reads SHALL be served from `ranking_snapshots` with `asOf`. A test SHALL prove
   drop-and-rebuild is byte-identical. Request path SHALL NOT run live window
   functions.
5. Index `(season_game_id, score DESC, achieved_at ASC)`. Pagination SHALL be
   keyset (`cursor` + `limit`, default 50, max 100) as in design §8.1. The
   viewer's rank row SHALL be present even when they are not on the current page.

### R7 — Championship ranking

1. Each **fixed-course** season game SHALL contribute 0–1,000 points toward the
   championship. Daily-seed games SHALL NOT contribute.
2. Points SHALL use the **hybrid** model in `docs/competitive-spec.md` §11
   (that file wins):
   - Top 100 per game: `1000 - floor(((rank - 1) * 100) / 99)` (1st = 1000,
     100th = 900).
   - Rank ≥ 101: `floor(899 * (N - rank) / (N - 100))` (last place 0).
3. Rationale, recorded so it is not relitigated: pure percentile is unstable
   (your points move when others play and you do not) and pool-size sensitive
   (first of 20 earns the same as first of 20,000). The hybrid is stable where
   the championship is decided and smooth in the tail. A churn test SHALL prove
   top-100 points are unchanged by tail-only inserts.
4. A game SHALL contribute championship points only at **≥50 verified entrants**;
   below that it SHALL display as provisional (points 0).
5. Non-participation SHALL score 0. Spec 2's live season has one fixed-course
   game (Test Chamber). Championship math SHALL still be written over the
   season's fixed-course set; tests for ten-game totals inject synthetic
   `season_games`.
6. Overall tiebreakers, in published order: most game wins → most top-10
   finishes → highest integer median of that season's fixed-course game point
   totals (design §10.1) → earliest achievement of the total.
7. Standings SHALL be recomputed from `ranking_dirty` with a 30-second floor
   plus an hourly cron safety net, and SHALL always be labelled `asOf`.
8. An immutable snapshot SHALL be frozen at season close (`frozen = true`) and
   SHALL never change afterward.
9. A secondary "Best 6 of 10" ladder SHALL NOT ship in Spec 2. `snapshot_scope`
   MAY include unused `best6`.

### R8 — Daily seeded ladder

1. A second ranked format SHALL exist alongside the fixed-course championship.
2. Daily seeds SHALL be server-issued per game (`daily_boards`), with their own
   leaderboards and their own snapshots.
3. A per-day attempt cap of 5 SHALL be enforced (`DAILY_ATTEMPT_CAP`).
4. Yesterday's board SHALL be archived immutably at the UTC boundary
   (`archived_at`).
5. **Daily results SHALL NOT affect championship standings.** A test SHALL prove
   championship snapshot bytes are unchanged after a verified daily run.

### R9 — Version pinning

1. Each season SHALL pin `game_version`, `simulation_version`, `scoring_version`,
   and the Rapier build hash via `season_games.game_version_id`.
2. Any competition-affecting change SHALL create a new version and a new
   leaderboard rather than mutating an active one. Cosmetic changes SHALL ship
   freely.
3. Physics constants, gravity, collision geometry, scoring formulas, and
   procedural generation rules SHALL NOT change silently during an active season.

---

## Out of scope for Spec 2

- Phaser rendering, art, audio, touch controls (Spec 3)
- Any of the ten shipping games (Specs 3–4)
- Deployment dashboards, observability, backups beyond Neon branch-per-PR (Spec 5)
- Moderation queue and DSA notice-and-action mechanics (Spec 5) — though
  `audit_events` and handle validation land here
- Redis, object storage, CDN — deliberately excluded at launch
- Discord login, email/password, magic-link
- Best 6 of 10 UI or ranking

---

## Definition of done

- [ ] Migrations apply and roll back cleanly on a fresh Neon branch; branch-per-PR live in CI
- [ ] Sign-in works with Google (and GitHub in production credentials); a handle can be claimed; a second user cannot take it
- [ ] An attempt can be issued, and every rejection path returns a distinct internal reason
- [ ] An honest Test Chamber run verifies to the committed golden; an inflated claimed score is rejected; a tampered input stream is rejected with a first-divergence location
- [ ] A worker killed mid-job retries without double-crediting
- [ ] Per-game leaderboard correct on ordering, ties, and "my rank"; snapshot rebuild identical
- [ ] Championship hybrid points correct at the 100th-place boundary and the 50-entrant gate;
      top-100 points provably stable under tail-only churn
- [ ] Daily ladder rotates at UTC, enforces its cap, archives, and provably does not touch the
      championship
- [ ] No OAuth client secrets or HMAC secrets are committed

---

## Notes (not SHALL)

- Ranked gameplay in Spec 2 is Test Chamber plus a thin authenticated shell.
  Phaser clients arrive in Spec 3 against the same `/v1` routes.
- Discord login is deferred until Neon ships it as a managed first-party
  provider (`provider-id`), or a later spec adds a second auth vendor (not this spec).
