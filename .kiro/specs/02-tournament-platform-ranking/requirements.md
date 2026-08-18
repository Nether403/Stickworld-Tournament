# Spec 2 — Tournament Platform and Ranking

**Status:** authored at scope depth, awaiting Spec 1 outcome before deepening
**Depth:** scope and contract only — deliberately not implementation detail
**Covers:** Plan tasks 5–9, 11, 13
**Depends on:** Spec 1 (all four tasks complete, fork branch chosen)
**Blocks:** Spec 3

---

## Why this spec is deliberately shallow

Spec 1 contains a fork. If the determinism harness finds divergence, the verification model
changes shape — which changes the attempt lifecycle, which changes this schema and the
verified-versus-provisional states the ranking layer depends on. Writing implementation detail
now risks writing it twice.

**Revision triggers — re-open this spec if Spec 1 lands on:**

| Branch | What changes here |
|---|---|
| **A** (all runtimes agree) | Nothing. Deepen as written. |
| **B1** (Node diverges, browsers agree) | The validation worker runs headless Chromium under Playwright instead of Node. Changes the worker's runtime, image size, cost per verification, and throughput assumptions — not the schema or API shape. |
| **B2** (browsers diverge) | Significant. `verified` may become `provisional` for a defined window, the client score becomes advisory only, and the rejection taxonomy needs a "within tolerance" state. Schema changes. |
| **B3** (conditional divergence) | Physics budgets become verification-relevant, not just performance-relevant. `game_versions` may need to record which primitive set a game is restricted to. |
| **B4** (fixed-point rewrite) | Timeline changes materially; schema mostly survives. Re-plan before proceeding. |

The user has explicitly asked to revisit this spec after Spec 1 lands.

**Spec 1 outcome (2026-08-18):** Branch A. One pinned Rapier `-compat` 0.20.0
build is bit-identical in Node, Chromium, Firefox, and WebKit. Recorded in
`docs/adr/0001-determinism-fork.md`. This spec can deepen as written; the
verification worker stays Node. No fork revision of Specs 2–5 is required on
the determinism axis.

---

## Requirements

### R1 — Schema as source of truth

1. Postgres on Neon SHALL be the sole source of truth. Every derived structure — leaderboard
   snapshots, championship standings, caches — SHALL be reconstructable from base tables.
2. Tables: `profiles`, `seasons`, `games`, `game_versions`, `season_games`, `attempts`, `runs`,
   `score_submissions`, `verified_results`, `game_bests`, `ranking_snapshots`,
   `verification_jobs`, `audit_events`.
3. `attempt`, `run`, and `personal best` SHALL be strictly distinct concepts. A player may
   abandon an attempt; a completed attempt becomes a run; **only a verified run may become a
   personal best.** A database constraint SHALL enforce that last clause rather than trusting
   application code.
4. Replays SHALL be stored as gzip-compressed `bytea` on `runs`, not in object storage. Neon's
   Object Storage is Beta and SHALL be kept off the integrity-critical path.
5. `ranked_score` SHALL be `bigint`, matching the replay header's `int64`.
6. Every attempt SHALL record the exact `game_version_id`, seed, and Rapier build hash it was
   issued against, so any historical run remains re-simulable.
7. Rejected and superseded runs SHALL be retained for audit and investigation, never deleted on
   the write path.

### R2 — Migrations and Neon branching

1. Migrations SHALL be versioned, reviewed, and applied through a single tool.
2. CI SHALL create a Neon database branch per pull request, apply migrations to it, run schema
   and ranking tests against it, and tear it down.
3. Ranking recomputation SHALL be testable against production-shaped data on a branch without
   touching production. This is the primary reason Neon was chosen and it SHALL be exercised.
4. Long-lived Railway processes SHALL connect via the pooled (PgBouncer) connection string using
   node-postgres. Transaction-mode pooler limitations SHALL be accounted for in migration
   tooling, which may need a direct connection.
5. The production branch's autosuspend policy SHALL be an explicit, recorded decision.

### R3 — Identity

1. Authentication SHALL use Neon managed Auth (managed Better Auth) with OAuth providers Google
   and Discord only at launch. Email and magic-link flows are out of scope because a
   transactional email sender would be a third vendor.
2. **Unverified assumption to confirm before designing any email-dependent flow:** whether Neon's
   managed auth bundles an email sender. Confirm during setup.
3. An internal user UUID SHALL be the primary key everywhere; the provider identity SHALL be a
   mapped attribute, so auth stays loosely coupled and replaceable.
4. Handles SHALL be unique, length- and charset-constrained, checked against a reserved-word
   list, and checked for confusable characters.
5. Guests MAY play practice mode. Ranked attempts SHALL require an account.

### R4 — Attempt issuance

1. `POST /v1/games/:gameId/attempts` SHALL return `attempt_id`, a server-generated 128-bit seed,
   `game_version`, an expiry, and an HMAC-signed token bound to user and game version.
