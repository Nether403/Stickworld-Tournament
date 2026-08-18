# Spec 5 — Design

**Depth:** full. This document is detailed enough to implement from directly.
**Fork:** Branch A (ADR-0001). Worker stays Node.
**Launch contracts:** ADR-0007.
**Status:** approved 2026-08-18; executing.

The previous scope draft named six tasks and five open questions. Those
questions are closed in ADR-0007. Goldens and `docs/games/*.md` still win
for simulation numbers.

---

## 1. Design principle

> Strangers can compete only after the server is the whole of score trust,
> the host is a UGC/compliance adult, and ops can roll back and restore.
> Cosmetics must not touch goldens. No third production vendor.

```
Task 2  InputSource + ADR-0008          (independent; goldens identical)
Task 3  Integrity / GDPR / moderation   (schema; before strangers)
Task 1  Asset pipeline + ledger         (cosmetics; operator generate)
Task 4  Browser matrix + budgets        (CI; real device is demo)
Task 5  Railway + Neon + telemetry      (before production seasons)
Task 6  internal-0 → beta-0 → season-1
```

Task 6 cannot start without Task 3 and Task 5 exit evidence. Task 1 is not
on that critical path except for the network/ledger CI gates. Task 4's CI
matrix can merge before real-device capture; public launch cannot.

---

## 2. Repository layout (what Spec 5 adds)

```
docs/
  adr/0007-spec5-launch-contracts.md
  adr/0008-pvp-seam.md
  assets/prompts/*.yaml            # operator inputs; committed
  assets/ledger.md                 # every shipped file
  budgets/spec5-qa.md              # written when measured
  ops/railway.md
  ops/neon.md
  ops/rollback.md
  ops/pitr-restore.md
  ops/metrics.md                   # SQL for mismatch rate, etc.
  ops/security-headers.md
  ops/device-qa.md                 # demo-gate checklist
  rulebook.md                      # player-facing, Task 6
  known-issues.md                  # Task 6, start with PR #4 leftovers
sources/brand/                     # human logo / wordmark / mascot
apps/web/public/assets/            # committed shipped files
apps/web/app/v1/health/route.ts
apps/web/app/v1/reports/route.ts
apps/web/app/v1/me/export/route.ts
apps/web/app/v1/me/delete/route.ts
apps/web/app/v1/me/notices/route.ts
apps/web/app/v1/moderation/route.ts
apps/web/app/legal/page.tsx
apps/web/public/assets/.gitkeep    # until first shipped file
scripts/check-no-runtime-ai.mjs
scripts/check-asset-ledger.mjs
scripts/assets-build.mjs           # optional; fails closed without keys
packages/input/src/source.ts
packages/db/src/schema.ts          # new tables / enums
```

`assets/generated/` stays gitignored. Do not add `@sentry/*` or
`@opentelemetry/*`.

---

## 3. Asset pipeline

Prompt YAML (`docs/assets/prompts/ui-badges.yaml` shape):

```yaml
id: ui-badge-verified
provider: gemini
model: gemini-2.5-flash-image
class_default: generated-then-human-edited
prompt: |
  Flat 64px badge, two colours from the UI tokens, no text…
```

`pnpm assets:build` (root script → `scripts/assets-build.mjs`):

1. Read every `docs/assets/prompts/*.yaml`.
2. Call the provider. Write `assets/generated/<id>.png` (or `.ogg`).
3. Print the output path. Do not copy to `public/` automatically.

Operator copies chosen files to `apps/web/public/assets/…` and appends a
ledger row. CI never calls the APIs.

Ledger columns: `path`, `sha256`, `class`, `prompt_id` (nullable for
pure `human`), `notes`.

Banned hostnames (network test + bundle grep), exact match only:

- `generativelanguage.googleapis.com`
- `api.deepgram.com`
- `openrouter.ai`

Do not ban all of `googleapis.com`. Do not block `accounts.google.com` or
the Neon Auth host.

Brand marks: SVG or PNG in `sources/brand/`, copied to
`public/assets/brand/`. Phaser games may keep capsules until a game's
textures exist; shipping a logo in the shell is enough for Task 1 exit.
Replacing every game's primitives is **not** required to merge Task 1.

---

## 4. `InputSource`

