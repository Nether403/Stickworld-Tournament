# Spec 1 — Design

**Depth:** full. This document is detailed enough to implement from directly.

---

## 1. Design principle

> One simulation core, two consumers. The same package, the same pinned `.wasm`, the same seed,
> the same inputs — the browser for play, the worker for verification.

Everything follows from that. Phaser never touches game rules. Postgres, HTTP, and React are
invisible to `sim-core`. If a score cannot be recomputed from inputs alone, it does not enter a
leaderboard.

The corollary is a hard dependency rule, enforced by lint: **`sim-core` and any game's
`simulation/` directory may not import from Phaser, React, Next, `node:*`, or any DOM global.**
Their only dependency is `@dimforge/rapier2d-compat`. This is what makes headless verification
possible, and it is easy to violate accidentally.

---

## 2. Repository layout

Only what Spec 1 creates. Later specs add `apps/`, `games/`, and the remaining `packages/`.

```
stickworld-tournament/
├── .gitignore                        # DONE — credentials excluded before git init
├── .kiro/specs/                      # these documents
├── package.json                      # pnpm workspace root
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json
├── .eslintrc.cjs                     # includes the determinism ban
├── vitest.workspace.ts
│
├── docs/
│   ├── competitive-spec.md           # R12 — written FIRST
│   └── adr/
│       ├── 0001-determinism-fork.md  # written by Task 2, the key artefact
│       ├── 0002-rapier-compat-build.md
│       └── 0003-prng-choice.md
│
├── packages/
│   ├── config-ts/                    # shared tsconfig
│   ├── config-eslint/                # shared eslint + the determinism rule
│   │
│   ├── sim-core/
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── rapier.ts             # init, build-hash verification
│   │   │   ├── detmath.ts            # the only maths surface
│   │   │   ├── detmath.internal.ts   # polynomial kernels
│   │   │   ├── prng.ts               # xorshift128, 4x uint32
│   │   │   ├── stepper.ts            # fixed-timestep accumulator
│   │   │   ├── bodies.ts             # stable creation-index registry
│   │   │   ├── hash.ts               # 64-bit state fingerprint
│   │   │   ├── units.ts              # PIXELS_PER_METRE, gravity
│   │   │   ├── budget.ts             # runtime budget enforcement
│   │   │   ├── contract.ts           # StickworldGame, Simulation, manifest
│   │   │   ├── score.ts              # score events + integer aggregation
│   │   │   └── errors.ts             # typed error taxonomy
│   │   ├── conformance/
│   │   │   ├── fixtures/stress-01.ts # the R6.1 primitive fixture
│   │   │   ├── golden/               # committed hash series — the contract
│   │   │   ├── runner-node.ts
│   │   │   ├── runner-browser.ts
│   │   │   └── page/index.html       # static page Playwright loads
│   │   └── tests/
│   │
│   ├── replay/
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── encode.ts
│   │   │   ├── decode.ts
│   │   │   ├── varint.ts             # LEB128 + zigzag
│   │   │   ├── crc32.ts
│   │   │   ├── recorder.ts           # capture-side, quantises inputs
│   │   │   ├── player.ts             # verification-side, feeds a Simulation
│   │   │   └── format.ts             # header layout constants
│   │   ├── bin/replay-verify.ts      # the CLI
│   │   └── tests/
│   │
│   └── game-test-chamber/            # R10, permanent CI fixture
│       ├── src/{simulation,manifest}.ts
│       └── tests/
│
└── .github/workflows/ci.yml
```

---

## 3. Version constants

Single source of truth, `packages/sim-core/src/version.ts`. Every one of these is
competition-affecting; changing any means new leaderboards.

```ts
export const RAPIER_PACKAGE = '@dimforge/rapier2d-compat';
export const RAPIER_VERSION = '0.20.0';            // exact pin, no range
export const RAPIER_BUILD_SHA256 = '<filled by Task 2 on first run>';
export const TICK_RATE = 60 as const;
export const TIMESTEP = 1 / 60;
export const SIM_CORE_VERSION = 1;                 // bump = replays invalidated
export const REPLAY_FORMAT_VERSION = 1;
export const DETMATH_VERSION = 1;                  // bump on any numeric change
```

