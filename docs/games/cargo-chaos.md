# Cargo Chaos

**Slug:** `cargo-chaos`  
**registryId:** `9`  
**gameVersion / simulationVersion / scoringVersion:** `1.0.0` / `1` / `1`  
**rankedFormat:** `fixed-course`  
**attemptShape:** `{ kind: 'single' }`  
**maxRunTicks:** `9000` (150 s)  
**Status:** frozen for Spec 4 v1.

Working title. Likely crowded on the register — fallback name on the legal track.

---

## Player problem

Carry a crate on a jointed hitch through a shaft of static ledges without
wrecking it. Fast inputs damage condition. Condition is an integer 0–100.

---

## Actions

| id | name | kind | min | max |
|---|---|---|---|---|
| 1 | `aim` | `int` | 0 | 359 |
| 2 | `hook` | `bool` |  |  |

Same hold-to-attach language as Hookline (rope to **cargo hitch** points, not
world anchors copied from Hookline's eight-ball layout). Hitch points are
fixed balls on the crate's path — original positions below.

---

## Physics (SI)

- Carrier: Hookline capsule `(2.0, 1.6)`.
- Crate: cuboid `0.40 × 0.40`, mass 25, start `(2.8, 1.6)`.
- Hitch: rope rest `0.9` m between carrier and crate, always on (not the
  player's hook). Player hook attaches carrier to **posts**.
- Condition: start 100. Each tick `|crate.linvel| > 6` subtracts 1, at most
  once per 10 ticks. Hitting a `hazard` sensor subtracts 15 once per sensor.
  Clamp at 0. Integer only.

---

## Course v1 (metres)

Death: carrier `y < 0` or condition hits 0. Finish: crate centre `x >= 36`
and `y > 0.5`.

Posts (fixed balls r 0.18), creation order:

| order | x | y |
|---|---|---|
| 1 | 6.0 | 3.5 |
| 2 | 11.0 | 2.0 |
| 3 | 16.0 | 4.0 |
| 4 | 22.0 | 3.0 |
| 5 | 28.0 | 5.0 |
| 6 | 33.0 | 2.5 |

Hazards (sensors): `(13.0, 0.8)` and `(25.0, 0.8)`, half `(1.0, 0.4)`.
Floor segments at y = 0.25 covering x 0–8, 18–24, 32–40 (gaps in between).

---

## Score contract

| type | when | `points` | `multiplier` |
|---|---|---|---|
| `progress` | crate maxX dm | delta | `100` |
| `condition` | at finish or fail, once | `condition` | `100` |
| `finish` | crate across plane | `finishBonus(tick, 9000)` | `100` |
| `fail` | death or condition 0 | `0` | `100` |

`condition` event points equal the integer 0–100 remaining. Do not float.

---

## Manifest budget

```
maxRigidBodies: 24
maxColliders: 40
maxJoints: 4
maxReplayBytes: 40960
maxScoreEvents: 512
```

---

## Kit finding log

The crate hitch sits on the aim ray to post 1, so a physics raycast hits the
crate first. v1 attaches to the nearest in-range post inside the aim cone
(dot ≥ 0.7). No extra bodies.

Sample freeze: score **16**, hash **`7bd2d9b1fb4c791a`**, `SAMPLE_TICKS` 360.
150 s record-on-change synthetic is asserted in `tests/contract.test.ts` before
the Phaser scene. Real mid-range Android frame-time is a demo gate, not CI.
