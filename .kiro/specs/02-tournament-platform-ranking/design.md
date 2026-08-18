# Spec 2 — Design

**Depth:** full. This document is detailed enough to implement from directly.
**Fork:** Branch A (ADR-0001). Worker is Node. Schema and API are unchanged by the fork.
**Stack decisions:** ADR-0004.
**Do not execute until approved.**

The previous scope draft was not enough to build from: it named entities and
APIs but omitted DDL, numeric limits, HMAC format, rate numbers, package layout,
and the Next vs Fastify / Drizzle vs Prisma choices. Those are now in this file
and in `tasks.md` (Tasks 1–7).

---

## 1. Design principle

> The server, not the client, defines what a competitive run is. Postgres is the
> source of truth. Verification is Spec 1's `decode → playReplay` wrapped in a
> queue, not a second physics engine.

Phaser, React, and Next stay out of `sim-core`. The worker's only game dependency
in Spec 2 is `@stickworld/game-test-chamber`. Later games register in a module
map; they do not fork the pipeline.

---

## 2. Repository layout (what Spec 2 adds)

```
apps/
  web/                     # Next.js App Router: shell + /v1/* route handlers
  worker/                  # Node: verification + ranking recompute + cron entry
packages/
  db/                      # Drizzle schema, migrations, seed
  platform/                # reason codes, attempt token, ranking math, game registry
```

`packages/platform` is pure TypeScript with tests. It may import
`@stickworld/sim-core` and `@stickworld/replay`. It may not import Next, Phaser,
or `node:fs` except in tests.

`pnpm-workspace.yaml` gains `'apps/*'`.

Exact pins (competition-adjacent where noted; all exact, no `^`):

| package | version |
|---|---|
| `next` | `16.3.1` |
| `react` / `react-dom` | `19.2.8` |
| `drizzle-orm` | `0.45.2` |
| `drizzle-kit` | `0.31.10` |
| `pg` | `8.23.0` |
| `@types/pg` | `8.23.1` |
| `@neondatabase/auth` | `0.5.0-beta` |

Do **not** add `@neondatabase/serverless`. Railway processes are long-lived; `pg`
on the pooled URL is the contract (ADR-0004). Next 16 uses `proxy.ts`, not
`middleware.ts`.

Railway services:

| Service | Image | Command | Notes |
|---|---|---|---|
| `web` | `apps/web` | `next start` | concurrency ≥ 1 |
| `worker` | `apps/worker` | `node dist/worker.js` | **concurrency = 1** |
| `cron` | same image as worker | `node dist/cron.js <job>` | Railway cron |

Cron jobs: `recompute-rankings`, `rotate-daily`, `close-season` (explicit, not
inferred from `ends_at` mid-request).

---

## 3. Constants

`packages/platform/src/limits.ts` (exact pins, competition-affecting where noted):

```ts
export const ATTEMPT_TTL_SECONDS = 15 * 60;          // ranked attempts are not resumable
export const ISSUE_RATE_USER_PER_MIN = 10;
export const ISSUE_RATE_USER_PER_HOUR = 60;
export const ISSUE_RATE_IP_PER_MIN = 30;
export const FINISH_RATE_USER_PER_MIN = 20;
export const DAILY_ATTEMPT_CAP = 5;                  // per user per game per UTC day
export const MAX_REPLAY_COMPRESSED_BYTES = 64 * 1024; // matches replay MAX_COMPRESSED_BYTES
export const SCORE_ENVELOPE_ABS = 1_000_000_000_000n; // cheap check before physics
export const RANKING_DIRTY_FLOOR_MS = 30_000;
export const CHAMPIONSHIP_ENTRANT_GATE = 50;
export const CHAMPIONSHIP_PLACEMENT_CUTOFF = 100;
export const HANDLE_MIN = 3;
export const HANDLE_MAX = 20;
export const HANDLE_PATTERN = /^[a-z0-9](?:[a-z0-9_-]{1,18}[a-z0-9])?$/;
export const HANDLE_CHANGE_COOLDOWN_DAYS = 30;
export const WORKER_STALE_LOCK_SECONDS = 120;
export const WORKER_MAX_CLAIMS = 5;
export const LEADERBOARD_PAGE_DEFAULT = 50;
export const LEADERBOARD_PAGE_MAX = 100;
```

