# Spec 4 — Tasks

**Status:** approved 2026-08-18; executed. Spec 3 is merged (PR #3).
Do not start Spec 5 until this PR merges and Spec 5 is separately approved.

Legend: `[ ]` not started · `[~]` in progress · `[x]` done
Geometry and score numbers: `docs/games/*.md` win if this file and those disagree.

---

## Task 1 — Wave A: projectile games

**Objective:** three more catalogue games; projectile in the kit; ragdoll proved
on Archery; best-of is one replay. No GameHost / `/v1` / schema edits.

- [x] 1.1 `physics-kit`: `launchImpulse` (or equivalent) with a kit unit test.
      `detmath` only. Construction still through `SimWorld.createRigidBody`.
      _(R1.1)_
- [x] 1.2 `games/launch-lab` **simulation only** from `docs/games/launch-lab.md`.
      Three sub-attempts, pose reset without new bodies, sum aggregation tests,
      miss-launch scores 0 for that slot. No Phaser. _(R1.2, R1.3)_
- [x] 1.3 Launch Lab goldens + `fixtures/sample.swr` + `pnpm replay:verify`.
      Compressed sample (and a 90 s synthetic) `< 5120` bytes. Contract-suite.
      _(R1.4)_
- [x] 1.4 Launch Lab `./client` + `/play/launch-lab`. Same host, same UI package.
      Seed `registry_id = 3` + `GAMES` map. Worker extra dep `.` only.
      Playwright: practice; ranked 401; this page does not fetch other games.
      _(R1.8, R6)_
- [x] 1.5 `games/ragdoll-archery-rush` simulation from its game doc. Ten-body
      ragdoll, static targets, integer aim+draw. Goldens. Tiny replay. _(R1.6)_
- [x] 1.6 Archery Phaser + play page + seed `registry_id = 4` + checklist.
      Then extract the proved ragdoll into `physics-kit`. Archery hashes
      **byte-identical**. Do not add `@stickworld/ragdoll` unless Hammer also
      imports it (it should not). _(R1.6)_
- [x] 1.7 `games/hammer-throw-havoc` simulation + goldens + client + seed
      `registry_id = 5`. Angular spin then release. Three throws, sum, tiny
      replay. Angular helper enters the kit only if Launch or Archery also
      needs it; otherwise keep it in Hammer and log the finding. _(R1.1)_
- [x] 1.8 Catalogue cards for all three. Championship can show five columns
      once verified results exist (platform already supports N games).
      Integration-effort notes in each game doc. _(R5, R6)_

**Tests:** scoring types including sum-of-three; contract-suite; four-runtime
hashes; tiny replay; lazy-load; legal grep.

**Demo:** five live games, five boards. Practice Launch as a guest. No SQL.

---

## Task 2 — Wave B: Pogo Tower

**Objective:** first seeded generator; first kinematic movers; weekly issue.

- [x] 2.1 Generator harness: `createTower(prng)` returns platforms in stable
      order. Fixture: same seed → identical geometry dump in Node. _(R2.1)_
- [x] 2.2 Four-runtime **geometry** fixture (separate file from gameplay
      hashes). Same seed, same ordered `(x,y,hx,hy)` list and same hash.
      _(R2.2)_
- [x] 2.3 `physics-kit` kinematic moving platform helper + kit test. Pogo
      simulation uses it. Pickaxe goldens MUST stay `6b03896db5837763`.
      _(R2.4)_
- [x] 2.4 `games/pogo-tower` gameplay goldens, small replay ≤ 15_360,
      `./client`, `/play/pogo-tower`. _(R2, R5)_
- [x] 2.5 Weekly seed platform increment: `issueAttempt` accepts
      `weekly-seed`; ranked client union; `/v1` body; rotation writes the
      ISO-week Monday into `daily_boards` (preferred) or a logged
      `weekly_boards` migration. Test: championship payload ignores a verified
      weekly Pogo result. _(R2.3, ADR-0006)_
- [x] 2.6 Seed `registry_id = 6` with `season_games` for `weekly-seed` (and
      `daily-seed` if issuance tests need it). Catalogue card. Lazy-load e2e.
      _(R5)_

**Demo:** six games live. Two clients, same week seed, identical towers.

---

## Task 3 — Wave C: Rooftop, Bike, Cargo

**Objective:** longest runs; kit gains controller, wheels, cargo condition.

- [x] 3.1 **Before Phaser:** for each of the three games, a 150 s
      record-on-change synthetic replay ≤ 40_960 bytes. If it fails, coarsen
      that game's action table only and log it. _(R3.1)_
- [x] 3.2 Kinematic character controller in `physics-kit` + fixture. Rooftop
      Relay sim from `docs/games/rooftop-relay.md`. Stumble flag is
      presentation. Goldens, client, seed `registry_id = 7`. _(R3.2)_
- [x] 3.3 Wheel assembly + suspension in `physics-kit` + fixture. Balance Bike
      Blitz sim + goldens + client + seed `registry_id = 8`. _(R3.3)_
- [x] 3.4 Jointed cargo + integer condition. Cargo Chaos sim + goldens +
      client + seed `registry_id = 9`. _(R3.4)_
- [x] 3.5 Playwright lazy-load for all three slugs. Catalogue. Demo-gate note
      for real Android frame-time (not CI). _(R3.5, R3.6)_

**Demo:** nine games live. Medium replay assertions green.

---

## Task 4 — Wave D: Demolition Dive

**Objective:** last game, or an explicit cut.

- [x] 4.1 Pre-flight: confirm Branch A still in force (it is). If a later
      Rapier pin change landed (it must not), stop. _(R4.1)_
- [x] 4.2 Breakable + chain-reaction + deterministic despawn in `physics-kit`
      with a max-body kit fixture (four runtimes) **before** the game view.
      Caps from `docs/games/demolition-dive.md`. _(R4.2, R4.3, R4.4)_
- [x] 4.3 `games/demolition-dive` simulation: three dives, sum, pose reset
      without new bodies, large replay ≤ 81_920. Goldens. _(R4.5)_
- [x] 4.4 Client + `/play/demolition-dive` + seed `registry_id = 10` **or**,
      if 4.2 fails closed, write the cut in the game doc and championship
      UI copies "nine games / 9,000 max" — no replacement title. _(R4.1)_
- [x] 4.5 Checklist, lazy-load, catalogue. Ten championship columns if it
      shipped; nine if cut. _(R6)_

**Demo:** launch roster complete, or a recorded nine-game championship.

---

## Exit criteria

All of `requirements.md` Definition of done, with executed-command evidence:

- [x] `pnpm lint` + `pnpm typecheck` (46/46) + `pnpm test` (197 passed, 20 skipped)
- [x] `node scripts/check-game-integration.mjs` + `node scripts/check-forbidden-names.mjs`
- [x] `pnpm replay:verify games/*/fixtures/sample.swr` — all ten goldens match, Pickaxe still `6b03896db5837763`
- [x] `pnpm --filter @stickworld/physics-kit score:browser` — max-body 28, 3/3 browsers
- [x] `pnpm --filter @stickworld/game-demolition-dive score:browser` — 3/3, score 528 / `7a45fea1ee107627`
- [x] `pnpm build` + `node scripts/check-play-bundle.mjs` — gzip 572160 ≤ 683301
- [x] `CI=true pnpm --filter @stickworld/web e2e` — 36 passed (catalogue through Demolition, lazy-load, ranked 401)

**Then stop.** Spec 5 waits for approval after this spec's execution evidence.
