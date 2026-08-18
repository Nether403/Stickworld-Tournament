# Ragdoll Archery Rush

**Slug:** `ragdoll-archery-rush`  
**registryId:** `4`  
**gameVersion / simulationVersion / scoringVersion:** `1.0.0` / `1` / `1`  
**rankedFormat:** `fixed-course`  
**attemptShape:** `{ kind: 'single' }`  
**maxRunTicks:** `5400` (90 s)  
**Status:** frozen for Spec 4 v1.

Working title. Trademark clearance is pending.

**This is the first ten-body stickman.** Launch Lab and Hammer Throw v1 stay
capsules. After goldens, extract the assembly into `physics-kit`.

---

## Player problem

Draw, aim, and release arrows at a row of static scored targets. The archer's
limbs are simulated; recoil is real. Skill is hold-time and aim, not a copied
carnival silhouette.

---

## Actions

| id | name | kind | min | max | scale |
|---|---|---|---|---|---|
| 1 | `aim` | `int` | 0 | 359 | 1 |
| 2 | `draw` | `int` | 0 | 100 | 1 |
| 3 | `fire` | `bool` |  |  |  |

- Pointer: aim from torso to pointer; drag distance → `draw`. Record on change.
- `fire` 0→1 spawns **no new body**. The arrow already exists (see Physics):
  pose it on the string each tick while not in flight; on fire, apply impulse
  and un-weld.
- One arrow in flight at a time. Next fire ignored until the arrow sleeps on a
  target, hits the backstop, or leaves the AABB (then reset pose to the string).
- Keyboard: A/D aim; W/S draw; Space fire.

---

## Physics (SI)

Ten capsules, construction order **root to leaves**. No separate hips body
(torso is the root). Freeze this table; do not add an eleventh body without a
`game_version`.

| order | part | halfHeight | radius | mass |
|---|---|---|---|---|
| 1 | torso | 0.28 | 0.16 | 22 |
| 2 | head | 0.08 | 0.12 | 6 |
| 3 | L upper arm | 0.14 | 0.07 | 4 |
| 4 | L lower arm | 0.13 | 0.06 | 3 |
| 5 | R upper arm | 0.14 | 0.07 | 4 |
| 6 | R lower arm | 0.13 | 0.06 | 3 |
| 7 | L thigh | 0.18 | 0.08 | 7 |
| 8 | L shin | 0.16 | 0.07 | 5 |
| 9 | R thigh | 0.18 | 0.08 | 7 |
| 10 | R shin | 0.16 | 0.07 | 5 |

Torso translation is **locked** (the plant). Limbs and head are dynamic.
Drawing the bow applies a counter-impulse to torso and the bow-side lower arm.
No PD balance controller. If a later wave wants a fully floppy plant, that is
a new `game_version`.

Arrow: one dynamic capsule `0.35 × 0.03`, mass `0.04`, exists from tick 0.
Welded (fixed joint) to the bow-side lower arm until `fire`. Impulse speed
`8 + draw * 0.22` m/s along `aim`.

Revolute joints with limits: torso–head, torso–each upper arm, each elbow,
torso–each thigh, each knee (nine joints). Limits live as degree literals in
the implementation and are covered by the hash fixture — do not retune after
freeze.

Targets: eight fixed discs, sensor **false** (arrow must collide). Radius `0.35`.

Floor cuboid. Backstop at x = 28.

---

## Course v1 (metres)

Torso start `(2.0, 1.4)`. Floor y = 0.25 half-height 0.25, x centre 14,
half-width 16.

Targets, creation order, centres:

| order | x | y | points |
|---|---|---|---|
| 1 | 12.0 | 2.0 | 100 |
| 2 | 12.0 | 4.5 | 150 |
| 3 | 16.0 | 3.0 | 200 |
| 4 | 16.0 | 6.0 | 250 |
| 5 | 20.0 | 2.5 | 300 |
| 6 | 20.0 | 5.5 | 400 |
| 7 | 24.0 | 4.0 | 500 |
| 8 | 24.0 | 7.0 | 800 |

First hit per target this run. Arrow reset to the string after sleep or AABB exit.

Run ends at `maxRunTicks` or when the player opens the results control in
practice. Ranked has no pause. There is no death plane in v1 (torso is locked).
`fail` is unused in shipping play; do not emit it.

---

## Score contract

| type | when | `points` | `multiplier` |
|---|---|---|---|
| `target` | first hit on that disc | table value | current streak |

Streak hundredths: `100 + 25 * min(consecutiveHits, 4)` using
`streakHundredths`. Resets on a miss (arrow stops without a new target).

Tiebreakers: none.

---

## Manifest budget

```
maxRigidBodies: 24
maxColliders: 40
maxJoints: 16
maxReplayBytes: 5120
maxScoreEvents: 64
```

---

## Kit finding log

Fill during Task 1.5–1.6. Ragdoll extract must not change freeze hashes.
v1 targets are static (movers are Wave B).
