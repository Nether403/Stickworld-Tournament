# Stickworld Tournament — Spec Index

Five specs, executed in order. Do not start a spec's implementation until its
design is **approved** and every earlier spec's definition of done is green.

| Spec | Title | Depth | Plan tasks | Status |
|---|---|---|---|---|
| [01](./01-simulation-replay-core/) | Deterministic Simulation and Replay Core | **full** | 1–4 | **done, merged** ([PR #1](https://github.com/Nether403/Stickworld-Tournament/pull/1)) |
| [02](./02-tournament-platform-ranking/) | Tournament Platform and Ranking | **full** | 5–9, 11, 13 | **done, merged** ([PR #2](https://github.com/Nether403/Stickworld-Tournament/pull/2)) |
| [03](./03-game-production-kit/) | Game Production Kit and Reference Game | **full** | 10, 12, 14 | design written; **awaiting approval** before execution |
| [04](./04-roster-production/) | Roster Production (games 3–10) | scope | 15–18 | blocked on Spec 3 |
| [05](./05-assets-integrity-operations-launch/) | Assets, Integrity, Operations, Launch | scope | 19–24 | blocked on Specs 1–4 |

Plus a non-spec parallel track: [`docs/legal/brand-and-ip-clearance.md`](../../docs/legal/brand-and-ip-clearance.md) — started, long lead times, gates naming.

**Vendors (locked):** Neon (Postgres + Auth + Branches) + Railway (web, worker, cron). No other cloud.

**Auth (current):** Google OAuth + email signup via Neon Managed Better Auth. GitHub is deferred. Discord is not a Neon first-party provider. See `docs/adr/0004-spec2-platform-stack.md` and `docs/adr/0005-spec3-game-host-and-auth.md`.

---

## Why Spec 1 was full depth first, and 4–5 stay scope

Spec 1 contained a determinism fork. That fork is **resolved: Branch A**. Specs 2–5 do not need a determinism-axis rewrite.

Spec 2 is full depth and executed: worker runtime, schema, and `/v1` are real.

Spec 3 is now full depth because the platform contracts exist: Phaser ownership, practice vs ranked, course geometry, score events, and extraction scope can be named without writing them twice.

Specs 4–5 stay at scope-and-contract depth until Spec 3 lands: they depend on the kit, the checklist merge gate, and the registration seam.

---

## Execution order

```
Spec 1  ──► Branch A, merged to main
   ▼
Spec 2  merged to main (PR #2)
   ▼
Spec 3  full-depth design ──► REPORT TO USER, STOP until approved ──► execute
   ▼
Spec 4  revise → approve → execute
   ▼
Spec 5  revise → approve → execute → launch
```

---

## The project in one paragraph

A browser-based competitive platform hosting ten original single-player stickman
physics games. Each game has a verified leaderboard; one championship ranking
spans all ten. The hard problem is not the games — it is score trust. The
browser belongs to the player, so a client-reported score is worthless. Every
trust claim depends on the server independently recomputing each score from
recorded inputs, which requires bit-identical physics in browser and server.
Spec 1 proved that for one pinned Rapier `-compat` 0.20.0 build. Spec 2 made
the server the issuer of every ranked run.

---

## Confirmed constraints

| Decision | Choice |
|---|---|
| Database / Auth | Neon (Postgres + Managed Better Auth) |
| Hosting | Railway — `web`, `worker`, cron in one project |
| Vendor count | **Capped at 2.** No Redis, no separate queue, no object store at launch |
| Ranked format | Both — fixed courses for the championship, plus a daily-seeded ladder |
| Stakes | Bragging rights only. No prizes, no KYC |
| Live PvP | Out of scope, but must stay architecturally possible without a rewrite |
| Spec 3 login | Google + email. GitHub later. No Discord |

Consequences: replays are Postgres `bytea`; the job queue is a Postgres table
consumed with `FOR UPDATE SKIP LOCKED`; email uses Neon's bundled sender (not a
third vendor); there is **no CDN at launch** — an accepted, recorded gap.

---

## Standing constraints for anyone working in this repo

- Never read, echo, log, or commit anything under `Credentials/`. Reference keys by name only.
- Do not force-push `main`. Feature work goes on `cursor/*` branches.
- No new dependencies beyond those named in the specs without flagging it. Pin exact versions.
- **The Rapier version and build variant are pinned and must not be bumped casually.** A version
  bump invalidates historical replays and is a competition-affecting change.
- No `Math` transcendentals, `**`, `Math.random`, or wall-clock reads anywhere inside `sim-core`
  or any game's `simulation/` directory. Lint-enforced. Same ban on `physics-kit` and `scoring`.
- No runtime calls to Gemini, Deepgram, or OpenRouter in shipped gameplay paths.
- Golden determinism hashes require an ADR to change. They are the contract, not a build artefact.

---

## Corrections to the workspace research documents

The ten research documents in the workspace root are the project's origin material, but this spec
set corrects them on several load-bearing points. **Where a spec contradicts a research document,
the spec wins.** Recorded here so these do not get relitigated.

1. **Rapier is not cross-platform deterministic by default.** Two research documents claim it is.
   Rapier's own docs say it is *locally* deterministic and that two different computers may produce
   completely different results. Spec 1 proved one pinned `-compat` WASM **is** bit-identical
   across Node and the Playwright browsers (Branch A).
2. **The research's reason for rejecting JS physics is wrong.** JS `+ - * /` and `Math.sqrt` on
   doubles are IEEE-754 exact and deterministic. The real threats are `Math.sin/cos/tan/pow/exp/log`
   (implementation-defined per ECMAScript), variable timestep, unstable iteration order, and SIMD
   build variance. Conclusion still favours Rapier; the reasoning differs, and the difference
   determines what we actually defend against.
3. **Physics uses SI units, not pixels.** Per Rapier's docs, a 100×100 px collider is effectively
   100 m wide against gravity of −9.81 and makes the simulation look like slow motion.
4. **Redis is not a launch dependency.** Postgres window functions (`rank`, `dense_rank`,
   `percent_rank`) do the ranking natively. A materialized snapshot plus a short cache covers
   launch traffic.
5. **Verify every ranked run, not just elite ones.** A 90-second run is ~5,400 headless ticks.
   Full verification is affordable, simpler, and strictly stronger than tiered verification. The
   proposed ML anomaly-detection tier is dropped entirely — it would be the least reliable
   component and solves a problem re-simulation already solves.
6. **The percentile championship formula has two defects.** It is unstable (your points move when
   others play and you do not) and pool-size sensitive (first of 20 earns the same as first of
   20,000). Replaced with a hybrid: fixed placement table for the top 100, percentile-scaled tail
   below, plus a 50-entrant gate.
7. **The roster in `building Stickworld Tournament.md` is rejected outright.** It proposes launching
   with Stickman Hook, Ragdoll Hit, Dreadhead Parkour and others — other companies' shipping
   commercial products. Nothing from it ships.
8. **The three PvP rosters are rejected as launch scope.** They contradict the single-player
   high-score brief and each needs authoritative rooms, matchmaking, netcode, and enough
   concurrency to fill a lobby before being fun at all.
9. **Never mix physics engines per game.** `Stickworldlegal.md` proposes six different stacks across
   ten games. That is six determinism surfaces, six sets of tuning constants, six verification
   harnesses. One engine, one pinned build, platform-wide.
10. **The branching-narrative game type is excluded entirely.** Highest IP risk in the genre, and it
    produces no meaningful score.

---

## Verification standard

Do not claim a task works from code inspection. Spec 1 Task 2's entire value is empirical
evidence, and the standard holds throughout: run the harness and show the hashes, run the tests and
show pass/fail, exercise UI in a real browser and capture a screenshot. Report what was checked and
what was not. **Never describe an unexecuted check as passing.**
