# Spec 4 — Roster Production (games 3–10)

**Status:** approved 2026-08-18; executed (Waves A–D on `cursor/spec-4-full-depth-bda1`). Do not start Spec 5 until this PR merges and Spec 5 is separately approved.
**Depth:** complete (design.md + tasks.md match Spec 1/2/3 style)
**Covers:** Plan tasks 15–18
**Depends on:** Spec 3 merged (PR #3); Branch A (ADR-0001)
**Blocks:** Spec 5
**Stack:** `docs/adr/0006-spec4-roster-contracts.md` (plus ADR-0005 for host/kit/auth)

---

## Why this spec is now full depth

Spec 3 landed GameHost, the kit, checklist CI, per-slug play pages, and the
registration seam. The scope draft named eight games and four waves but omitted
action tables, course numbers, score events, how best-of-3 fits in one replay,
where ragdoll is proved, and which `/v1` fields Wave B is allowed to extend.
This revision supplies that.

Owner approved execution 2026-08-18. ADR-0006 decisions are locked.

---

## The locked roster

Ten games, all single-player, one integer higher-is-better `ranked_score`.
Games 1–2 shipped in Spec 3. Working titles; trademark clearance pending.

| # | Game | slug | registryId | Ranked format | Attempt shape | Replay | Wave |
|---|---|---|---|---|---|---|---|
| 1 | Hookline Sprint | `hookline-sprint` | 1 | fixed-course | single | tiny | Spec 3 |
| 2 | Pickaxe Ascent | `pickaxe-ascent` | 2 | fixed-course | single | small | Spec 3 |
| 3 | Launch Lab | `launch-lab` | 3 | fixed-course | best-of 3, **sum** | tiny | A |
| 4 | Ragdoll Archery Rush | `ragdoll-archery-rush` | 4 | fixed-course | single | tiny | A |
| 5 | Hammer Throw Havoc | `hammer-throw-havoc` | 5 | fixed-course | best-of 3, **sum** | tiny | A |
| 6 | Pogo Tower | `pogo-tower` | 6 | **weekly-seed** | single | small | B |
| 7 | Rooftop Relay | `rooftop-relay` | 7 | fixed-course | single | medium | C |
| 8 | Balance Bike Blitz | `balance-bike-blitz` | 8 | fixed-course | single | medium | C |
| 9 | Cargo Chaos | `cargo-chaos` | 9 | fixed-course | single | medium | C |
| 10 | Demolition Dive | `demolition-dive` | 10 | fixed-course | best-of 3, **sum** | large | D |

Authoritative geometry and score numbers: `docs/games/<slug>.md`. If this file
and those disagree, the game doc wins.

---

## Requirements

### R1 — Wave A: projectile games

1. Launch Lab SHALL ship first in the wave. Projectile spawn + impulse helpers
   MAY be added to `physics-kit` with a kit determinism fixture **before** Launch
   depends on them. Angular-release helpers SHALL wait until Hammer Throw needs
   them (ADR-0006: first consumer).
2. Launch Lab and Hammer Throw SHALL run three sub-attempts inside **one**
   `Simulation`, **one** replay, **one** `/v1` submission. `finished` stays false
   until three sub-attempts complete or `maxRunTicks`. Between sub-attempts the
   sim resets poses/velocities of bodies that already exist and MUST NOT create
   or destroy rigid bodies after tick 0. `ranked_score` is the **sum** of the
   three integer sub-scores. _(ADR-0006)_
3. Multi-attempt aggregation SHALL have unit tests separate from single-run
   scoring (`packages/scoring` or the game's `tests/scoring.test.ts`).
4. Wave A sample replays SHALL stay in the tiny class (`< 5 KB` compressed,
   competitive-spec §6 / design §5). CI SHALL assert it.
5. Analog aim, power, and draw SHALL be integer-quantised at capture.
   Record-on-change. Cheap-check limit remains 8 events/tick.
6. Ragdoll Archery Rush SHALL be the first ten-body stickman. Launch Lab and
   Hammer Throw v1 SHALL keep a locked capsule. After Archery goldens exist,
   extract the proved ragdoll assembly into `physics-kit` (same byte-identical
   ritual as Spec 3 Task 2). Do not add `@stickworld/ragdoll` as a separate
   package unless a second Wave A game imports it. _(ADR-0005, ADR-0006)_
7. Archery v1 targets SHALL be **static**. Kinematic movers are Wave B.
8. Each Wave A game SHALL register via the Spec 3 seam only (seed + `GAMES`
   map + workspace deps + per-slug play page). **No GameHost API change, no
   `/v1` shape change, no schema change.** If any of those is required, write a
   kit finding and stop. _(ADR-0006)_

### R2 — Wave B: Pogo Tower

1. Pogo Tower is the first game whose **geometry is generated from the
   server-issued seed**. The generator SHALL live in simulation code, use only
   the Spec 1 PRNG and `detmath`, emit bodies in a fixed order, and bump
   `simulation_version` when it changes.
2. A fixture SHALL assert the same seed produces identical geometry **and**
   identical hashes in Node, Chromium, Firefox, and WebKit, **separate** from
   the gameplay golden (so a generator bug is distinguishable from solver
   drift).
3. Ranked format is `weekly-seed`. Issue SHALL follow the same server-issued
   pattern as the daily ladder. Wave B MAY extend `issueAttempt` /
   `RankedClient` / the `/v1/games/:slug/attempts` body union to accept
   `weekly-seed`. Championship SHALL continue to ignore non-`fixed-course`
   rows. _(ADR-0006)_
4. Moving kinematic platforms SHALL enter `physics-kit` in this wave, proved
   by Pogo, available later to Rooftop / Bike / Cargo. Pickaxe v1 MUST NOT be
   rewritten to use them.
5. Frame-time on a real mid-range Android is a **demo gate** for this wave's
   moving platforms, not a CI job.

### R3 — Wave C: continuous movement

1. Replay budgets (`< 40 KB` compressed) SHALL be asserted with a 150 s
   record-on-change fixture **before** Phaser views are built. Do not coarsen
   input unless that fixture fails. _(ADR-0006)_
2. Rooftop Relay SHALL use a **kinematic character controller**, not a dynamic
   capsule. Recoverable stumble is a `renderState` flag; it SHALL NOT switch
   the body to a ragdoll in v1.
3. Balance Bike Blitz SHALL add a wheel assembly with suspension springs to
   `physics-kit` after a kit fixture, then the game uses it.
4. Cargo Chaos SHALL joint cargo to the carrier and expose an integer
   **condition** (0–100 hundredths of remaining integrity) that feeds scoring.
5. Each game SHALL be touch-viable with at most two held buttons plus optional
   analog lean quantised to integers.
6. Real mid-range Android frame-time for Wave C is a demo gate during this
   wave (not deferred to Spec 5).

### R4 — Wave D: Demolition Dive

1. Demolition Dive SHALL ship last. Branch A is in force; the game stays on
   the roster unless the max-body four-runtime fixture fails and cannot be
   repaired without a Rapier bump. Cutting it launches championship with nine
   columns and a 9,000-point maximum. No replacement title in this spec.
   _(ADR-0006)_
2. Hard caps SHALL be declared in the manifest and enforced every step:
   rigid bodies, colliders, joints, destructible pieces, chain-reaction depth.
3. Debris that leaves the play AABB SHALL despawn **inside the simulation**
   with a deterministic rule (same tick, same bodies, all four runtimes).
   Cosmetic-only cleanup is a determinism bug.
4. A determinism fixture SHALL run at the game's **maximum** body count across
   all four runtimes before the Phaser view is written.
5. Three dives, one replay, sum aggregation — same phase-machine rules as R1.2.

### R5 — Game designs are contracts, not this spec's body

1. Mechanics, geometry, physics tuning, and score event numbers SHALL live in
   `docs/games/<slug>.md`. This spec names slugs, waves, kit primitives, and
   platform increments.
2. Each game SHALL pass the Spec 3 integration checklist as a merge gate
   (`scripts/check-game-integration.mjs`). Add the new `score:browser` line to
   CI when the package exists.
3. Inspiration ledgers SHALL exist at `docs/legal/inspiration/<slug>.md`
   before the game's first implementation commit.

### R6 — Roster-wide invariants

1. Every game SHALL produce exactly one integer `ranked_score`, higher always
   better. Time is a bonus, never a ranking key. Championship still uses all
   ten (or nine if Demolition is cut) at 0–1,000 each (`docs/competitive-spec.md` §11).
2. Every game SHALL declare a physics budget and assert it every step in
   test/dev.
3. Touch: one tap, two buttons, or drag-and-release, as the roster table.
4. Shared `@stickworld/ui` tokens. Per-slug play pages. Opening one slug SHALL
   NOT fetch another game's `./client` chunk.
5. No third-party game name in code, UI, assets, or filenames (existing
   legal grep).
6. Pins: Phaser `4.2.1`, Next `16.3.1`, Rapier `-compat` `0.20.0`. Do not bump
   Rapier.

---

## Out of scope

- Branching-narrative / CYOA (excluded from the platform)
- Live PvP
- Generated art and voice (Spec 5)
- GitHub / Discord login
- Pickaxe moving-ledge v2
- A replacement tenth game if Demolition is cut
- `@stickworld/ragdoll` as a separate package unless a second consumer appears
  in the same wave

---

## Definition of done

- [x] Wave A: three games live, each with a board; best-of fixtures are one
      replay; tiny replay assertions green; Archery ragdoll extracted without
      changing its freeze hashes
- [x] Wave B: Pogo generator fixture (geometry + hash) agrees in four runtimes;
      weekly issue works; championship ignores weekly rows
- [x] Wave C: three games live; 40 KB replay fixtures asserted before views;
      kinematic controller / wheels / cargo condition in the kit
- [x] Wave D: Demolition caps enforced; max-body four-runtime fixture green
      **or** the game is cut and championship is nine columns
- [x] Every new game passed the Spec 3 checklist as a merge gate
- [x] Championship table has a column per shipping ranked game
- [x] Inspiration ledgers present for games 3–10
- [x] No new cloud vendor; pins unchanged

---

## Notes (not SHALL)

- Working titles remain on the legal track.
- Test Chamber stays in CI, not on the catalogue.
- Daily-seed rows may be seeded for Wave A–D games so issuance does not 404;
  championship path is fixed-course except Pogo (weekly).