2. The client SHALL NOT choose or influence the seed.
3. Each attempt SHALL carry a single-use nonce. Reuse SHALL be rejected.
4. Rate limits SHALL apply per user and per IP.
5. WHEN an attempt is expired, already consumed, belongs to another user, targets the wrong
   season or game version, or carries a tampered token, THEN issuance or submission SHALL be
   rejected with a distinct, non-leaky reason.

### R5 — Submission and verification

1. `POST /v1/attempts/:attemptId/finish` SHALL accept the input replay and a claimed score.
2. **Every ranked run SHALL be verified by re-simulation.** No tiered "elite scores only" model,
   and no ML anomaly detection. A 90-second run is roughly 5,400 headless ticks; full
   verification is affordable, simpler, and strictly stronger.
3. Cheap checks SHALL run synchronously before enqueueing: schema, ownership, expiry, nonce,
   replay size, input cadence plausibility, duration bounds, score envelope.
4. The queue SHALL be a Postgres table consumed with `SELECT ... FOR UPDATE SKIP LOCKED`. No
   Redis, no third vendor.
5. The worker SHALL decode the replay, load the exact pinned game version and Rapier build,
   re-simulate, and compare recomputed score **and** final state hash.
6. The rejection reason taxonomy SHALL be the one defined in Spec 1 design §8.5, extended with
   platform-level reasons. Reasons SHALL be specific enough to explain to a player and to
   investigate with.
7. Verification SHALL be idempotent. A worker crash mid-job SHALL release the lock and the job
   SHALL retry without double-crediting.
8. The client's claimed score SHALL NOT be trusted for any purpose except producing a diff for
   the rejection reason.

### R6 — Per-game leaderboards

1. Leaderboard eligibility SHALL be a player's best **verified** score for a `season_game`.
2. Ranking SHALL be score descending, then that game's published tiebreakers, then `achieved_at`.
3. `RANK()` SHALL be used so genuine ties share a place.
4. Reads SHALL be served from a materialized snapshot with a short cache, fully rebuildable from
   `verified_results`. A test SHALL prove drop-and-rebuild is byte-identical.
5. Index `(season_game_id, score DESC, achieved_at ASC)`.

### R7 — Championship ranking

1. Each game SHALL contribute 0–1,000 points toward the championship.
2. Points SHALL use the **hybrid** model, not raw percentile:
   - Top 100 per game: fixed placement table, 1st = 1000 descending to 900 at 100th.
   - Below 100th: percentile-scaled 0–899.
3. Rationale, recorded so it is not relitigated: pure percentile is unstable (your points move
   when others play and you do not) and pool-size sensitive (first of 20 earns the same as first
   of 20,000). The hybrid is stable where the championship is decided and smooth in the tail.
4. A game SHALL contribute championship points only at **≥50 verified entrants**; below that it
   SHALL display as provisional.
5. Non-participation SHALL score 0. All ten games SHALL count.
6. Overall tiebreakers, in published order: most game wins → most top-10 finishes → highest
   median normalized result → earliest achievement of the total.
7. Standings SHALL be recomputed on cron and SHALL always be labelled "as of «timestamp»".
8. An immutable snapshot SHALL be frozen at season close and SHALL never change afterward.
9. A secondary "Best 6 of 10" ladder MAY be published for casual retention.

### R8 — Daily seeded ladder

1. A second ranked format SHALL exist alongside the fixed-course championship.
2. Daily seeds SHALL be server-issued per game, with their own leaderboards and their own
   snapshots.
3. A per-day attempt cap SHALL be enforced.
4. Yesterday's board SHALL be archived immutably at the UTC boundary.
5. **Daily results SHALL NOT affect championship standings.** A test SHALL prove this.

### R9 — Version pinning

1. Each season SHALL pin `game_version`, `simulation_version`, `scoring_version`, and the Rapier
   build hash.
2. Any competition-affecting change SHALL create a new version and a new leaderboard rather than
   mutating an active one. Cosmetic changes SHALL ship freely.
3. Physics constants, gravity, collision geometry, scoring formulas, and procedural generation
   rules SHALL NOT change silently during an active season.

---

## Out of scope for Spec 2

- Phaser rendering, art, audio, touch controls (Spec 3)
- Any of the ten shipping games (Specs 3–4)
- Deployment, observability, backups (Spec 5)
- Moderation queue and DSA notice-and-action mechanics (Spec 5) — though the `audit_events`
  table and handle validation land here
- Redis, object storage, CDN — deliberately excluded at launch

---

## Definition of done

- [ ] Migrations apply and roll back cleanly on a fresh Neon branch; branch-per-PR live in CI
- [ ] Sign-in works; a handle can be claimed; a second user cannot take it
- [ ] An attempt can be issued, and every rejection path returns a distinct non-leaky reason
- [ ] An honest run verifies; an inflated claimed score is rejected; a tampered input stream is
      rejected with a first-divergence location
- [ ] A worker killed mid-job retries without double-crediting
- [ ] Per-game leaderboard correct on ordering, ties, and "my rank"; snapshot rebuild identical
- [ ] Championship hybrid points correct at the 100th-place boundary and the 50-entrant gate;
      top-100 points provably stable under tail-only churn
- [ ] Daily ladder rotates at UTC, enforces its cap, archives, and provably does not touch the
      championship
