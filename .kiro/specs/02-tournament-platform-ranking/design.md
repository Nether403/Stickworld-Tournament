# Spec 2 — Design (scope and contract depth)

Public contracts and decisions that later specs depend on. Implementation detail is deliberately
omitted until Spec 1's fork resolves.

---

## 1. Service topology

Two Railway services plus cron in one project. Two vendors total.

```
Railway
├── web      Next.js shell + API route handlers (or Fastify)
├── worker   verification + ranking recompute
└── cron     triggers ranking recompute, daily seed rotation, season close

Neon
├── Lakebase Postgres   source of truth, replay bytea, job queue
└── Managed Auth        Better Auth, OAuth-only (Google + Discord)
```

No Redis (Postgres queue via `SKIP LOCKED`). No object storage (replays are `bytea`). No CDN at
launch — accepted gap, see Spec 5.

---

## 2. Entity contract

Fields that other specs depend on. Not full DDL.

| Entity | Key fields | Notes |
|---|---|---|
| `profiles` | `user_id` (uuid PK), `handle`, `auth_provider_id`, `status` | Internal uuid is the primary key everywhere; provider id is a mapped attribute |
| `seasons` | `id`, `slug`, `starts_at`, `ends_at`, `status`, `rules_version` | |
| `games` | `id`, `slug`, `registry_id` (uint16) | `registry_id` matches the replay header, assigned once, never reused |
| `game_versions` | `id`, `game_id`, `game_version`, `simulation_version`, `scoring_version`, `rapier_build_hash`, `config_json`, `released_at` | The re-simulation contract |
| `season_games` | `season_id`, `game_id`, `game_version_id`, `seed_policy`, `active_from`, `active_to` | `seed_policy` distinguishes fixed-course from daily/weekly |
| `attempts` | `id`, `user_id`, `season_game_id`, `game_version_id`, `seed` (16 bytes), `nonce`, `issued_at`, `expires_at`, `status` | Server-issued; client never influences `seed` |
| `runs` | `id`, `attempt_id`, `user_id`, `claimed_score`, `total_ticks`, `replay` (bytea gz), `final_state_hash`, `created_at` | Replay is inputs only |
| `score_submissions` | `run_id`, `verification_status`, `reason_code`, `first_divergent_tick`, `verified_score`, `verified_at` | Reason taxonomy from Spec 1 §8.5 |
| `verified_results` | `id`, `user_id`, `season_game_id`, `score` (bigint), `tiebreak_metrics` (jsonb), `achieved_at`, `run_id` | Only verified runs land here |
| `game_bests` | `season_game_id`, `user_id`, `verified_result_id`, `score` | Leaderboard source |
| `ranking_snapshots` | `season_id`, `scope`, `subject_id`, `rank`, `points`, `provisional`, `calculated_at` | Derived, rebuildable, cached |
| `verification_jobs` | `id`, `run_id`, `state`, `attempts`, `locked_at`, `locked_by` | Consumed with `FOR UPDATE SKIP LOCKED` |
| `audit_events` | `actor`, `action`, `target`, `request_meta`, `created_at` | Append-only |

**Constraint that must be in the database, not application code:** `game_bests` may only
reference a `verified_results` row, and `verified_results` may only reference a run whose
`score_submissions.verification_status = 'verified'`. R1.3 exists because this is the exact
invariant that gets violated when someone adds a "quick fix" write path under deadline.

---

## 3. API surface

```http
POST   /v1/games/:gameId/attempts          -> { attemptId, seed[4], gameVersion, expiresAt, token }
POST   /v1/attempts/:attemptId/finish      -> { runId, status: 'pending' }
GET    /v1/runs/:runId                     -> verification status + reason + verified score
GET    /v1/games
GET    /v1/seasons/current
GET    /v1/leaderboards/:seasonId/:gameId  -> page + viewer's own rank
GET    /v1/seasons/:seasonId/standings     -> championship table, with `asOf`
GET    /v1/daily/:gameId                   -> today's seed metadata + board
GET    /v1/users/:userId/profile
GET    /v1/me/runs
```

Contract notes:

- The client never sends coordinates, velocities, or an authoritative score. `claimed_score` is
  accepted only to produce a rejection diff.
