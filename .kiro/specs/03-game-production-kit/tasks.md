# Spec 3 — Tasks (scope depth)

**Do not execute yet.** Deepened after Spec 2 lands.

---

## Task 1 — Hookline Sprint vertical slice

**Objective:** one complete game from sign-in to leaderboard with zero manual database steps.

**Order of work:** simulation first (rope constraint, anchors, gates, perfect-release, combo,
fixed course, integer scoring), then Phaser 4 presentation, then practice and ranked modes, then
the score-breakdown result screen.

**Acceptance gate:** passes the Spec 1 contract harness, its own determinism fixture across all
four runtimes, and a replay fixture the validator reproduces exactly. Runs within its declared
physics budget on a mid-range Android and an iPhone. One-tap control works on keyboard, mouse,
and touch.

**Demo:** on a laptop and on a phone — sign in, start a ranked attempt, play, finish, see the run
verified, see a personal best recorded, see your leaderboard position. No database intervention at
any point.

---

## Task 2 — Extract shared packages

**Objective:** stop, extract what Hookline proved, and nothing more.

**Acceptance gate — the one that matters:** after refactoring Hookline onto the shared packages,
its determinism hash series and replay fixture score are **byte-identical** to the pre-refactor
baseline. Anything else means the refactor silently changed physics outcomes and invalidated every
score. Bundle size measured and recorded as a budget. The Spec 1 lint ban extended to every
extracted package.

**Explicitly out of scope here:** wheel assembly, breakable object, and moving platform are
declared in `physics-kit`'s roadmap but not implemented until Spec 4 has a game that needs them.

**Demo:** Hookline running on shared packages with an unchanged golden hash and unchanged fixture
score, plus a recorded bundle-size baseline.

---

## Task 3 — Integration checklist and Pickaxe Ascent

**Objective:** codify the repeatable process and prove it on game two.

**Acceptance gate:** the checklist from design §5 is a merge gate in CI, not advisory. Pickaxe
Ascent is built using only the SDK and shared packages, touching no platform code, and passes the
identical suite Hookline passes. Any platform change that turns out to be necessary is recorded as
a finding about the kit.

**Demo:** game two live with its own leaderboard and championship column, plus a recorded
integration time compared against Hookline's build time — the actual measure of whether the kit
pays for itself.

---

## Exit criteria

See `requirements.md` § Definition of done.
