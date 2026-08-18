# Spec 5 — Tasks

**Status:** approved 2026-08-18; executing. Spec 4 is merged (PR #4).

Legend: `[ ]` not started · `[~]` in progress · `[x]` done
Goldens: Hookline `9c52d8f426f31ee1`, Pickaxe `6b03896db5837763` — do not
regenerate. Game docs in `docs/games/*.md` still win for sim numbers.

---

## Task 1 — Build-time asset pipeline

**Objective:** provenance and a generate path that cannot leak into
runtime. Shipped files are committed. Plan ref 19.

- [ ] 1.1 `sources/brand/` human logo + wordmark (SVG). Copy to
      `apps/web/public/assets/brand/`. Catalogue / auth header uses them.
      Class `human` in the ledger. _(R1.7)_
- [ ] 1.2 `docs/assets/prompts/` at least one YAML (badge or background)
      with `provider`, `model`, `prompt`. `scripts/assets-build.mjs` + root
      `pnpm assets:build`: no keys → exit 0 with "skipped"; keys present →
      write `assets/generated/` only. _(R1.1, R1.5, ADR-0007.3)_
- [ ] 1.3 `docs/assets/ledger.md` + `scripts/check-asset-ledger.mjs`. CI
      `verify` runs it. Every `apps/web/public/assets/**` file listed;
      SHA-256 matches. _(R1.6)_
- [ ] 1.4 `scripts/check-no-runtime-ai.mjs` greps built `apps/web/.next`
      (after `pnpm --filter @stickworld/web build`) and `apps/worker/dist`
      plus `games/*/dist` if present for hostnames in design §3. Add to
      `verify`. Playwright: `/play/hookline-sprint` practice records
      requests; banned hosts count 0. _(R1.2)_
- [ ] 1.5 Confirm no `games/*/src/simulation/**` import from `public/assets`.
      Contract tests still green; Hookline/Pickaxe hashes unchanged. _(R1.4,
      R1.8)_
- [ ] 1.6 Voice: either commit one short SFX under `public/assets/sfx/`
      with ledger class `human` or `generated-then-human-edited`, or ship
      silent and note "no VO" in known-issues. Do not block on Deepgram.
      _(R1.9)_

**Tests:** ledger script; no-runtime-ai; Playwright network; goldens.

**Demo:** ledger walk; network panel on a practice run; `pnpm assets:build`
without keys prints skipped.

---

## Task 2 — PvP seam

**Objective:** formal `InputSource`, three-source identity, ADR. No
netcode. Plan ref 20.

- [ ] 2.1 `packages/input/src/source.ts`: `QuantisedInput`, `InputSource`,
      `LocalInputSource`, `ReplayInputSource`, `ScriptedInputSource`. Unit
      tests for tick grouping. _(R2.1, R2.2)_
- [ ] 2.2 `playReplay` applies via `ReplayInputSource`. GameHost `tickClock`
      applies via `LocalInputSource`. Recorder still used for encode.
      _(R2.4)_
- [ ] 2.3 Three-source test in `packages/input/tests/source-identity.test.ts`
      (or game-test-chamber): same fixture, three sims, equal score + hash.
      _(R2.3)_
- [ ] 2.4 `docs/adr/0008-pvp-seam.md`. Explicitly list what is not built.
      _(R2.5, R2.6)_
- [ ] 2.5 Re-run Hookline + Pickaxe Node goldens and `pnpm replay:verify`
      on both samples. Byte-identical. _(R2.4)_

**Demo:** three-source test green plus ADR-0008. No room code in the diff.

---

## Task 3 — Integrity, abuse, and compliance

**Objective:** adversarial suite, UGC queue, GDPR. Plan ref 21.

- [ ] 3.1 Migration: enums/tables in design §5. `upsertProfile` stores
      email. `normalizeHandle` rejects `^d-[0-9a-f]{12,13}$`. Existing
      `ci` season `entry_policy = 'open'`. _(R3.8, R7)_
- [ ] 3.2 Platform tests for finish paths: each replay decode error code
      via `finishAttempt` (not only `replay.test.ts`); `ATTEMPT_CONSUMED`
      nonce reuse; `ATTEMPT_EXPIRED`; `RATE_LIMITED` on issue; second user
      not sharing the first user bucket. Clock: fake `now` past `expiresAt`
      while payload still looks fresh. _(R3.1)_
- [ ] 3.3 Host/platform: `stop` without finish does not verify; expired
      issued attempt cannot finish. Ranked `setPaused` still throws.
      _(R3.2, R3.3)_
- [ ] 3.4 `POST /v1/reports` unauthenticated, IP rate-limit, hashes IP.
      `GET/POST /v1/moderation/...` moderator-only. Force-release handle,
      suspend, notices. Audit rows. Playwright or request tests for the
      HTTP shape. _(R3.4, R3.5, R3.6)_
- [ ] 3.5 `GET /v1/me/export`, `POST /v1/me/delete`. After delete,
      championship rebuild still includes the anonymised row as `retired`.
      Re-login as the same Neon user must not revive the old handle
      (auth id is `deleted:…`; they would create a new profile). _(R3.7)_
- [ ] 3.6 `next.config.ts` headers + `docs/ops/security-headers.md`. Play
      e2e still loads `/play/hookline-sprint`. _(R3.10)_
- [ ] 3.7 `/legal` page: 13+, UGC, export/delete, no prizes. Email signup
      checkbox. _(R3.11)_
- [ ] 3.8 Invite-season issue: `NOT_INVITED` without `ranked_invites` row;
      moderator bypass; practice still 200. _(R7.1)_

**Demo:** file a report as a guest, action it as moderator, see the
notice. Export then delete; board shows `retired`.

---

## Task 4 — Cross-browser and device QA

**Objective:** CI matrix + budget file. Real phones are demo gates. Plan
ref 22.

- [ ] 4.1 Playwright projects: chromium, firefox, webkit, mobile-webkit
      (iPhone 12), mobile-chromium (Pixel 5). CI installs those browsers.
      Catalogue + one practice play test run on each. _(R4.1)_
- [ ] 4.2 Lazy-load: visit every `/play/<slug>`, assert the other nine
      client package URL fragments are absent. _(R4.3)_
- [ ] 4.3 Keep `score:browser` for all ten games (already in CI). Record
      Hookline + Test Chamber verify duration `< 5 s` in a worker/platform
      test. _(R4.2, design §6)_
- [ ] 4.4 `docs/budgets/spec5-qa.md` table (bundle ceiling, replay caps,
      CI verify duration). Real-device rows left `pending` until demo.
      _(R4.4, R4.5)_
- [ ] 4.5 `docs/ops/device-qa.md` checklist. Do not claim phones passed
      without a capture. _(R4.4)_

**Demo:** CI table in the Actions log; later, device video on Task 6.

---

## Task 5 — Operations

**Objective:** deploy, observe, roll back, restore. Plan ref 23.

- [ ] 5.1 `GET /v1/health`. Telemetry stdout when
      `STICKWORLD_TELEMETRY=1`; new event names from design §7. Worker
      emits verify ok/reject/duration. _(R5.3, R5.4)_
- [ ] 5.2 `docs/ops/railway.md`: web / worker / cron start commands, env
      **names**, migrate-on-release, worker not public. Commit Nixpacks or
      Railway config only if the monorepo otherwise will not build. _(R5.1,
      R5.2)_
- [ ] 5.3 Worker start fails if Drizzle migrations are pending
      (`packages/db` journal vs `drizzle/*.sql`). _(R5.2)_
- [ ] 5.4 `docs/ops/neon.md` restates autosuspend = 0. `docs/ops/metrics.md`
      SQL. `docs/ops/rollback.md`. _(R5.5, R5.7)_
- [ ] 5.5 Staging broken-deploy demo: health 500 → rollback → 200. Record
      evidence in the Task 5 PR body. _(R5.5)_
- [ ] 5.6 PITR restore demo per `docs/ops/pitr-restore.md`. Ranking
      rebuild checksum. _(R5.6)_
- [ ] 5.7 Confirm production web/worker env does not list Gemini/Deepgram/
      OpenRouter keys (checklist in railway.md). _(R5.9)_

**Demo:** health 200; one JSON telemetry line in Railway logs; rollback
and PITR evidence.

---

## Task 6 — Internal tournament, closed beta, freeze, launch

**Objective:** production-shaped seasons, then freeze. Plan ref 24.
**Blocked on:** Task 3 and Task 5 exit evidence. Task 1 ledger + Task 4
CI matrix should be green; real-device rows may complete during
`internal-0`.

- [ ] 6.1 Amend `docs/competitive-spec.md` §11 (design §12). `rules_version
      = 2`. `docs/rulebook.md` player-facing. Championship UI copy: nine
      games, Pogo weekly-only, max 9,000. _(R8.2, R8.3, R8.4)_
- [ ] 6.2 Seed `internal-0` invite season. Staff in `ranked_invites`. Run
      the human edge list; every item already has an automated test from
      Task 3. Close season; frozen snapshot. _(R6)_
- [ ] 6.3 Seed `beta-0` (14 days, 24 invites). Metrics SQL from
      `docs/ops/metrics.md`. Versioned fixes only. _(R7)_
- [ ] 6.4 `docs/known-issues.md` including PR #4 presentation leftovers
      still open. Device-qa captures attached to the launch PR. _(R4.4,
      R8.3)_
- [ ] 6.5 Legal gate: counsel review recorded in
      `docs/legal/brand-and-ip-clearance.md`. If uncleared, **do not**
      open `season-1` to the public; stop and report. _(R8.5)_
- [ ] 6.6 Open `season-1` (`open`, 28 days) only after freeze checklist
      in R8.2. No golden regen. No Rapier bump. _(R8)_

**Demo:** frozen `internal-0` snapshot; published rulebook; `season-1`
live or an explicit legal stop.

---

## Exit criteria

All of `requirements.md` Definition of done, with executed-command
evidence (hashes, CI logs, restore checksums). Never describe an
unexecuted check as passing.

**Then stop.** There is no Spec 6 in this index. Post-launch work
(Cloudflare, Sentry, Best 6, VO pack, GitHub login) needs a new spec.