`RAPIER_BUILD_SHA256` starts empty; Task 2's first harness run prints it and it is committed.
Thereafter a mismatch fails CI with an explicit message about historical replay invalidation.

**Why `-compat`:** it inlines the WASM as base64 inside a single JS file, so browser and Node
provably load identical bytes and no bundler can substitute a different `.wasm`. Recorded as
ADR-0002. Cost: slightly larger JS payload and `await RAPIER.init()` before use. Worth it.

---

## 4. `detmath` — the deterministic maths surface

### 4.1 Classification

| Category | Functions | Treatment |
|---|---|---|
| **Exactly specified by IEEE-754/ECMAScript** | `+ - * /`, `Math.sqrt`, `abs`, `min`, `max`, `floor`, `ceil`, `round`, `trunc`, `sign`, `fround` | Re-exported from `detmath` unchanged. Safe to delegate. |
| **Implementation-defined — must be replaced** | `sin`, `cos`, `tan`, `asin`, `acos`, `atan`, `atan2`, `pow`, `exp`, `log`, `hypot`, `cbrt` | Own implementation using only the exact primitives. |
| **Forbidden outright** | `Math.random`, `Date.now`, `performance.now`, `crypto.getRandomValues`, `**` | Lint error. No replacement — use the PRNG or the tick counter. |

Everything routes through `detmath` even when it delegates, so simulation code has exactly one
import surface and one place to change if a delegation is later found unsafe.

### 4.2 Implementation approach

- `sin`/`cos`: range-reduce to `[-π/4, π/4]` using a `BigInt`-exact or Cody-Waite style
  reduction with a compile-time `π` split into high and low `f64` parts (avoids catastrophic
  cancellation), then evaluate a minimax polynomial in Horner form. Only `+ - *` used.
- `tan` = `sin/cos` with a guard near the pole.
- `atan2`: quadrant dispatch onto a minimax `atan` on `[0,1]` with the `1/x` identity above 1.
- `pow`: integer exponents by exact binary exponentiation. Fractional exponents are **not
  provided initially** — if a game needs one, it is added deliberately with its own accuracy and
  determinism tests rather than reached for casually.
- `hypot`: `sqrt(x*x + y*y)` with scaling to avoid overflow. Note this differs numerically from
  `Math.hypot`, which is intentional — ours is reproducible.

### 4.3 Testing

Two independent test axes, both required:

1. **Accuracy** — compare against a high-precision reference over a wide sampled domain, assert
   max relative error within a documented bound (target: ≤ 2 ULP for `sin`/`cos`/`atan2`).
2. **Determinism** — assert bit-identical output across Node, Chromium, Firefox, WebKit for a
   committed input vector. This is the axis that actually matters; accuracy only has to be *good
   enough and identical*.

`DETMATH_VERSION` bumps on any numeric change, because it alters historical replay outcomes.

---

## 5. PRNG

```ts
export type Seed128 = readonly [number, number, number, number];

export class Prng {
  private s: Uint32Array;              // 4 lanes
  constructor(seed: Seed128) { /* reject all-zero state */ }
  nextUint32(): number;                // >>> 0 normalised
  nextFloat(): number;                 // [0,1) as u32 / 2**32 — exact division
  nextInt(minInclusive: number, maxExclusive: number): number;  // rejection sampling, no modulo bias
  clone(): Prng;
  state(): Seed128;
}
```

Notes that matter:

- xorshift128, 32-bit variant. Only `^`, `<<`, `>>>`, `Math.imul`, with `>>> 0` after each step.
  ADR-0003 records why not xorshift128+ (needs 64-bit adds → BigInt → slower, no benefit).
- All-zero state is degenerate and is rejected at construction.
- `nextInt` uses rejection sampling. Modulo would bias and, worse, bias differently depending on
  range — a subtle fairness bug in seeded level generation.
- `nextFloat` divides by `2**32`, which is exact in IEEE-754.
- Seeds are 128-bit and server-issued. The server sends four `uint32`; the client never chooses.

---

## 6. Fixed-timestep stepper

