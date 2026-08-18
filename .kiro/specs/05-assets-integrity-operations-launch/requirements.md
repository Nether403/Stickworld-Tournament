# Spec 5 — Assets, Integrity, Operations, Launch

**Status:** authored at scope depth
**Depth:** scope and contract only
**Covers:** Plan tasks 19–24
**Depends on:** Spec 4 complete (all ten games live)

---

## Purpose

Everything between "ten games work" and "strangers can be trusted to compete on this." Asset
production, the future-multiplayer seam, abuse and compliance hardening, cross-device QA,
operations on Railway and Neon, and the run-up to a public season.

---

## Requirements

### R1 — Build-time asset pipeline

1. Art SHALL be generated with Gemini and voice with Deepgram, both **at build time only**,
   writing static files.
2. **No runtime calls to Gemini, Deepgram, or OpenRouter in any shipped gameplay path.** A network
   test SHALL assert zero requests reach those hosts during a ranked run. Reasons: cost, latency,
   and offline breakage.
3. OpenRouter SHALL be used for development tooling only — level layout generation into
   seed/config JSON that is then validated and frozen, test fixture generation, documentation,
   support triage, handle moderation review. It SHALL NOT appear in the simulation or scoring path,
   because it is non-deterministic by nature.
4. Collision geometry SHALL remain hand-authored, never generated, so it stays tunable and
   versionable.
5. The pipeline SHALL be reproducible from committed prompts and source inputs.
6. An asset provenance ledger SHALL record every shipped asset, its origin, and whether it was
   human-authored, generated, or generated-then-human-edited.
7. Brand marks — logo, mascot, wordmark — SHALL be human-authored and human-iterated.
   **Rationale:** purely AI-generated images may not attract copyright protection where authorship
   requires human intellectual creation. Trademark protects the brand regardless, but anything we
   need to own defensively gets human authorship. Generated art remains fine for volume.
8. Generated binaries SHALL NOT be committed. Prompts, sources, and the ledger SHALL be.

### R2 — The PvP seam (preserve the option, build nothing)

1. `sim-core` already consumes inputs per tick. That SHALL be formalised as an `InputSource`
   interface with a local implementation and a recorded implementation.
2. A test SHALL drive a simulation from a scripted "remote" input source, proving no
   local-input assumptions leaked into game rules.
3. An ADR SHALL record what a future authoritative-room model would add and what it would not need
   to change.
4. **No rooms, no matchmaking, no netcode SHALL be built.** This requirement exists to keep a
   future option open at near-zero present cost, not to start on it.

### R3 — Integrity and abuse hardening

1. An adversarial test suite SHALL cover malformed and oversized replays, duplicate nonces,
   expired attempts, background-tab and refresh mid-run, clock skew, and rate-limit evasion.
2. **Player handles are user-generated content.** That alone requires a notice-and-action
   mechanism, a moderation queue, statements of reasons for actioned content, and an audit trail.
   A handle field is sufficient to trigger this; it does not require chat or level sharing.
3. Reports SHALL be actionable through a moderation queue with a complete audit trail.
4. Actioned users SHALL receive a statement of reasons naming the rule applied and the available
   redress.
5. GDPR data export and deletion SHALL be implemented. Deletion SHALL remove personal data while
   preserving anonymised competitive-integrity records, so leaderboard history stays coherent.
6. Rate limits, security headers, and abuse controls SHALL be in place on every public endpoint.

### R4 — Cross-browser, device, and performance QA

1. A Playwright matrix SHALL cover Chromium, Firefox, and WebKit desktop, plus mobile Chromium and
   mobile WebKit.
2. Measured per game: initial bundle size, game load time, physics frame time, render frame time,
   memory, replay size, validation duration.
3. Real-device passes SHALL be run on a mid-range Android and an iPhone.
4. CI SHALL produce a pass/fail table per game per browser against declared budgets and SHALL
   fail the build on regression.
5. Opening one game SHALL NOT fetch another game's assets. A test SHALL assert this.

### R5 — Operations on Railway and Neon

1. Two Railway services (web, worker) plus cron in one project, with private networking.
2. Migrations SHALL be gated in the deploy pipeline.
3. Observability SHALL instrument web, API, worker, and ranking recompute, tagged by `game_id`,
   `game_version`, `season_id`, browser family, device class, and ranked-versus-practice.
