# Spec 4 — Design

**Depth:** full. This document is detailed enough to implement from directly.
**Fork:** Branch A (ADR-0001). Worker stays Node.
**Roster contracts:** ADR-0006.
**Do not execute until approved.**

The previous scope draft named waves and four open questions. Those questions
are closed in ADR-0006. Geometry and score numbers live in `docs/games/*.md`.

---

## 1. Design principle

> One new hard thing per wave. Prove it on the first consumer with goldens.
> Extract only what two or more games (or the rest of the wave) will import.
> Best-of-3 is extra phases inside one sim, not extra `/v1` attempts.

```
Wave A  projectile (+ ragdoll on game two of the wave)
Wave B  seeded generation + kinematic movers
Wave C  kinematic character, wheels, jointed cargo
Wave D  breakables + deterministic despawn
```

Spec 3 seam stays the default: seed + `GAMES` map + per-slug play page +
workspace deps. The only scheduled `/v1` increment is Wave B `weekly-seed`.

---

## 2. Repository layout (what Spec 4 adds)

```
docs/
  adr/0006-spec4-roster-contracts.md
  games/launch-lab.md
  games/ragdoll-archery-rush.md
  games/hammer-throw-havoc.md
  games/pogo-tower.md
  games/rooftop-relay.md
  games/balance-bike-blitz.md
  games/cargo-chaos.md
  games/demolition-dive.md
  legal/inspiration/<slug>.md          # eight new ledgers
games/
  launch-lab/                          # registryId 3
  ragdoll-archery-rush/                # registryId 4
  hammer-throw-havoc/                  # registryId 5
  pogo-tower/                          # registryId 6
  rooftop-relay/                       # registryId 7
  balance-bike-blitz/                  # registryId 8
  cargo-chaos/                         # registryId 9
  demolition-dive/                     # registryId 10
apps/web/app/play/<slug>/              # one folder per game (Spec 3 lesson)
```

Package exports stay `{ ".": sim, "./client": Phaser }`. Worker and
`packages/platform/src/verify.ts` import `.` only.

`physics-kit` grows in place. No new workspace package for ragdoll unless a
second Wave A game imports the assembly.

---

## 3. Best-of phase machine

Applies to Launch Lab, Hammer Throw, Demolition Dive.

```
tick 0: construct ALL bodies that will ever exist (ramps, rings, projectile, …)
loop:
  aim / charge phase  → player inputs
  launch edge         → apply impulse once
  flight / impact     → score this sub-attempt into events with type prefix
  if subIndex == 3 or tick >= maxRunTicks: finished = true
  else: resetTranslation/linvel on the projectile (and ragdoll parts for
        Demolition); destroyImpulseJoint any ephemeral joints; subIndex++
```

Rules:

- `ranked_score = sum(subScore[1..3])`. Missed launches score 0 for that slot.
- Score events keep a `sub` index in `type` (`launch-ring`, or put `sub` in
  `renderState` only — **do not** add fields to `ScoreEvent` without a Spec 1
  amendment). Use event types `ring`, `distance`, `landing` as today; unit
  tests group them by tick ranges. Optional: `points` already integer-sum.
- Replay is ordinary `SWR1` inputs. Three `launch` 0→1 edges delimit phases.
  No format-version bump.
- `GameHost` still finishes when `simulation.finished` is true. No host API
  change. If a host change appears, kit-finding stop.
- Cheap-check 8 events/tick still holds (aim + power + pose + launch ≤ 4).

`packages/scoring` MAY gain `sumSubAttempts(scores: readonly number[]): number`
that is `scores.reduce((a, b) => a + b, 0)` with tests. Do not invent float
averaging.

---

## 4. `physics-kit` growth

| Primitive | First consumer | Also used by | Notes |
|---|---|---|---|
| projectile spawn + impulse | Launch Lab | Archery arrow, Hammer head, Demolition body | `launchImpulse(body, dir, speed)` using `detmath` |
| angular spin then release | Hammer Throw | (Launch does not spin a hammer) | Kit only if a second game needs it in-wave; else keep in Hammer |
| ten-body ragdoll | Archery | Demolition (Wave D) | Extract after Archery goldens |
| kinematic moving platform | Pogo Tower | Rooftop, Bike, Cargo | Not Pickaxe v1 |
| seeded generator harness | Pogo Tower | later daily content | Geometry fixture ≠ gameplay fixture |
| kinematic character controller | Rooftop Relay | — | v1 stumble is cosmetic |
| wheel + suspension | Balance Bike | — | |
| jointed cargo + condition | Cargo Chaos | — | integer 0–100 |
| breakable + chain + despawn | Demolition Dive | — | caps in manifest |

