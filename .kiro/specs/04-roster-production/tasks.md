# Spec 4 — Tasks (scope depth)

**Do not execute yet.** Deepened after Spec 3 lands.

Every game in every wave repeats the Spec 3 template and must clear the integration checklist as
a merge gate. The per-game work is not re-specified here — that is the point of having a template.

---

## Task 1 — Wave A: projectile games

**Games:** Launch Lab, Ragdoll Archery Rush, Hammer Throw Havoc.

**New capability:** projectile and angular-launch primitives, plus multi-attempt score
aggregation.

**Acceptance gate:** each game passes the full per-game suite. Multi-attempt aggregation has its
own unit tests. All three attempts of Launch Lab and Hammer Throw ride in one replay and one
submission. Replay size assertions confirm these remain the smallest payloads on the platform.
Analog aim and draw inputs are quantised at capture.

**Demo:** five games live, five leaderboards, championship table with five populated columns.

---

## Task 2 — Wave B: Pogo Tower

**New capability:** deterministic seeded level generation — the first generated content on the
platform.

**Acceptance gate:** same seed produces identical geometry and an identical state hash in all four
runtimes, proven by a fixture separate from the gameplay fixture so a generator bug and a solver
divergence remain distinguishable. Weekly rotation works. The generator is versioned under
`simulation_version`.

**Demo:** six games live. Two players given the same seed see identical towers.

---

## Task 3 — Wave C: continuous movement and vehicles

**Games:** Rooftop Relay, Balance Bike Blitz, Cargo Chaos.

**New capabilities:** kinematic character controller, wheel assembly with suspension, jointed
cargo with a condition metric.

**Acceptance gate:** each game passes the full suite. Replay size budgets validated **early in
the wave**, not at the end. Frame-time budgets verified on a real mid-range Android device during
this wave rather than deferred to Spec 5. Rooftop Relay uses a kinematic controller, not a dynamic
body.

**Demo:** nine games live, with load-time and frame-time budgets still met on real mid-range
hardware.

---

## Task 4 — Wave D: Demolition Dive

**New capability:** destructible structures with chain reactions and deterministic despawn.

**Pre-flight check:** if Spec 1's fork landed on Branch B2 or B3, re-assess viability before
building. Chaotic high-body-count simulation is exactly where bounded divergence stops being
bounded. Cutting this game is an acceptable outcome and preferable to an unverifiable leaderboard.

**Acceptance gate:** hard caps on active bodies, destructible objects, and chain-reaction depth
declared and enforced at runtime. Debris despawn is deterministic and part of the simulation.
Determinism fixture passes at **maximum** body count across all four runtimes. Mobile frame-time
budget met at worst case.

**Demo:** all ten games live, each with a leaderboard, and a fully populated ten-column
championship table.

---

## Exit criteria

See `requirements.md` § Definition of done.
