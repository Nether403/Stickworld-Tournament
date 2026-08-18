# Pickaxe Ascent

**Slug:** `pickaxe-ascent`  
**registryId:** `2`  
**gameVersion / simulationVersion / scoringVersion:** `1.0.0` / `1` / `1`  
**rankedFormat:** `fixed-course`  
**attemptShape:** `{ kind: 'single' }`  
**maxRunTicks:** `7200` (120 s at 60 Hz)  
**Status:** frozen for Spec 3 v1. Geometry or scoring changes require a new `game_version`.

Working title. Trademark clearance is pending.

This game **proves the kit**. It must not force GameHost or `/v1` changes.
Static ledges only (ADR-0005). No kinematic moving platforms.

---

## Player problem

Climb a shaft by placing a pick and using gravity and pendulum leverage to gain
altitude. Skill is aim and when to let go, not a copied cave layout.

---

## Actions

| id | name | kind | min | max | scale |
|---|---|---|---|---|---|
| 1 | `aim` | `int` | 0 | 359 | 1 |
| 2 | `hook` | `bool` |  |  |  |

Drag-and-release:

- Pointer move updates `aim` (integer degrees, 0 = +x, counter-clockwise, Y-up
  world). Record **only when the quantized degree changes**.
- Pointer down sets `hook = 1` (try attach / hold). Pointer up sets `hook = 0`
  (release).
- Keyboard: A/D or arrows change `aim` by 3 degrees per tick while held;
  Space is `hook`.

Cadence: at most 2 events per tick (`aim` change + `hook` edge). Cheap-check
limit is 8.

---

## Physics (SI)

- Climber: dynamic capsule, same dimensions as Hookline (kit reuse), rotation
  locked.
- Pickaxe: **kinematic** capsule or cuboid `1.20 × 0.08` m, pose each tick:
  origin = climber centre + `(0, 0.15)`, rotation = `aim * π / 180` via
  `detmath` (`sin`/`cos`). Kinematic pose is set in pre-step **before**
  `world.step()`. This avoids motors.
- Attach: on `0 → 1`, ray from pickaxe tip along the pickaxe axis, length
  `0.45` m. If it hits a **ledge** collider, create a rope/distance joint
  rest length `0.12` m between climber and a dedicated **anchor body** at the
  hit point (or the ledge body with a local anchor). One joint max.
- Release: `1 → 0` removes the joint.
- Construction order: shaft walls, ledges in table order, climber, pickaxe
  kinematic body. Joints ephemeral.

---

## Course v1 (metres)

Shaft: x ∈ `[0, 10]`, y ∈ `[-2, 30]`. Walls: x = 0.4 and x = 9.6, cuboids.
Death: `y < 0`. Finish: `y >= 24`.

Start: climber `(5.0, 1.6)` on a floor cuboid centre `(5.0, 0.25)`, half
`(4.5, 0.25)`.

Ledges (fixed cuboids), creation order. Half-extents `(1.1, 0.12)` unless noted:

| order | centre x | centre y |
|---|---|---|
| 1 | 3.2 | 3.5 |
| 2 | 6.8 | 6.5 |
| 3 | 3.0 | 9.5 |
| 4 | 7.0 | 12.5 |
| 5 | 3.4 | 15.5 |
| 6 | 6.6 | 18.5 |
| 7 | 3.2 | 21.5 |
| 8 | 5.0 | 24.5 |

Checkpoints: invisible sensors at y = 3, 6, 9, 12, 15, 18, 21, 24 (full shaft
width). Each awards once when `maxY` crosses that plane.

Seed ignored for geometry. PRNG unused in v1.

---

## Score contract

| type | when | `points` | `multiplier` |
|---|---|---|---|
| `altitude` | `floor(maxY * 10)` increases | delta (decimetres of best-y) | `100` |
| `checkpoint` | first crossing of a checkpoint y | `400` | current streak |
| `clean-climb` | checkpoint without a drop > 2.0 m from run-apex since last checkpoint | `150` | current streak |
| `finish` | `y >= 24` | `max(0, floor((7200 - tick) / 6))` | `100` |
| `fail` | death | `0` | `100` |

Streak hundredths: `100 + 20 * min(cleanCount, 5)` → 100…200. Resets on death
or on a drop > 2.0 m from the highest `y` since the last checkpoint.

Tiebreakers: none.

---

## Manifest budget

```ts
maxRigidBodies: 24
maxColliders: 40
maxJoints: 4
maxReplayBytes: 15360   // analog aim; still "small"
maxScoreEvents: 768
```

Replay compressed size for a 120 s aim-heavy run SHALL stay under 15 KB in the
fixture test. If it does not, reduce aim recording (already record-on-change)
before widening the budget.

---

## Kit finding log

Fill during Task 3. If GameHost, `/v1`, or schema must change, **stop**.

| Date | Finding | Disposition |
|---|---|---|
| | | |

---

## Integration effort (fill at the end of Task 3)

- Hookline Task 1 wall-clock (from git dates or log):
- Pickaxe Task 3 wall-clock:
- New files vs Hookline:
- New platform files (must be 0 besides seed + map):
