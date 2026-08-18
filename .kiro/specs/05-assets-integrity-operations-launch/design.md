# Spec 5 — Design (scope and contract depth)

---

## 1. Asset pipeline shape

```
docs/assets/prompts/*.yaml          committed          human-authored inputs
sources/brand/*                     committed          human-authored brand marks
        │
        ├── pnpm assets:art     → Gemini (Vertex)   → assets/generated/art/*
        ├── pnpm assets:voice   → Deepgram CLI      → assets/generated/audio/*
        │
        └── docs/assets/ledger.md   committed        provenance for every shipped asset
```

`assets/generated/` is gitignored (already in place). Prompts, sources, and the ledger are
committed, so the output is reproducible without carrying binaries in git history.

**The hard rule, and why it needs a test rather than a convention:** no runtime calls to Gemini,
Deepgram, or OpenRouter in a shipped gameplay path. It is trivially easy to "temporarily" add a
runtime call during development and ship it. The network assertion during a ranked run is what
actually prevents that.

Ledger classification per asset: `human`, `generated`, or `generated-then-human-edited`. Brand
marks must be `human` or `generated-then-human-edited`, because purely generated images may not
attract copyright where authorship requires human intellectual creation. Volume art may be
`generated` freely.

---

## 2. The PvP seam

```ts
export interface InputSource {
  inputsForTick(tick: number): readonly QuantisedInput[];
}
```

Three implementations, of which only two are built:

| Implementation | Built in | Purpose |
|---|---|---|
| `LocalInputSource` | Spec 3 | live play from the device |
| `ReplayInputSource` | Spec 1 | verification and ghost playback |
| `NetworkInputSource` | **never, in this project** | proof the seam is real |

The test drives one simulation from all three sources — the third as a scripted stub — and asserts
identical outcomes. That proves no local-input assumption leaked into game rules, which is the
entire value of the exercise.

The ADR records what a future authoritative-room model would add: room lifecycle, matchmaking,
per-tick input broadcast, and reconciliation. And what it would not change: the simulation core,
the replay format, the scoring model, or the schema. Cost now: one interface and one test.

---

## 3. Compliance surface

The compliance obligation here is easy to underestimate, so it is stated plainly:

> A handle field alone makes this platform a host of user-generated content.

That is enough to require a notice-and-action mechanism, a moderation queue, statements of reasons
for actioned content, and an audit trail. No chat, no level sharing, and no avatars are needed to
trigger it.

```
report (any visitor, no account required)
   → moderation queue  → action → statement of reasons to the user
                                → audit_events (append-only)
                                → redress path disclosed
```

GDPR deletion splits the data: personal data is removed, while competitive-integrity records
(verified results, audit entries) are retained anonymised so leaderboard history stays coherent.
Deleting a player must not silently rewrite a past season's standings.

---

## 4. Observability tag set

Every metric and trace carries: `game_id`, `game_version`, `season_id`, `browser_family`,
`device_class`, `ranked_or_practice`.

The metrics that actually matter for this platform, as distinct from generic web metrics:

| Metric | Why it matters here |
|---|---|
| verification failure rate by game | A spike means either an exploit or a determinism regression |
| score mismatch rate | The single best early warning of both cheating and drift |
| verification duration p99 | Drives worker sizing; changes materially under Branch B1 |
| leaderboard recalculation time | The championship recompute is the heaviest scheduled job |
| attempt abandonment rate by game | Difficulty and usability signal |
| game load success rate by device class | The CDN gap will show up here first |

---

## 5. Operations topology

```
Railway project
├── web       Next.js + API          ← public
├── worker    verification + ranking ← private networking only
└── cron      recompute, daily rotation, season close

Neon
├── production branch    autosuspend policy = explicit recorded decision
├── PR branches         created and destroyed by CI
└── PITR                restore tested, not assumed
```

Two acceptance demos worth treating as requirements rather than nice-to-haves, because both are
routinely claimed and rarely exercised:

1. A deliberately broken deploy is detected and rolled back.
2. A Neon point-in-time restore into a staging branch, followed by a full leaderboard rebuild from
   `verified_results`, matches production.

The second demo is the one that proves the "Postgres is the source of truth, everything else is
derived" claim is real rather than aspirational.

---

## 6. Open questions

1. Observability vendor: Sentry, or an OpenTelemetry-compatible stack? Either adds a vendor —
   is that an accepted third, or is Railway's built-in logging sufficient at launch?
2. Does Cloudflare go in front at launch after all, given it also brings Turnstile and DDoS
   protection for free?
3. Closed beta size and invitation mechanism?
4. Season 1 length, and is the "Best 6 of 10" secondary ladder in or out at launch?
5. Does the internal tournament use real staff accounts or synthetic players, given that verified
   results are retained permanently?

---

## 7. Tasks

| # | Task | Plan ref |
|---|---|---|
| 1 | Build-time asset pipeline, provenance ledger, zero-runtime-call assertion | 19 |
| 2 | PvP seam: `InputSource`, three-source test, ADR. No netcode | 20 |
| 3 | Integrity and abuse hardening, UGC moderation, GDPR export and deletion | 21 |
| 4 | Cross-browser and device QA with per-game budgets enforced in CI | 22 |
| 5 | Railway and Neon operations, observability, tested restore, rollback runbook | 23 |
| 6 | Internal tournament → closed beta → version freeze → launch | 24 |

Sub-tasks written when this spec is deepened after Spec 4 lands.
