# Hookline Sprint

**Slug:** `hookline-sprint`  
**registryId:** `1`  
**gameVersion / simulationVersion / scoringVersion:** `1.0.0` / `1` / `1`  
**rankedFormat:** `fixed-course`  
**attemptShape:** `{ kind: 'single' }`  
**maxRunTicks:** `5400` (90 s at 60 Hz)  
**Status:** frozen for Spec 3 v1. Geometry or scoring changes require a new `game_version`.

Working title. Trademark clearance is pending (`docs/legal/brand-and-ip-clearance.md`).

---

## Player problem

Make a swing feel like a race: attach, carry pendulum speed, release at the right
moment, land the next attach without falling. Skill is timing and aim, not a
puzzle sequence memorised from another product.

---

## Actions

Pointer aim is a simulation input (it changes which anchor attaches). A bool-only
replay cannot reproduce it, so v1 records integer degrees. Keyboard still feels
like one button: the host writes `aim` from auto-aim, then `hook`.

| id | name | kind | min | max | notes |
|---|---|---|---|---|---|
| 1 | `aim` | `int` | 0 | 359 | degrees, 0 = +x, counter-clockwise, Y-up. Record on change. |
| 2 | `hook` | `bool` |  |  | `1` held = try-attach / stay attached; `0` = release |

Hold-to-attach, release-to-let-go.

- **Pointer/touch:** host sets `aim` from pointer world position minus player
  centre. Ray origin = player centre. Max length `ATTACH_RANGE = 8` m.
- **Keyboard (Space):** host sets `aim` toward the nearest anchor inside a
  forward cone (`dot(toAnchor, facing) >= 0.25`, distance ≤ 8 m), then `hook`.
  `facing` is `(sign(linvel.x) or +1, 0.15)` normalised with `detmath.hypot`.
- Apply order is ascending action id: `aim` (1) then `hook` (2) on the same tick.
- Attach on `0 → 1` only if the ray hits an **anchor** collider. Miss = no joint.
- While `hook = 1` and attached, the rope stays. `1 → 0` removes the joint
  (release). Re-attach requires a new edge.

`@stickworld/input` (after extraction) records **edges only**, not per-tick holds.
A 90 s run with sparse attaches must compress under 5 KB (competitive-spec §6).

---

## Physics (SI)

- Player: one dynamic capsule, half-height `0.45` m, radius `0.18` m, mass `70`.
  Rotation **locked** (arcade swing, not a flopping ragdoll). Linear damping
  `0.04`, gravity Rapier default `GRAVITY` from sim-core.
- Anchors: fixed bodies, ball collider radius `0.20` m, collision group `ANCHOR`.
- Rope: `JointData.rope(restLength, {0,0}, {0,0})` between player and the hit
  anchor. `restLength = clamp(distanceAtAttach, 0.8, 8.0)`.
- Construction order (competition-affecting): static world colliders first, then
  anchors in table order, then player. Joints created only on attach and destroyed
  on release; destroy/create must go through `SimWorld` so the body registry stays
  stable. **Do not create the player after the first `world.step()` in a way that
  reorders existing bodies.** Player and anchors exist from tick 0.
- No moving platforms, springs, or bumpers in v1.

---

## Course v1 (metres, Y up)

Play AABB: `x ∈ [-1, 58]`, `y ∈ [-2, 16]`. Death: `player.y < 0` **or**
`player.x < -0.5`. Finish plane: `player.x >= 52` and `player.y > 0.5`.

Start: player translation `(2.0, 3.0)`.

Start ledge (fixed cuboid): centre `(2.0, 0.25)`, half-extents `(2.0, 0.25)`.

Anchors, in creation order:

| order | x | y |
|---|---|---|
| 1 | 6.0 | 8.0 |
| 2 | 12.0 | 5.5 |
| 3 | 18.0 | 9.0 |
| 4 | 24.0 | 5.0 |
| 5 | 30.0 | 8.5 |
| 6 | 36.0 | 6.0 |
| 7 | 42.0 | 9.5 |
| 8 | 48.0 | 7.0 |

Gates (sensor cuboids, no physical response). Crossing `player.x` from below the
gate `x` awards once:

| gate | x | points |
|---|---|---|
| A | 12 | 500 |
| B | 24 | 500 |
| C | 36 | 500 |
| D | 52 | 500 |

Seed is **ignored for geometry**. The server still issues a seed (competitive-spec
§1). Simulation must not read the PRNG for v1.

---

## Score contract

`ranked_score` = integer aggregation of events via `aggregateScore` (multiplier
is hundredths). Higher is better.

| type | when | `points` | `multiplier` |
|---|---|---|---|
| `progress` | `floor(maxX * 10)` increases | delta (1 per decimetre of best-x) | `100` |
| `gate` | first crossing of a gate | `500` | current combo |
| `perfect-release` | release while attached and this swing's `|linvel.x|` ≥ 92% of this swing's max `|linvel.x|`, and max ≥ `2.0` m/s | `200` | current combo |
| `finish` | finish plane, not dead | `max(0, floor((5400 - tick) / 6))` | `100` |
| `fail` | death | `0` | `100` |

Combo: integer hundredths `100 + 25 * min(perfectStreak, 4)` → 100, 125, 150,
175, 200. Streak increments on `perfect-release`, resets on death **or** on
contact between the player collider and the start ledge after tick 30 **or**
180 ticks with no perfect.

`maxX` is the maximum player `translation.x` this run. Progress events keep the
result screen honest during play; they are not a second ranking key.

Tiebreakers: none. Ranking is score desc, then `achieved_at` (competitive-spec §10).

Envelope: a legitimate run is well under `SCORE_ENVELOPE_ABS`. Cheap check stays
platform-global.

---

## Manifest budget

```ts
maxRigidBodies: 16
maxColliders: 32
maxJoints: 4          // at most one rope at a time, plus none leftover
maxReplayBytes: 8192
maxScoreEvents: 512
```

---

## Finish conditions

`finished = true` when any of: finish plane, death, `tick >= 5400`.

---

## Presentation notes (not competition-affecting)

Camera follows player with a 4 m look-ahead in +x. Capsule fill = ink token.
Anchors = accent discs. Gates = success-coloured vertical bars with a unique
shape (chevron) so colour is not the only cue. Countdown 3-2-1-GO is host-owned
and does not step the sim.

---

## Fixtures

- `games/hookline-sprint/fixtures/sample.swr` — a committed honest run used by
  the worker integration test (score + hash in `conformance/golden/sample.json`).
- Determinism series: hash at ticks 1, 10, 100, 1000, 5400 with the sample input
  stream, four runtimes.