HMAC secret `ATTEMPT_HMAC_SECRET` lives in Railway env, never in the repo.
Minimum 32 bytes. Rotation: dual-secret window (`ATTEMPT_HMAC_SECRET_PREV`) for
one TTL.

---

## 4. Schema (DDL contract)

Drizzle schema in `packages/db/src/schema.ts`. Types below are the contract;
column names are exact.

Shared enums (Postgres):

```sql
CREATE TYPE attempt_status AS ENUM (
  'issued', 'active', 'submitted', 'abandoned', 'expired'
);
CREATE TYPE verification_status AS ENUM (
  'pending', 'verified', 'rejected'
);
CREATE TYPE job_state AS ENUM (
  'queued', 'locked', 'done', 'failed'
);
CREATE TYPE season_status AS ENUM (
  'scheduled', 'active', 'closing', 'closed'
);
CREATE TYPE seed_policy AS ENUM (
  'fixed-course', 'daily-seed', 'weekly-seed'
);
CREATE TYPE snapshot_scope AS ENUM (
  'game', 'championship', 'daily', 'best6'  -- best6 unused in Spec 2
);
CREATE TYPE profile_status AS ENUM (
  'active', 'suspended'
);
```

### 4.1 Tables

**`profiles`**
- `user_id uuid PRIMARY KEY` — our id, not the provider's
- `auth_user_id text NOT NULL UNIQUE` — `neon_auth.user.id` (or equivalent)
- `handle citext UNIQUE` — null until claimed
- `handle_claimed_at timestamptz`
- `handle_changed_at timestamptz` — first claim sets this; next PUT refused until +30 days
- `status profile_status NOT NULL DEFAULT 'active'`
- `created_at timestamptz NOT NULL DEFAULT now()`

**`seasons`**
- `id uuid PRIMARY KEY`
- `slug text UNIQUE NOT NULL`
- `starts_at timestamptz NOT NULL`
- `ends_at timestamptz NOT NULL`
- `status season_status NOT NULL`
- `rules_version int NOT NULL`
- `created_at timestamptz NOT NULL DEFAULT now()`

**`games`**
- `id uuid PRIMARY KEY`
- `slug text UNIQUE NOT NULL` — `'test-chamber'`
- `registry_id int NOT NULL UNIQUE CHECK (registry_id >= 0 AND registry_id <= 65535)`
- `created_at timestamptz NOT NULL DEFAULT now()`

**`game_versions`**
- `id uuid PRIMARY KEY`
- `game_id uuid NOT NULL REFERENCES games(id)`
- `game_version text NOT NULL` — semver
- `simulation_version int NOT NULL`
- `scoring_version int NOT NULL`
- `rapier_build_hash text NOT NULL CHECK (length(rapier_build_hash) = 64)`
- `detmath_version int NOT NULL`
- `replay_format_version int NOT NULL`
- `config_json jsonb NOT NULL DEFAULT '{}'`
- `released_at timestamptz NOT NULL`
- `created_at timestamptz NOT NULL DEFAULT now()`
- `UNIQUE (game_id, game_version, simulation_version, scoring_version)`

**`season_games`**
- `id uuid PRIMARY KEY`
- `season_id uuid NOT NULL REFERENCES seasons(id)`
- `game_id uuid NOT NULL REFERENCES games(id)`
- `game_version_id uuid NOT NULL REFERENCES game_versions(id)`
- `seed_policy seed_policy NOT NULL`
- `active_from timestamptz NOT NULL`
- `active_to timestamptz NOT NULL`
- `created_at timestamptz NOT NULL DEFAULT now()`
- `UNIQUE (season_id, game_id, seed_policy)`

