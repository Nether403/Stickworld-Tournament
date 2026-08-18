# Spec 3 — Game Production Kit and Reference Game

**Status:** authored at scope depth
**Depth:** scope and contract only
**Covers:** Plan tasks 10, 12, 14
**Depends on:** Specs 1 and 2 complete
**Blocks:** Spec 4

---

## Purpose

Turn "we can verify a score" into "we can build a game." This spec produces the first shipping
game as a complete vertical slice, then extracts the reusable kit **from proven code only**, then
proves the kit works by building game two against it.

The sequencing matters and is the whole point: build one game properly, *then* generalise. The
alternative — designing a shared framework up front and hoping ten games fit it — is how
platforms acquire abstractions nobody needs and miss the ones they do.

---

## Requirements

### R1 — Hookline Sprint as a complete vertical slice

1. Hookline Sprint SHALL be built end to end: sign-in → ranked attempt → play → verified score →
   personal best → leaderboard position, with **zero manual database intervention** anywhere in
   that path.
2. The simulation SHALL be built before the presentation. Rope distance constraint, anchor
   raycasting, gates, perfect-release detection, combo multiplier, fixed course geometry, integer
   scoring.
3. Presentation SHALL be Phaser 4 handling rendering, camera, effects, and audio hooks only.
   Phaser SHALL NOT touch game rules, and the lint boundary from Spec 1 SHALL enforce this.
4. Input SHALL work on keyboard, mouse, and touch. One-tap control.
5. Practice mode and ranked mode SHALL both exist. Practice requires no account and produces no
   leaderboard entry.
6. The result screen SHALL show a score breakdown derived from the score event stream, not a
   bare number, so players can understand what they earned and why.
7. It SHALL pass the Spec 1 contract harness, its own determinism fixture, and a replay fixture
   the validator reproduces exactly.
8. It SHALL run within its declared physics budget on a mid-range Android device and an iPhone.

### R2 — Extraction of shared packages

1. Shared packages SHALL be extracted **after** Hookline works, from code Hookline actually
   proved. Speculative abstraction SHALL be resisted; premature extraction costs more than
   duplication at this stage.
2. Packages to extract: `@stickworld/physics-kit` (rope joint, hinge, wheel assembly, moving
   platform, breakable object, projectile, checkpoint, impact sensor), `@stickworld/ragdoll`
   (standard ten-body stickman: head, torso, two upper arms, two forearms, two upper legs, two
   lower legs), `@stickworld/input`, `@stickworld/scoring` (combo, multiplier, streak),
   `@stickworld/ui`, `@stickworld/telemetry`.
3. **Critical acceptance gate:** after refactoring Hookline onto the shared packages, its
   determinism hash and its replay fixture score SHALL be **byte-identical** to before the
   refactor. A refactor that changes physics outcomes has silently invalidated every score.
4. Bundle size SHALL be measured and recorded as a budget at this point.
5. Extracted physics primitives SHALL keep the integer-scaled, `detmath`-only discipline from
   Spec 1. The lint ban SHALL extend to every extracted package.

### R3 — The per-game integration checklist

1. A written checklist SHALL be codified covering: design specification, frozen score contract,
   seed fixtures, determinism test, scoring unit tests, replay fixture, end-to-end test, touch
   controls, performance budget, declared physics budget, accessibility pass.
2. The checklist SHALL be a merge gate for every subsequent game, not advisory.
3. Game design documents SHALL live in `docs/games/*.md`, not in specs. Mechanics, level geometry,
   and physics tuning churn through playtesting; specs cover the systems that must not churn.

### R4 — Pickaxe Ascent proves the kit

1. Pickaxe Ascent SHALL be built using only the SDK and shared packages, touching **no platform
   code**. If platform code must change, that is a finding about the kit and SHALL be recorded.
2. It SHALL pass the identical test suite Hookline passes, with no game-specific platform
   changes.
3. Integration effort SHALL be recorded and compared against Hookline's build time, as the
   measure of whether the kit actually pays for itself.

### R5 — Visual and product consistency

1. Both games SHALL share one visual language: stickman proportions, typography, impact effects,
   countdown, pause screen, results screen, leaderboard widgets, personal-best celebration,
   tournament badges, colour system, audio language.
2. Each game's code and assets SHALL load only when that game is opened. Visitors SHALL NOT
   download assets for games they are not playing.
3. A player SHALL feel they are competing inside one platform, not opening unrelated minigames.

---

## Out of scope

- Games 3–10 (Spec 4)
- Generated art and voice pipelines (Spec 5) — placeholder assets are acceptable here
- Deployment and observability (Spec 5)

---

## Definition of done

- [ ] Hookline Sprint playable end to end on desktop and phone, no manual DB steps
- [ ] Shared packages extracted; Hookline's hash and fixture score byte-identical post-refactor
- [ ] Bundle size measured and recorded as a budget
- [ ] Integration checklist codified as a merge gate
- [ ] Pickaxe Ascent integrated touching no platform code, passing the identical suite
- [ ] Per-game lazy loading verified: opening one game does not fetch another's assets
