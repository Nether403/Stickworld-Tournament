# Spec 2 — Tasks (scope depth)

**Do not execute yet.** Sub-tasks are written when this spec is deepened, after Spec 1's
determinism fork resolves and the user approves the revision.

Each task below states its objective, its acceptance gate, and its demo. That is enough to
sequence and estimate; it is not yet enough to implement from, by design.

---

## Task 1 — Schema, migrations, Neon branch-per-PR

**Objective:** the full entity model in place, with production-shaped migration testing from the
first commit.

**Acceptance gate:** migrations apply and roll back cleanly on a fresh Neon branch. The
database-level constraint that only a verified run can become a personal best is proven by a
test that attempts the illegal write and is refused. CI creates, migrates, tests, and tears down
a branch per PR.

**Demo:** open a PR; watch CI provision a Neon branch, migrate it, run schema tests, destroy it.
A seeded season with one game is queryable.

---

## Task 2 — Auth, profile, handle claim

**Objective:** sign in, claim a handle, own a profile. OAuth-only.

**Acceptance gate:** Google and Discord sign-in work. Internal user UUID is the primary key with
provider identity as a mapped attribute. Handle uniqueness, charset, length, reserved words, and
confusable characters all enforced. Guests can reach practice mode and are refused ranked
attempts.

**Blocking question:** confirm whether Neon managed auth bundles an email sender before designing
any email-dependent flow.

**Demo:** sign in with Google, claim a handle, view a profile. A second account is refused the
same handle with a clear message.

---

## Task 3 — Attempt issuance API

**Objective:** the server, not the client, defines what a competitive run is.

**Acceptance gate:** issuance returns `attempt_id`, a server-generated 128-bit seed, game
version, expiry, and an HMAC-signed token bound to user and game version. Nonce reuse, expiry,
wrong-user, wrong-version, and tampered-token paths each return a distinct, non-leaky reason.
Rate limits trip and reset.

**Demo:** `curl` a valid attempt, then walk each rejection path showing distinct reasons and no
information leakage.

---

## Task 4 — Submission, queue, and verification worker

**Objective:** every ranked run re-simulated. No tiers, no ML anomaly detection.

**Acceptance gate:** cheap checks reject early with typed reasons. Runs and replays persist
immutably before enqueueing. The worker consumes with `FOR UPDATE SKIP LOCKED`, re-simulates
against the exact pinned game version and Rapier build, and compares both recomputed score and
final state hash. A worker killed mid-job releases its lock and retries without double-crediting.
A tampered input stream is rejected with a first-divergence tick.

**Fork dependency:** if Spec 1 lands on Branch B1, this worker runs headless Chromium rather than
Node. Pipeline shape unchanged; throughput and image size change.

**Demo:** submit an honest run and watch it reach verified. Submit an inflated claimed score and
watch it rejected with a recorded reason and audit entry. Kill the worker mid-verification and
show the job completing exactly once.

---

## Task 5 — Per-game leaderboard

**Objective:** correct, rebuildable per-game ranking.

**Acceptance gate:** ordering, shared places for genuine ties, and a correct viewer rank row.
Better scores replace personal bests; worse ones do not. Snapshot drop-and-rebuild is
byte-identical to the original.

**Demo:** three accounts submit runs; the board shows correct order and ties. Delete the
snapshot, rebuild from `verified_results`, show identical output.

---

## Task 6 — Championship ranking

**Objective:** aggregate ten unlike score scales into one fair, stable table.

**Acceptance gate:** hybrid points correct at the 100th-place boundary and either side of it.
The 50-entrant gate correctly withholds points and marks a game provisional. Top-100 points
provably unchanged when only tail players submit new scores — this is the specific defect the
hybrid exists to fix, so it gets its own test. All four tiebreakers exercised. Season-close
snapshot immutable thereafter.

**Demo:** championship table with ten point columns and totals, a provisional badge on a
sub-gate game, and an `asOf` timestamp that advances on recompute. A churn test showing top-100
stability.

---

## Task 7 — Daily seeded ladder

**Objective:** the second ranked format, without destabilising the championship.

**Acceptance gate:** daily seeds rotate at the UTC boundary, per-day attempt cap enforced and
reset, yesterday archived immutably, and a test proving a daily submission cannot alter
championship standings.

**Demo:** play the daily ladder, hit the cap, cross the UTC boundary, see a fresh seed with
yesterday archived and the championship untouched.

---

## Exit criteria

See `requirements.md` § Definition of done. Every item proven by executed commands with captured
output — not code inspection.
