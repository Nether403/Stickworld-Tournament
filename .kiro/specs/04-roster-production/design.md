# Spec 4 — Design (scope and contract depth)

---

## 1. Why waves, and why this order

Games are grouped so each wave pays for one set of physics primitives once, and ordered so risk
rises only after the platform has absorbed the previous increment.

```
Spec 3    rope/joint            Hookline, Pickaxe        proves the kit
  ↓
Wave A    projectile            Launch, Archery, Hammer  smallest replays, multi-attempt scoring
  ↓
Wave B    seeded generation     Pogo Tower               first generated content
  ↓
Wave C    continuous + vehicle  Rooftop, Bike, Cargo     longest runs, largest replays
  ↓
Wave D    destruction           Demolition Dive          highest risk, last
```

Each wave adds exactly one new hard thing. Wave A adds multi-attempt aggregation. Wave B adds
deterministic procedural generation. Wave C adds vehicles and long replays. Wave D adds mass
destruction. Nothing in the sequence requires two new capabilities at once.

---

## 2. `physics-kit` growth by wave

Primitives are implemented when the first game that needs them arrives, never speculatively.

| Primitive | Introduced | Consumers |
|---|---|---|
| rope / distance joint | Spec 3 | Hookline, Pickaxe |
| checkpoint, impact sensor | Spec 3 | all |
| combo / streak | Spec 3 | Hookline, Rooftop, Pogo, Bike, Demolition, Archery |
| projectile | Wave A | Launch, Archery, Hammer, Demolition |
| angular launch / release | Wave A | Hammer, Launch |
| moving platform (kinematic) | Wave B | Pogo, Rooftop, Bike, Cargo, Pickaxe |
| seeded generator harness | Wave B | Pogo, and later daily-seed content |
| kinematic character controller | Wave C | Rooftop |
| wheel assembly + suspension | Wave C | Bike |
| jointed cargo + condition metric | Wave C | Cargo |
| breakable object / chain reaction | Wave D | Demolition |
| deterministic despawn | Wave D | Demolition |

Every addition carries the same obligation as the originals: fixed construction order,
`detmath` only, integer-scaled parameters, and a determinism fixture before any game depends on it.

---

## 3. Multi-attempt scoring contract (Wave A)

Launch Lab, Hammer Throw, and Demolition Dive use `attemptShape: { kind: 'best-of', count: 3 }`.

```
ONE server-issued attempt
  └─ ONE replay containing all three sub-attempts, delimited by a reset marker
      └─ ONE submission
          └─ server re-simulates all three and aggregates
```

Aggregation is part of `scoring_version`. Whether "best of three" means the highest single
sub-attempt or the sum of all three is a per-game decision recorded in the game's manifest and
its design doc — but it is decided **before** the leaderboard opens, never adjusted after.

Rationale for one replay rather than three submissions: three submissions would triple
verification load, let a player abandon bad sub-attempts, and make the attempt cap meaningless.

---

## 4. Deterministic generation contract (Wave B onward)

The generator is simulation code and is bound by every Spec 1 rule:

- Seeded exclusively from the server-issued 128-bit seed via the `sim-core` PRNG
- `detmath` only, no `Math` transcendentals
- No wall-clock reads, no `Math.random`
- Emits geometry in a **fixed, stable order** so body creation indices are reproducible
- Versioned under `simulation_version`; a generator change is competition-affecting

Test obligation: same seed → identical geometry → identical state hash, in all four runtimes.
This gets its own fixture separate from the gameplay fixture, because a generator bug and a
solver divergence look identical in a final hash and need to be distinguishable.

---

## 5. Replay size ladder

Budgets are declared per game in its manifest and asserted in CI. Wave C is where this stops
being theoretical.

| Class | Games | Target compressed |
|---|---|---|
| tiny | Hookline, Launch, Archery, Hammer | < 5 KB |
| small | Pickaxe, Pogo | < 15 KB |
| medium | Rooftop, Bike, Cargo | < 40 KB |
| large | Demolition | < 80 KB |

At the top of the ladder, 100,000 runs is roughly 8 GB — comfortably inside Postgres `bytea`, and
the reason object storage stays off the critical path.

---

## 6. Demolition Dive risk register

The one game with a real chance of not shipping, so its risks are named up front.

| Risk | Handling |
|---|---|
| Chain reactions diverge across runtimes | Determinism fixture at **maximum** body count, all four runtimes, before build proceeds |
| Body count blows the mobile frame budget | Hard runtime cap, enforced, declared in the manifest |
| Debris cleanup silently affects simulation | Despawn is deterministic and part of the simulation, never a cosmetic afterthought |
| Replay exceeds budget | Inputs are only three launches; state is large but inputs are tiny. Budget should hold — verify early |
| Spec 1 landed on Branch B2/B3 | Re-assess viability before build. Removing it from the launch roster is acceptable and preferable to shipping an unverifiable leaderboard |

---

## 7. Open questions

1. Best-of-three semantics per game: highest single, or sum? Decide per game before its
   leaderboard opens.
2. Does Pogo Tower's weekly seed reuse the daily ladder's rotation machinery, or need its own?
3. Should Wave C's medium replays be trimmed by lowering input sample granularity, or is the
   budget comfortable as-is?
4. If Demolition Dive is cut, does a tenth game replace it, or does the championship launch with
   nine and a 9,000-point maximum?

---

## 8. Tasks

| # | Task | Games | Plan ref |
|---|---|---|---|
| 1 | Wave A — projectile | Launch Lab, Ragdoll Archery Rush, Hammer Throw Havoc | 15 |
| 2 | Wave B — seeded generation | Pogo Tower | 16 |
| 3 | Wave C — continuous and vehicle | Rooftop Relay, Balance Bike Blitz, Cargo Chaos | 17 |
| 4 | Wave D — destruction | Demolition Dive | 18 |

Each game within a wave repeats the Spec 3 template and must clear the integration checklist as a
merge gate. Sub-tasks written when this spec is deepened after Spec 3 lands.