- Every leaderboard and standings response carries an explicit `asOf` timestamp. Standings are a
  cached projection and must be presented as such.
- WebSockets are not required. Gameplay is single-player and standings are cached.

---

## 4. Verification pipeline

```
POST /finish
   │
   ├─ synchronous cheap checks ─── reject ──> typed reason, audit event
   │    schema · ownership · expiry · nonce · replay size
   │    input cadence · duration bounds · score envelope
   │
   ├─ persist run + replay bytea (immutable)
   ├─ enqueue verification_job
   ▼
worker  (FOR UPDATE SKIP LOCKED)
   │  decode replay
   │  load exact game_version + pinned Rapier build
   │  re-simulate totalTicks
   │  compare verified_score AND final_state_hash
   ├─ mismatch ──> rejected + reason_code + first_divergent_tick
   ▼
verified
   ├─ upsert game_bests (only if strictly better)
   ├─ insert verified_results
   └─ mark championship standings dirty
         ▼
      cron recompute ──> ranking_snapshots
```

Idempotency: the run row is written before enqueueing, `verification_jobs` is keyed on `run_id`,
and `game_bests` updates are conditional on strict improvement. A worker killed at any point
retries without double-crediting.

**If Spec 1 lands on Branch B1, only the worker's runtime changes** — headless Chromium under
Playwright instead of Node. The pipeline shape, schema, and API are unaffected. This is why the
fork does not invalidate this design, only its worker implementation and its throughput budget.

---

## 5. Ranking algorithms

### Per-game

```sql
RANK() OVER (
  PARTITION BY season_game_id
  ORDER BY score DESC, <game tiebreak metric> DESC, achieved_at ASC
)
```

Served from a materialized snapshot, fully rebuildable from `verified_results`.

### Championship — the hybrid

```
if placement <= 100:
    points = 1000 - floor((placement - 1) * 100 / 99)     # 1st=1000 … 100th=900, integer
else:
    points = floor(899 * (1 - percent_rank_below_100))     # smooth 0..899 tail

if entrants_for_game < 50:
    points contribute 0 and the game displays as `provisional`

championship_total = sum(points for all 10 games)          # max 10,000
```

Integer arithmetic throughout, for the same reason scores are integers: float accumulation order
changes results.

Properties worth stating because they are the point of the design:

- **Stable at the sharp end.** Top-100 points depend on placement, not on the size or churn of
  the tail. A player who stops playing does not silently lose points to newcomers below them.
- **Pool-size resistant.** The 50-entrant gate stops a thin leaderboard from minting 1,000-point
  champions.
- **Smooth in the tail.** Below 100th, percentile keeps progression meaningful for the majority.

Tiebreakers, published in this order: most game wins → most top-10 finishes → highest median
normalized result → earliest achievement of the total.

---

## 6. Open questions to resolve during this spec

1. Does Neon's managed auth bundle a transactional email sender? Gates whether magic-link can
   ever be added without vendor three. **Confirm before designing any email-dependent flow.**
2. Autosuspend on the production Neon branch: disable, or accept cold starts given that
   leaderboard reads come from cached snapshots?
3. API layer: Next route handlers (fewer moving parts) or Fastify (cleaner separation from the
   shell, easier to scale independently)?
4. Championship recompute cadence: fixed interval, or dirty-flag-driven with a floor?
5. Does the "Best 6 of 10" secondary ladder ship at launch or later?

---

## 7. Tasks

| # | Task | Plan ref |
|---|---|---|
| 1 | Schema, migrations, Neon branch-per-PR in CI | 5 |
| 2 | Auth, profile, handle claim with validation | 6 |
| 3 | Attempt issuance API with HMAC token, nonce, rate limits | 7 |
| 4 | Submission endpoint, Postgres job queue, verification worker | 8 |
| 5 | Per-game leaderboard with snapshot and rebuild guarantee | 9 |
| 6 | Championship ranking, hybrid points, gate, cron recompute, season freeze | 11 |
| 7 | Daily seeded ladder with cap, rotation, archival, isolation test | 13 |

Sub-tasks are written when this spec is deepened after Spec 1's fork resolves.
