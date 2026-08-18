# Spec 1 — Deterministic Simulation and Replay Core

**Status:** Task 1 complete; executing Tasks 2–4
**Depth:** full (implementable directly)
**Covers:** Plan tasks 1–4
**Blocks:** Specs 2, 3, 4, 5

---

## 1. Introduction

This spec builds the foundation on which every trust claim in Stickworld Tournament rests: a
simulation package that produces **bit-identical results in a player's browser and on the
server**, plus a replay format compact enough to store in Postgres and precise enough to
recompute a score from.

Nothing else in the project is worth building until this works, because the entire competitive
model — per-game leaderboards, championship points, records — depends on the server being able
to independently recompute a score from recorded inputs. A client-reported score is worthless;
the browser belongs to the player.

### 1.1 Why this spec exists before the others

The research documents in the workspace root assert that Rapier "guarantees cross-platform
determinism out of the box." Rapier's own documentation contradicts this:

> By default, Rapier is locally deterministic, meaning that running the exact same simulation
> twice **with the same machine**, using the same version of Rapier [...] will result in the
> exact same simulation results. However, doing this on two different computers may result in
> completely different results.

Cross-platform determinism is **conditional, not default**. The reasoning that still favours
Rapier is that the same `.wasm` binary bundles its own math routines and therefore *should*
behave identically in every runtime — but "should" is load-bearing and unproven.

This spec proves or disproves it empirically, early, cheaply. See §5, *The determinism fork*.

### 1.2 Correction carried from the plan

The research's stated reason for rejecting JavaScript physics is wrong, and getting this right
changes what we actually have to defend against. JavaScript `+ - * /` on doubles are IEEE-754
exact and fully deterministic across engines. `Math.sqrt` is likewise correctly rounded. The
**real** non-determinism sources, and therefore the real targets of this spec, are:

| Threat | Mitigation in this spec |
|---|---|
| `Math.sin/cos/tan/pow/exp/log/atan2/hypot/cbrt` — implementation-defined per ECMAScript, genuinely divergent across V8, JSC, SpiderMonkey | `detmath` module + lint ban (R4) |
| `**` operator (identical semantics to `Math.pow`) | lint ban on the syntax node (R4) |
| `Math.random` | seeded PRNG only (R3) |
| Wall-clock reads (`Date.now`, `performance.now`) inside simulation | lint ban (R4) |
| Variable / frame-rate-coupled timestep | fixed 60 Hz accumulator (R2) |
| Unstable body iteration order | sorted stable handle registry (R5) |
| SIMD vs non-SIMD WASM build variance | single pinned non-SIMD build, hash-asserted (R1) |
| Rapier version drift | exact pin, hash-asserted, treated as competition-affecting (R1) |
| `-0` vs `+0`, NaN bit patterns in the state hash | normalised and asserted absent (R5) |
| Pixels used as physics units (Rapier docs: makes gravity look like slow motion) | SI units + explicit render scale constant (R2) |

---

## 2. Glossary

| Term | Meaning |
|---|---|
| **tick** | One fixed simulation step. Exactly 1/60 s of simulated time. The only unit of time the simulation knows. |
| **frame** | One rendered image. Decoupled from ticks. Frames never affect outcomes. |
| **attempt** | A server-authorised opportunity to produce a ranked run. May be abandoned. |
| **run** | A completed attempt. Has inputs, a duration in ticks, and a claimed score. |
| **verified run** | A run whose score the server recomputed and agreed with. Only these can become personal bests. |
| **replay** | The binary encoding of a run's seed, versions, and input event stream. Inputs only — never positions. |
| **state hash** | A 64-bit fingerprint of the full dynamic simulation state at a given tick. The determinism contract. |
| **golden hash** | A committed state hash that CI asserts against. Changing one is a competition-affecting change. |
| **detmath** | The only maths surface simulation code may import. Deterministic by construction. |
| **conformance fixture** | A committed seed + input stream + expected score + expected hash, used to prove reproducibility. |
| **runtime** | A JS execution environment under test: Node, Chromium, Firefox, or WebKit. |
| **divergence matrix** | Which runtimes agree with which. Richer than pass/fail and drives the fork decision (§5). |

---

## 3. Requirements

### R1 — Pinned, verifiable physics build

**User story:** As the platform operator, I need certainty that the physics engine running in a
player's browser is byte-identical to the one in the validator, so that a verified score means
something.

**Acceptance criteria:**