**`attempts`**
- `id uuid PRIMARY KEY`
- `user_id uuid NOT NULL REFERENCES profiles(user_id)`
- `season_game_id uuid NOT NULL REFERENCES season_games(id)`
- `game_version_id uuid NOT NULL REFERENCES game_versions(id)`
- `seed bytea NOT NULL CHECK (octet_length(seed) = 16)` — four LE uint32
- `nonce bytea NOT NULL UNIQUE CHECK (octet_length(nonce) = 16)`
- `issued_at timestamptz NOT NULL DEFAULT now()`
- `expires_at timestamptz NOT NULL`
- `status attempt_status NOT NULL DEFAULT 'issued'`
- `consumed_at timestamptz`
- `created_at timestamptz NOT NULL DEFAULT now()`

**`runs`**
- `id uuid PRIMARY KEY`
- `attempt_id uuid NOT NULL UNIQUE REFERENCES attempts(id)`
- `user_id uuid NOT NULL REFERENCES profiles(user_id)`
- `claimed_score bigint NOT NULL`
- `total_ticks int NOT NULL CHECK (total_ticks > 0)`
- `replay bytea NOT NULL` — gzip SWR1
- `final_state_hash bytea NOT NULL CHECK (octet_length(final_state_hash) = 8)`
- `created_at timestamptz NOT NULL DEFAULT now()`

**`score_submissions`**
- `run_id uuid PRIMARY KEY REFERENCES runs(id)`
- `verification_status verification_status NOT NULL DEFAULT 'pending'`
- `reason_code text` — see §6
- `first_divergent_tick int`
- `verified_score bigint`
- `verified_hash bytea`
- `verified_at timestamptz`
- `created_at timestamptz NOT NULL DEFAULT now()`

**`verified_results`**
- `id uuid PRIMARY KEY`
- `user_id uuid NOT NULL REFERENCES profiles(user_id)`
- `season_game_id uuid NOT NULL REFERENCES season_games(id)`
- `run_id uuid NOT NULL UNIQUE REFERENCES runs(id)`
- `score bigint NOT NULL`
- `tiebreak_metrics jsonb NOT NULL DEFAULT '{}'`
- `achieved_at timestamptz NOT NULL`
- `created_at timestamptz NOT NULL DEFAULT now()`

**`game_bests`**
- `season_game_id uuid NOT NULL REFERENCES season_games(id)`
- `user_id uuid NOT NULL REFERENCES profiles(user_id)`
- `verified_result_id uuid NOT NULL REFERENCES verified_results(id)`
- `score bigint NOT NULL`
- `created_at timestamptz NOT NULL DEFAULT now()`
- `PRIMARY KEY (season_game_id, user_id)`

**R1.3 database constraint (not application hope):**

```sql
CREATE OR REPLACE FUNCTION assert_verified_run() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM score_submissions s
    WHERE s.run_id = NEW.run_id AND s.verification_status = 'verified'
  ) THEN
    RAISE EXCEPTION 'verified_results require a verified submission';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

A unit test inserts an unverified run and asserts the trigger refuses it.

**`ranking_snapshots`**
- `id uuid PRIMARY KEY`
- `season_id uuid NOT NULL REFERENCES seasons(id)`
- `scope snapshot_scope NOT NULL`
- `subject_id uuid NOT NULL` — season_game_id or season_id
- `payload jsonb NOT NULL` — ordered rows; byte-compared in rebuild tests
- `as_of timestamptz NOT NULL`
- `frozen boolean NOT NULL DEFAULT false`
- `created_at timestamptz NOT NULL DEFAULT now()`

A partial unique index `(season_id, scope, subject_id) WHERE frozen = false`
holds the live snapshot. Frozen season-close rows are extra immutable copies.

**`ranking_dirty`**
- `season_id uuid PRIMARY KEY REFERENCES seasons(id)`
- `dirty_at timestamptz NOT NULL`
- `last_recomputed_at timestamptz`
- `created_at timestamptz NOT NULL DEFAULT now()`

Verified-result insert:

```sql
INSERT INTO ranking_dirty (season_id, dirty_at)
VALUES ($1, now())
ON CONFLICT (season_id) DO UPDATE SET dirty_at = excluded.dirty_at;
```

Recompute (worker or cron): run only when `dirty_at IS NOT NULL` AND
(`last_recomputed_at IS NULL` OR `now() - last_recomputed_at >= 30 seconds`).
Capture `started_at = now()` before the rebuild. After a successful rebuild:

```sql
UPDATE ranking_dirty
SET last_recomputed_at = $started_at,
    dirty_at = CASE WHEN dirty_at <= $started_at THEN NULL ELSE dirty_at END
