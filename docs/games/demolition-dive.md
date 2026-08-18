# Demolition Dive

**Slug:** `demolition-dive`  
**registryId:** `10`  
**gameVersion / simulationVersion / scoringVersion:** `1.0.0` / `1` / `1`  
**rankedFormat:** `fixed-course`  
**attemptShape:** `{ kind: 'best-of', count: 3 }` (sum)  
**maxRunTicks:** `5400`  
**Status:** frozen for Spec 4 v1. Highest determinism risk; ships last.

Working title. Trademark clearance is pending.

Reuse the Archery **ten-body ragdoll** (extracted kit). Three dives, sum.
Structures are authored stacks of breakable cuboids, not a copied skyline.

---

## Player problem

Aim a dive so the ragdoll hits a weak storey and the stack chains. Caps keep
the sim inside a mobile budget.

---

## Actions

| id | name | kind | min | max |
|---|---|---|---|---|
| 1 | `aim` | `int` | 0 | 359 |
| 2 | `power` | `int` | 0 | 100 |
| 3 | `launch` | `bool` |  |  |

Same commit model as Launch Lab. After each dive settles (all breakable
linear speeds `< 0.4` for 30 ticks) or leaves AABB, reset ragdoll pose to the
gantry **without new bodies**, restore breakables that have a `resetGroup`
already allocated at tick 0 (see below).

---

## Physics (SI)

Ragdoll: Archery table, but torso **unlocked** for the dive. Gantry start
torso `(2.0, 12.0)`.

Breakables: 12 cuboids in three storeys. Each has a fracture impulse threshold
`|n| > 4.0` from a contact with the ragdoll or another breakable. On fracture
the cuboid stays in the world (no new shards — **no body spawn**). It becomes
dynamic if it was fixed; colour/render flags `broken`. Chain: a broken piece
may fracture neighbours the same tick, depth cap **3**.

Despawn: if a piece centre leaves AABB `x∈[-2,22], y∈[-2,16]`, set it to a
park pose at `(-10, -10)` and disable its collider (still the same handle).
Never `destroyRigidBody`.

**Reset between dives:** park pose back to authored pose, colliders enabled,
`broken=false`. Same handles.

---

## Course v1 (metres)

Storey cuboids, half `(0.8, 0.25)`, x = 10, y centres:

| order | y | value |
|---|---|---|
| 1–4 | 1.0 | 40 each |
| 5–8 | 3.0 | 70 each |
| 9–12 | 5.0 | 110 each |

x offsets within a storey: `8.4, 10.0, 11.6, 13.2`.

Floor under the stack. Backstop x = 20.

---

## Score contract

Sum of three dives.

| type | when | `points` | `multiplier` |
|---|---|---|---|
| `break` | cuboid first fractures this dive | table value | chain |
| `fail` | ragdoll `y < -1` before any break this dive | `0` | `100` |

Chain multiplier: `100 + 20 * min(depth, 3)` on that break event.

---

## Manifest budget (hard caps, enforced every step)

```
maxRigidBodies: 28
maxColliders: 48
maxJoints: 16
maxReplayBytes: 81920
maxScoreEvents: 256
maxBreakables: 12
maxChainDepth: 3
```

Four-runtime fixture at this body count before Phaser. If it fails closed,
cut the game; championship becomes nine columns / 9,000 max. No replacement
title.

---

## Kit finding log

Pre-flight: Branch A. Rapier stays `0.20.0` `-compat`.

Fracture uses `contactImpulse` on manifolds, `|n| > 4.0`. Same-tick chain is
index-ordered with depth cap 3. Despawn parks `(-10,-10)` and `collider.setEnabled(false)`.
Never `destroyRigidBody`. Floor sits under the stack only so a miss can fall.

Max-body four-runtime hashes (28 bodies) live in `packages/physics-kit/conformance/golden/max-body.json`.

Sample freeze: score **528**, hash **`7a45fea1ee107627`**, `SAMPLE_TICKS` 480.