1. The project SHALL depend on `@dimforge/rapier2d-compat` at an exact version (`0.20.0`), with
   no caret or tilde range, in every package that touches simulation.
2. The `-compat` build SHALL be used rather than `@dimforge/rapier2d`, because it inlines the
   WASM as base64 in a single JS file. This removes the possibility of a bundler substituting a
   different `.wasm` and guarantees browser and Node load the same bytes.
3. Any `-simd` package variant SHALL NOT be introduced. A lint or dependency check SHALL fail
   the build if one appears.
4. On initialisation, `sim-core` SHALL compute the SHA-256 of the decoded WASM bytes and expose
   it as `rapierBuildHash`.
5. A test SHALL assert `rapierBuildHash` equals a committed constant. WHEN the hash differs,
   THEN the test SHALL fail with a message stating that a Rapier change invalidates historical
   replays and is a competition-affecting change requiring a version bump and new leaderboards.
6. The pinned version SHALL NOT be upgraded as routine maintenance. Renovate/Dependabot, if
   configured, SHALL be told to ignore it.

### R2 — Fixed timestep, SI units, decoupled rendering

**User story:** As a player, I need my score to depend on my skill, not on whether I own a 144 Hz
monitor or a slow phone.

**Acceptance criteria:**

1. The simulation SHALL advance in fixed steps of exactly `1/60` seconds. The Rapier world
   timestep SHALL be set to this value and never varied.
2. The simulation SHALL expose an integer `tick` counter as the sole measure of elapsed time.
   Simulation code SHALL NOT read any wall clock.
3. Rendering SHALL use an accumulator: real elapsed time accumulates, whole ticks are consumed,
   and the fractional remainder is used **only** to interpolate presentation.
4. WHEN the render loop stalls (background tab, slow device), THEN the number of ticks consumed
   SHALL be capped per frame to prevent a stall from producing a spiral, AND the simulation
   SHALL remain the authority on elapsed simulated time.
5. Physics SHALL use SI units — metres, kilograms, seconds — with gravity near `-9.81`. A single
   exported constant `PIXELS_PER_METRE` SHALL define the render scale. Simulation code SHALL NOT
   contain pixel values.
6. A test SHALL run the same fixture with three different simulated frame pacings (uniform 60 Hz,
   jittery 30–144 Hz, and one long stall) and assert an identical final state hash and score.

### R3 — Seeded pseudo-randomness

**User story:** As a competitor, I need the course I play to be exactly the course my rival
played, and I need my own replay to reproduce.

**Acceptance criteria:**

1. `sim-core` SHALL provide a seeded PRNG whose entire state is four `uint32` lanes (128 bits).
2. The implementation SHALL be the 32-bit member of the xorshift128 family, using only
   `^`, `<<`, `>>>`, and `Math.imul`, with explicit `>>> 0` normalisation after every operation.
   *Deviation from the handoff plan, which named xorshift128+: the `+` scrambler requires 64-bit
   addition, which in JavaScript means BigInt — slower with no determinism benefit here, since
   the 32-bit variant is already exactly reproducible. Recorded as ADR-0003.*
3. The PRNG SHALL be created from the run's 128-bit seed and SHALL be the only source of
   randomness available to simulation code.
4. A test SHALL assert a known seed produces a known first 1,000 outputs, byte-for-byte, in
   every runtime under test.
5. `Math.random` SHALL be unavailable to simulation code (see R4).

### R4 — Deterministic maths surface with an enforced ban

**User story:** As a developer on this codebase, I need the compiler and linter to stop me from
accidentally destroying determinism, because the failure is silent and appears months later as
an unreproducible world record.

**Acceptance criteria:**

1. `sim-core` SHALL export a `detmath` module which is the only maths surface simulation code
   imports.
2. `detmath` SHALL provide `sin`, `cos`, `tan`, `atan2`, `sqrt`, `pow`, `hypot`, and any other
   function games need, implemented using only IEEE-754-exact primitives (`+ - * /`,
   `Math.sqrt`, comparisons) — typically minimax polynomial approximations with range reduction.
3. Functions that ARE exactly specified by ECMAScript SHALL be allowed to delegate:
   `Math.sqrt`, `abs`, `min`, `max`, `floor`, `ceil`, `round`, `trunc`, `sign`, `fround`.
   They SHALL still be re-exported through `detmath` so simulation code has exactly one import
   surface and one place to change if a delegation is ever found unsafe.