```ts
export type QuantisedInput = { actionId: number; value: number };

export interface InputSource {
  inputsForTick(tick: number): readonly QuantisedInput[];
}
```

| Class | File | Behaviour |
|---|---|---|
| `ReplayInputSource` | `packages/input/src/source.ts` | Walks `InputEvent[]` already sorted by tick |
| `LocalInputSource` | same | Buffer filled by `push(tick, actionId, value)` from GameHost.input |
| `ScriptedInputSource` | same | `ReadonlyMap<number, readonly QuantisedInput[]>` |

`packages/replay/src/player.ts` `playReplay` builds a `ReplayInputSource`
and, per tick, `applyInputsInOrder(..., source.inputsForTick(tick))`.

GameHost `tickClock` uses `this.inputs.inputsForTick(tick)` instead of
slicing `recorder.snapshot()` for the apply path. It still records into
`Recorder` for encode. `host.input` calls `shouldRecordChange`, then
`recorder.record` and `local.push(sim.tick, …)`.

Three-source test: decode `packages/game-test-chamber/fixtures/sample.swr`
(or Hookline sample). Drive three fresh sims. Assert equal score and
`stateHash`. Scripted map is the same events grouped by tick.

ADR-0008 is short: future rooms add a transport and a
`NetworkInputSource`; they do not change `Simulation`, `SWR1`, scoring
aggregators, or Neon schema.

---

## 5. Schema increments (Task 3)

All additive. No change to attempt/run/verify relations.

```
profile_status: active | suspended | anonymised     -- add value
profiles.role: player | moderator                   -- new enum, default player
profiles.email: citext nullable unique              -- from Neon Auth at upsert

seasons.entry_policy: invite | open                 -- default open for
                                                    -- existing ci season

ugc_reports
  id uuid pk
  reporter_user_id uuid null references profiles
  reporter_ip_hash text not null
  target_user_id uuid not null references profiles
  reason_code text not null   -- handle_impersonation | handle_offensive | other
  details text not null default ''
  status: open | dismissed | actioned
  created_at

moderation_actions
  id uuid pk
  report_id uuid null references ugc_reports
  actor_user_id uuid not null references profiles
  target_user_id uuid not null references profiles
  action: dismiss | force_release_handle | suspend | unsuspend
  reason_code text not null
  reason_text text not null
  created_at

ranked_invites
  email citext pk
  invited_at timestamptz not null
  consumed_at timestamptz
  consumed_user_id uuid references profiles
```

IP hashing: SHA-256 of `ip + ATTEMPT_HMAC_SECRET` (already required).
Store hex. Do not store raw IP.

`upsertProfile` writes `email` when the auth payload includes one.
Invite check: if `seasons.entry_policy = 'invite'` and role is not
`moderator`, require `ranked_invites.email = profile.email` (or auth
email if profile.email is null). Stamp `consumed_*` on first successful
ranked issue.

Anonymise (`POST /v1/me/delete`):

- `status = 'anonymised'`
- `handle = 'd-' + first 12 hex of sha256(userId)` (retry on citext clash
  by appending a counter nibble — still matching `^d-[0-9a-f]{12,13}$`)
- `email = null`, `auth_user_id = 'deleted:' + userId`
- Keep `verified_results` / `runs` / `audit_events`
- Ranking display: if `status = 'anonymised'` show handle as `retired`
  (do not show `d-…` publicly)

Export: JSON snapshot, `Content-Disposition: attachment`. No other
players' PII.

Moderator routes: `GET /v1/moderation/reports?status=open`,
`POST /v1/moderation/reports/:id/action` with `{ action, reason_code,
reason_text }`. `requireModerator` uses `profiles.role`. CI seeds no
moderator; tests insert one.

New reason codes: `NOT_INVITED`, `UGC_REPORT_RATE`, `ALREADY_ANONYMISED`,
`FORBIDDEN` stays non-leaky for non-moderators hitting moderation URLs.

Season close vs in-flight attempt (R6.2 last item): **once `seasons.status`
is `closing` or `closed`, `finishAttempt` rejects with `SEASON_INACTIVE`.**
Issued attempts expire naturally. Close job first sets `closing`, waits
until `now > max(attempts.expires_at)` for issued/active rows **or** a
fixed 15-minute grace equal to `ATTEMPT_TTL_SECONDS`, then `closed` and
frozen snapshot. Internal tournament human pass must start close when no
one is mid-run; the test uses a fake clock.

