# Balance Bike Blitz

**Slug:** `balance-bike-blitz`  
**registryId:** `8`  
**gameVersion / simulationVersion / scoringVersion:** `1.0.0` / `1` / `1`  
**rankedFormat:** `fixed-course`  
**attemptShape:** `{ kind: 'single' }`  
**maxRunTicks:** `9000` (150 s)  
**Status:** frozen for Spec 4 v1.

Working title. "Balance bike" is a real product category — legal track has a
fallback name ready if clearance fails.

---

## Player problem

Ride a two-wheel assembly over ramps without looping out. Throttle, brake,
lean. Crash (torso angle beyond ±80° for 30 ticks, or `y < 0`) ends the run.

---

## Actions

| id | name | kind | min | max |
|---|---|---|---|---|
| 1 | `throttle` | `bool` |  |  |
| 2 | `brake` | `bool` |  |  |
| 3 | `lean` | `int` | 0 | 200 |

`lean` 0–200 → −1.00…+1.00. Two buttons + analog lean. Touch: hold right
half = throttle, left = brake, tilt = lean.

---

## Physics (SI)

Wheel assembly (kit), construction order:

1. Frame cuboid `0.55 × 0.08`, mass 12, start `(2.0, 1.2)`
2. Rear wheel ball r `0.28`, mass 2
3. Front wheel ball r `0.28`, mass 2
4. Rider capsule (locked to frame with a fixed joint) — presentation mass 70
   split: capsule 40 + frame already 12

Suspension: wheel–frame prismatic or distance joints rest `0.32` m. Wheel
motors: rear wheel torque while `throttle`, brake impulse while `brake`.
Lean: torque on frame `leanHundredths * 0.8`.

---

## Course v1 (metres)

Death `y < -1`. Finish `x >= 64`.

| order | kind | centre | half |
|---|---|---|---|
| 1 | floor | (8, 0.25) | (8, 0.25) |
| 2 | ramp | (18, 1.0) | (3, 0.20) rotated +12° kinematic **fixed angle** (not moving) |
| 3 | gap floor | (28, 0.25) | (4, 0.25) |
| 4 | ramp | (36, 1.4) | (3, 0.20) −8° |
| 5 | beam | (46, 2.0) | (4, 0.12) |
| 6 | deck | (58, 0.25) | (8, 0.25) |

If kinematic rotation of a "fixed" ramp is awkward, bake the ramp as a static
hull of two cuboids. Do not add movers here; Pogo owns movers.

Checkpoints x = 16, 32, 48, 64.

---

## Score contract

| type | when | `points` | `multiplier` |
|---|---|---|---|
| `progress` | maxX dm | delta | `100` |
| `air` | ticks with both wheels off ground, each 10 ticks | `15` | combo |
| `checkpoint` | plane | `250` | combo |
| `finish` | `x >= 64` | `finishBonus(tick, 9000)` | `100` |
| `fail` | crash or `y < -1` | `0` | `100` |

Combo: `streakHundredths` on checkpoints; air does not increment streak.
Resets on fail.

---

## Manifest budget

```
maxRigidBodies: 20
maxColliders: 32
maxJoints: 8
maxReplayBytes: 40960
maxScoreEvents: 768
```