4. An ESLint rule SHALL fail the build when any file under `packages/sim-core/src` or any game's
   `simulation/` directory references:
   `Math.sin|cos|tan|asin|acos|atan|atan2|pow|exp|log|log2|log10|log1p|expm1|sinh|cosh|tanh|asinh|acosh|atanh|hypot|cbrt|random`,
   the `**` operator, `Date.now`, `Date.prototype.getTime`, `performance.now`, `crypto.getRandomValues`,
   or `new Date`.
5. Each `detmath` function SHALL have an accuracy test against a high-precision reference
   asserting error within a documented bound, AND a determinism test asserting identical output
   bits across all runtimes.
6. WHEN a `detmath` implementation changes numerically, THEN it SHALL be treated as a
   simulation-version bump, because it changes historical replay outcomes.

### R5 — State hashing

**User story:** As the operator, I need a single cheap value that proves two simulations are in
the same state, so that determinism is testable rather than assumed.

**Acceptance criteria:**

1. `sim-core` SHALL expose `stateHash(): bigint` returning a 64-bit fingerprint of all dynamic
   state: for every rigid body, its translation, rotation, linear velocity, and angular velocity.
2. Bodies SHALL be visited in ascending order of a **stable creation index** that `sim-core`
   maintains itself. Rapier handles SHALL NOT be relied upon for ordering, and no `Map`, `Set`,
   or object-key iteration SHALL determine hash order.
3. Before hashing, `-0` SHALL be normalised to `+0`.
4. WHEN any value being hashed is `NaN` or non-finite, THEN `stateHash` SHALL throw with the
   offending body's creation index and field name. Silent corruption is not acceptable.
5. The hash SHALL be computed over the raw little-endian bytes of the float values, using an
   algorithm implemented with `Math.imul`/`BigInt` only — no platform hashing.
6. `stateHash` SHALL be callable at any tick and SHALL NOT mutate simulation state. A test SHALL
   assert that calling it 100 times mid-run does not change the final hash.

### R6 — The conformance harness and divergence matrix

**User story:** As the decision maker, I need to know not just *whether* determinism holds but
*where it breaks*, because that determines which fallback we take.

**Acceptance criteria:**

1. A stress fixture SHALL exercise every physics primitive the ten-game roster needs:
   a jointed ragdoll (revolute joints with limits), a rope/distance constraint, a settling stack
   of bodies, a fast projectile with continuous collision detection enabled, a kinematic moving
   platform, and a breakable joint.
2. The fixture SHALL run at least 10,000 ticks and SHALL record the state hash at tick
   1, 10, 100, 1,000, and 10,000 — not only the final tick — so divergence can be located in
   time rather than merely detected.
3. The harness SHALL execute in Node, Chromium, Firefox, and WebKit, plus mobile Chromium and
   mobile WebKit viewports, and SHALL collect every runtime's hash series.
4. The harness SHALL emit a **divergence matrix** reporting which runtimes agree with which at
   each checkpoint, and SHALL name the earliest tick at which any pair diverges.
5. WHEN all runtimes agree at every checkpoint, THEN the harness SHALL write the hash series to
   `conformance/golden/` and subsequent CI runs SHALL assert against it.
6. A deliberate negative test SHALL substitute `Math.sin` for `detmath.sin` and SHALL assert the
   harness reports divergence. A harness that cannot fail proves nothing.
7. The harness SHALL be runnable locally as a single command and SHALL print a human-readable
   verdict, not only a machine assertion.

### R7 — Replay format

**User story:** As the operator, I need runs stored cheaply in Postgres and decodable years
later by a validator that must reject anything malformed rather than crash on it.

**Acceptance criteria:**

1. The replay SHALL encode: format magic and version, game registry id, game version,
   simulation version, scoring version, Rapier build hash prefix, the 128-bit seed, the attempt
   id, tick rate, total ticks, claimed score, and the input event stream.
2. The replay SHALL contain **inputs only**. Positions, velocities, and any client-computed
   authoritative value SHALL NOT be encoded, because a modified client can fabricate them.
3. Input events SHALL be delta-encoded on tick (LEB128 varint) with quantised integer values
   (zigzag varint). Analog inputs such as aim angle and draw strength SHALL be quantised to
   integers at capture time, per the game's declared action table, because a raw float from a
   pointer device is not reproducible.
4. Each game SHALL declare its action table in its manifest, with stable numeric action ids that
   are never reused or renumbered.
5. The encoded form SHALL carry a CRC-32 over header and body, and the final state hash, so
   decode corruption and simulation divergence produce distinct, distinguishable failures.
