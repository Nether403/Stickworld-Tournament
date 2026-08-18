# Spec 1 — Tasks

**Complete.** Merged to `main` via PR #1 (2026-08-18). Branch A. Do not reopen
except for competition-affecting ADRs.

Legend: `[ ]` not started · `[~]` in progress · `[x]` done
Requirement references point at `requirements.md`.

---

## Task 1 — Competitive specification, repository foundation, secrets hygiene

**Objective:** a repo that builds clean from a fresh clone, with the competition rules written
down before any code depends on them.

- [x] 1.0 Create `.gitignore` covering `Credentials/`, `*.env`, `.env*`, and service-account
      JSON patterns, **before** `git init`. Verify with `git ls-files --others --exclude-standard`.
      _(Done ahead of spec authoring — R11.1)_
- [x] 1.1 Write `docs/competitive-spec.md` **first**, before any simulation code. Define tick
      rate, score datatype, replay format version, seed format, attempt lifecycle, pause/focus
      policy, personal-best rules, tie rules, championship point formula, version-pinning policy.
      Include the seven conditions every ranked game must satisfy. Keep it short enough to read
      in one sitting. _(R12)_
- [x] 1.2 Scaffold the pnpm workspace: root `package.json`, `pnpm-workspace.yaml`, `turbo.json`,
      `tsconfig.base.json`, `vitest.workspace.ts`. TypeScript strict, `noUncheckedIndexedAccess`,
      `exactOptionalPropertyTypes`. _(R11.5)_
- [x] 1.3 Create `packages/config-ts` and `packages/config-eslint` as shared config packages.
- [x] 1.4 Write the determinism ESLint rule in `config-eslint`: ban the forbidden `Math` members,
      the `**` operator, `Date.now`, `new Date`, `performance.now`, and `crypto.getRandomValues`
      within `sim-core/src` and any `**/simulation/**` path. Also ban imports of Phaser, React,
      Next, `node:*`, and DOM globals from those paths (design §1). _(R4.4)_
- [x] 1.5 Write the credential-leak test: assert `git ls-files` contains nothing matching
      credential patterns. Must fail if someone force-adds a secret. _(R11.2)_
- [x] 1.6 Add a dependency guard test asserting no `-simd` Rapier variant is present and that the
      Rapier dependency is an exact pin with no range prefix. _(R1.1, R1.3)_
- [x] 1.7 CI workflow `verify` job: install, lint, typecheck, unit tests, credential-leak test.
      Runs on every PR. _(R11.5)_
- [x] 1.8 Write ADR-0002 (`-compat` build choice) and ADR-0003 (PRNG choice). Short, one page each.

**Tests:** lint/typecheck/unit all green in CI. Credential-leak test passes and demonstrably
fails when a secret is force-added. Determinism lint rule demonstrably fails on a file using
`Math.sin`.

**Demo:** fresh clone → `pnpm install && pnpm build && pnpm test` green.
`git check-ignore -v Credentials/.env` confirms exclusion. `docs/competitive-spec.md` reviewed.

---

## Task 2 — Determinism conformance harness (THE GO/NO-GO GATE)

**Objective:** prove or disprove that one pinned Rapier WASM build produces bit-identical state
in Node, Chromium, Firefox, and WebKit. Nothing downstream is built until a branch is chosen.

> Produce a **divergence matrix**, not a pass/fail. Which runtimes agree with which, and the
> earliest divergent tick, determines which fallback applies. A boolean would throw away the
> information the decision needs.

- [x] 2.1 Create `packages/sim-core` with `@dimforge/rapier2d-compat` pinned to exactly `0.20.0`.
      _(R1.1, R1.2)_
- [x] 2.2 `rapier.ts`: async init, decode the inlined WASM, compute SHA-256, expose
      `rapierBuildHash`. Print it on first run so it can be committed to
      `RAPIER_BUILD_SHA256`. Assert against the constant thereafter, with a failure message
      naming historical-replay invalidation. _(R1.4, R1.5)_
- [x] 2.3 `units.ts`: `PIXELS_PER_METRE`, gravity constant, SI-unit helpers. No pixel values
      anywhere in simulation code. _(R2.5)_
- [x] 2.4 `prng.ts`: xorshift128 over 4 × uint32. Reject all-zero state. `nextInt` via rejection
      sampling, never modulo. Test a known seed's first 1,000 outputs. _(R3)_
