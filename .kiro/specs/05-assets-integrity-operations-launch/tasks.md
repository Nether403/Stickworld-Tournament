# Spec 5 — Tasks (scope depth)

**Do not execute yet.** Deepened after Spec 4 lands.

---

## Task 1 — Build-time asset pipeline

**Objective:** generated art and voice as static build output, never a runtime dependency.

**Acceptance gate:** `pnpm assets:build` reproduces the full set from committed prompts and
sources. A network test proves zero requests to Gemini, Deepgram, or OpenRouter during a ranked
run. The provenance ledger covers every shipped asset. Brand marks are human-authored or
generated-then-human-edited. Collision geometry remains hand-authored.

**Demo:** regenerate the whole asset set from a clean checkout. Open the browser network panel
during a ranked run and show zero third-party AI calls. Walk the ledger.

---

## Task 2 — PvP seam

**Objective:** keep live multiplayer a later addition rather than a rewrite, at near-zero present
cost.

**Acceptance gate:** `InputSource` formalised with local and recorded implementations. A test
drives one simulation from local, recorded, and a scripted "remote" stub with identical outcomes,
proving no local-input assumption leaked into game rules. An ADR records what a future
authoritative-room model would add and what it would not change.

**Explicitly not built:** rooms, matchmaking, netcode, reconciliation.

**Demo:** the three-source test green, plus the ADR.

---

## Task 3 — Integrity, abuse, and compliance

**Objective:** close the adversarial and compliance gaps before strangers arrive.

**Acceptance gate:** adversarial suite green across malformed and oversized replays, duplicate
nonces, expired attempts, background-tab and refresh mid-run, clock skew, and rate-limit evasion.
A report flows through the moderation queue with a full audit trail and produces a statement of
reasons. GDPR export returns complete records; deletion removes personal data while preserving
anonymised competitive-integrity records so past standings stay coherent.

**Worth restating:** the handle field alone makes this a host of user-generated content. This task
is not optional on the grounds that there is no chat.

**Demo:** walk the adversarial suite, then file a report and action it end to end.

---

## Task 4 — Cross-browser and device QA

**Objective:** evidence per game per browser against declared budgets.

**Acceptance gate:** Playwright matrix across Chromium, Firefox, WebKit desktop plus mobile
Chromium and mobile WebKit. Per game: bundle size, load time, physics frame time, render frame
time, memory, replay size, validation duration. Real-device passes on a mid-range Android and an
iPhone. CI fails on regression. Opening one game provably fetches nothing belonging to another.

**Demo:** the CI report table, plus real-device capture of the two heaviest games — Demolition
Dive and Balance Bike Blitz — meeting frame-time budget.

---

## Task 5 — Operations

**Objective:** deploy, observe, roll back, restore.

**Acceptance gate:** two Railway services plus cron with private networking. Migrations gated in
deploy. Observability across web, API, worker, and ranking recompute with the full tag set.
Backups with a restore that has actually been run. Rollback runbook written and exercised. Neon
autosuspend policy recorded as an explicit decision.

**Demo:** break a deploy deliberately, detect it, roll it back. Then restore a Neon branch via PITR
and rebuild every leaderboard from `verified_results`, matching production. The second demo is what
proves "Postgres is the source of truth" is real rather than aspirational.

---

## Task 6 — Internal tournament, closed beta, freeze, launch

**Objective:** run a complete season on production systems before the public sees one.

**Acceptance gate:** the full edge-case list from `requirements.md` R6.2 exercised, each one
gaining an automated regression test afterward. Closed beta metrics reviewed with specific
attention to games where a small exploit yields disproportionate scores. All competition-affecting
values frozen. Rulebook and known-issues page published.

**Demo:** a complete internal season start to finish producing an immutable final snapshot, then
the published rulebook.

---

## Exit criteria

See `requirements.md` § Definition of done and § Launch quality bar.
