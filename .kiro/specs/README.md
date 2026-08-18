# Stickworld Tournament — Spec Index

Five specs, executed in order, each revised in light of the previous one's outcome.

| Spec | Title | Depth | Plan tasks | Status |
|---|---|---|---|---|
| [01](./01-simulation-replay-core/) | Deterministic Simulation and Replay Core | **full** | 1–4 | authored, awaiting approval to execute |
| [02](./02-tournament-platform-ranking/) | Tournament Platform and Ranking | scope | 5–9, 11, 13 | authored, **revise after Spec 1** |
| [03](./03-game-production-kit/) | Game Production Kit and Reference Game | scope | 10, 12, 14 | authored |
| [04](./04-roster-production/) | Roster Production (games 3–10) | scope | 15–18 | authored |
| [05](./05-assets-integrity-operations-launch/) | Assets, Integrity, Operations, Launch | scope | 19–24 | authored |

Plus a non-spec parallel track: [`docs/legal/brand-and-ip-clearance.md`](../../docs/legal/brand-and-ip-clearance.md) — starts now, long lead times, gates naming.

---

## Why the depths differ

Spec 1 is written at full implementable depth. Specs 2–5 are written at scope-and-contract depth
deliberately, because **Spec 1 contains a fork.** If the determinism harness finds divergence
between runtimes, the verification model changes shape — which changes the attempt lifecycle,
which changes Spec 2's schema and the verified-versus-provisional states everything downstream
depends on. Writing implementation detail now risks writing it twice.

The user's chosen sequence: author all five so the full shape is visible, execute Spec 1, then
revise Spec 2 in light of the result, and repeat the land-then-revise cycle down the chain.

---

## Execution order

```
Spec 1  ──► determinism fork resolved, ADR-0001 written
   │
   │  ◄── REPORT TO USER, STOP
   ▼
Spec 2  revise for the chosen branch → approve → execute
   ▼
Spec 3  revise → approve → execute
   ▼
Spec 4  revise → approve → execute
   ▼
Spec 5  revise → approve → execute → launch
```

The one branch that changes Spec 2's shape rather than just its wording is **B1** (Node diverges,
browsers agree): the validation worker then runs headless Chromium under Playwright instead of
Node. Schema and API survive; worker runtime, image size, cost, and throughput all change.

---

## The project in one paragraph

A browser-based competitive platform hosting ten original single-player stickman physics games.
Each game has a verified leaderboard; one championship ranking spans all ten. The hard problem is
not the games — it is score trust. The browser belongs to the player, so a client-reported score
is worthless. Every trust claim depends on the server independently recomputing each score from
recorded inputs, which requires bit-identical physics in browser and server. That is an assumption
the research asserts but does not prove, and Spec 1 exists to settle it.

---

## Confirmed constraints

| Decision | Choice |
|---|---|
| Database / Auth | Neon (Lakebase Postgres + managed Auth, which is managed Better Auth) |
| Hosting | Railway — shell, API, worker, cron as services in one project |
| Vendor count | **Capped at 2.** No Redis, no separate queue, no object store at launch |
| Ranked format | Both — fixed courses for the championship, plus a daily-seeded ladder |
| Stakes | Bragging rights only. No prizes, no KYC |
| Live PvP | Out of scope, but must stay architecturally possible without a rewrite |

Consequences: replays are Postgres `bytea` (Neon Object Storage is Beta — keep it off the
integrity path); the job queue is a Postgres table consumed with `FOR UPDATE SKIP LOCKED`; auth is
OAuth-only (Google + Discord) because magic links need an email sender, which would be vendor
three; and there is **no CDN at launch** — an accepted, recorded gap.

---

## Standing constraints for anyone working in this repo

- Never read, echo, log, or commit anything under `Credentials/`. Reference keys by name only.
- No GitHub remote and no push without explicit user confirmation. Local `git init` is fine.
- No new dependencies beyond those named in the specs without flagging it. Pin exact versions.
- **The Rapier version and build variant are pinned and must not be bumped casually.** A version
  bump invalidates historical replays and is a competition-affecting change.
- No `Math` transcendentals, `**`, `Math.random`, or wall-clock reads anywhere inside `sim-core`
  or any game's `simulation/` directory. Lint-enforced.
- No runtime calls to Gemini, Deepgram, or OpenRouter in shipped gameplay paths.
- Golden determinism hashes require an ADR to change. They are the contract, not a build artefact.

---

## Corrections to the workspace research documents

The ten research documents in the workspace root are the project's origin material, but this spec
set corrects them on several load-bearing points. **Where a spec contradicts a research document,
the spec wins.** Recorded here so these do not get relitigated.

1. **Rapier is not cross-platform deterministic by default.** Two research documents claim it is.
   Rapier's own docs say it is *locally* deterministic and that two different computers may produce
   completely different results. Cross-platform determinism is conditional. Spec 1 proves it
   empirically.
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