- [x] 2.5 `detmath.ts` + `detmath.internal.ts`: implement `sin`, `cos`, `tan`, `atan2`,
      integer-exponent `pow`, `hypot`. Re-export the exactly-specified functions. Accuracy tests
      against a high-precision reference (≤ 2 ULP target) **and** cross-runtime bit-identity
      tests. _(R4.1, R4.2, R4.3, R4.5)_
- [x] 2.6 `bodies.ts`: stable creation-index registry. All body creation routes through it.
      `ordered()` returns ascending creation index. _(R5.2)_
- [x] 2.7 `hash.ts`: 64-bit FNV-1a over the f32 bytes of translation, rotation, linvel, angvel
      for every registered body in creation order. Normalise `-0`. Throw
      `NonFiniteStateError` naming body index and field on NaN/Infinity. Prove purity: 100
      mid-run calls do not alter the final hash. _(R5)_
- [x] 2.8 `stepper.ts`: fixed-timestep accumulator with `MAX_FRAME_DELTA` 0.25 s and
      `MAX_TICKS_PER_FRAME` 15. Expose `interpolationAlpha` for presentation only. _(R2.1–R2.4)_
- [x] 2.9 Frame-pacing invariance test: the same fixture under uniform 60 Hz, jittery 30–144 Hz,
      and one long stall must yield an identical final hash and score. _(R2.6)_
- [x] 2.10 Build fixture `stress-01` covering all six primitive families — jointed ragdoll with
      revolute limits, rope/distance constraint, settling stack, fast CCD projectile, kinematic
      moving platform, breakable joint. 10,000 ticks. Hash at ticks 1, 10, 100, 1,000, 10,000.
      _(R6.1, R6.2)_
- [x] 2.11 `runner-node.ts` + `pnpm determinism:node`.
- [x] 2.12 `runner-browser.ts` + a plain static page, driven by Playwright across Chromium,
      Firefox, WebKit, mobile Chromium, mobile WebKit. No bundler machinery — test `sim-core`,
      not a build pipeline. _(R6.3)_
- [x] 2.13 Divergence matrix reporter: table of runtime × checkpoint, an agreement summary, the
      earliest divergent tick per disagreeing pair, and a human-readable verdict naming the
      indicated branch. _(R6.4, R6.7)_
- [x] 2.14 Negative control: a fixture variant using `Math.sin` instead of `detmath.sin`,
      asserted in CI to **diverge**. A harness that cannot fail proves nothing. _(R6.6)_
- [x] 2.15 On agreement, write the hash series to `conformance/golden/` and assert against it in
      CI thereafter. _(R6.5)_
- [x] 2.16 CI `determinism` and `negative` jobs, matrix uploaded as an artefact, `determinism`
      marked a required check.
- [x] 2.17 **Write `docs/adr/0001-determinism-fork.md`**: the full matrix, earliest divergent tick
      per pair, chosen branch (A / B1 / B2 / B3 / B4), and the reasoning.
- [x] 2.18 **Report the result to the user prominently and stop.** If any branch other than A is
      indicated, Specs 2–5 are revised before execution.

      Done: Branch A. Specs 2–5 do not need a determinism-axis fork revision.
      Tasks 3–4 proceed.

**Tests:** as itemised. The negative control is as important as the positive one.

**Demo:** the printed divergence matrix with four hash series and an explicit verdict. If they
disagree, the demo is instead the ADR with the matrix and the branch decision — which is a
successful outcome for this task, not a failure. Learning this in week one is the entire point.

**Measure while here:** `detmath` throughput and per-tick simulation cost at the fixture's body
count, so Spec 3's frame budget starts from data rather than a guess.

---

## Task 3 — Replay format, input recorder, score events

**Objective:** record a run compactly, replay it exactly, prove the round trip, and reject
hostile input safely.

- [x] 3.1 Create `packages/replay`. `format.ts` with the 88-byte header layout from design §8.1.
- [x] 3.2 `varint.ts`: LEB128 unsigned + zigzag signed, with round-trip property tests.
- [x] 3.3 `crc32.ts` with known-answer tests.
- [x] 3.4 `encode.ts`: header, delta-encoded tick + action id + zigzag value body, CRC footer,
      then gzip. _(R7.1, R7.3, R7.5, R7.6)_
- [x] 3.5 `decode.ts`: a parser for hostile input. Size caps checked **before** allocation.
      Every failure returns a typed error from the §8.5 taxonomy — never an unhandled throw,
      unbounded allocation, or unbounded loop. _(R7.8)_