```ts
export interface Stepper {
  readonly tick: number;
  advance(realDeltaSeconds: number): number;   // returns ticks consumed
  readonly interpolationAlpha: number;         // [0,1) — PRESENTATION ONLY
}
```

```
accumulator += min(realDelta, MAX_FRAME_DELTA)   // clamp; a stall must not spiral
while (accumulator >= TIMESTEP && ticksThisFrame < MAX_TICKS_PER_FRAME) {
    consumeInputsForTick(tick)
    game.preStep()
    world.step()
    game.postStep()                              // collisions, scoring, finish check
    tick++
    accumulator -= TIMESTEP
    ticksThisFrame++
}
interpolationAlpha = accumulator / TIMESTEP      // rendering only
```

`MAX_FRAME_DELTA` = 0.25 s and `MAX_TICKS_PER_FRAME` = 15. A backgrounded tab or a garbage-
collection pause therefore cannot inject a thousand ticks in one frame.

**The verification path does not use this class at all.** The validator drives ticks directly
from the replay's `totalTicks`, so wall-clock behaviour cannot influence a verified score. That
asymmetry is deliberate and is the reason R2.6 tests three frame pacings for an identical hash.

---

## 7. Body registry and state hashing

Rapier handles are not a safe ordering key. `sim-core` maintains its own registry:

```ts
export interface BodyRegistry {
  register(handle: RigidBodyHandle): number;   // returns stable creation index
  ordered(): readonly RigidBodyHandle[];       // ascending creation index, always
  count(): number;
}
```

Every body creation goes through `register`. Hash order is creation order. No `Map`/`Set`
iteration, no object key order, no `Array.sort` on floats.

### Hash algorithm

```
for each handle in registry.ordered():
    read translation.x, translation.y, rotation angle,
         linvel.x, linvel.y, angvel                    (f32 from Rapier)
    for each value v:
        if (!Number.isFinite(v)) throw NonFiniteStateError(index, field)
        if (v === 0) v = 0            // collapses -0 to +0
        write v into a scratch Float32Array
hash the scratch buffer's Uint8Array view with FNV-1a 64-bit over BigInt
return the 64-bit BigInt
```

`stateHash()` is pure — R5.6 requires a test proving 100 mid-run calls do not change the final
hash. Easy to get wrong if a scratch buffer is shared carelessly.

---

## 8. Replay format

### 8.1 Header (little-endian, fixed 88 bytes)

| Offset | Size | Field | Notes |
|---:|---:|---|---|
| 0 | 4 | magic | ASCII `SWR1` |
| 4 | 2 | formatVersion | uint16 |
| 6 | 2 | gameRegistryId | uint16, assigned once, never reused |
| 8 | 4 | gameVersion | packed major/minor/patch |
| 12 | 2 | simulationVersion | uint16 |
| 14 | 2 | scoringVersion | uint16 |
| 16 | 8 | rapierBuildHashPrefix | first 8 bytes of the WASM SHA-256 |
| 24 | 16 | seed | 4 × uint32 |
| 40 | 16 | attemptId | UUID bytes |
| 56 | 2 | tickRate | uint16, 60 |
| 58 | 4 | totalTicks | uint32 |
| 62 | 8 | claimedScore | int64 — headroom beyond int32 for combo-heavy games |
| 70 | 4 | eventCount | uint32 |
| 74 | 8 | finalStateHash | uint64 |
| 82 | 6 | reserved | zero-filled, pads to 88 |

### 8.2 Body — input events

Ascending tick order. Where several inputs share a tick, ascending action id (matching the
R9.4 apply order).

```
tickDelta   LEB128 unsigned varint   (delta from previous event's tick)
actionId    uint8
value       zigzag LEB128 varint     (bool → 0/1; analog → quantised integer)
```

### 8.3 Footer

```
crc32   uint32   over bytes [0, footerStart)
```

Then gzip the whole thing.

### 8.4 Why this shape

- **Inputs only.** Positions are omitted because a modified client can fabricate them (R7.2).
- **Quantised analog values.** A raw `pointermove` float is not reproducible; a game's manifest
  declares e.g. aim angle as an int in units of 1/10,000 rad. Quantisation happens at capture,
  so the recorded value *is* the value simulated. This is the single most commonly missed
  requirement in replay systems.