---

## 6. Budgets (CI)

Replay class caps — already in Spec 4; keep asserting on sample fixtures:

| Class | Games | Compressed ceiling |
|---|---|---|
| tiny | Hookline, Launch, Archery, Hammer | 5_120 |
| small | Pickaxe, Pogo | 15_360 |
| medium | Rooftop, Bike, Cargo | 40_960 |
| large | Demolition | 81_920 |

Play bundle: existing `docs/budgets/spec3-bundles.json` ceiling **683301**.
Do not silently re-baseline because assets were added; if the shell logo
pushes gzip over, either compress/trim the asset or bump the baseline in
a dedicated commit that records why.

Physics budgets: manifests already declare `maxRigidBodies` etc. Contract
suite already asserts them. Spec 5 does not raise caps.

Validation duration: platform integration (or worker unit) asserts a
Test Chamber + Hookline fixture verify each complete in **< 5 s** on CI
hardware. Not a production SLO.

---

## 7. Telemetry and metrics

`packages/telemetry` `emit`:

```ts
if (process.env.STICKWORLD_TELEMETRY === '1') {
  process.stdout.write(JSON.stringify({ ts: new Date().toISOString(), name, ...tags }) + '\n');
}
```

Worker `verify.ts` emits `verify.ok` / `verify.reject` with
`reasonCode` and `verify.duration_ms`. Host already emits start/finish;
add `seasonId` when the ranked session has it, `deviceClass` from a
coarse UA parse on the server at issue/finish (do not trust a client
field for this).

`docs/ops/metrics.md` is SQL, not a vendor dashboard:

- mismatch rate: `score_submissions.reason_code = 'SCORE_MISMATCH'` / verified
  in the last 15 minutes
- verification duration: application logs (`verify.duration_ms`)
- abandonment: attempts `issued|active` past `expires_at`
- jobs backlog: `verification_jobs.state in ('queued','locked')`

Alerting at launch: Railway healthcheck on `/v1/health`. A mismatch-rate
page in ops SQL. No PagerDuty.

---

## 8. Railway / Neon topology

```
Railway project (one)
├── web      Next start, public, health /v1/health
│              release: pnpm db:migrate
├── worker   node apps/worker dist, private
└── cron     three schedules, same worker image, different args
               hourly  recompute-rankings
               00:05Z  rotate-daily
               (manual / season end) close-season

Neon project still-mouse-62565389
├── production  autosuspend = 0 (already)
├── PR branches CI schema job (already)
└── restore-drill-*  PITR demo only
```

Commit `docs/ops/railway.md` with service start commands, required env
names (**names only**: `DATABASE_URL`, `DATABASE_URL_UNPOOLED`,
`ATTEMPT_HMAC_SECRET`, `NEON_AUTH_*`, `STICKWORLD_TELEMETRY`). Root
`nixpacks.toml` or per-service Railway settings as actually required by
the monorepo; do not invent a Docker stack if Nixpacks builds `pnpm`.

Worker private networking: do not bind a public HTTP server on worker.

Rollback: Railway → previous successful deploy for that service. If a
migration already applied, **do not** down-migrate production; forward-fix.
The broken-deploy demo uses a staging environment: deploy a web image
whose `/v1/health` is patched to 500, confirm probe fail, roll back,
confirm 200. Do not do this on the public production URL if beta is live.

PITR demo: Neon console → branch from PITR timestamp → `DATABASE_URL*`
pointed at it → `pnpm --filter @stickworld/platform` ranking rebuild
helper (extract the existing recompute into a CLI if not already)
→ checksum `ranking_snapshots.payload` against a copy taken before the
drill. Record the commands and the matching hashes in the PR that closes
Task 5.

---

## 9. Security headers

`apps/web/next.config.ts` `headers()` for `/:path*`. CSP sketch (adjust
only if a real blocked resource appears, and document it):

```
default-src 'self';
script-src 'self' 'wasm-unsafe-eval';
style-src 'self' 'unsafe-inline';
img-src 'self' data:;
connect-src 'self' <NEON_AUTH_ORIGIN> accounts.google.com;
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
```