WHERE season_id = $1;
```

If a verify lands during the rebuild, `dirty_at` stays set and the next cycle
picks it up. Hourly cron calls the same function so a missed flag cannot stall
forever.

**`verification_jobs`**
- `id uuid PRIMARY KEY`
- `run_id uuid NOT NULL UNIQUE REFERENCES runs(id)`
- `state job_state NOT NULL DEFAULT 'queued'`
- `attempts int NOT NULL DEFAULT 0`
- `locked_at timestamptz`
- `locked_by text`
- `last_error text`
- `created_at timestamptz NOT NULL DEFAULT now()`

Claim:

```sql
UPDATE verification_jobs
SET state = 'locked', locked_at = now(), locked_by = $worker, attempts = attempts + 1
WHERE id = (
  SELECT id FROM verification_jobs
  WHERE state = 'queued'
     OR (state = 'locked' AND locked_at < now() - interval '2 minutes')
  ORDER BY id
  FOR UPDATE SKIP LOCKED
  LIMIT 1
)
RETURNING *;
```

Stale locks > 2 minutes are reclaimable. `done` is terminal. `failed` after 5
attempts is terminal and pages ops (Spec 5); Spec 2 tests the retry path only.

**`audit_events`**
- `id bigserial PRIMARY KEY`
- `actor uuid` — null for system
- `action text NOT NULL`
- `target text NOT NULL`
- `request_meta jsonb NOT NULL DEFAULT '{}'`
- `created_at timestamptz NOT NULL DEFAULT now()`

**`daily_boards`** (daily ladder isolation)
- `id uuid PRIMARY KEY`
- `season_game_id uuid NOT NULL REFERENCES season_games(id)`
- `utc_date date NOT NULL`
- `seed bytea NOT NULL CHECK (octet_length(seed) = 16)`
- `archived_at timestamptz`
- `created_at timestamptz NOT NULL DEFAULT now()`
- `UNIQUE (season_game_id, utc_date)`

Daily runs still use `attempts` / `runs` / `verified_results` / `game_bests`,
but `season_games.seed_policy = 'daily-seed'` and championship recompute
**ignores** those `season_game_id`s. A test inserts a verified daily result and
asserts championship `payload` is unchanged.

**`rate_limit_hits`** (unlogged is fine)
- `key text NOT NULL`
- `window_start timestamptz NOT NULL`
- `count int NOT NULL`
- `PRIMARY KEY (key, window_start)`

Indexes:

```sql
CREATE INDEX game_bests_board ON game_bests (season_game_id, score DESC);
CREATE INDEX verified_results_board
  ON verified_results (season_game_id, score DESC, achieved_at ASC);
