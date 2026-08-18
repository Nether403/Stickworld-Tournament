# Spec 3 — Tasks

**Execute in order after this spec is approved.** Specs 1 and 2 are merged.
Do not start Spec 4 until Spec 3's exit criteria have executed-command evidence.

Legend: `[ ]` not started · `[~]` in progress · `[x]` done
Requirement references point at `requirements.md`.
Geometry and score numbers: `docs/games/*.md` win if this file and those disagree.

---

## Task 1 — Hookline Sprint vertical slice

**Objective:** one complete game from sign-in to leaderboard with zero manual
SQL. Simulation and goldens before Phaser.

- [x] 1.1 Workspace: `'games/*'` in `pnpm-workspace.yaml`. Pin `phaser` `4.2.1`
      on the Hookline client package and on `apps/web` if the play island
      imports it. Extend `transpilePackages`. Extend ESLint determinism glob
      to `games/*/src/simulation/**/*.ts` (already covered by `**/simulation/**`
      — confirm). Add legal grep script (design §14) to `verify`. _(R3.3, R5, R6.4)_
- [x] 1.2 Auth shell: Google + email signup/sign-in; **remove GitHub button**.
      Wrapper in `apps/web/lib/auth/email.ts`. Catalogue cards for Hookline
      (and a disabled/hidden Pickaxe card until Task 3). _(R6)_
- [x] 1.3 `packages/game-host` with unit tests: countdown does not step;
      `setPaused(true)` throws in `ranked`; practice pause stops `step` calls;
      ranked `start` calls `POST /v1/games/:slug/attempts` via injected fetch;
      `stop` without finish does not POST finish. _(R1.5, ADR-0005)_
- [x] 1.4 `games/hookline-sprint` **simulation only**: course, rope attach,
      scoring events. No Phaser. Unit tests for every score event type and for
      miss-ray (no joint). _(R1.2)_
- [x] 1.5 Commit Node hash series + `fixtures/sample.swr` +
      `conformance/golden/sample.json`. `pnpm replay:verify` on the fixture.
      Contract-suite green. _(R1.7)_
- [x] 1.6 Browser simulation identity: Chromium/Firefox/WebKit page loading
      simulation only (Test Chamber pattern). Hashes match 1.5. _(R1.7)_
- [x] 1.7 Phaser `./client` view + `/play/hookline-sprint`. Host drives the
      scene. Keyboard + mouse + touch hold/release. Instructions copy on the
      page. Colour-blind-safe gates. _(R1.3, R1.4, R5)_
- [x] 1.8 Seed `hookline-sprint` `registry_id = 1` and `GAMES` map entry.
      Worker extra dependency on `@stickworld/game-hookline-sprint` (`.` only).
      Integration test: honest fixture verifies; inflated claim
      `SCORE_MISMATCH`. _(R7)_
- [x] 1.9 Playwright: practice completes without auth; ranked without session
      is `401`; ranked with injected/test session (Spec 2 style user in DB +
      cookie if feasible, otherwise API-level like platform integration tests
      plus a thin UI test) reaches a leaderboard viewer row. Mobile viewports
      for touch. Network: this page does not fetch `pickaxe`. _(R1.1, R1.8, R5.2)_

**Tests:** scoring types; contract-suite; four-runtime hashes; worker golden;
Playwright practice; legal grep.

**Demo:** Google or email sign-in, claim handle, ranked Hookline, verified PB,
leaderboard row. Practice as a guest with pause. No SQL console.

---

## Task 2 — Extract shared packages

**Objective:** stop, extract what Hookline proved, nothing more.

- [x] 2.0 **Baseline freeze.** Note the git SHA of Task 1 goldens. Do not
      regenerate them in this task. _(R2.3)_
- [x] 2.1 `@stickworld/physics-kit`: rope, anchor, raycast attach, gate sensor,
      impact sensor. Lint ban on this package. Hookline simulation imports it.
      _(R2.2)_
- [x] 2.2 `@stickworld/scoring`: combo/streak hundredths. Hookline uses it.
- [x] 2.3 `@stickworld/input`: record-on-change. Hookline client uses it.
- [x] 2.4 `@stickworld/ui`: tokens + countdown + pause + results + leaderboard
      widget + PB toast. Shell and play island use them. _(R5.1)_
- [x] 2.5 `@stickworld/telemetry`: no-op `emit`. Host may call it. Games run
      without it. _(ADR-0005)_
- [x] 2.6 Re-run Task 1 determinism + replay fixture. **Byte-identical** to
      2.0. If not, revert the extract — do not update goldens. _(R2.3)_
- [x] 2.7 Measure `/play/hookline-sprint` client JS+CSS gzip **excluding**
      Rapier inlined WASM; write `docs/budgets/spec3-bundles.md`. Add CI
      ceiling at 120% of that number. _(R2.4)_

**Explicitly out of scope:** ragdoll, wheels, breakables, moving platforms.

**Demo:** same golden hash and fixture score as Task 1, plus the budget file.

---

## Task 3 — Checklist CI and Pickaxe Ascent

**Objective:** the checklist is a merge gate; game two uses only the kit.

- [x] 3.1 `scripts/check-game-integration.mjs` (or equivalent) fails `verify`
      if a `games/*` package misses design §11 files. Hookline already passes.
      _(R3.1)_
- [x] 3.2 `games/pickaxe-ascent` simulation from `docs/games/pickaxe-ascent.md`
      using physics-kit, scoring, sim-core only. Kinematic pickaxe helper may
      be added to physics-kit; log it. **No GameHost API change.** _(R4)_
- [x] 3.3 Pickaxe goldens, scoring tests, contract-suite, replay size ≤ 15 KB
      compressed for the sample (or a 120 s synthetic aim stream). _(R4.2)_
- [x] 3.4 Pickaxe `./client` + `/play/pickaxe-ascent`. Same host, same UI
      package. Touch + keyboard. _(R5)_
- [x] 3.5 Seed `registry_id = 2` + `GAMES` map line **only** platform edits.
      Worker verifies Pickaxe fixture. Championship table can show a second
      column once both have verified results (platform already supports N
      fixed-course games). _(R7, R4.1)_
- [x] 3.6 Playwright lazy-load: Hookline play must not request Pickaxe client
      chunk and vice versa. Integration effort table filled in
      `docs/games/pickaxe-ascent.md`. _(R4.4, R5.2)_
- [x] 3.7 If any extra platform file changed, write the kit finding and stop
      for review. _(R4.1)_

**Demo:** game two on the catalogue with its own board. Hookline goldens
unchanged. Recorded integration comparison.

---

## Exit criteria

All of `requirements.md` Definition of done, with executed-command evidence:

- [x] Hookline ranked path, no manual SQL
- [x] Google + email shown; GitHub not shown
- [x] Extraction byte-identical
- [x] Bundle baseline + lazy-load
- [x] Checklist CI
- [x] Pickaxe via seam only
- [x] Inspiration ledgers already in this deepening PR; keep them updated if
      names change

**Then stop.** Spec 4 waits for approval after this spec's execution evidence.