6. The wire form SHALL be gzip-compressed for storage and transport.
7. A 90-second single-action run SHALL encode to under 5 KB compressed. A test SHALL assert this.
8. WHEN a replay is malformed, truncated, oversized, carries an unknown format version, or fails
   CRC, THEN the decoder SHALL return a typed, specific error and SHALL NOT throw an unhandled
   exception, allocate unboundedly, or enter an unbounded loop.
9. A property-based test SHALL assert that for randomly generated valid input streams:
   record → encode → decode → replay yields an identical state hash and identical score.

### R8 — Score events and explainable rejection

**User story:** As a player whose run was rejected, I deserve to know why. As an operator
investigating a suspicious score, I need to see where client and server disagreed.

**Acceptance criteria:**

1. The simulation SHALL emit a stream of score events `{tick, type, points, multiplier}` rather
   than only a final number.
2. `score()` SHALL be a pure integer aggregation of the score event stream. It SHALL NOT use
   floating-point accumulation, because float addition order affects results.
3. The canonical `ranked_score` SHALL be an integer and higher SHALL always be better. Where
   time matters, it SHALL be converted into bonus points, never used as a raw ranking key.
4. A client MAY submit its score event stream alongside its inputs. The server's recomputed
   stream SHALL be authoritative, and the two SHALL be diffable to produce a rejection reason
   naming the first divergent tick and event.
5. A test SHALL assert that a tampered score event stream is detected with a precise first-
   divergence location rather than a generic mismatch.

### R9 — The game SDK contract

**User story:** As a developer adding game seven, I need one interface to implement and no
opportunity to accidentally reach into platform internals.

**Acceptance criteria:**

1. `sim-core` SHALL export a `StickworldGame` interface with a static `manifest` and a
   `createSimulation(context)` factory.
2. The manifest SHALL declare: stable slug id, numeric registry id, game version, simulation
   version, scoring version, ranked format, attempt shape (single or best-of-N), maximum run
   ticks, tick rate, the action table, and a physics budget.
3. The physics budget SHALL declare maximum rigid bodies, colliders, joints, replay bytes, and
   score events.
4. The per-tick order of operations SHALL be specified and enforced: apply inputs for this tick
   in ascending action id order → game pre-step → `world.step()` → game post-step and scoring →
   increment tick. This ordering is part of the contract because changing it changes outcomes.
5. WHEN a simulation exceeds any declared budget at runtime, THEN it SHALL fail loudly in
   development and test builds.
6. The simulation SHALL separate authoritative state from presentation. A render snapshot method
   MAY exist, but nothing it returns SHALL influence simulation or scoring.

### R10 — The conformance game ("Test Chamber")

**User story:** As a developer, I need a known-good minimal game that proves the SDK contract
end to end, and stays in CI forever as the thing every real game is checked against.

**Acceptance criteria:**

1. A minimal game implementing `StickworldGame` SHALL be built. It is deliberately not a
   shipping title.
2. It SHALL be permanent CI infrastructure, not scaffolding to delete. Every one of the ten real
   games' integrations SHALL be validated against the same contract tests this game validates.
3. It SHALL produce an identical integer score for the same seed and input stream when run in a
   browser and when run headless in Node.
4. It SHALL include a contract test proving a budget-exceeding simulation is caught.

### R11 — Repository foundation and secrets hygiene

**User story:** As the owner, I need the project to build from a clean clone and I need certainty
that my credentials never reach a repository.

**Acceptance criteria:**

1. `.gitignore` covering `Credentials/`, `*.env`, `.env*`, and service-account JSON patterns
   SHALL exist before `git init` and before any commit. *(Already done — see repo root.)*
2. A test SHALL assert that no file matching credential patterns is tracked by git.
3. Credential file contents SHALL NOT be read, echoed, or logged by any tooling in this repo.
4. A GitHub remote SHALL NOT be created and nothing SHALL be pushed without explicit user
   confirmation. Local `git init` is permitted.
5. The monorepo SHALL use pnpm workspaces and Turborepo with TypeScript strict mode, ESLint,
   Prettier, and Vitest, and CI SHALL run lint, typecheck, and tests on every pull request.
6. A fresh clone followed by `pnpm install && pnpm build && pnpm test` SHALL succeed.

### R12 — The written competitive specification

**User story:** As the operator, I need the competition rules fixed in writing before ten games
start making incompatible assumptions about them.

**Acceptance criteria:**