Construction through `sim.createRigidBody` only. Lint glob already covers
`packages/physics-kit/src/**/*.ts`.

### Ragdoll v1 (Archery, then Demolition)

Ten capsules, revolute joints with angular limits, construction order **root
to leaves**, documented in `docs/games/ragdoll-archery-rush.md`. No PD
balance controller in v1 (active ragdoll is a determinism swamp). Archery
stance is kinematic pose or locked hips plus free arms — the game doc picks
one and freezes it. Demolition may unlock all joints on launch.

---

## 5. Replay size ladder

Asserted in each game's contract test.

| Class | Games | Compressed ceiling |
|---|---|---|
| tiny | Hookline, Launch, Archery, Hammer | 5_120 bytes |
| small | Pickaxe, Pogo | 15_360 bytes |
| medium | Rooftop, Bike, Cargo | 40_960 bytes |
| large | Demolition | 81_920 bytes |

Wave C writes the 150 s synthetic stream test **before** the Phaser scene.

---

## 6. Wave B weekly seed

Schema already: `seed_policy` enum includes `weekly-seed`.

Increment (named, allowed):

- `packages/platform/src/attempts.ts` `seedPolicy` union adds `'weekly-seed'`
- `apps/web/app/v1/games/[gameId]/attempts/route.ts` body type
- `packages/game-host/src/ranked-client.ts` / `types.ts`
- Rotation: ISO week key `YYYY-Www` stored either as `daily_boards.utc_date`
  = that Monday, or a `weekly_boards` table if a check constraint blocks it.
  Prefer Monday-date reuse of `daily_boards` to avoid a migration. If a
  migration is required, it is a Wave B kit finding (schema). Championship
  recompute already skips non-`fixed-course`.

Generator: `createTower(prng: Prng): Platform[]` sorted by `y` ascending,
then `x`. Same function on client and worker. PRNG draws are the only
entropy. Count of platforms is a function of seed, not wall clock.

---

## 7. Visual language and play routes

`@stickworld/ui` tokens unchanged (ADR-0005). Phaser primitives until Spec 5.

Play route per slug, copied from Hookline/Pickaxe:

```
apps/web/app/play/<slug>/page.tsx
apps/web/app/play/<slug>/play-client.tsx   # dynamic(..., { ssr: false }) one island
```

Catalogue on `/` gains a card when the game is seeded. Lazy-load e2e: opening
slug A must not request slug B's client module.

---

## 8. Integration checklist

Unchanged from Spec 3 design §11. `scripts/check-game-integration.mjs`
already globs `games/*`. CI `determinism` job adds
`pnpm --filter @stickworld/game-<slug> score:browser` per new package.

---

## 9. What this spec does not change

- Competitive-spec championship formula
- Replay magic `SWR1` / format version 1
- Rapier pin
- Auth button set (Google + email)
- GameHost pause/ranked policy
- Cheap-check 8 events/tick
- Vendor cap (Neon + Railway)

---

## 10. Risks

| Risk | Handling |
|---|---|
| Best-of accidentally becomes 3 `/v1` attempts | Phase machine in the sim; host tests still "one finish POST" |
| Ragdoll diverges across browsers | Four-runtime Archery golden before extract |
| Weekly seed issues a daily seed | Union + season_games row tests; championship ignore test |
| Wave C replay > 40 KB | Fixture first; coarsen that game only |
| Demolition chain reactions diverge | Max-body fixture; cut the game rather than bump Rapier |
| Moving platforms smuggled into Pickaxe | Explicitly out; kit finding if a PR touches Pickaxe goldens |
| GameHost change for best-of | Stop and review (ADR-0006 predicted none) |

---

## 11. Closed questions (were design §7)

| # | Question | Decision |
|---|---|---|
| 1 | Best-of: max or sum? | **Sum** of three sub-scores. |
| 2 | Pogo weekly vs daily rotator? | **Reuse** daily machinery; `weekly-seed` on issue. |
| 3 | Pre-emptively coarsen Wave C input? | **No.** Fail the 40 KB fixture first. |
| 4 | Demolition cut → replacement game? | **No.** Nine columns / 9,000 max. Branch A: keep trying. |

---

## 12. Tasks

See `tasks.md`. Wave order is load-bearing. Do not start Wave B until Wave A
exit evidence exists, and so on.
