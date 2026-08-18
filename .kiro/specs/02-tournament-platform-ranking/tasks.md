# Spec 2 — Tasks

**Execute in order after this spec is approved.** Spec 1 is merged; the worker
is Node (Branch A). Do not start Spec 3 until Spec 2's exit criteria have
executed-command evidence.

Legend: `[ ]` not started · `[~]` in progress · `[x]` done
Requirement references point at `requirements.md`.

**Executed 2026-08-18.** `pnpm lint`, `pnpm typecheck`, `pnpm build`, and
`pnpm test` (81 passed / 22 files). Honest Test Chamber: score 302, hash
`e6ee35729a0c77b3`. Unauthenticated `POST /v1/games/test-chamber/attempts`
returns `401 UNAUTHENTICATED`. Sign-in UI shows Google + GitHub. GitHub
`schema` job still needs repository secrets `NEON_API_KEY` and
`NEON_PROJECT_ID=still-mouse-62565389`. Do not start Spec 3.

---

## Task 1 — Schema, migrations, Neon branch-per-PR

**Objective:** the entity model in Postgres, with production-shaped migration
testing from the first commit.

- [x] 1.1 Create `packages/db` with Drizzle, `pg`, and Drizzle Kit. Direct URL
      for migrations, pooled URL for app queries. _(R2.1, R2.4)_
- [x] 1.2 Implement the DDL in design §4: enums, tables (including
      `ranking_dirty`), FKs, indexes, seed packing comment. `ranked_score` /
      `claimed_score` / `verified_score` are `bigint`. Replays are `bytea`. _(R1)_
- [x] 1.3 Install the `assert_verified_run` trigger (or equivalent) so
      `verified_results` cannot reference an unverified submission. Test: illegal
      insert is refused. _(R1.3)_
- [x] 1.4 Seed script: season `ci`, game `test-chamber` (`registry_id = 0`),
      pinned `game_versions` matching Spec 1 constants, fixed-course and
      daily-seed `season_games`. _(R9)_
- [x] 1.5 Migrations apply and roll back on a fresh database. Document the
      rollback command. _(R2.1)_
- [x] 1.6 CI `schema` job: Neon branch per PR, migrate, test, teardown. Missing
      secrets on a fork skip with an explicit message; this repo requires them.
      _(R2.2, R2.3)_
- [x] 1.7 Record production autosuspend = off in `docs/adr/0004-spec2-platform-stack.md`
      (already decided). Confirm the Neon project setting when the project is
      created. _(R2.5)_

**Tests:** trigger refusal; migrate up/down; seed is queryable.

**Demo:** open a PR; CI provisions a Neon branch, migrates, runs schema tests,
destroys it.

---

## Task 2 — Auth, profile, handle claim

**Objective:** sign in, claim a handle, own a profile. OAuth-only.

- [x] 2.1 Enable Neon Managed Better Auth on the development branch. Google +
      GitHub (ADR-0004). Do not enable email/password or magic-link. _(R3.1)_
- [x] 2.2 `apps/web` Next.js App Router with the Neon Auth client and
      `app/api/auth/[...path]/route.ts` proxy as in current Neon Next docs.
- [x] 2.3 On first session, upsert `profiles` with internal `user_id` and
      `auth_user_id`. Provider identity is not the PK. _(R3.3)_
- [x] 2.4 `PUT /v1/me/handle` with uniqueness, `HANDLE_PATTERN`, reserved list,
      NFKC check. Distinct `HANDLE_TAKEN` / `HANDLE_INVALID` / `HANDLE_COOLDOWN`.
      30-day cooldown via `handle_changed_at`. Same-handle no-op is 204. _(R3.4, R3.6)_
- [x] 2.5 Ranked routes require a claimed handle. Unauthenticated ranked
      attempts return `UNAUTHENTICATED`. _(R3.5)_
- [x] 2.6 Confirm (and write one line in ADR-0004 if new): Neon Auth's bundled
      email sender exists, and we still are not using it. _(R3.2)_

**Tests:** handle uniqueness; reserved and NFKC refusals; unauthenticated ranked
issue fails. E2E Google sign-in against a Neon branch (dev shared Google
credentials).

**Demo:** sign in with Google, claim a handle, second account refused the same
handle.

---

## Task 3 — Attempt issuance

**Objective:** the server defines the competitive run.

- [x] 3.1 `POST /v1/games/:gameId/attempts` issues `attempt_id`, 16-byte seed
      (four LE uint32, never all-zero), `game_version`, `expiresAt`
      (`now() + 15m`), HMAC token bound to user + game version,
      `dailyCapRemaining`. _(R4.1, R4.2, R4.6)_
- [x] 3.2 Single-use `nonce`. Status `issued`. _(R4.3)_
- [x] 3.3 Rate limits: 10/user/min, 60/user/hour, 30/IP/min. _(R4.4)_
- [x] 3.4 Rejection paths, internally distinct, externally non-leaky where
      required: expired, consumed, wrong user, wrong version, tampered token,
      inactive season, daily cap, unauthenticated. _(R4.5)_
- [x] 3.5 Audit event on every issue and every rejection.

**Tests:** valid issue; each rejection code; nonce uniqueness; degenerate seed
never stored; rate-limit trip and reset.

**Demo:** `curl` a valid attempt, then walk each rejection path.

---

## Task 4 — Submission, queue, verification worker

**Objective:** every ranked run re-simulated in Node. No tiers, no ML.

- [x] 4.1 `POST /v1/attempts/:attemptId/finish` accepts base64 gzip replay +
      claimed score string. Cheap checks first (design §6). _(R5.1, R5.3)_