- **Three independent failure signals.** CRC catches transport corruption, `finalStateHash`
  catches simulation divergence, and score mismatch catches tampering. Distinguishing them is
  what makes rejection reasons useful rather than a shrug.
- **Version fields in the header.** A replay is decodable and re-simulable years later against
  the exact build that produced it.

### 8.5 Error taxonomy

Typed, distinguishable, never an unhandled throw (R7.8):

`BadMagicError`, `UnsupportedFormatVersionError`, `TruncatedReplayError`, `CrcMismatchError`,
`ReplayTooLargeError`, `UnknownActionError`, `InputValueOutOfRangeError`,
`TickOrderViolationError`, `TickCountMismatchError`, `BudgetExceededError`,
`NonFiniteStateError`, `StateHashMismatchError`, `ScoreMismatchError`.

The decoder is a parser for hostile input. Size caps are checked **before** allocation.

---

## 9. The game SDK contract

```ts
// packages/sim-core/src/contract.ts

export type RankedFormat = 'fixed-course' | 'daily-seed' | 'weekly-seed';

export interface ActionDescriptor {
  readonly id: number;                    // uint8, stable forever
  readonly name: string;
  readonly kind: 'bool' | 'int';
  readonly min?: number;                  // required when kind === 'int'
  readonly max?: number;
  readonly scale?: number;                // quantisation divisor, e.g. 10_000 for 1e-4 rad
}

export interface PhysicsBudget {
  readonly maxRigidBodies: number;
  readonly maxColliders: number;
  readonly maxJoints: number;
  readonly maxReplayBytes: number;
  readonly maxScoreEvents: number;
}

export type AttemptShape =
  | { readonly kind: 'single' }
  | { readonly kind: 'best-of'; readonly count: number };

export interface GameManifest {
  readonly id: string;                    // 'test-chamber'
  readonly registryId: number;            // uint16, never reused
  readonly gameVersion: string;           // semver
  readonly simulationVersion: number;
  readonly scoringVersion: number;
  readonly rankedFormat: RankedFormat;
  readonly attemptShape: AttemptShape;
  readonly maxRunTicks: number;
  readonly tickRate: 60;
  readonly actions: readonly ActionDescriptor[];
  readonly budget: PhysicsBudget;
}

export interface ScoreEvent {
  readonly tick: number;
  readonly type: string;
  readonly points: number;                // integer
  readonly multiplier: number;            // integer, scaled by 100 — never a float
}

export interface Simulation {
  readonly tick: number;
  readonly finished: boolean;
  applyInput(actionId: number, value: number): void;
  step(): void;
  score(): number;                        // integer, pure aggregation of scoreEvents()
  scoreEvents(): readonly ScoreEvent[];
  stateHash(): bigint;
  renderState(): unknown;                 // PRESENTATION ONLY, never authoritative
  dispose(): void;
}

export interface SimulationContext {
  readonly seed: Seed128;
  readonly rapier: RapierModule;
  readonly prng: Prng;
}

export interface StickworldGame {
  readonly manifest: GameManifest;
  createSimulation(context: SimulationContext): Simulation;
}
```

### 9.1 The per-tick contract

Fixed, and part of the versioned contract because changing it changes outcomes:

```
1. apply all inputs scheduled for this tick, ascending action id
2. game pre-step   (forces, impulses, motor targets, spawns)
3. rapier world.step()
4. game post-step  (read contacts, emit score events, evaluate finish)
5. tick++
```

Note `multiplier` is an integer scaled by 100. Float multipliers accumulate differently
depending on order and are a silent determinism leak in every scoring system that uses them.

---

## 10. Conformance harness

### 10.1 Fixture (R6.1)

`stress-01` builds one world containing all six primitive families the roster needs — jointed
ragdoll, rope/distance constraint, settling stack, fast CCD projectile, kinematic moving
platform, breakable joint — and runs 10,000 ticks, recording the state hash at ticks
1, 10, 100, 1,000, and 10,000.

Checkpoints rather than only a final hash, because *when* divergence starts tells you *what*
diverged. A tick-1 divergence points at construction or the WASM build; a tick-1,000 divergence
points at accumulated drift in a specific solver path.

