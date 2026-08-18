# Spec 3 — Design (scope and contract depth)

---

## 1. The two-layer rule

Every game is two directories with a hard boundary between them:

```
games/<slug>/
├── src/
│   ├── simulation/        ← authoritative. sim-core + detmath only.
│   │   ├── state.ts           NO Phaser. NO DOM. NO node:*. NO Math.sin.
│   │   ├── rules.ts           Lint-enforced from Spec 1.
│   │   ├── scoring.ts
│   │   ├── course.ts
│   │   └── simulation.ts
│   │
│   ├── client/            ← presentation. Phaser 4.
│   │   ├── scene.ts           May read simulation state.
│   │   ├── renderer.ts        May NEVER write it.
│   │   ├── effects.ts
│   │   ├── audio.ts
│   │   └── controls.ts
│   │
│   └── manifest.ts        ← the contract from Spec 1 §9
│
└── tests/
    ├── deterministic.test.ts
    ├── scoring.test.ts
    └── replay.test.ts
```

`simulation/` runs unchanged in the browser and in the validator. `client/` never runs in the
validator at all. This is the same principle as Spec 1's core rule, applied per game, and it is
what makes verification possible.

---

## 2. Hookline Sprint

**Mechanic:** attach a grappling line to anchor points, swing on pendulum momentum, release at
the right moment, carry momentum toward the next obstacle or gate.

**Score shape:** `distance + gate bonuses + perfect-release bonuses + combo multiplier`, integer,
higher better.

**Why it is the reference game:** one-button control, immediately understandable, high skill
ceiling, short attempts, fast restarts, tiny replay, and highly reproducible physics. It exercises
the rope constraint and the combo system without needing ragdolls, vehicles, or destructibles.
If the platform can verify this, it can verify most of the roster.

**Course:** fixed geometry, identical for every player all season. Seeded generation is not used
here; that arrives with Pogo Tower in Spec 4.

---

## 3. Extraction order and the byte-identical gate

```
1. Build Hookline with everything local to the game.
2. Record: determinism hash series + replay fixture score.   ← the baseline
3. Extract physics-kit, ragdoll, input, scoring, ui, telemetry.
4. Refactor Hookline onto them.
5. Re-run: hash series and fixture score MUST be byte-identical.
6. Only then is the extraction accepted.
```

Step 5 is the gate that matters. A refactor that changes a joint's construction order, a
constraint's parameter order, or a scoring accumulation order will change outcomes — silently,
and in a way that invalidates every score recorded before it. The hash catches this immediately;
review would not.

Extract only what Hookline proved. `physics-kit` will ship with rope joint, checkpoint, impact
sensor, and combo support after this spec. Wheel assembly, breakable object, and moving platform
are **declared in the package's roadmap but not implemented** until a game that needs them exists
in Spec 4.

---

## 4. Shared package boundaries

| Package | Owns | Must not |
|---|---|---|
| `physics-kit` | Body/joint/collider factories with fixed construction order | Contain game rules or scoring |
| `ragdoll` | The standard ten-body stickman and its joint configuration | Contain per-game tuning; games configure, not fork |
| `input` | Action mapping, quantisation to the manifest's action table, keyboard/mouse/touch abstraction | Read the DOM from within simulation |
| `scoring` | Combo, multiplier, streak primitives, integer-only | Know about any specific game |
| `ui` | React components, design tokens, results screen, leaderboard widgets, PB celebration | Touch simulation |
| `telemetry` | Event emission with the standard tag set | Be required for a game to function |

`ragdoll` deserves emphasis: ten games configuring one ragdoll is the difference between one
determinism surface and ten. Games get configuration knobs, never their own joint hierarchies.

---

## 5. Integration checklist (the merge gate from R3)

A game may not merge until every line is satisfied:

- [ ] Design doc in `docs/games/<slug>.md`
- [ ] Manifest with stable `registryId`, versions, action table, physics budget
- [ ] Score contract frozen and documented
- [ ] Seed fixtures committed
- [ ] Determinism test passing across all four runtimes
- [ ] Unit test per score event type
- [ ] Replay fixture the validator reproduces exactly
- [ ] End-to-end test: attempt → play → verified → leaderboard
- [ ] Touch controls tested on real mobile viewports
- [ ] Performance budget met on mid-range Android and iPhone
- [ ] Physics budget declared and asserted at runtime
- [ ] Accessibility pass: instructions screen, colour-blind-safe indicators, no hover-only mechanics
- [ ] Assets lazy-loaded; opening this game fetches nothing belonging to another
- [ ] Inspiration ledger entry (parallel legal track)

---

## 6. Open questions

1. Does the Phaser scene own the `Stepper`, or does a platform-level game host own it and drive
   the scene? The host approach centralises the pause/focus policy but couples more tightly.
2. Where does the practice/ranked mode switch live — manifest, host, or scene?
3. Placeholder art strategy until Spec 5's generated pipeline exists: flat colour primitives, or
   a small hand-authored set that establishes the visual language early?
4. Does `telemetry` ship in this spec or defer to Spec 5 with the observability work?

---

## 7. Tasks

| # | Task | Plan ref |
|---|---|---|
| 1 | Hookline Sprint vertical slice, sign-in to leaderboard, desktop and phone | 10 |
| 2 | Extract shared packages; byte-identical hash and score gate; record bundle budget | 12 |
| 3 | Codify the integration checklist; build Pickaxe Ascent against it, touching no platform code | 14 |

Sub-tasks written when this spec is deepened after Spec 2 lands.