- [x] 4.2 Persist `runs` + `score_submissions` (`pending`) **before** enqueue.
      Mark attempt `submitted` / nonce consumed in the same transaction. _(R5.4)_
- [x] 4.3 `apps/worker` claims with `FOR UPDATE SKIP LOCKED`, including stale
      locks. _(R5.4, R5.7)_
- [x] 4.4 Worker: `decodeReplay` → load Test Chamber + pinned Rapier →
      `playReplay` → compare score **and** hash. Reason taxonomy from design §6.
      _(R5.2, R5.5, R5.6)_
- [x] 4.5 Success path: `verified_results`, conditional `game_bests` upsert
      (strictly better only), dirty flag. _(R1.3, R6.1)_
- [x] 4.6 Kill-worker test: lock released, job completes exactly once, no
      double `verified_results`. _(R5.7)_
- [x] 4.7 Inflated claimed score → `SCORE_MISMATCH` + `first_divergent_tick`.
      Tampered inputs → `STATE_HASH_MISMATCH` or score mismatch. Claimed score
      is never written to `game_bests`. _(R5.8)_
- [x] 4.8 After 5 claims without success: `jobs.state = failed`,
      `reason_code = WORKER_FAULT`, no `verified_results` row. _(R5.7)_

**Tests:** honest Test Chamber fixture verifies to 302 / `e6ee35729a0c77b3`
(or the committed golden if versions bump). Adversarial cheap checks. Retry
idempotency.

**Demo:** submit `packages/game-test-chamber/fixtures/sample.swr` and watch
verified. Submit claimed score `999999999` and watch rejection + audit row.

---

## Task 5 — Per-game leaderboard

**Objective:** correct, rebuildable per-game ranking.

- [x] 5.1 `game_bests` is the eligibility source. `RANK()` over score desc,
      `achieved_at` asc. Shared places. _(R6.1–R6.3)_
- [x] 5.2 Snapshot `ranking_snapshots` with `asOf`. `GET /v1/leaderboards/...`
      reads the snapshot, never live window functions on the request path. _(R6.4)_
- [x] 5.3 Drop-and-rebuild test: payloads byte-identical. _(R6.4)_
- [x] 5.4 Viewer rank row on the payload even when the viewer is not on the
      current page. Keyset pagination (design §8.1). Index
      `(season_game_id, score DESC, achieved_at ASC)`. _(R6.5)_
- [x] 5.5 Worse scores do not replace a PB; equal scores keep the earlier row.

**Demo:** three accounts; board order and ties; delete snapshot; rebuild; diff
empty.

---

## Task 6 — Championship ranking

**Objective:** hybrid points, gate, freeze.

- [x] 6.1 Implement `placement` / `tail` integer formulas from
      `docs/competitive-spec.md` §11 in `packages/platform`. Table-drive the
      1st=1000, 100th=900, 101st-just-below-900, last=0 cases. _(R7.1–R7.3)_
- [x] 6.2 Entrant gate: `< 50` → 0 points + `provisional`. _(R7.4)_
- [x] 6.3 Non-participation is 0. Only `fixed-course` season games. _(R7.5, R8.5)_
- [x] 6.4 Tiebreakers: wins → top-10 → integer median (design §10.1) → earliest
      total. Table-drive odd `n` and even `n` (lower central value). _(R7.6)_
- [x] 6.5 Dirty-flag recompute with 30s floor + hourly cron. Every payload has
      `asOf`. _(R7.7)_
- [x] 6.6 Season close: freeze snapshot, `frozen = true`, subsequent recomputes
      do not mutate it. _(R7.8)_
- [x] 6.7 Churn test: add tail-only verified results; top-100 points unchanged.
      _(R7.3)_
- [x] 6.8 Do **not** ship Best-6-of-10. `snapshot_scope` may include `best6`.
      _(R7.9)_

**Demo:** table with per-game columns, provisional badge, `asOf` advancing,
churn test log.

---

## Task 7 — Daily seeded ladder

**Objective:** second ranked format that cannot touch the championship.

- [x] 7.1 `daily_boards` + UTC rotation cron. _(R8.1, R8.2, R8.4)_
- [x] 7.2 Per-day cap of 5 ranked attempts per user per game. _(R8.3)_
- [x] 7.3 Yesterday archived (`archived_at` set). Today's seed is what issuance
      returns for `seedPolicy: 'daily-seed'`.
- [x] 7.4 Isolation test: daily verified run leaves championship snapshot
      bytes unchanged. _(R8.5)_

**Demo:** hit the cap, cross UTC (clock injected in tests), fresh seed,
yesterday archived, championship untouched.

---

## Exit criteria

All of `requirements.md` Definition of done, with executed-command evidence:

- [~] Migrations apply on the Spec 2 Neon project. Rollback is documented and
      coded (`rollbackInitial`, `ci-schema` up-down-up). Branch-per-PR CI is
      wired; it needs GitHub secrets `NEON_API_KEY` and
      `NEON_PROJECT_ID=still-mouse-62565389` before that job is live.
- [x] Sign-in UI (Google + GitHub) and unique handle claim. Live Google OAuth
      callback was not completed in this environment (GitHub needs a console
      OAuth app).
- [x] Attempt issuance; every rejection path distinct internally
- [x] Honest run verifies; inflated claim rejected; tampered inputs rejected
      with a first-divergence location
- [x] Worker killed mid-job retries without double-crediting
- [x] Per-game board: order, ties, my-rank, rebuild identical
- [x] Championship hybrid correct at 100th and 50-entrant gate; top-100 stable
      under tail churn
- [x] Daily ladder rotates, caps, archives, and cannot touch championship

**Then stop.** Spec 3 (Phaser kit + Hookline Sprint) waits for approval.
