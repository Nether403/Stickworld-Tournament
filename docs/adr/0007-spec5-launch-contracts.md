# ADR-0007 — Spec 5 launch contracts

**Status:** accepted 2026-08-18. Owner approved ADR-0007 and the Spec 5
full-depth documents. Execution follows `tasks.md`.
**Spec:** 5
**Depends on:** Spec 4 merged ([PR #4](https://github.com/Nether403/Stickworld-Tournament/pull/4)),
Branch A (ADR-0001), ADR-0004, ADR-0005, ADR-0006

## Context

Spec 5's scope draft named six plan tasks (19–24) and five open questions.
Specs 1–4 are merged. Ten games are registered. Ranked `/v1`, the Node worker,
GameHost, and the kit exist. Placeholder Phaser primitives are the visual
language (ADR-0005). `@stickworld/telemetry` is a no-op. There is no Railway
config in the repo, no GDPR routes, no moderation queue, and no `InputSource`
type.

Standing constraints that this ADR must not reopen:

- Vendor cap is **two** production clouds: Neon + Railway (spec index).
- Rapier `-compat` `0.20.0` is frozen. Goldens are the contract.
- Cosmetic art/audio may ship without a `game_version` bump
  (`docs/competitive-spec.md` §12).
- Neon production autosuspend is **already off** (ADR-0004).
- `"Best 6 of 10"` does **not** ship (ADR-0004). Schema `snapshot_scope`
  still reserves `best6`; Spec 5 must not add UI or writers for it.
- Championship recompute already ignores non-`fixed-course` rows (ADR-0006,
  `packages/platform/src/recompute.ts`). Pogo Tower is weekly-only.

Post-merge product facts (2026-08-18):

- PR #4 merged. Demolition Dive shipped as registry id 10 (Branch A).
- Frozen goldens are listed on that PR; Spec 5 must not regenerate them to
  "make art work."
- Play e2e is Chromium desktop + iPhone 12 viewport only.
- `profile_status` is `active | suspended`. No anonymised state.
- `audit_events` exists; there is no report table.
- `assets/generated/` is gitignored; no prompts, ledger, or brand sources exist.
- Legal track: working titles, trademark searches not started. Counsel review
  still gates **public** launch, not this deepening.

## Decisions

1. **No third production vendor at launch.** Observability is structured JSON
   logs from `@stickworld/telemetry` on stdout (Railway log drain) plus SQL
   over tables we already own (`verification_jobs`, `audit_events`,
   `score_submissions`). Do **not** add Sentry, a hosted OTel backend,
   PostHog, Resend, Redis, or an object store.

   Rejected alternative: Sentry as vendor 3. Useful, and the MCP exists, but
   the vendor cap was the load-bearing infrastructure decision of the whole
   project. Score-mismatch rate is already in Postgres. Revisit Sentry only
   after launch if Railway logs cannot answer an incident.

2. **No Cloudflare (and no Turnstile) in Spec 5.** The CDN gap stays the
   accepted gap. Cloudflare in front is a DNS change documented in
   `docs/ops/railway.md` as a *post-launch* option, not a repo dependency.
   Asset budgets stay tight. Do not read `CF-Connecting-IP` or add Turnstile
   widgets.

3. **Shipped static files are committed.** This amends scope-draft R1.8
   ("generated binaries SHALL NOT be committed"). Gemini image output is not
   bit-reproducible, and there is no object store. Launch path:

   - Prompts and brand sources stay committed (`docs/assets/prompts/`,
     `sources/brand/`).
   - `pnpm assets:build` writes gitignored `assets/generated/` and is an
     **operator** command (needs `GEMINI_API_KEY` / `DEEPGRAM_API_KEY`). It is
     **not** a Railway build step and **not** a CI job.
   - Selected outputs are copied into `apps/web/public/assets/` (and optional
     `games/<slug>/public/` only if a game needs a local file) and committed.
     That copy is the human step that makes the class
     `generated-then-human-edited` or `human`.
   - `docs/assets/ledger.md` lists every shipped file, hash, class, and prompt
     pointer. CI checks completeness and that gameplay JS does not fetch
     Gemini / Deepgram / OpenRouter hosts.

   Collision geometry stays in `games/*/src/simulation/**` (already
   hand-authored). Art must not change goldens.

4. **Voice is not a launch gate.** Countdown and results stay visual. A small
   committed SFX pack (or silence) is enough. Deepgram is available as the
   same opt-in generator; announcer VO can land later without a season bump.

5. **`InputSource` lives in `@stickworld/input`.** Three implementations:
   `LocalInputSource` (device buffer), `ReplayInputSource` (decoded `SWR1`
   events), `ScriptedInputSource` (test stub standing in for a future
   network source). `NetworkInputSource` is **not** built. `playReplay` and
   GameHost's per-tick apply path consume the interface. Goldens stay
   byte-identical. No rooms, matchmaking, or netcode. Future-room ADR is
   `docs/adr/0008-pvp-seam.md`, written in Spec 5 Task 2.

6. **Championship is nine fixed-course games / 9,000 max.** Competitive-spec
   §11 is amended in Spec 5 Task 6 (version bump `rules_version`). Pogo Tower
   has weekly (and daily) boards only. Daily results still do not count.
   Tiebreaker "median of the ten game point totals" becomes "median of the
   championship-game point totals" (unplayed championship games are 0).
   Demolition Dive counts; it shipped.

7. **Closed beta is invite-only, 24 seats, 14 days.** Table `ranked_invites`
   (email citext unique). `seasons.entry_policy` is `'invite' | 'open'`.
   Ranked `issueAttempt` on an invite season requires a matching auth email
   (or `profiles.role = 'moderator'`). Practice stays open. Public Season 1
   is `'open'`, **28 days**, `rules_version` matching the amended spec.
   `internal-0` reuses the same table.

8. **Internal tournament is real staff accounts on a real invite season
   (`internal-0`).** Synthetic players stay in CI / Neon PR branches and
   **must not** be inserted into production `verified_results`. Automated
   edge cases from R6.2 become regression tests (Task 3 / Task 6); the
   production internal season is the human UX pass.

9. **Age policy is 13+.** Self-declared checkbox on email signup and a line
   on the Google auth screen / legal page. No COPPA flow. No under-13
   accounts by policy. Honor system; we are not adding KYC.

10. **Moderation is in-app, no mail vendor.** Public `POST /v1/reports` (no
    account required, IP rate-limited). Moderators are `profiles.role =
    'moderator'` (not self-serve). Actions: dismiss, force-release handle,
    suspend, unsuspend. Statement of reasons is stored and shown at
    `GET /v1/me/notices`. Email is not sent (Neon Auth's bundled sender is
    for auth only).

11. **GDPR deletion anonymises; it does not rewrite standings.** New
    `profile_status` value `anonymised`. Handle becomes `d-` + 12 hex chars
    (reserved prefix; `normalizeHandle` rejects player-chosen handles
    starting `d-` of that shape). `auth_user_id` is replaced with
    `deleted:<uuid>` so the Neon Auth user can be removed. `verified_results`,
    `runs` (including replay `bytea`), and `audit_events` rows remain on that
    profile id. Display name on leaderboards for anonymised profiles is
    `retired`. Export is `GET /v1/me/export` (auth required) before delete.

12. **Pins unchanged** except new **optional** operator-only keys
    (`GEMINI_API_KEY`, `DEEPGRAM_API_KEY`) which production Railway **web**
    and **worker** must not have. Phaser `4.2.1`, Next `16.3.1`, Rapier
    `-compat` `0.20.0`, React `19.2.8`, Playwright `1.62.1`.

## Consequences

- Spec 5 tasks can name files, tables, routes, header names, budget numbers,
  and season slugs.
- Owner approval of this ADR is required before Task 1 implementation.
- Legal counsel and trademark clearance still gate **public** Season 1, not
  the internal season.
- PR #4 review leftovers (presentation vs collider mismatch, some cubic
  P2s) are inventory for `docs/known-issues.md`, not a Spec 4 reopen.
