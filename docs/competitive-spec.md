# Stickworld Competitive Specification

This is the rulebook simulation code may depend on. It is short on purpose. If a
later spec disagrees with this file, **this file wins** until it is explicitly
amended and version-bumped.

Competition-affecting amendments require a new season (or a new leaderboard for
the affected game). Cosmetic amendments do not.

---

## 1. Seven conditions every ranked game must satisfy

1. Accepts an explicit 128-bit seed; the client never chooses it.
2. Advances in fixed simulation ticks; frames never affect outcomes.
3. Produces one integer `ranked_score`; higher is always better.
4. Reproduces that score from recorded inputs alone.
5. Serialises every player input that affected the simulation.
6. Produces deterministic checkpoints (a 64-bit state hash at any tick).
7. Supports version pinning: game, simulation, scoring, and Rapier build.

A game that cannot meet all seven is practice-only. It does not enter a
leaderboard.

---

## 2. Time

| Constant | Value |
|---|---|
| Tick rate | **60 Hz** |
| Timestep | exactly `1/60` seconds |
| Time unit inside simulation | integer `tick`, starting at 0 |
| Wall clock | forbidden inside simulation and scoring |

Rendering uses an accumulator. Whole ticks are consumed; the fractional
remainder interpolates presentation only.

When the render loop stalls (background tab, GC pause, slow device):

- Real delta is clamped to `MAX_FRAME_DELTA = 0.25` s.
- At most `MAX_TICKS_PER_FRAME = 15` ticks are consumed in one frame.
- Excess real time is discarded. This is a death-spiral guard, not a pause
  button.
- The verifier ignores wall clock entirely. It drives exactly `totalTicks`
  from the replay.

---

## 3. Units

Physics uses SI units: metres, kilograms, seconds. Gravity is `-9.81` m/s²
along Y (down).

`PIXELS_PER_METRE = 50`. A 1.8 m stickman draws about 90 px tall. Simulation
code does not contain pixel quantities. Render code multiplies metres by this
constant.

Rapier is f32 internally. JS numbers are f64. State hashing reads f32 bits.
Scoring never accumulates floats.

---

## 4. Seed and randomness

A seed is four `uint32` values (`Seed128`). The server issues it. All-zero is
illegal (degenerate PRNG state) and must never be issued.

The only RNG simulation code may use is the spec-1 xorshift128 (32-bit
variant) constructed from that seed. See `docs/adr/0003-prng-choice.md`.
`Math.random` and `crypto.getRandomValues` are lint errors.

---

## 5. Score

- Canonical `ranked_score` is an integer. On the wire and in Postgres it is
  `int64` / `bigint`.
- Higher is always better. When a game cares about time, time becomes bonus
  points. Time is never a raw ranking key.
- Score is a pure integer aggregation of score events
  `{ tick, type, points, multiplier }`.
- `points` is an integer. `multiplier` is an integer scaled by 100
  (so `1.5×` is `150`). No floating-point accumulation.
- The client's claimed score and claimed event stream are advisory. The
  server's recomputation is authoritative. A mismatch names the first
  divergent tick and event.

---

## 6. Replay

| Field | Value |
|---|---|
| Magic | ASCII `SWR1` |
| Format version | `1` |
| Contents | inputs only — never positions, velocities, or client-computed state |
| Analog inputs | quantised to integers **at capture time**, per the game's action table |
| Integrity | CRC-32 over header+body, plus final 64-bit state hash |
| Storage | gzip-compressed `bytea` in Postgres |

A 90-second single-action run must encode under 5 KB compressed.

Malformed, truncated, oversized, unknown-version, or CRC-failing replays
return a typed error. They do not throw unhandled, allocate unboundedly, or
loop unboundedly.

---

## 7. Attempt lifecycle

Ranked play is a server-authorised **attempt**, not a client-declared run.

```
issued → active → submitted → verifying → verified
                                 └→ rejected
         └→ abandoned   (refresh, close, expiry, explicit abort)
```

- Practice does not create a ranked attempt and cannot become a personal best.
- Guests may play practice. Ranked requires an account.
- The server binds attempt id, seed, game version, and expiry. The client
  cannot change them.