1. A document `docs/competitive-spec.md` SHALL be authored **before** simulation code depends on
   its contents, defining: tick rate, score datatype, replay format version, seed format,
   attempt lifecycle, pause and focus policy, personal-best rules, tie rules, the championship
   point formula, and the version-pinning policy.
2. It SHALL state the seven conditions every ranked game must satisfy: accepts an explicit seed;
   uses fixed simulation ticks; produces an integer score; reproduces that score from replay
   inputs; serialises all player inputs; produces deterministic checkpoints; supports version
   pinning.
3. It SHALL be short enough to be read in full by anyone joining the project.

---

## 4. Out of scope for Spec 1

Explicitly deferred so this spec stays small enough to finish in about a week:

- Any database, schema, or migration (Spec 2)
- Authentication, accounts, handles (Spec 2)
- HTTP API, attempt issuance, submission endpoints (Spec 2)
- Leaderboards and championship ranking (Spec 2)
- Phaser rendering, art, audio, touch controls (Spec 3)
- Any of the ten shipping games (Specs 3 and 4)
- Deployment to Railway or Neon (Spec 5)
- Gemini, Deepgram, or OpenRouter integration (Spec 5)

The validator **worker** is Spec 2. The validator **capability** — headless re-simulation
producing an authoritative score — is proven here in Node, because that is what the fork
depends on.

---

## 5. The determinism fork

This is the reason Spec 1 exists standalone. Requirement R6 produces a divergence matrix; that
matrix selects a branch. **No downstream spec is executed until a branch is chosen and recorded
as an ADR.**

### Branch A — all runtimes agree

Proceed exactly as planned. Client and server both simulate; the server's recomputation is
authoritative; every ranked run is verified by re-simulation. Specs 2–5 need no revision on
this axis.

### Branch B — divergence found

The matrix determines which sub-branch applies. This is why R6.4 requires a matrix rather than
a boolean.

**B1 — Node diverges, browsers agree with each other.**
Most likely and cheapest to fix. Run the validator as headless Chromium under Playwright
instead of Node. Cost: heavier workers, slower verification, a browser in the server image.
Architecture otherwise unchanged. *This possibility alone justifies collecting the matrix.*

**B2 — browsers diverge from each other.**
More serious. Options, in preference order:
- Identify the specific diverging primitive and avoid it platform-wide, then re-test.
- Restrict the ranked roster to primitives that empirically agree, and design games within
  that subset.
- Move to server-authoritative-only scoring, where the client simulation is explicitly a
  *preview* and the server verdict is final. **Caveat that must be stated plainly:** this is
  only viable where divergence stays bounded. In a chaotic physics simulation over thousands of
  ticks, small drift compounds — a grapple release that succeeded locally may miss on the
  server. That is not a display discrepancy, it is an unfair outcome. Viable for short,
  low-body-count games (Launch Lab, Archery); not viable for Demolition Dive.

**B3 — divergence only under specific conditions** (high body count, CCD, a particular joint
type). Constrain those conditions in the physics budget and re-test. May cap Demolition Dive's
design or move it out of the launch roster.

**B4 — irreducible divergence.**
Fixed-point integer simulation: write the 2D physics we actually need on `int32`/`int64`
fixed-point arithmetic, which is exactly reproducible by construction. Full control, and a
realistic multi-week cost for the primitive set the roster needs. Chosen only if B1–B3 all fail.

### Decision procedure

1. Run the harness. Capture the full matrix, not a verdict.
2. Record results in `docs/adr/0001-determinism-fork.md`: the matrix, the earliest divergent
   tick per pair, the chosen branch, and the reasoning.
3. **Report the result to the user prominently before proceeding.**
4. Revise Specs 2–5 for the chosen branch, get approval, then execute.

---

## 6. Definition of done

Spec 1 is complete when all of the following are demonstrated with evidence, not asserted:

- [ ] A fresh clone builds and tests green; credential exclusion proven by an automated test
- [ ] `docs/competitive-spec.md` written and reviewed
- [ ] The divergence matrix has been produced and the fork branch chosen and recorded as an ADR
- [ ] The negative test confirms the harness detects injected non-determinism
- [ ] A replay round-trips to an identical hash and score, with a 90-second run under 5 KB
- [ ] Malformed, truncated, and oversized replays produce typed errors rather than crashes
- [ ] Test Chamber produces the same integer score in a browser and in headless Node from the
      same seed and inputs
- [ ] The `detmath` lint ban is active and demonstrably fails a build when violated

**Verification standard:** every item above is proven by executed commands with captured output.
Code inspection does not count. An unexecuted check is never reported as passing.
