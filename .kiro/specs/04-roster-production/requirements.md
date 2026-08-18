# Spec 4 — Roster Production (games 3–10)

**Status:** authored at scope depth
**Depth:** scope and contract only
**Covers:** Plan tasks 15–18
**Depends on:** Spec 3 complete (kit extracted, checklist a merge gate, proven on game two)
**Blocks:** Spec 5's launch gate

---

## Purpose

Ship the remaining eight games by repeating the Spec 3 template, grouped into waves so each wave
amortises one set of physics primitives instead of paying for them one game at a time.

**This spec is one process applied eight times, not eight specs.** Individual game designs are
not specified here — see R5.

---

## The locked roster

Ten games, all single-player, all producing one integer higher-is-better score, collapsing into
roughly five reusable physics systems. Games 1 and 2 ship in Spec 3.

| # | Game | System group | Ranked format | Attempt shape | Replay | Wave |
|---|---|---|---|---|---|---|
| 1 | Hookline Sprint | rope/joint | fixed course | 1 run ~90 s | tiny | *Spec 3* |
| 2 | Pickaxe Ascent | rope/joint | fixed course | 1 run ~120 s | small | *Spec 3* |
| 3 | Launch Lab | projectile | fixed course | best of 3 | tiny | A |
| 4 | Ragdoll Archery Rush | projectile | fixed targets | 1 run ~90 s | tiny | A |
| 5 | Hammer Throw Havoc | projectile/angular | fixed field | best of 3 | tiny | A |
| 6 | Pogo Tower | joint/platform | **weekly seed** | 1 run ~120 s | small | B |
| 7 | Rooftop Relay | kinematic + platform | fixed course | 1 run ~150 s | medium | C |
| 8 | Balance Bike Blitz | wheel/vehicle | fixed course | 1 run ~150 s | medium | C |
| 9 | Cargo Chaos | joint + platform | fixed course | 1 run ~150 s | medium | C |
| 10 | Demolition Dive | destructible | fixed structures | best of 3 | large | D |

---

## Requirements

### R1 — Wave A: projectile games (Launch Lab, Ragdoll Archery Rush, Hammer Throw Havoc)

1. All three SHALL share one projectile and angular-velocity system extracted into `physics-kit`
   only where **two or more of the three** genuinely need the same thing.
2. Launch Lab and Hammer Throw SHALL bundle all three attempts into **one submission and one
   replay**. Three separate submissions would triple verification load and let players
   cherry-pick their best of many.
3. Multi-attempt score aggregation SHALL have its own unit tests, separate from single-run
   scoring.
4. These SHALL remain the smallest replay payloads on the platform. A size assertion SHALL
   enforce it.
5. Analog aim and draw-power inputs SHALL be quantised to integers at capture time per each
   game's declared action table.

### R2 — Wave B: Pogo Tower

1. Pogo Tower is the **first game where a seeded generator drives level content**. The generator
   SHALL be deterministic and versioned as part of `simulation_version`.
2. A test SHALL assert the same seed produces identical geometry in all four runtimes.
3. WHEN the generator changes, THEN it SHALL be treated as a competition-affecting change
   requiring a new version and new leaderboards.
4. Weekly seed rotation SHALL follow the same server-issued pattern as the daily ladder.

### R3 — Wave C: continuous movement (Rooftop Relay, Balance Bike Blitz, Cargo Chaos)

1. These carry the longest runs and largest replays on the platform. Replay size budgets SHALL be
   validated **early in the wave**, not discovered at the end.
2. Rooftop Relay SHALL use a **kinematic character controller, not a dynamic body** — more
   deterministic and cheaper, and the recoverable-stumble presentation can be cosmetic.
3. Balance Bike Blitz SHALL use the wheel assembly with suspension springs, added to
   `physics-kit` in this wave.
4. Cargo Chaos SHALL use jointed cargo with a condition metric that feeds scoring.
5. Frame-time budgets SHALL be verified on a real mid-range Android device during this wave, not
   deferred to Spec 5's QA pass.

### R4 — Wave D: Demolition Dive, last

1. Demolition Dive SHALL ship last. It carries the highest determinism risk, the largest
   simulation state, the biggest replays, and the worst mobile profile.
2. Hard caps SHALL be declared and enforced at runtime on active rigid bodies, destructible
   objects, and chain-reaction depth.
3. Debris leaving the play area SHALL despawn **deterministically** — a cosmetic-looking cleanup
   rule that silently affects simulation is a determinism bug.
4. A determinism fixture SHALL run at the game's **maximum** body count across all four runtimes.
5. IF Spec 1's fork landed on Branch B2 or B3, THEN this game's viability SHALL be re-assessed
   before build, because chaotic high-body-count simulation is exactly where bounded divergence
   stops being bounded. Moving it out of the launch roster is an acceptable outcome.

### R5 — Game designs are not specifications

1. Mechanics, level geometry, physics tuning, and difficulty curves SHALL live in
   `docs/games/<slug>.md`, not in this spec. They churn continuously through playtesting; specs
   cover systems that must not churn.
2. Each game SHALL satisfy the Spec 3 integration checklist as a merge gate. That checklist, not
   a per-game spec, is the quality mechanism.

### R6 — Roster-wide invariants

1. Every game SHALL produce exactly one integer `ranked_score`, higher always better, with time
   converted to bonus points and never used as a raw ranking key.
2. Every game SHALL declare a physics budget and stay within it.
3. Every game SHALL be touch-viable: one tap (Hookline), two buttons (Pogo, Bike, Rooftop,
   Cargo), or drag-and-release (Launch, Hammer, Archery, Pickaxe).
4. Every game SHALL share the platform's visual and audio language.
5. Every game's assets SHALL load only when that game is opened.
6. No game SHALL contain a third-party game name in code, UI strings, assets, or filenames. The
   CI grep gate from the parallel legal track SHALL enforce this.

---

## Out of scope

- The branching-narrative / choose-your-own-adventure game type is **excluded from the platform
  entirely.** The legal research flags it as the highest IP risk in the genre and it produces no
  meaningful score.
- Live PvP variants of any game (Spec 5 preserves the seam; nothing is built).
- Generated art and voice (Spec 5).

---

## Definition of done

- [ ] All ten games live, each with a leaderboard and a championship column
- [ ] Wave A replays remain the smallest on the platform, assertion-enforced
- [ ] Pogo Tower's seeded generator produces identical geometry in all four runtimes
- [ ] Wave C meets load-time and frame-time budgets on a real mid-range Android
- [ ] Demolition Dive enforces its hard caps and passes determinism at maximum body count
- [ ] Every game passed the Spec 3 integration checklist as a merge gate
- [ ] Championship table fully populated across ten columns