- Each attempt has a single-use nonce. Reuse is rejected.
- Refresh, navigation away, or close **abandons** the attempt. Ranked runs
  are not resumable. Start a new attempt.
- An expired attempt cannot be submitted.
- A completed attempt becomes a **run** (inputs + claimed score). Only a
  **verified** run may become a personal best.

---

## 8. Pause and focus

- Ranked: there is no pause control. The player cannot freeze a competitive
  run to think, tab-switch strategically, or screenshot a puzzle.
- Hidden-tab / stall behaviour follows §2: at most 15 ticks of catch-up, then
  discarded real time. That discarded time is **not** extra thinking time on
  the verifier — the verifier never saw it. On the client it is a brief hitch,
  then the run continues.
- Practice: pause is allowed. Paused practice produces no ranked replay.
- Alt-tab, phone lock, and backgrounding do not extend a ranked attempt's
  expiry.

---

## 9. Personal bests

- Eligibility: the player's best **verified** `ranked_score` for that
  `season_game`.
- A strictly higher verified score replaces the stored best.
- A worse score is kept as a run and ignored for ranking.
- An equal score does not replace. The earlier `achieved_at` stands.
- Unverified, rejected, abandoned, and practice runs never become a PB.

---

## 10. Per-game ranking and ties

Order: `ranked_score` descending, then that game's published tiebreakers,
then earlier `achieved_at`.

Ties that survive every published tiebreaker **share a place** (SQL `RANK()`,
so 1, 2, 2, 4). Games declare tiebreakers in their manifest. If they declare
none, score then earlier `achieved_at` is the whole order.

Leaderboard reads come from a snapshot labelled `as of <timestamp>`. The
snapshot is fully rebuildable from verified results.

---

## 11. Championship points

Each of the ten games contributes 0–1,000 points. Non-participation is 0.
All ten count. Daily-ladder results do **not** count.

A game contributes championship points only at **≥ 50 verified entrants**.
Below that it displays as provisional.

### Placement table (ranks 1–100)

Integer arithmetic, no floats:

```
placement(rank) = 1000 - floor(((rank - 1) * 100) / 99)
```

1st = 1000, 100th = 900. Ranks between are monotonic non-increasing integers.

If a game has fewer than 100 entrants (but at least 50), only the ranks that
exist use this table. There is no tail yet.

### Tail (rank ≥ 101)

```
tail(rank, N) = floor(899 * (N - rank) / (N - 100))
```

Last place is 0. Rank 101 is just below 900. `N` is the number of verified
entrants that game-season.

### Overall ties

Published order, stop at the first difference:

1. Most per-game wins (place 1 on a game).
2. Most top-10 finishes.
3. Highest median of the ten game point totals.
4. Earliest `achieved_at` of the championship total.

Standings are recomputed on a schedule and labelled `as of <timestamp>`.
Season close freezes an immutable snapshot.

A secondary "Best 6 of 10" ladder may exist for retention. It is not the
championship.

---

## 12. Version pinning

These are competition-affecting. Changing any of them on an in-season game
means a new `game_version` and a new leaderboard, not a silent patch.

| Pin | Meaning |
|---|---|
| `game_version` | content, geometry, timing windows |
| `simulation_version` | tick contract, stepper, body order, hash |
| `scoring_version` | event types and aggregation |
| `DETMATH_VERSION` | numeric change to detmath |
| Rapier package + SHA-256 of the inlined WASM | physics build |
| `REPLAY_FORMAT_VERSION` | bytes on the wire |

Golden determinism hashes are the contract. Regenerating them to "fix" CI
requires an ADR.

Cosmetic art, audio, and UI copy may ship without a version bump provided
they cannot change a score.

---

## 13. Verification

Every ranked run is re-simulated. No trusted client scores. No elite-only
tier. No ML anomaly detector.

Verification is: decode replay → load the exact pinned build → apply inputs
in contract order → compare integer score and final state hash.

Until Spec 1's determinism harness writes `docs/adr/0001-determinism-fork.md`,
the worker runtime (Node vs headless Chromium) is not frozen. Everything else
in this file is.