`unsafe-inline` style is accepted for Next/Phaser. Do not add
`'unsafe-eval'` unless a captured CSP report shows it is required; prefer
`wasm-unsafe-eval` only. No `connect-src` to AI hosts.

---

## 10. QA matrix

`apps/web/playwright.config.ts` projects:

| name | device |
|---|---|
| chromium | Desktop Chrome |
| firefox | Desktop Firefox |
| webkit | Desktop Safari |
| mobile-webkit | iPhone 12 (existing `mobile`) |
| mobile-chromium | Pixel 5 |

Keep `fullyParallel: false` if tests share a server. CI `determinism` job
already installs Playwright browsers for sim-core; web e2e must
`playwright install` firefox/webkit with deps.

Lazy-load: one test that visits each `/play/<slug>` and asserts the other
nine client package names do not appear in requested URLs (pattern from
existing Hookline/Pickaxe tests).

Real device: `docs/ops/device-qa.md` checklist — frame time "playable",
touch, and a ranked finish on Hookline if a test account exists. Capture
is a walkthrough artifact at Task 6, not a PNG in git.

---

## 11. Seasons

| slug | entry_policy | length | who |
|---|---|---|---|
| `ci` | `open` | existing | tests (unchanged) |
| `internal-0` | `invite` | until edge list signed off; target ≤ 7 days | staff |
| `beta-0` | `invite` | 14 days | 24 invites |
| `season-1` | `open` | 28 days | public |

`rules_version` on `season-1` matches competitive-spec after §11 amendment.

Championship games (registry ids): 1, 2, 3, 4, 5, 7, 8, 9, 10.
Pogo (6) excluded.

---

## 12. Competitive-spec amendment (Task 6, not before approval)

Replace §11 opening:

> Each championship game contributes 0–1,000 points. Championship games
> are the season's `fixed-course` titles. Weekly-seed and daily-seed
> boards do not contribute. At launch that is nine games (Pogo Tower is
> weekly-only). Non-participation is 0. Maximum championship total is
> 9,000.

Tiebreaker 3: median of championship-game point totals (nine values;
missing = 0).

Bump the spec header to version 2. `seasons.rules_version = 2` for
`season-1`.

---

## 13. What this spec does not change

- Rapier pin, `SWR1`, cheap-check 8 events/tick
- GameHost pause policy
- Auth button set (Google + email)
- Vendor cap (Neon + Railway)
- Best-6 writers
- Spec 3/4 goldens
- Pickaxe static ledges

---

## 14. Risks

| Risk | Handling |
|---|---|
| Gemini non-reproducible | committed `public/assets`; generate is operator-only |
| CSP breaks Phaser/WASM | document exception; don't ship a CSP that fails play e2e |
| Invite season without email on profile | persist email at upsert; tests cover missing email → `NOT_INVITED` |
| Anonymise breaks unique handle | `d-` + hex; normalizeHandle reserves the pattern |
| Close-season races a finish | `closing` + TTL grace; `SEASON_INACTIVE` on finish |
| Telemetry env left off in prod | Task 5 checklist: `STICKWORLD_TELEMETRY=1` on all three processes |
| Third vendor sneaks in via "just Sentry" | ADR-0007 decision 1; PR review fails new deps |
| Legal unblocked internal, blocked public | R8.5 |
| Asset commit blows bundle ceiling | fail CI; trim asset; don't regen goldens |

---

## 15. Closed questions (were design §6)

| # | Question | Decision |
|---|---|---|
| 1 | Sentry or OTel? | **Neither.** JSON logs + SQL. |
| 2 | Cloudflare at launch? | **No.** Recorded CDN gap stays. |
| 3 | Beta size / invites? | **24 emails**, `ranked_invites`, 14 days. |
| 4 | Season 1 length / Best 6? | **28 days.** Best 6 still out. |
| 5 | Internal: staff vs synthetic? | **Staff on production-shaped DB.** Synthetic in CI only. |
| 6 | *(added)* Where do generated bytes live? | **Committed `public/assets/`. ** |
| 7 | *(added)* Championship columns? | **Nine.** Pogo weekly-only. |
| 8 | *(added)* Age? | **13+.** |

---

## 16. Tasks

See `tasks.md`. Task 6 is blocked on Task 3 and Task 5 evidence. Owner
approved 2026-08-18. Execute in order.
