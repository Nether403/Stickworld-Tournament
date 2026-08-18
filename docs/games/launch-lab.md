# Launch Lab

**Slug:** `launch-lab`  
**registryId:** `3`  
**gameVersion / simulationVersion / scoringVersion:** `1.0.0` / `1` / `1`  
**rankedFormat:** `fixed-course`  
**attemptShape:** `{ kind: 'best-of', count: 3 }` (sum of three sub-scores)  
**maxRunTicks:** `5400` (90 s at 60 Hz for all three launches)  
**Status:** frozen for Spec 4 v1. Geometry or scoring changes require a new `game_version`.

Working title. Trademark clearance is pending.

The stickman is a **locked-rotation capsule projectile**, not a ragdoll.

---

## Player problem

Pick an angle and a power, commit, then tuck or stretch in flight so the capsule
threads rings and lands on the pad. Three launches, all count (sum). Skill is
the commit, not a copied carnival booth.

---

## Actions

| id | name | kind | min | max | scale |
|---|---|---|---|---|---|
| 1 | `aim` | `int` | 0 | 359 | 1 |
| 2 | `power` | `int` | 0 | 100 | 1 |
| 3 | `tuck` | `bool` |  |  |  |
| 4 | `launch` | `bool` |  |  |  |

- Pointer drag: horizontal → `aim` (0 = +x, CCW, Y-up); vertical → `power`.
  Record on change.
- Pointer up while still in the aim phase does **not** launch. Space or a
  dedicated release control sets `launch` 0→1.
- `tuck = 1` reduces the capsule's linear damping in flight (see Physics).
- Keyboard: A/D aim ±3°/tick; W/S power ±2/tick; Space launch; Shift tuck.
- Cadence: at most 4 events/tick. Cheap-check 8.

After a landing or a fail, the sim resets the capsule to the pad **without
new bodies** and increments `subIndex`. `launch` must return to 0 before the
next 0→1 counts.

---

## Physics (SI)

- Capsule: same as Hookline (`halfHeight 0.45`, `radius 0.18`, `mass 70`),
  rotation locked, damping `0.04` on the pad, `0.01` while `tuck=1` in flight,
  `0.04` otherwise.
- Launch: `launchImpulse` along `aim` with speed `4 + power * 0.16` m/s
  (power 0 → 4 m/s, power 100 → 20 m/s). Applied once on `0→1`.
- Construction order: backstop, pad, rings (table order), landing deck, capsule.
  All exist from tick 0.

---

## Course v1 (metres)

Play AABB: x ∈ `[-2, 48]`, y ∈ `[-4, 18]`. Death: `y < -3` or `x > 46`.
Pad (aim phase): centre `(2.0, 1.0)`, half `(1.5, 0.25)`. Capsule start
`(2.0, 1.7)`.

Rings (sensor AABBs, score once per sub-attempt), half `(0.15, 1.4)`:

| order | centre x | centre y |
|---|---|---|
| 1 | 10.0 | 4.0 |
| 2 | 18.0 | 6.5 |
| 3 | 26.0 | 5.0 |
| 4 | 34.0 | 7.0 |

Landing deck: centre `(40.0, 1.0)`, half `(2.5, 0.25)`. Resting on the deck
with `|v| < 0.8` for 20 ticks ends the sub-attempt as a landing.

Seed ignored for geometry.

---

## Score contract

`ranked_score` = sum of three sub-attempt scores.

| type | when | `points` | `multiplier` |
|---|---|---|---|
| `distance` | `floor(maxX * 10)` increases | delta (dm) | `100` |
| `ring` | first crossing of that ring this sub-attempt | `250` | `100` |
| `landing` | settled on deck | `400` if all four rings this throw, else `150` | `100` |
| `fail` | death | `0` | `100` |

No combo. Tiebreakers: none.

---

## Manifest budget

```
maxRigidBodies: 16
maxColliders: 24
maxJoints: 0
maxReplayBytes: 5120
maxScoreEvents: 256
```

---

## Kit finding log

- Wave A platform increment: none. GameHost, `/v1`, and schema unchanged.
- `launchImpulse` + `resetDynamicPose` live in `physics-kit`. Construction still uses `SimWorld.createRigidBody`.
- Per-decimetre `distance` events would exceed `maxScoreEvents: 256` on a 90 s three-launch run. v1 emits one `distance` event per sub-attempt at close, points = accumulated `floor(maxX*10)` delta for that throw. Ranked score is unchanged versus summing per-tick deltas.
- Best-of pose reset does not create or destroy rigid bodies after tick 0.