CREATE INDEX attempts_user_issued ON attempts (user_id, issued_at DESC);
CREATE INDEX jobs_claim ON verification_jobs (state, id);
```

### 4.2 Seed128 packing

```ts
function packSeed(seed: readonly [number, number, number, number]): Uint8Array {
  const out = new Uint8Array(16);
  const view = new DataView(out.buffer);
  view.setUint32(0, seed[0] >>> 0, true);
  view.setUint32(4, seed[1] >>> 0, true);
  view.setUint32(8, seed[2] >>> 0, true);
  view.setUint32(12, seed[3] >>> 0, true);
  return out;
}
```

Reject all-zero. Use `crypto.getRandomValues` **in the API process**, not in
sim-core.

---

## 5. Auth and handles

Neon Managed Better Auth (Beta). Users/sessions live in `neon_auth.*` and branch
with the database.

Launch providers: **Google** and **GitHub** (ADR-0004). Discord is deferred.

After OAuth:

1. Read `neon_auth` user id from the session.
2. Upsert `profiles` keyed by `auth_user_id`.
3. Ranked routes require `profiles.handle IS NOT NULL` and `status = 'active'`.
4. Guests (no session) may load practice UI later (Spec 3). Spec 2 ranked
   endpoints return `UNAUTHENTICATED`.

Handle claim `PUT /v1/me/handle`:

- Lowercase on write.
- `HANDLE_PATTERN`, length 3–20.
- Reserved list committed at `packages/platform/src/reserved-handles.json`
  (`admin`, `administrator`, `official`, `stickworld`, `support`, `moderator`,
  `staff`, …).
- ASCII-only pattern already blocks mixed-script homoglyphs. Still reject
  handles whose NFKC form differs from the input.
- First successful claim sets `handle_claimed_at` and `handle_changed_at`.
- A later `PUT` is `HANDLE_COOLDOWN` until
  `handle_changed_at + HANDLE_CHANGE_COOLDOWN_DAYS`. Same-handle no-op is 204
  and does not reset the cooldown.
- `HANDLE_COOLDOWN` player-safe message: "You can change your handle again later."

---

## 6. Reason codes

Wire value is `reason_code` (text). Platform codes plus Spec 1 §8.5:

| code | source | player-safe message |
|---|---|---|
| `BAD_MAGIC` | replay | Replay is not a Stickworld replay. |
| `UNSUPPORTED_FORMAT` | replay | Replay format is not supported. |
| `TRUNCATED` | replay | Replay is incomplete. |
| `CRC_MISMATCH` | replay | Replay failed integrity check. |
| `TOO_LARGE` | replay | Replay exceeds size budget. |
| `UNKNOWN_ACTION` | replay | Replay contains an unknown input. |
| `VALUE_OUT_OF_RANGE` | replay | Replay contains an out-of-range input. |
| `TICK_ORDER` | replay | Replay inputs are out of order. |
| `TICK_COUNT` | replay | Replay duration does not match the header. |
| `BUDGET_EXCEEDED` | sim | Simulation exceeded its physics budget. |
| `NON_FINITE_STATE` | sim | Simulation produced a non-finite state. |
| `STATE_HASH_MISMATCH` | verify | Re-simulated physics do not match the replay. |
| `SCORE_MISMATCH` | verify | Re-simulated score does not match the claim. |
| `GZIP` | replay | Replay payload is not valid gzip. |
| `UNAUTHENTICATED` | platform | Sign in required. |
| `FORBIDDEN` | platform | Not allowed. |
| `HANDLE_TAKEN` | platform | That handle is taken. |
| `HANDLE_INVALID` | platform | That handle is not allowed. |
| `RATE_LIMITED` | platform | Slow down. |
| `ATTEMPT_EXPIRED` | platform | That attempt expired. |
| `ATTEMPT_CONSUMED` | platform | That attempt was already used. |
| `ATTEMPT_NOT_FOUND` | platform | Attempt not found. |
| `TOKEN_INVALID` | platform | Attempt token is invalid. |
| `WRONG_VERSION` | platform | Game version does not match this attempt. |
| `WRONG_USER` | platform | Attempt belongs to another player. |
| `SEED_DEGENERATE` | platform | Server refused to issue a degenerate seed. |
| `DAILY_CAP` | platform | Daily attempt cap reached. |
| `SEASON_INACTIVE` | platform | This season is not accepting ranked runs. |
| `SCORE_ENVELOPE` | platform | Claimed score is outside the allowed range. |
| `CADENCE` | platform | Input cadence is implausible. |
| `DURATION` | platform | Run duration is outside the game's limits. |
| `HANDLE_COOLDOWN` | platform | You can change your handle again later. |
| `WORKER_FAULT` | platform | Verification failed. Try submitting again. |
| `BAD_CURSOR` | platform | Invalid cursor. |
| `INTERNAL` | platform | Something went wrong. |

Non-leaky: `WRONG_USER`, `ATTEMPT_NOT_FOUND`, and `FORBIDDEN` share the same
external message ("Attempt not found") so you cannot probe another player's
attempt ids. Internally they remain distinct in `audit_events`.

Cheap-check `CADENCE`: more than 8 distinct action events on the same tick, or
events with `tick >= totalTicks`, fail before enqueue.

Cheap-check `DURATION`: `totalTicks > game.manifest.maxRunTicks` or `< 1`.

---

## 7. Attempt token

```
token = base64url(json) + "." + base64url(hmac_sha256_utf8(json, secret))
json  = {"attemptId","userId","gameVersionId","exp"}  // exp = unix seconds
```

Verify: split on `.`, recompute HMAC, compare with `timingSafeEqual`, check
`exp`, bind `attemptId` and `userId` to the row. Accept `ATTEMPT_HMAC_SECRET`
or `ATTEMPT_HMAC_SECRET_PREV`.

---

## 8. API

All JSON. Auth: session cookie from Neon Auth. CSRF: SameSite cookies + Origin
check on mutating routes.

```
POST /v1/games/:gameId/attempts
  body: { seedPolicy?: 'fixed-course' | 'daily-seed' }
  201: { attemptId, seed: [u32,u32,u32,u32], gameVersion, expiresAt, token, dailyCapRemaining }
  4xx: { error: { code, message } }