- [x] 3.6 `recorder.ts`: capture-side. Quantises analog inputs to integers per the game's action
      table **at capture time**, so the recorded value is exactly the value simulated. Enforces
      ascending tick, then ascending action id. _(R7.3, R7.4)_
- [x] 3.7 `player.ts`: verification-side. Feeds a `Simulation` from a decoded replay, drives
      exactly `totalTicks`, and compares recomputed score and final state hash.
- [x] 3.8 `score.ts` in `sim-core`: score event stream, integer-only aggregation, `multiplier` as
      an integer scaled by 100. No float accumulation anywhere. _(R8.1, R8.2, R8.3)_
- [x] 3.9 Score-stream diff: given client and server streams, report the first divergent tick and
      event so rejections are explainable rather than a shrug. _(R8.4, R8.5)_
- [x] 3.10 `bin/replay-verify.ts` CLI printing score, tick count, and hash match.
- [x] 3.11 Property test: for randomly generated valid input streams,
      record → encode → decode → replay yields identical hash and identical score. _(R7.9)_
- [x] 3.12 Size budget test: a 90-second single-action run encodes under 5 KB compressed. _(R7.7)_
- [x] 3.13 Adversarial corpus: truncated, oversized, bad magic, bad CRC, unknown format version,
      unknown action id, out-of-range value, non-monotonic ticks, tick-count mismatch. Each must
      produce its specific typed error.

**Demo:** `pnpm replay:verify fixture.swr` prints score, tick count, hash match. A 90-second run
encodes under 5 KB. The adversarial corpus produces thirteen distinct typed errors and zero
crashes.

---

## Task 4 — Game SDK contract and the permanent conformance game

**Objective:** one interface every game implements, plus a minimal game proving the contract end
to end, which stays in CI forever.

- [x] 4.1 `contract.ts`: `GameManifest`, `ActionDescriptor`, `PhysicsBudget`, `AttemptShape`,
      `ScoreEvent`, `Simulation`, `SimulationContext`, `StickworldGame` exactly as design §9.
      _(R9.1, R9.2, R9.3)_
- [x] 4.2 Implement and document the per-tick order of operations as an enforced contract:
      inputs (ascending action id) → pre-step → `world.step()` → post-step/scoring → tick++.
      _(R9.4)_
- [x] 4.3 `budget.ts`: runtime budget enforcement, throwing `BudgetExceededError` in dev and test
      builds when a declared limit is exceeded. _(R9.5)_
- [x] 4.4 Enforce the presentation boundary: `renderState()` output must not be reachable from
      simulation or scoring. Add a test that mutating a render snapshot cannot affect the hash.
      _(R9.6)_
- [x] 4.5 Build `packages/game-test-chamber`: a minimal `StickworldGame` — score from gates
      passed plus survival ticks, exercising a rope constraint and a small ragdoll so the
      contract is tested against real physics rather than a stub. _(R10.1)_
- [x] 4.6 Cross-runtime score equality: the same module, seed, and input stream produces an
      identical integer score in a browser and in headless Node. _(R10.3)_
- [x] 4.7 Budget-violation contract test: a deliberately over-budget variant is caught. _(R10.4)_
- [x] 4.8 Extract the contract test suite into a reusable exported harness so each of the ten
      real games runs the identical checks. Test Chamber is permanent CI infrastructure, not
      scaffolding to delete. _(R10.2)_
- [x] 4.9 Wire Test Chamber's conformance run into CI alongside `stress-01`.

**Demo:** the same game module, driven by the same recorded replay, prints an identical score in
a browser console and from the Node CLI. The reusable contract harness is green.

---

## Exit criteria for Spec 1

All of `requirements.md` §6 demonstrated with executed-command evidence:

- [x] Fresh clone builds and tests green; credential exclusion proven by automated test
- [x] `docs/competitive-spec.md` written and reviewed
- [x] Divergence matrix produced; fork branch chosen and recorded in ADR-0001
- [x] Negative control confirms the harness detects injected non-determinism
- [x] Replay round-trips to identical hash and score; 90-second run under 5 KB
- [x] Adversarial replay corpus yields typed errors, zero crashes
- [x] Test Chamber scores identically in browser and headless Node
- [x] `detmath` lint ban active and demonstrably failing a build when violated

**Then stop.** Report the fork outcome, revise Spec 2 accordingly, get approval, and only then
continue.
