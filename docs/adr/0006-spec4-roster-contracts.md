# ADR-0006 — Spec 4 roster contracts

**Status:** proposed for Spec 4 deepening (2026-08-18)
**Spec:** 4
**Depends on:** Spec 3 merged ([PR #3](https://github.com/Nether403/Stickworld-Tournament/pull/3)), Branch A (ADR-0001), ADR-0005

## Context

Spec 4's scope draft named eight games, four waves, and four open questions. Spec 3
landed the kit, the checklist merge gate, per-slug play pages, and the registration
seam (seed row + worker `GAMES` map). Those facts let this spec name files, action
tables, geometry, and the exact platform increments each wave is allowed to make.

Post-merge product facts (2026-08-18):

- Spec 3 is merged. Hookline goldens stay frozen (`9c52d8f426f31ee1`). Pickaxe v1
  uses static ledges and a locked capsule.
- Neither Spec 3 game simulates a ten-body stickman. Ragdoll waits for the first
  Spec 4 game that needs one (Ragdoll Archery Rush).
- Spec 1 landed on **Branch A**. Demolition Dive stays on the launch roster.
- `seed_policy` already includes `weekly-seed` in Postgres. `/v1` issue currently
  accepts only `fixed-course` | `daily-seed`.
- Replay format `SWR1` is inputs only. A new delimiter frame is unnecessary if
  sub-attempts are phases inside one `Simulation`.

## Decisions

1. **Best-of-N is a simulation phase machine, not N ranked attempts.** Launch Lab,
   Hammer Throw Havoc, and Demolition Dive use `attemptShape: { kind: 'best-of', count: 3 }`.
   One server-issued attempt, one replay, one submission. The simulation keeps
   `finished === false` until three sub-attempts complete or `maxRunTicks`. Between
   sub-attempts it **resets existing body poses and velocities** and destroys
   ephemeral joints. It MUST NOT create or destroy rigid bodies after tick 0
   (Spec 3 kit finding: registry order). Aggregation is the **sum** of the three
   integer sub-scores. Sum averages luck (the reason the roster uses three launches
   at all). `max` would keep the luckiest bounce. The TypeScript tag stays
   `best-of` meaning "N phases in one run," not "keep the max."

   Rejected alternative: three `/v1` submissions. That triples verification load
   and lets a player abandon a bad throw.

2. **Pogo Tower weekly seeds reuse the daily ladder machinery.** `season_games.seed_policy = 'weekly-seed'`
   (enum already exists). Wave B extends `issueAttempt` and the ranked client union
   to accept `weekly-seed`. Rotation writes one row per ISO week (Monday 00:00 UTC)
   analogously to `daily_boards.utc_date`. No second rotator, no new table family
   unless `daily_boards` cannot store a week identity without a check constraint
   fight — if so, add `weekly_boards` with the same columns and log it as a Wave B
   kit finding. Championship still ignores anything that is not `fixed-course`.

3. **Wave C does not pre-emptively coarsen input.** Record-on-change stays.
   Medium replay ceiling is 40 KB compressed. Lower granularity only if a 150 s
   fixture fails that cap, and then only that game's action table.

4. **Demolition Dive stays.** Branch A makes the four-runtime max-body fixture
   meaningful. If that fixture fails and cannot be repaired without a Rapier bump,
   **cut the game** and launch championship with nine columns / 9,000-point maximum.
   Do not invent an 11th title in this spec.

5. **Ragdoll is extracted from Ragdoll Archery Rush, not before Launch Lab.**
   Launch Lab and Hammer Throw use a locked capsule (plus a projectile body).
   Archery is the first ten-body consumer. Same ritual as Spec 3: goldens on the
   first consumer, then extract into `physics-kit` (or a thin `ragdoll.ts` module
   inside that package — **do not** add `@stickworld/ragdoll` as a separate
   workspace package unless two games in the same wave import it).

6. **Pickaxe does not gain moving ledges in Spec 4.** ADR-0005 already deferred
   those to Wave B as a primitive. The consumer is Pogo Tower (then Rooftop, Bike,
   Cargo). A Pickaxe `game_version` bump that uses movers is out of this spec.

7. **Allowed platform touches per new game remain the Spec 3 seam** plus the two
   named increments below. Anything else is a kit finding and stops the wave for
   review.

   | Wave | Extra platform increment |
   |---|---|
   | A | none (best-of lives in the sim) |
   | B | `weekly-seed` on issue/finish/ranked-client; weekly rotation job |
   | C | none |
   | D | none |

8. **Pins unchanged:** Phaser `4.2.1`, Next `16.3.1`, Rapier `-compat` `0.20.0`,
   React `19.2.8`. Play pages stay per-slug (`apps/web/app/play/<slug>/`).

## Consequences

- Spec 4 tasks can name slugs, `registryId`s 3–10, action tables, course numbers,
  score events, and kit helpers.
- Wave A should not touch `GameHost` beyond what a new `StickworldGame` already
  requires (`finished` later in the run). If a host change is discovered, log it
  and stop.
- Owner approval of this deepening is required before any `games/<slug>` for
  titles 3–10 is implemented.