POST /v1/attempts/:attemptId/finish
  body: { token, replay: <base64 of gzip SWR1>, claimedScore: string }
  202: { runId, status: 'pending' }

GET  /v1/runs/:runId
  200: { runId, status, reasonCode?, firstDivergentTick?, verifiedScore?, asOf }

GET  /v1/games
GET  /v1/seasons/current
GET  /v1/leaderboards/:seasonId/:gameId?cursor=&limit=50
GET  /v1/seasons/:seasonId/standings
GET  /v1/daily/:gameId
GET  /v1/users/:userId/profile
GET  /v1/me/runs
PUT  /v1/me/handle          { handle }
```

HTTP mapping: `UNAUTHENTICATED` → 401; `RATE_LIMITED` / `DAILY_CAP` /
`HANDLE_COOLDOWN` → 429; `ATTEMPT_EXPIRED` / `ATTEMPT_CONSUMED` /
`TOKEN_INVALID` / `WRONG_VERSION` / `SCORE_ENVELOPE` / `CADENCE` / `DURATION` /
`TOO_LARGE` / `HANDLE_INVALID` / `BAD_CURSOR` → 400; `HANDLE_TAKEN` → 409; `SEASON_INACTIVE` →
403; `ATTEMPT_NOT_FOUND` / `WRONG_USER` / `FORBIDDEN` → 404 with message
"Attempt not found"; finish accepted → 202; handle first claim → 200; handle
same-value no-op → 204.

Leaderboard and standings responses always include `asOf` (ISO-8601).

`claimedScore` is a decimal string to survive int64. Never used as the ranked
score.

Game id in URLs is the slug (`test-chamber`), not the uuid.

### 8.1 Leaderboard pagination (keyset)

`limit` default 50, max 100. `cursor` is unpadded base64url of JSON:

```json
{ "score": "123", "achievedAt": "2026-08-18T00:00:00.000Z", "userId": "<uuid>" }
```

Order: `score DESC`, `achieved_at ASC`, `user_id ASC`. Next page:

```sql
WHERE (score, achieved_at, user_id) < ($score, $achievedAt, $userId)
-- implemented as:
--   score < $score
--   OR (score = $score AND achieved_at > $achievedAt)
--   OR (score = $score AND achieved_at = $achievedAt AND user_id > $userId)
```

Invalid cursor → 400 `{ error: { code: "BAD_CURSOR", message: "Invalid cursor." } }`.
Opaque; clients must not parse it.

Each page also includes `viewer: { rank, score, userId } | null` so "my rank"
does not require scanning to the viewer's page.

### 8.2 Route files (`apps/web`)

```
apps/web/
  app/api/auth/[...path]/route.ts     # export const { GET, POST } = auth.handler()
  app/auth/[path]/page.tsx            # Neon Auth views
  app/v1/games/route.ts               # GET
  app/v1/games/[gameId]/attempts/route.ts
  app/v1/attempts/[attemptId]/finish/route.ts
  app/v1/runs/[runId]/route.ts
  app/v1/seasons/current/route.ts
  app/v1/seasons/[seasonId]/standings/route.ts
  app/v1/leaderboards/[seasonId]/[gameId]/route.ts
  app/v1/daily/[gameId]/route.ts
  app/v1/users/[userId]/profile/route.ts
  app/v1/me/handle/route.ts
  app/v1/me/runs/route.ts
  lib/auth/server.ts                  # createNeonAuth from @neondatabase/auth/next/server
  lib/auth/client.ts
  proxy.ts                            # Next 16; auth.middleware, ranked routes need session
