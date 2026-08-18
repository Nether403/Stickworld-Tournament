# Rooftop Relay

**Slug:** `rooftop-relay`  
**registryId:** `7`  
**gameVersion / simulationVersion / scoringVersion:** `1.0.0` / `1` / `1`  
**rankedFormat:** `fixed-course`  
**attemptShape:** `{ kind: 'single' }`  
**maxRunTicks:** `9000` (150 s)  
**Status:** frozen for Spec 4 v1.

Working title. Trademark clearance is pending.

Movement is a **kinematic character controller**, not a dynamic capsule.
Stumble is a `renderState.stumbled` flag lasting 20 ticks after a graze;
it does not switch to ragdoll.

---

## Player problem

Carry speed across authored roofs. Jump and slide are the only verbs. Route
is choosing when to slide under a lintel vs jump a gap.

---

## Actions

| id | name | kind | min | max |
|---|---|---|---|---|
| 1 | `run` | `int` | 0 | 2 | 
| 2 | `jump` | `bool` |  |  |
| 3 | `slide` | `bool` |  |  |

`run`: 0 still, 1 forward, 2 back. Record on change. Touch: on-screen left/right
or auto-run with jump/slide buttons (two buttons — R6). Keyboard: arrows +
Space jump + C slide.

---

## Physics (SI)

- Controller: kinematic cuboid `0.18 × 0.45` (standing) / `0.18 × 0.22` (slide).
  Shape swap MUST be the same collider resized or a second sensor already
  created at tick 0 — no new bodies.
- Horizontal speed: `5.0` m/s forward, `3.0` back. Gravity integrated in the
  controller (`vy -= 9.81/60` each tick) with floor snaps, not Rapier dynamic.
- Jump: `vy = 7.5` if grounded. Coyote 4 ticks. Buffer 4 ticks.
- Construction: roofs in table order, lintels, start block, character.

Moving platforms: none in v1 (Pogo already proved movers; this course is static
so the controller fixture is readable).

---

## Course v1 (metres)

Start `(2.0, 3.0)`. Death `y < 0`. Finish `x >= 72`.

Roofs (cuboids), half-y `0.20`:

| order | centre x | centre y | hx |
|---|---|---|---|
| 1 | 4 | 1.0 | 4 |
| 2 | 14 | 1.4 | 3.5 |
| 3 | 24 | 2.2 | 3.0 |
| 4 | 34 | 1.6 | 3.5 |
| 5 | 46 | 2.8 | 4.0 |
| 6 | 58 | 2.0 | 3.0 |
| 7 | 70 | 1.2 | 4.0 |

Lintels (low beams, slide under): centres `(24, 3.4)` and `(58, 3.2)`, half
`(1.2, 0.15)`. Checkpoints at x = 12, 24, 36, 48, 60, 72.

---

## Score contract

| type | when | `points` | `multiplier` |
|---|---|---|---|
| `progress` | `floor(maxX * 10)` increases | delta dm | `100` |
| `checkpoint` | first plane | `300` | flow |
| `finish` | `x >= 72` | `finishBonus(tick, 9000)` | `100` |
| `fail` | `y < 0` | `0` | `100` |

Flow hundredths: `100 + 25 * min(checkpointsThisRunWithoutFail, 4)`. Resets on
fail only (not on stumble).

---

## Manifest budget

```
maxRigidBodies: 24
maxColliders: 40
maxJoints: 0
maxReplayBytes: 40960
maxScoreEvents: 768
```

150 s synthetic record-on-change MUST be written before the Phaser scene.

---

## Kit finding log

Stumble is `renderState.stumbled` for 20 ticks after a lintel graze. Slide
resizes the same cuboid (`setHalfExtents`) and shifts y so the feet stay put.
No new bodies. Gravity is integrated in the controller (`GRAVITY_Y * TIMESTEP`).

Sample freeze: score **1103**, hash **`7e2dc106b92d0b28`**, `SAMPLE_TICKS` 480.
150 s record-on-change synthetic is asserted in `tests/contract.test.ts` before
the Phaser scene. Real mid-range Android frame-time is a demo gate, not CI.
