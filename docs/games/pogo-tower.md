# Pogo Tower

**Slug:** `pogo-tower`  
**registryId:** `6`  
**gameVersion / simulationVersion / scoringVersion:** `1.0.0` / `1` / `1`  
**rankedFormat:** `weekly-seed`  
**attemptShape:** `{ kind: 'single' }`  
**maxRunTicks:** `7200` (120 s)  
**Status:** frozen for Spec 4 v1. Generator changes bump `simulation_version`.

Working title. Trademark clearance is pending.

First **seeded generator**. First **kinematic moving platforms**. Capsule
climber, not a ragdoll. Pickaxe v1 must not be rewritten to use these movers.

---

## Player problem

Auto-bounce upward. Lean to land on shrinking, sometimes moving, ledges.
The week's seed is the course.

---

## Actions

| id | name | kind | min | max |
|---|---|---|---|---|
| 1 | `lean` | `int` | 0 | 200 | 

`lean` is 0–200 meaning −1.00…+1.00 hundredths (`value - 100`). Record on
change. Keyboard: A/D hold nudges ±4 per tick. Touch: tilt analog, quantised.

One analog axis. Cheap-check 8 is plenty.

---

## Physics (SI)

- Climber: Hookline capsule at generated spawn, rotation locked, damping 0.02.
- Pogo impulse: on contact with a `ledge` collider, apply `+v` of `9.0` m/s
  if `vy ≤ 0` (once per contact edge). No extra body for the spring.
- Lean: each tick `applyImpulse({ x: leanHundredths * 0.04, y: 0 })`.
- Movers: kinematic cuboids; `setKinematicTranslation` pre-step. Path is a
  function of `tick` and the platform's seed-drawn amplitude — `detmath.sin`
  of `tick * ω`.

---

## Generator v1

`createTower(prng): { spawn: {x,y}, ledges: Ledge[] }`

- Always 16 ledges, y = `2 + i * 1.8` for i in 0..15.
- `x = 3 + (prng.u32() % 401) / 100` → 3.00–7.00 in 0.01 m steps.
- Half extents: `hx = 0.90 - i * 0.03`, `hy = 0.10`.
- Moving if `(prng.u32() % 4) === 0`: amplitude `(prng.u32() % 81) / 100`
  (0–0.80 m), period ticks `90 + (prng.u32() % 91)`.
- Walls at x = 0.4 and x = 9.6 (static). Floor at y = 0.25.
- Spawn `(5.0, 1.6)`.
- Death `y < 0`. Finish: `maxY >= 2 + 15 * 1.8` (top ledge band) or timeout.

PRNG draw order is the list above. Do not add extra draws.

Same function on every runtime. Geometry fixture dumps JSON of the 16 ledges.

---

## Score contract

| type | when | `points` | `multiplier` |
|---|---|---|---|
| `altitude` | `floor(maxY * 10)` increases | delta dm | `100` |
| `land` | pogo contact on a new ledge index | `120` | streak |
| `fail` | `y < 0` | `0` | `100` |

Streak: `streakHundredths(consecutiveNewLedges, 20, 5)`. Resets on death or
on a drop > 2.0 m from apex since last land.

Tiebreakers: none.

Championship: **does not** use weekly results (`docs/competitive-spec.md` §11).
Weekly is its own board.

---

## Manifest budget

```
maxRigidBodies: 24
maxColliders: 40
maxJoints: 0
maxReplayBytes: 15360
maxScoreEvents: 512
```

---

## Kit finding log

Wave B may extend `/v1` issue to `weekly-seed`. Prefer storing ISO-week Monday
in `daily_boards.utc_date`. Schema migration = stop and review.