```

`@neondatabase/auth` is Beta. Pin `0.5.0-beta`. Cookie secret is
`NEON_AUTH_COOKIE_SECRET` (env only).

### 8.3 `packages/platform` files

```
packages/platform/src/limits.ts
packages/platform/src/reason-codes.ts
packages/platform/src/attempt-token.ts
packages/platform/src/ranking.ts          # placement, tail, integerMedian, overallTies
packages/platform/src/seed128.ts
packages/platform/src/reserved-handles.json
packages/platform/src/index.ts
```

---

## 9. Verification worker (Node, Branch A)

```ts
import { decodeReplay, playReplay } from '@stickworld/replay';
import { initRapier, Prng } from '@stickworld/sim-core';
import { testChamberGame } from '@stickworld/game-test-chamber';

const GAMES = new Map([[0, testChamberGame]]);
```

For each claimed job:

1. Load `runs.replay`, `attempts.seed`, `game_versions.*`.
2. `decodeReplay`. On typed error → reject with that code, `jobs.state = done`.
3. Assert header `gameRegistryId`, version fields, and `rapierBuildHashPrefix`
   match the pinned `game_versions` row (compare the same 8 raw bytes as the
   replay header).
4. `createSimulation` + `playReplay`.
5. On score/hash mismatch: `reason_code`, `first_divergent_tick` from
   `diffScoreEvents` when event streams differ, else `0` for hash-only.
6. On success: insert `verified_results`, conditional upsert `game_bests`
   (`WHERE excluded.score > game_bests.score`), mark championship dirty.
7. Always write `score_submissions` before releasing the lock.
8. Uncaught worker exception, timeout, or OOM: do not write `verified_results`.
   Leave the job `queued` if claims < 5; at 5 claims set `failed` and
   `score_submissions.reason_code = 'WORKER_FAULT'`.

Idempotency: `verification_jobs.run_id UNIQUE`. Re-claim of a `done` job is a
no-op. `game_bests` upsert is strict improvement only; equal scores keep the
earlier `achieved_at`.

---

## 10. Ranking

Pure functions in `packages/platform/src/ranking.ts`, integer-only.

Per-game place: `RANK()` over `(score DESC, achieved_at ASC)`. Spec 2 Test
Chamber has no extra tiebreakers.

Championship points, matching `docs/competitive-spec.md` §11 (that file wins):

```
if entrants < 50: points = 0, provisional = true
else if rank <= 100:
    points = 1000 - floor(((rank - 1) * 100) / 99)
else:
    points = floor(899 * (N - rank) / (N - 100))   // last place 0