### 10.2 Runners

- **Node:** `packages/sim-core/conformance/runner-node.ts`, invoked by `pnpm determinism:node`.
- **Browser:** a plain static page imports the built ESM bundle, runs the same fixture, and
  returns the hash series. Playwright drives Chromium, Firefox, WebKit, plus mobile Chromium and
  mobile WebKit viewports. Deliberately no bundler-specific machinery, so the harness tests
  `sim-core` rather than a build pipeline.

### 10.3 Output — the divergence matrix

```
Stickworld determinism conformance — fixture stress-01
Rapier @dimforge/rapier2d-compat 0.20.0  sha256:3f9a…c210

runtime            t=1      t=10     t=100    t=1000   t=10000
node 26.4.0        a1b2…    c3d4…    e5f6…    0718…    293a…
chromium 1xx       a1b2…    c3d4…    e5f6…    0718…    293a…
firefox 1xx        a1b2…    c3d4…    e5f6…    0718…    293a…
webkit 1xx         a1b2…    c3d4…    e5f6…    0718…    293a…

AGREEMENT: all 4 runtimes identical at all checkpoints
VERDICT:   PASS → Branch A
```

And on failure, the shape that actually drives the decision:

```
AGREEMENT: {chromium, firefox, webkit} agree; node diverges from t=100
VERDICT:   FAIL → Branch B1 (validator should run headless Chromium, not Node)
           see docs/adr/0001-determinism-fork.md
```

### 10.4 Negative control (R6.6)

A variant fixture compiled with `Math.sin` substituted for `detmath.sin` must be reported as
divergent. Without this, a harness that silently always passes proves nothing. It runs in CI
as an expected-fail.

---

## 11. CI

```yaml
jobs:
  verify:        # lint (incl. determinism ban), typecheck, unit tests, credential-leak test
  determinism:   # needs: verify
                 # runs Node + Playwright(chromium, firefox, webkit, mobile) harness,
                 # asserts against conformance/golden/, uploads the matrix as an artefact
  negative:      # asserts the injected-Math.sin fixture DOES diverge
```

The `determinism` job is a required check. A red matrix blocks merge, because a silent
determinism regression is the most expensive class of bug this project can ship — it surfaces
months later as an unreproducible record with no way to adjudicate it.

---

## 12. Risks in this spec

| Risk | Handling |
|---|---|
| Rapier `-compat` turns out to load different bytes in Node vs browser | The build-hash assertion (R1.4/R1.5) catches it on the first run, before any conclusion is drawn |
| `detmath` accuracy is adequate but *slow*, hurting frame budget | Measure in Task 2; polynomial `sin`/`cos` are typically comparable to native. If a hot path is genuinely too slow, cache per-tick values rather than weaken determinism |
| f32 vs f64 boundary confusion — Rapier is f32 internally, JS numbers are f64 | The hasher reads f32 explicitly; scoring is integer-only; documented in the competitive spec |
| Golden hashes get regenerated casually to "fix" a red build | Golden files require an ADR to change. Make this a review rule, not just a convention |
| The negative control rots into an always-skip | It is an expected-fail assertion in CI, so a skip is itself a failure |
| Team treats Test Chamber as scratch code and deletes it | R10.2 makes it permanent infrastructure; it is the contract test every real game reuses |

---

## 13. What Spec 2 inherits

Contracts that Spec 2's API and schema must match, so they are fixed here rather than negotiated
later:

- `Seed128` is four `uint32`, server-issued.
- Replay is a gzipped binary blob → Postgres `bytea`. Header carries every version field needed
  to re-simulate.
- `ranked_score` is an integer; `int64` on the wire, and the column type must match.
- The rejection reason taxonomy (§8.5) becomes the `verification_status` reason enum.
- Verification = decode → re-simulate → compare score and final state hash. Spec 2 wraps this in
  a worker and a queue; it does not reimplement it.
- **If the fork lands on Branch B1, Spec 2's worker runs headless Chromium instead of Node.**
  This is the one place a fork outcome changes Spec 2's shape, which is precisely why Spec 2 is
  written at scope depth and revised after Task 2.