4. Metrics SHALL include: game load success rate and duration, attempt starts, completions,
   abandonment rate, verification duration and failure rate, score mismatch rate, personal-best
   improvement rate, submissions per minute, API/database latency, leaderboard recalculation time,
   and errors by game, version, browser, and device.
5. Backups SHALL exist and a restore SHALL be **tested**, not assumed.
6. A rollback runbook SHALL be written and exercised.
7. The Neon production branch autosuspend policy SHALL be an explicit recorded decision.
8. **Accepted gap:** no CDN at launch. Railway is not an asset CDN, and ten games of art and audio
   served from one or two regions will be slow in Asia and South America. Cloudflare's free tier
   in front is a DNS change rather than architectural coupling and also brings Turnstile and DDoS
   protection. Treated as vendor 2.5 when measured. Per-game asset budgets stay tight meanwhile.

### R6 — Internal tournament

1. A complete internal season SHALL run on production systems before any external player sees one.
2. It SHALL exercise: extreme scores, ties, zero scores, disconnects, refresh mid-run, duplicate
   submission, long and malformed replays, expired attempts, background tabs, mobile touch input,
   network failure after finish, worker backlog, and a season ending while a run is active.
3. Every edge case exercised manually SHALL gain an automated regression test afterward.

### R7 — Closed beta

1. A controlled external cohort SHALL be invited.
2. Measured: attempts per player, game popularity, difficulty curves, score distributions,
   leaderboard participation, mobile usability, verification mismatch rate, crash rate, load times,
   abandonment.
3. Analysis SHALL look specifically for games where a small exploit yields disproportionate
   scores.
4. Tuning SHALL happen only through versioned rule changes, never silent edits to an active
   leaderboard.

### R8 — Version freeze and launch

1. Before launch, all competition-affecting values SHALL be frozen: Rapier version and build,
   physics configuration, gravity, collision masks, level geometry, generation rules, scoring
   formulas, game versions, replay format, tournament rules.
2. The rulebook SHALL be published, including tie rules and the championship formula.
3. A known-issues page SHALL be published.
4. Only critical fixes SHALL ship after freeze.

---

## Launch quality bar

Adapted from the research's checklist, with the corrections this project adopted.

**Competitive integrity**
- [ ] Client cannot submit an authoritative score
- [ ] Ranked runs require server-issued attempt ids and server-controlled seeds
- [ ] **Every** ranked run is verified server-side by re-simulation
- [ ] Duplicate submissions rejected
- [ ] Game, simulation, scoring versions and Rapier build all pinned per season
- [ ] Tie rules and the championship formula published

**Game stability**
- [ ] All ten games pass deterministic replay tests across all four runtimes
- [ ] All ten work on supported desktop and mobile browsers
- [ ] Game load failure rate below threshold
- [ ] No known leaderboard-breaking exploit

**Platform**
- [ ] Accounts reliable; personal bests persist correctly
- [ ] Per-game and championship rankings accurate
- [ ] Every leaderboard rebuildable from `verified_results`
- [ ] Replay storage functioning; backups tested by restore

**Operations**
- [ ] Error, API, verification, and leaderboard metrics live
- [ ] Alerting configured
- [ ] Rollback documented and exercised

---

## Definition of done

- [ ] `pnpm assets:build` reproduces the full art and audio set from committed inputs
- [ ] Network test proves zero runtime AI-service calls during gameplay
- [ ] Provenance ledger complete for every shipped asset; brand marks human-authored
- [ ] `InputSource` seam tested from three sources; ADR written; no netcode built
- [ ] Adversarial suite green; a report flows through the moderation queue with an audit trail
- [ ] GDPR export and deletion working, with competitive history preserved anonymised
- [ ] CI device/browser matrix green against per-game budgets
- [ ] A deliberately broken deploy detected and rolled back
- [ ] A Neon point-in-time restore into a staging branch, followed by a full leaderboard rebuild
      from `verified_results`, matching production
- [ ] A complete internal season run end to end, producing an immutable final snapshot
- [ ] Closed beta metrics reviewed; version freeze applied; rulebook published