```

If `50 ≤ N < 100`, only the placement table is used (no tail).

Championship total = sum of points across **fixed-course** season games only.

Spec 2's `ci` season has one fixed-course game. Do **not** pad nine imaginary
future roster games with zeros (that would make every median 0). Championship
functions take the season's current fixed-course set. Tests for a ten-game
season insert ten synthetic `season_games`.

### 10.1 Integer median

Competitive spec §11 tiebreaker 3 is "highest median of the ten game point
totals." Spec 2 implements **integer** median, no floats:

- Sort the season's fixed-course point totals ascending (non-participation = 0
  for a game that exists in the season and the player has no verified result).
- Let `n` be the length. If `n` is odd, take index `floor(n / 2)`. If `n` is
  even, take the **lower** of the two central values (index `n/2 - 1`). Never
  average.

When the roster reaches ten games, `n = 10` and the median is the 5th of the
sorted list.

Overall ties: most wins → most top-10 → integer median of game point totals →
earliest timestamp of reaching the current total.

Snapshot rebuild test: compute `payload`, store it, delete live snapshot,
recompute, `expect(payload).toEqual(original)`.

---

## 11. Daily ladder

- Cron `rotate-daily` at 00:00 UTC: insert tomorrow's `daily_boards` row with a
  new seed; set `archived_at` on yesterday.
- Issuing a daily attempt requires `utc_date = CURRENT_DATE` and fewer than 5
  attempts for that user+game+day in `issued`/`active`/`submitted`.
- Championship recompute query: `seed_policy = 'fixed-course'` only.
- Test: verified daily run does not change championship snapshot bytes.

---

## 12. CI

`.github/workflows/ci.yml` gains a `schema` job (Task 1):

1. Create a Neon branch from `main`.
2. Apply migrations via the direct URL.
3. Run `packages/db` and `packages/platform` tests plus API integration tests.
4. Delete the branch.

Secrets: `NEON_API_KEY`, `NEON_PROJECT_ID` in GitHub Actions (not `Credentials/`).
Local: Railway/Neon env, gitignored `.env`.

`verify` stays as Spec 1. `schema` needs Neon credentials; if they are missing
in a fork PR, the job skips with an explicit message rather than a false green.
On this repo's CI they are required.

### 12.1 Environment variables (never committed)

| name | who | purpose |
|---|---|---|
| `DATABASE_URL` | web, worker, cron | Neon **pooled** connection |
| `DATABASE_URL_UNPOOLED` | drizzle-kit, migrate | Neon **direct** connection |
| `ATTEMPT_HMAC_SECRET` | web | ≥32 bytes |
| `ATTEMPT_HMAC_SECRET_PREV` | web | optional rotation window |
| `NEON_AUTH_BASE_URL` | web | branch Auth URL |
| `NEON_AUTH_COOKIE_SECRET` | web | signed session cookie |
| `NEON_API_KEY` | CI only | create/delete branches |
| `NEON_PROJECT_ID` | CI only | project for those branches |

OAuth client ids/secrets live in the Neon Auth dashboard per branch, not in
Railway, except when a tool requires them — still never in git.

---

## 13. Seed data for CI and local

One season `slug = 'ci'`, one game `test-chamber` / `registry_id = 0`, one
`game_versions` row pinned to Spec 1 constants (`RAPIER_BUILD_SHA256`,
`SIM_CORE_VERSION = 1`, Test Chamber `1.0.0`). Two `season_games`:
`fixed-course` and `daily-seed`.

---

## 14. What Spec 3 inherits

- Attempt issuance and finish already work for any `StickworldGame` in the
  module map.
- Phaser talks only to `POST /attempts` and `POST /finish`; it never writes
  scores.
- Adding Hookline Sprint = insert `games` + `game_versions` + map entry.
  No worker rewrite.
- Leaderboard URL shape is stable.

---

## 15. Risks

| Risk | Handling |
|---|---|
| Neon Auth is Beta | Pin the SDK. Auth state branches with Postgres, which we need. Record Beta in README. |
| Discord was in the original brief | ADR-0004: GitHub is the second provider. |
| PgBouncer transaction mode | Migrations use the direct URL. App queries use pooled. |
| Worker backlog | Spec 2 tests correctness; throughput budgets are Spec 5. |
| HMAC secret leak | Env only; dual-secret rotation; audit on token failures. |
