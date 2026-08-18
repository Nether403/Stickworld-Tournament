# Hammer Throw Havoc

**Slug:** `hammer-throw-havoc`  
**registryId:** `5`  
**gameVersion / simulationVersion / scoringVersion:** `1.0.0` / `1` / `1`  
**rankedFormat:** `fixed-course`  
**attemptShape:** `{ kind: 'best-of', count: 3 }` (sum)  
**maxRunTicks:** `5400`  
**Status:** frozen for Spec 4 v1.

Working title. Trademark clearance is pending.

Thrower is a locked capsule. The hammer is a separate dynamic body (not a
ragdoll). Angular-release is this game's new primitive.

---

## Player problem

Spin up, release at the right phase so the hammer flies through gates and
lands far. Three throws, all count.

---

## Actions

| id | name | kind | min | max |
|---|---|---|---|---|
| 1 | `spin` | `bool` |  |  |
| 2 | `release` | `bool` |  |  |

- Hold `spin` to add a capped angular impulse each tick to the hammer about
  the thrower (`+0.35` N·m equivalent via `applyTorqueImpulse`, cap
  `|ω| ≤ 18` rad/s using `detmath` abs).
- `release` 0→1 destroys the rope/revolute linking hammer to thrower (ephemeral
  joint). Gravity and linear velocity take over.
- Keyboard: hold D or Right to spin; Space release. Touch: hold to spin,
  release the hold to throw (drag-and-release).
- Record edges only. Tiny replay.

After the hammer sleeps or leaves the AABB, reset hammer pose to the hand,
recreate the **same** joint slot only if the joint was destroyed — prefer
keeping the joint and setting motor zero vs create/destroy if registry
stability requires it. **Do not create a new rigid body.** Sub-index increments.

---

## Physics (SI)

- Thrower capsule at `(3.0, 1.6)`, locked rotation, locked translation (the
  circle is the hammer's, not footwork).
- Hammer: cuboid `0.45 × 0.08`, mass `8`, start `(3.6, 1.6)`.
- Link: revolute or rope rest `0.55` m, ephemeral on release.
- Construction: floor, gates, far wall, thrower, hammer, joint.

---

## Course v1 (metres)

Floor: centre `(30, 0.25)`, half `(32, 0.25)`. Death: hammer `y < -1`.

Vertical gate sensors (once per throw), half `(0.08, 2.5)`:

| order | x | y | points |
|---|---|---|---|
| 1 | 12 | 3.0 | 80 |
| 2 | 20 | 3.5 | 120 |
| 3 | 28 | 4.0 | 180 |
| 4 | 36 | 4.5 | 240 |

Far wall at x = 52 (stops the hammer).

---

## Score contract

Sum of three throws.

| type | when | `points` | `multiplier` |
|---|---|---|---|
| `distance` | `floor(maxX * 10)` of the hammer increases | delta dm | `100` |
| `gate` | first crossing this throw | table | `100` |
| `fail` | hammer `y < -1` | `0` | `100` |

Tiebreakers: none.

---

## Manifest budget

```
maxRigidBodies: 16
maxColliders: 24
maxJoints: 2
maxReplayBytes: 5120
maxScoreEvents: 256
```

---

## Kit finding log

- `applySpinTorque` stays in this package. Launch Lab and Ragdoll Archery Rush do not need an angular helper, so it is not extracted into `physics-kit`.
- The published cuboid overlaps the planted thrower; v1 sets thrower/hammer collision and solver groups so they interact with the world but not each other.
- Revolute anchors at the thrower rest (`0.55` m) and the hammer handle (`-hx`) so spin is about the thrower, not the cuboid COM (COM pin produced `ω` with zero linear velocity on release).
- `+0.35` N·m/tick cannot lift the 8 kg hammer over a vertical circle against gravity. While the joint exists the hammer uses `gravityScale = 0`; gravity returns on release. No new bodies.
- Sample freeze: score **100**, hash **`b31b725255ab72d8`**, `SAMPLE_TICKS` 280. Spin from tick 0, release at tick 120.
