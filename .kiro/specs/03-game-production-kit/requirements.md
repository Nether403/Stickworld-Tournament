# Spec 3 — Game Production Kit and Reference Game

**Status:** approved 2026-08-18; **executed** on `cursor/spec-3-full-depth-bda1`
**Depth:** complete (design.md + tasks.md match Spec 1/2 style)
**Covers:** Plan tasks 10, 12, 14
**Depends on:** Spec 1 merged (PR #1, Branch A); Spec 2 merged (PR #2)
**Blocks:** Spec 4
**Stack:** `docs/adr/0005-spec3-game-host-and-auth.md` (plus ADR-0004 for the platform)

---

## Why this spec is now full depth

Spec 2 landed the ranked pipeline: Neon schema, Google (and now email) auth, attempt
issue/finish, Node re-simulation, per-game boards, championship, daily ladder. Spec 3's
scope draft named Hookline, a kit, and Pickaxe, but omitted Phaser ownership, mode
switching, course geometry, score event types, action tables, package layout, and
which kit pieces are actually proved by game one. This revision supplies that.

Approved. Execute `tasks.md` in order.

---

## Requirements

### R1 — Hookline Sprint as a complete vertical slice

1. Hookline Sprint SHALL be built end to end: sign-in (Google or email) → claim handle
   → ranked attempt → play → verified score → personal best → leaderboard position,
   with **zero manual database intervention** anywhere in that path. Seed + worker map
   SHALL register the game; operators SHALL NOT insert rows by hand for a normal run.
2. Simulation SHALL be built and golden-hashed **before** the Phaser view. Rope
   distance constraint, anchor raycast attach, gates, perfect-release detection, combo
   multiplier, fixed course geometry, integer scoring — all as
   `docs/games/hookline-sprint.md` (that file wins for geometry and numbers).
3. Presentation SHALL be Phaser `4.2.1` handling rendering, camera, effects, and audio
   hooks only. Phaser SHALL NOT call `step()`, `applyInput`, or write simulation
   fields. The Spec 1 lint boundary SHALL keep Phaser, React, Next, `node:*`, and DOM
   globals out of `games/*/src/simulation/**`.
4. Input SHALL work on keyboard, mouse, and touch as **hold-to-attach / release-to-let-go**
   (one button). Keyboard uses Space and auto-aims the nearest anchor in a forward cone.
   Pointer/touch aims the ray at the pointer world position.
5. Practice mode and ranked mode SHALL both exist on the **GameHost** (ADR-0005).
   Practice requires no account, uses a host-generated seed, allows pause, and
   produces no `/v1` attempt and no leaderboard entry. Ranked requires a session and
   a claimed handle, issues `POST /v1/games/hookline-sprint/attempts`, and has no pause.
6. The result screen SHALL render the score event stream (`progress`, `gate`,
   `perfect-release`, `finish` / `fail`), not a bare number.
7. Hookline SHALL pass `@stickworld/game-test-chamber/contract-suite`, its own
   four-runtime determinism fixture, and a committed replay fixture the worker
   reproduces exactly. Goldens live under `games/hookline-sprint/conformance/golden/`.
8. Physics budget SHALL be the manifest budget in design §5.1, asserted every step
   in test/dev. CI SHALL run Playwright `mobile-chromium` and `mobile-webkit`
   viewports for touch. Real mid-range Android and iPhone frame-time is a **demo
   gate**, not a CI job.

### R2 — Extraction of shared packages (after Hookline goldens exist)

1. Shared packages SHALL be extracted **after** Hookline's determinism hash series
   and replay fixture score are committed. Speculative abstraction SHALL be refused.
2. Packages to extract from proved Hookline code, and only those:

   | Package | Contents in Spec 3 |
   |---|---|
   | `@stickworld/physics-kit` | rope/distance joint, anchor, raycast attach, gate/checkpoint sensor, impact sensor |
   | `@stickworld/scoring` | combo / streak, integer multiplier hundredths |
   | `@stickworld/input` | keyboard / mouse / touch → action table; record-on-change into `Recorder` |
   | `@stickworld/ui` | tokens, countdown, practice pause, results, leaderboard widget, PB toast |
   | `@stickworld/telemetry` | no-op/in-memory emitter, standard tags |

   `@stickworld/ragdoll`, wheel assembly, breakable objects, and moving platforms
   SHALL NOT be implemented in this spec (ADR-0005). Roadmap notes belong in
   `packages/physics-kit/README.md`.
3. **Critical acceptance gate:** after refactoring Hookline onto the extracted
   packages, its determinism hash series and replay fixture score SHALL be
   **byte-identical** to the pre-refactor committed goldens. A mismatch fails the
   task; it is not fixed by regenerating goldens.
4. Bundle size SHALL be measured (Playwright coverage or `next build` client stats)
   and recorded in `docs/budgets/spec3-bundles.md`. CI SHALL fail if the
   `/play/hookline-sprint` JS+CSS (excluding Rapier's inlined WASM) exceeds **120%**
   of that recorded baseline after the baseline exists. First baseline is set in
   Task 2, not guessed here.
5. Extracted simulation-touching packages (`physics-kit`, `scoring`) SHALL be under
   the Spec 1 lint ban (`stickworld/no-nondeterminism`, `stickworld/no-host-imports`).
   `input`, `ui`, `telemetry`, and `game-host` MAY use DOM / `performance.now`.

### R3 — Per-game integration checklist (merge gate)

1. The checklist in design §11 SHALL be a CI merge gate for every path matching
   `games/*`, not advisory. A new game package that fails the file/test presence
   check SHALL fail `verify`.
2. Game design documents SHALL live in `docs/games/<slug>.md`. Frozen score
   contracts, action tables, and v1 geometry live there. Spec 3's `design.md` names
   the host and kit; it does not re-tune Hookline mid-season.
3. Inspiration ledger entries SHALL exist at `docs/legal/inspiration/<slug>.md`
   before that game's simulation is merged. Trademark boxes in
   `docs/legal/brand-and-ip-clearance.md` MAY remain pending; that does not block
   implementation of working titles, but public launch remains Spec 5 + counsel.

### R4 — Pickaxe Ascent proves the kit

1. Pickaxe Ascent SHALL be built using the SDK (`StickworldGame`), extracted kit
   packages, `GameHost`, and `@stickworld/ui` only. It SHALL NOT modify
   `packages/platform` except the **registration seam** (ADR-0005 decision 8):
   seed rows + one `GAMES` map entry. It SHALL NOT modify `GameHost` APIs. If
   either must change, record a kit finding in `docs/games/pickaxe-ascent.md` and
   stop for review — do not silently expand the host.
2. It SHALL pass the identical contract suite Hookline passes, plus its own
   goldens, scoring tests, replay fixture, Playwright touch viewport, and lazy-load
   assertion.
3. v1 ledges SHALL be static (ADR-0005). Revolute/hinge **or** kinematic pickaxe
   pose (design §7) MAY be added to `physics-kit` during this task; that is a kit
   extension proved by game two, not a platform change.
4. Integration effort SHALL be recorded in `docs/games/pickaxe-ascent.md` (wall-clock
   of the executing branch, and a file/LOC count vs Hookline) as the measure of
   whether the kit pays for itself. This is documentation, not a pass/fail number.

### R5 — Visual and product consistency

1. Both games SHALL use `@stickworld/ui` tokens: stickman-as-capsule proportions
   (design §9), typography, countdown, pause, results, leaderboard widget, PB
   toast, colour system. Phaser effects SHALL read those token hex values, not
   invent a second palette.
2. Each game's client module and assets SHALL load only from `/play/<slug>`.
   Opening Hookline SHALL NOT fetch Pickaxe chunks. A Playwright network test
   SHALL prove it.
3. Catalogue, sign-in, handle claim, and leaderboard chrome SHALL feel like one
   product. Game canvases sit inside that chrome; they are not standalone sites.

### R6 — Spec 3 auth and shell (inherits Spec 2, amends the button set)

1. Ranked play SHALL accept **Google OAuth** and **email signup/sign-in** through
   Neon Auth (`@neondatabase/auth@0.5.0-beta`). GitHub SHALL NOT be offered in the
   Spec 3 UI. Discord stays out.
2. Email SHALL use Neon Auth's existing bundled sender. No Resend, no third vendor.
3. Guests SHALL reach practice. Ranked SHALL still require session + claimed handle
   (`UNAUTHENTICATED` / existing Spec 2 codes).
4. `/play/<slug>` SHALL be a client island (`next/dynamic`, `ssr: false`) so Phaser
   never runs on the server.

### R7 — Registration and worker

1. Registry ids are stable and never reused: `test-chamber = 0`,
   `hookline-sprint = 1`, `pickaxe-ascent = 2`.
2. `packages/platform/src/verify.ts` `GAMES` map SHALL include both shipping games.
   The API process SHALL continue to import `@stickworld/platform` without Rapier;
   only `@stickworld/platform/verify` (worker) loads games.
3. Seed SHALL add both games to season `ci` with `fixed-course` and `daily-seed`
   `season_games`, pinned to Spec 1 Rapier / sim-core constants, `gameVersion`
   `1.0.0`.
4. Adding a third game later MUST follow the same seam. No worker rewrite.

---

## Out of scope

- Games 3–10 (Spec 4)
- Generated art / Deepgram voice (Spec 5)
- Deployment dashboards, Sentry, backups (Spec 5)
- Ten-body ragdoll, wheels, breakables, kinematic moving platforms
- GitHub or Discord login buttons
- Best 6 of 10
- Live PvP
- Real-device CI farm (demo only)

---

## Definition of done

- [x] Hookline Sprint playable end to end on desktop (Playwright + manual) and phone
      viewports; ranked path uses `/v1` with no manual SQL
- [x] Google and email sign-in reach handle claim; GitHub is not shown
- [x] Shared packages extracted; Hookline hash series and fixture score byte-identical
- [x] Bundle baseline recorded; lazy-load test green (Hookline does not fetch Pickaxe)
- [x] Integration checklist is a CI merge gate
- [x] Pickaxe Ascent registered via the seam only, passing the identical suite
- [x] Inspiration ledgers present for both games
- [x] No new cloud vendor; Phaser and kit pins are exact

---

## Notes (not SHALL)

- Working titles remain subject to the parallel legal track. Spec 3 implements them.
- Test Chamber stays in CI forever. It is not a catalogue shipping title.
- Daily-seed rows are registered so issuance works; Spec 3 games' **championship**
  path is fixed-course. Daily ladder play for Hookline is allowed by the platform
  but is not a Spec 3 demo requirement.
