# Stickworld Tournament: Platform Recommendation and Development Roadmap

**Prepared for:** Stickworld Tournament  
**Prepared by:** Manus AI  
**Date:** 18 August 2026

## Executive recommendation

Stickworld Tournament should launch as a **2D-first, asynchronous competitive platform**: players complete short, repeatable skill runs in ten distinct stickman physics games; each game has its own seasonal leaderboard, while one **overall championship table** converts per-game performance into comparable points. The important product decision is to treat the platform—not the ten games—as the primary software product. Each game should plug into a shared attempt, scoring, ranking, replay, telemetry, and identity contract.

The recommended launch stack is **TypeScript throughout**, with a **React/Next.js platform shell**, **Phaser 3 with its bundled Matter physics system** for the individual 2D games, a **PostgreSQL-based backend** hosted through Supabase, and a small server-side API layer for issuing attempts and accepting verified results. Phaser’s Matter integration is designed for full-body physics, constraints, joints, complex shapes, collision detection, and rigid-body dynamics—precisely the primitives needed for grapples, ragdolls, bounce surfaces, projectiles, bikes, and destructible-object interactions.[1] PostgreSQL should be the source of truth for scores and rankings because its native window functions explicitly support `rank`, `dense_rank`, and `percent_rank` semantics.[2]

> **Design principle:** A player’s browser may render and simulate the game, but it must never be trusted to create an accepted tournament score by itself. The server owns the attempt lifecycle and decides whether a result becomes leaderboard-eligible.[3] [4]

| Decision area | Launch recommendation | Why it is the right default |
|---|---|---|
| Product format | Seasonal, asynchronous, high-score competition | It supports global participation without real-time multiplayer infrastructure. |
| Game style | Short 2D physics skill games, approximately 60–180 seconds per run | Fast retry loops create a clear improvement cycle and fit desktop and mobile browsers. |
| Client game engine | Phaser 3 + Matter, TypeScript | It delivers a mature 2D scene/input/asset stack plus the physics needed for stickman mechanics.[1] |
| Platform shell | Next.js + React + TypeScript | It is well suited to account pages, game discovery, leaderboards, profiles, and server-side routes. |
| Tournament backend | PostgreSQL, Supabase Auth/Storage/Realtime, server-side score API | It concentrates identity, durable relational data, access control, and real-time updates in a portable Postgres foundation.[5] [6] |
| Overall champion metric | Sum of normalized per-game tournament points, not raw scores | Raw scores across unlike games are not comparable. |
| Integrity model | Server-issued attempt token + validation + replay/event proof for elite scores | It is proportionate to asynchronous browser competition and can become stricter as prizes or stakes increase. |

## 1. The tournament design rules that should govern every game

The ten launch games should feel different, but they must obey the same competitive contract. Every game needs a simple control vocabulary, a finish state that cannot be ambiguous, an understandable score breakdown, a bounded run length, and a way to reject impossible results. A tournament game should reward repeatable skill rather than hidden randomness, device-specific performance, or grinding many hours for incremental advantage.

For a launch roster, use a fixed **seasonal ruleset** for every game: a published game version, one or more server-issued daily/weekly seeds, a maximum attempt duration, a defined score ceiling or score-envelope model, and a visible tiebreak rule. Players should know why they are ranked where they are. New maps, balance adjustments, and scoring changes should enter as a new game version or a new season; never silently alter an active leaderboard.

| Criterion | Required standard | Practical implementation |
|---|---|---|
| Learnability | Understandable within one practice run | Limit the core input to tap/click, hold/release, arrows/WASD, or a small combination. |
| Skill expression | Mastery grows through timing, trajectory, route choice, and risk management | Give players combos, optional lines, precision bonuses, and recoverable mistakes. |
| Tournament fairness | Equivalent challenge for comparable attempts | Use a server-issued seed and version; provide practice mode separately from ranked mode. |
| Run duration | Ranked attempt normally lasts 1–3 minutes | Use a hard timeout and predictable restart. |
| Score legibility | Players can explain a high score | Display base score, multipliers, bonuses, penalties, and tie-breaking statistics. |
| Mobile feasibility | Touch controls are not an afterthought | Offer touch-first controls, safe-area layout, and avoid pixel-perfect cursor-only inputs. |
| Verification potential | Score can be checked from inputs and events | Use fixed-timestep simulation where feasible and a structured event log for scoring. |

## 2. Recommended ten-game launch roster

The following roster deliberately distributes physics archetypes. It prevents the platform from feeling like ten variations of a single runner while keeping all games inside a shared 2D stickman art, audio, input, and competitive framework. The names are working titles; perform normal brand and trademark review before public use.

| # | Working title | Core mechanics | Ranked score | Why it suits the tournament model |
|---:|---|---|---|---|
| 1 | **Skyhook Ascent** | The stickman auto-swings from anchor points. Players hold to attach a grappling line and release at the correct momentum to gain height, pass gates, and avoid hazards. | Highest altitude, gate-combo points, then fastest completion time as a tiebreaker. | One-button timing is immediately learnable but has deep trajectory mastery. Fixed anchor layouts make scores highly comparable. |
| 2 | **Rail Rush** | An auto-running stickman jumps, slides, wall-kicks, and vaults through a changing obstacle course. Speed rises in controlled stages. | Distance plus clean-chain multiplier and collectible-route bonuses. | Endless or fixed-duration runs create short repeatable sessions. The score envelope is easy to validate from distance, collisions, and pickups. |
| 3 | **Stickbike Trials** | A stickman rides a physics bike across ramps, seesaws, loose crates, and terrain. Players throttle, brake, and lean to preserve momentum and land tricks. | Checkpoint distance, stunt value, clean-land bonuses, and time. | Vehicle-body balance creates compelling physics skill without real-time opponents. A seeded course enables direct leaderboard comparison. |
| 4 | **Cannon Crash Course** | Players set angle and power to launch a ragdoll stickman through bumpers, targets, breakable objects, and score gates, with a limited mid-air nudge. | Destruction value, target-chain multiplier, and remaining launch attempts. | Aim-and-release physics is readable in spectator replays. Limited shots prevent grinding inside a run and make each choice meaningful. |
| 5 | **Rooftop Rebound** | The stickman drops through a vertical city of trampolines, awnings, fans, and breakable platforms, steering in the air to build a bounce chain. | Depth reached, consecutive-bounce multiplier, precision ring bonuses. | A vertical endless format makes a natural high-score chase. Riskier narrow rebounds create memorable leaderboard moments. |
| 6 | **Arrow Arc Arena** | A stickman archer draws, aims, and releases arrows into moving targets, rope switches, ricochet plates, and timed bonus windows. | Target points multiplied by accuracy streak, with speed as a tiebreaker. | Projectile rules are bounded and easy to audit. The game gives players a precision-focused alternative to movement-heavy titles. |
| 7 | **Jetpack Junction** | A stickman uses short bursts of thrust to thread industrial tunnels, rescue floating tokens, and land on tiny pads while conserving fuel. | Distance, rescue-value multiplier, fuel efficiency, and clean landings. | Thrust control is accessible on touch screens yet exposes subtle momentum and resource-management skill. |
| 8 | **Avalanche Air** | The stickman snowboards or skis downhill, choosing safe lines or large jumps. In the air, players rotate, grab, and stabilize for clean landings. | Route distance, trick-combo score, and avalanche-escape bonus. | The game combines route planning with ragdoll consequences. Generated but seeded terrain can refresh each season without sacrificing fairness. |
| 9 | **Cratefall Constructor** | Players drop, push, and hook physics crates to build a rapidly rising escape path for the stickman. Unstable constructions may collapse but can produce combo bonuses. | Height survived, structure-stability bonus, and efficient-use bonus. | It broadens the roster beyond reflex games and rewards planning. Short, fixed piece sequences make attempts replayable and verifiable. |
| 10 | **Pinball Pitman** | The stickman is the ball in a kinetic pinball arena: players use launch timing, air nudges, and limited flipper-like kick pads to sustain runs and trigger modes. | Pinball-style target points, mode multipliers, and survival time. | It provides highly watchable score runs with rapid feedback and a strong “one more attempt” loop, while reusing bumper and collision technology. |

The first three production games should be **Skyhook Ascent**, **Rail Rush**, and **Arrow Arc Arena**. Together they validate the most important platform assumptions: constrained-body physics and grappling; a high-frequency endless score loop; and a concise projectile-scoring loop. Once those three share the same attempt and score-submission contract, the remaining seven can be built as production waves rather than independent experiments.

### Game design guardrails

Avoid launching with games whose scores depend heavily on uncontrolled floating-point divergence, network latency, exact display refresh rate, or a random map that was not allocated by the platform. Do not make a game’s score depend on visual cosmetics, paid boosts, or device performance. If monetization is introduced later, restrict it to cosmetics, season passes that do not affect ranked play, or non-ranked content.

A 3D route remains possible, but it is not recommended for the first release. Babylon.js with Havok is a credible future path for a small number of 3D physics experiences; however, its Havok integration is a WebAssembly module and Babylon documents a WebAssembly SIMD requirement that excludes iOS versions prior to 16.4.[7] A 2D Phaser-first launch has materially lower device, performance, asset, and verification risk.

## 3. Platform architecture and technology stack

The platform should have four logical layers: the player-facing application; a modular game runtime; an authoritative tournament service; and managed data/observability services. The frontend loads each game as a route-level module inside a common shell, while the backend handles identity, attempt issuance, score promotion, rankings, moderation, and audit data. This preserves a seamless player experience without forcing all ten games into one large, tightly coupled codebase.

![Stickworld Tournament architecture](https://private-us-east-1.manuscdn.com/sessionFile/JHLcQqWVJ4XiTukpKxwetD/sandbox/8ypgSTElkSVKqqDLQWlsyB-images_1787051065678_na1fn_L2hvbWUvdWJ1bnR1L3N0aWNrd29ybGRfYXJjaGl0ZWN0dXJl.png?Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvSkhMY1FxV1ZKNFhpVHVrcEt4d2V0RC9zYW5kYm94Lzh5cGdTVEVsa1NWS3FxRExRV2xzeUItaW1hZ2VzXzE3ODcwNTEwNjU2NzhfbmExZm5fTDJodmJXVXZkV0oxYm5SMUwzTjBhV05yZDI5eWJHUmZZWEpqYUdsMFpXTjBkWEpsLnBuZyIsIkNvbmRpdGlvbiI6eyJEYXRlTGVzc1RoYW4iOnsiQVdTOkVwb2NoVGltZSI6MTc4OTQzMDQwMH19fV19&Key-Pair-Id=K2QY5QTL8JSY6C&Signature=MEUCIBaZUyNIyOpTTEmuybSt~-ZOCdrIUZUXxyCF5BGx1rXTAiEA-5wIJXJQTvOaAC538nPSwSRqNNYxwjq~Ipiw7cpr6Gw_)

| Layer | Recommended technologies | Responsibilities |
|---|---|---|
| Platform UI | **Next.js, React, TypeScript, Tailwind CSS** | Landing pages, authentication flow, profiles, game catalogue, rankings, season rules, responsive navigation, and accessible UI. |
| Game runtime | **Phaser 3 + Matter**, TypeScript, Web Audio API | Canvas rendering, input, physics scenes, animations, sound, fixed-step game loop, local practice mode, and serialized run events. Phaser’s Matter mode supports constraints and full-body physics beyond simple rectangle/circle collisions.[1] |
| Shared game SDK | Internal TypeScript package | `startAttempt`, seeded RNG, input abstraction, timer, score event schema, pause/visibility policy, telemetry hooks, submission client, and game-version metadata. |
| Application API | Next.js Route Handlers or a small Fastify service, Zod validation | Session-aware endpoints for attempt creation, score submission, leaderboard reads, profile updates, moderation actions, and admin tools. |
| Identity | **Supabase Auth** | Magic link, email/password, OTP, and social sign-in can be supported through a single authentication layer.[6] Start with email magic link plus Google/Discord if those fit the audience. |
| Primary data | **PostgreSQL** on Supabase | Accounts, seasons, game versions, attempts, score events, best results, ranks, moderation, and audit logs. |
| File/replay storage | Supabase Storage or S3-compatible object storage | Compressed replay input streams, event logs, screenshots or video proofs for record review, and game assets. |
| Read performance | PostgreSQL indexes, cached leaderboard endpoint, optional Redis later | Serve top leaderboard pages fast while preserving the database as the source of truth. |
| Delivery and protection | CDN-hosted static assets; serverless hosting; HTTPS; rate limits; optional Turnstile | Fast game delivery, API abuse controls, security headers, and bot friction. Turnstile is a non-CAPTCHA visitor-verification option, but it complements rather than replaces result validation.[8] |
| Quality and operations | Sentry or equivalent, product analytics, structured audit events, OpenTelemetry-compatible traces | Detect failed game loads, score anomalies, client errors, latency, and ranking regressions. |

### Why Phaser + Matter is the preferred launch engine

Phaser should be selected over building directly on a low-level physics library because the platform is shipping a collection of games, not a single custom simulator. Phaser provides the common game concerns—scenes, input, scale management, assets, animation, audio integration—while Matter supplies the richer physical behaviours needed by the roster. Matter is not the only feasible choice: Planck.js is a JavaScript/TypeScript Box2D rewrite and is attractive where a team wants lower-level control of a 2D rigid-body simulation.[9] It is best held as a specialist option for a later game rather than creating two physics stacks at launch.

### Recommended repository structure

Use a single **pnpm workspace monorepo**, not ten repositories or ten standalone websites. pnpm has native workspace support and its `workspace:` protocol can guarantee that internal package dependencies resolve locally rather than accidentally from the public registry.[10] Add Turborepo when build and test volume justifies cached task orchestration; it can be introduced incrementally.[11]

```text
stickworld-tournament/
├── apps/
│   ├── web/                         # Next.js platform shell and server routes
│   └── verifier/                    # optional headless replay-verification worker
├── games/
│   ├── skyhook-ascent/
│   ├── rail-rush/
│   ├── stickbike-trials/
│   ├── cannon-crash-course/
│   ├── rooftop-rebound/
│   ├── arrow-arc-arena/
│   ├── jetpack-junction/
│   ├── avalanche-air/
│   ├── cratefall-constructor/
│   └── pinball-pitman/
├── packages/
│   ├── game-sdk/                    # required interface and attempt lifecycle
│   ├── physics-kit/                 # shared bodies, collision groups, fixed-step helpers
│   ├── scoring/                     # score events and deterministic aggregation
│   ├── ui/                          # shared React components and design tokens
│   ├── api-contract/                # Zod schemas and generated types
│   └── config/                      # lint, TypeScript, test and build configuration
├── supabase/
│   ├── migrations/
│   ├── functions/
│   └── tests/
├── docs/                            # rules, scoring, game specs, runbooks
└── e2e/                             # Playwright user journeys and leaderboard tests
```

Every game module should export the same small contract. The platform owns authentication, ranked-attempt requests, display state, and accepted-score UI; a game owns its scene, controls, deterministic seed interpretation, scoring events, and replay serialization. This isolation prevents a change in one game from breaking every other game or duplicating tournament logic ten times.

```ts
export interface TournamentGame {
  readonly metadata: {
    id: string;
    version: string;
    rankedMode: "seeded" | "daily" | "fixed-course";
    maxRunMs: number;
  };
  createRun(context: RankedAttemptContext): GameRun;
}

export interface GameRun {
  start(): void;
  pause(): void;
  dispose(): void;
  serializeResult(): {
    score: number;
    scoreBreakdown: ScoreEvent[];
    inputTrace: InputEvent[];
    elapsedMs: number;
  };
}
```

## 4. Tournament data model, ranking rules, and score acceptance

The data model should distinguish an **attempt** from a player’s **best result**. Keeping every accepted and rejected attempt is important for auditability, cheating investigations, analytics, and future balance work. A separate best-result table or materialized view makes leaderboard reads inexpensive.

| Core entity | Purpose | Essential fields |
|---|---|---|
| `profiles` | Public player identity | `user_id`, `handle`, `avatar_url`, moderation status. |
| `seasons` | Immutable tournament window | `id`, `name`, `starts_at`, `ends_at`, status, published rules version. |
| `games` | Stable game identity | `id`, display metadata, control category, launch status. |
| `game_versions` | Reproducible rule/asset bundle | `id`, `game_id`, semantic version, build hash, scoring schema, status. |
| `season_games` | Defines eligible game version and rules per season | `season_id`, `game_version_id`, seed policy, rank weight, active dates. |
| `attempts` | Server-issued ranked run | `id`, `user_id`, `season_game_id`, seed, nonce, starts/expires timestamps, state. |
| `score_submissions` | Client result and server decision | `attempt_id`, claimed score, elapsed time, event digest, replay URI, validation state/reason. |
| `verified_results` | Accepted leaderboard-eligible outcome | `user_id`, `season_game_id`, score, tie metrics, achieved_at, verification tier. |
| `game_bests` | Best verified result per player and game | `season_game_id`, `user_id`, `verified_result_id`, score. |
| `ranking_snapshots` | Cached/public rank read model | `season_id`, scope, subject id, rank, points, calculated_at. |
| `audit_events` | Security and admin traceability | actor, action, target, request metadata, timestamp. |

### Individual game ranking

For a given season and game, leaderboard eligibility is limited to a player’s best **verified** result. Rank players by descending score, then by the game-specific published tiebreakers. A sensible default is: **higher score**, then **better precision metric** (such as accuracy, landing quality, or fewer collisions), then **earlier verified completion time**, then a stable internal identifier solely for display ordering. Use SQL `RANK()` when genuinely tied players should share a displayed place, because it assigns the same rank to peer rows and leaves a gap after the tie; use `DENSE_RANK()` only if gap-free public positions are desired.[2]

```sql
select
  user_id,
  score,
  rank() over (
    partition by season_game_id
    order by score desc, precision_metric desc, achieved_at asc
  ) as game_rank
from game_bests
where season_game_id = $1;
```

### Overall ranking: normalize first, then sum points

**Do not sum raw game scores.** A 200,000-point pinball score and a 2,000-metre runner score do not represent the same accomplishment. Instead, calculate standing points from each player’s per-game percentile or placement, then sum the ten resulting values.

The recommended initial system is a percentile-based model. For each game leaderboard, calculate `percent_rank` with score and published tiebreakers. Assign `game_points = ROUND(1000 × (1 − percent_rank))`, which gives the winner 1,000 points and maps the field to a 0–1,000 range. A player who does not record a verified result in a game receives zero. The overall total is the sum over all ten games, for a maximum of 10,000 points. PostgreSQL explicitly provides `percent_rank` alongside its rank functions.[2]

| Overall rule | Recommended policy | Reason |
|---|---|---|
| Points per game | 0–1,000 normalized points | Each game contributes equally despite unlike score scales. |
| Participation | All ten games count; no “best 8 of 10” at launch | It rewards broad mastery and makes the championship identity clear. |
| Weighting | Equal weights at launch | Avoids an opaque hierarchy among launch games. Add weights only after measured evidence and public notice. |
| Overall tiebreak 1 | Greater number of game wins | Rewards exceptional first-place performance. |
| Overall tiebreak 2 | Higher median normalized game result | Rewards consistent strength across the roster. |
| Overall tiebreak 3 | Earliest achievement of the final total | Deterministic final resolution without subjective review. |
| Visibility | Recalculate after score acceptance; cache 15–60 seconds | Feels live without making rank snapshots the source of truth. |

At launch scale, PostgreSQL views and disciplined indexes are enough. Index accepted results by `(season_game_id, score DESC, achieved_at ASC)` and game bests by `(season_game_id, user_id)`. As participation rises, compute a materialized public snapshot after score promotion, cache the top 100 and “my rank” queries, and maintain historical final-season snapshots rather than recomputing closed tournaments.

### Score acceptance and anti-cheat model

A web game cannot make browser code fully trusted. OWASP states that JavaScript client-side validation can be bypassed and that validation must be implemented on the server before the application processes data.[3] The OWASP Game Security Framework likewise treats the game client as an untrusted side of a core trust boundary and recommends an authoritative, layered approach.[4] For Stickworld’s asynchronous high-score format, the aim is not to simulate every frame server-side at launch; it is to ensure that impossible or manipulated scores cannot become trusted standings.

| Stage | Server action | Result |
|---|---|---|
| 1. Start ranked attempt | Authenticate user; issue single-use `attempt_id`, nonce, game version, seed, expiry, and rules hash. | The run is bound to a defined competitive context. |
| 2. Play locally | The browser simulates the game using a fixed timestep, records normalized inputs and scoring events, and prevents ranked pause/background abuse. | Smooth gameplay without a network round trip per input. |
| 3. Submit result | Validate schema, session, token expiry, game build, one-time nonce, elapsed-time bounds, score envelope, and request rate. | Obvious forged or replayed submissions are rejected early. |
| 4. Promote provisionally | Store an immutable raw submission; atomically update the player’s best only if the score is valid and better. | Leaderboards are consistent and auditable. |
| 5. Verify elite results | Automatically replay the input trace in a fixed engine/build environment; check event sequence and score aggregation. Flag outliers for moderation. | Record scores receive a higher verification tier before prizes or highlights. |
| 6. Enforce | Hold, remove, or reverse invalid results; preserve audit evidence and show a clear status to the player. | Competitive trust survives enforcement. |

Do not rely on a client-side secret, obfuscation, or a signed browser payload as the integrity mechanism: an attacker controls the browser and can inspect or alter it. A short-lived server token prevents simple replay of an attempt but does not prove that input events were honestly produced. Build games so their ranked score can be rederived from a deterministic or tightly constrained input/event trace. For the few physics games where exact cross-device replay is not sufficiently stable, use a fixed browser/runtime verifier for top scores and mark results as **provisional** until verified rather than falsely claiming perfect determinism.

## 5. Step-by-step development roadmap

The roadmap is intentionally platform-first. A feature-complete game that cannot safely submit, explain, and rank its score is not a tournament game. Each phase has a concrete exit condition so the project does not become ten disconnected mini-games.

| Phase | Main work | Deliverables and launch gate |
|---|---|---|
| 0. Tournament specification | Define season duration, scoring policy, age/geography policy if applicable, data retention, player conduct, ranked-vs-practice rules, game-version policy, and rewards policy. | A written tournament rulebook and a one-page score/tie specification approved before coding. |
| 1. Foundation | Create the TypeScript pnpm monorepo; configure linting, formatting, unit tests, end-to-end tests, CI, environments, error reporting, and feature flags. | A protected main branch with reproducible local setup and CI checks on every pull request. |
| 2. Core platform | Build responsive Next.js shell, account onboarding, profile/handle flow, game catalogue, season hub, public leaderboards, and admin roles. | A user can sign in, browse a placeholder season, and see a stable empty leaderboard. |
| 3. Tournament services | Implement database migrations, RLS policies, attempt issuance, score-submission API, moderation audit trail, game/version registry, and ranking views. | API contract tests show that a score can be accepted, rejected, replaced by a better personal best, and reflected in rankings. |
| 4. Golden vertical slice | Build **Skyhook Ascent** as the reference game. Implement ranked and practice modes, seeded input, score breakdown, replay trace, restart flow, mobile controls, and result screen. | A player can complete a verified ranked run from sign-in to leaderboard with no manual database intervention. |
| 5. Game SDK hardening | Extract only proven code from the vertical slice into `game-sdk`, `physics-kit`, scoring schemas, shared HUD components, and asset/audio conventions. | A documented game integration checklist and a small sample game can plug into the platform in days, not weeks. |
| 6. Production waves | Build games 2–4, then 5–7, then 8–10. Each game receives a short design specification, fixed score contract, accessibility review, seed strategy, test fixtures, and playtest review before integration. | Each wave passes the same ranked-attempt, replay, performance, and browser test suite. |
| 7. Integrity, QA, and content completion | Test malformed submissions, duplicate token attempts, out-of-range scores, rate limits, browser refresh/background behavior, leaderboard ties, game-version migrations, and moderation reversals. Run device/browser performance tests and accessibility passes. | No critical security or ranking defects; every launch game meets performance and restart-time budgets. |
| 8. Closed beta and tuning | Invite a controlled cohort. Observe funnel drop-off, crash/error rates, score distributions, suspicious result rates, game completion rate, input-device disparity, and leaderboard concentration. Tune only through versioned rules. | Evidence supports fair score ranges and acceptable reliability before public season start. |
| 9. Launch operations | Freeze launch versions, publish rules, enable status monitoring and incident playbooks, schedule leaderboard backups, run support/moderation rotations, and release a public known-issues page. | Season 1 opens with tested rollback, suspension, and result-correction procedures. |

### Recommended game production sequence

The rollout should optimise for learning rather than visual variety alone. First build the reference game and platform slice. Next add games with different scoring patterns to test the shared contract. Then complete the portfolio in risk-balanced waves.

| Wave | Games | Capability being proven |
|---|---|---|
| Reference | Skyhook Ascent | Grapple constraints, seeded route, altitude scoring, core replay approach. |
| Wave A | Rail Rush; Arrow Arc Arena | Endless-run scoring and projectile precision scoring. |
| Wave B | Stickbike Trials; Cannon Crash Course; Rooftop Rebound | Vehicles, ragdolls, destructibles, launch and bounce chains. |
| Wave C | Jetpack Junction; Avalanche Air; Cratefall Constructor; Pinball Pitman | Resource control, generated terrain, construction stability, dense collision systems. |

### Quality gates for every game

Each game should pass the same non-negotiable checklist: a design specification; a frozen ranked scoring formula; deterministic seed fixtures; unit tests for every score event; a replay fixture for a known high score; an end-to-end test from start attempt to leaderboard; desktop and touch control tests; a 60 Hz and lower-end-device performance test; a pause/visibility/network-interruption policy; telemetry events; and an accessible instructions screen. Playwright’s guidance to test user-visible behavior, isolate test data, and run browser coverage in CI is especially relevant for the platform UI and ranked-attempt flows.[12]

## 6. Key launch risks and mitigations

The largest product risk is not building a game that is fun in isolation; it is building a score competition that players perceive as unfair. Address fairness in rules, data architecture, and operations from the first prototype.

| Risk | Consequence | Mitigation |
|---|---|---|
| Client-side score tampering | Leaderboard credibility collapses | Server-issued attempts, validation, immutable submissions, replay/event verification, anomaly flags, and moderation tools. |
| Physics inconsistency across devices | High-score disputes and failed replays | Fixed timestep; constrained physics; versioned engine/build; record verification in a controlled browser environment; avoid frame-rate-based scoring. |
| Unbalanced score scales | One game dominates the overall table | Normalize per-game placement into points; analyse distributions during beta; announce all rule changes by season. |
| Ten unique implementations drift apart | Slow development and regression cascades | Shared game SDK, scoring schemas, UI components, and a mandatory integration checklist. |
| Broad mobile support breaks gameplay | Large audience segment cannot compete | Design touch controls first, use responsive canvas scaling, test on representative devices, and avoid hover-only mechanics. |
| Fragile live rankings | Confusing or stale standings | Use transactional best-score promotion, explicit cache freshness, immutable final-season snapshots, and ranking regression tests. |
| Scope overrun | Delayed launch with inconsistent quality | Build one gold-standard game, prove the platform, then ship in waves under shared gates. |

## 7. Immediate next actions

First, write the Season 1 tournament rules and choose whether its ranked format is fixed-course, daily-seeded, or weekly-seeded for each game. Second, create the monorepo and implement the database/API contract before investing in all ten games. Third, build Skyhook Ascent as a complete vertical slice with both practice and ranked modes. Only after its leaderboard, replay evidence, error reporting, and mobile controls work end-to-end should the team extract the shared SDK and accelerate the rest of the roster.

This order turns Stickworld Tournament from a collection of browser games into a defensible, extensible competitive platform. It also leaves clear future paths: daily challenges, friend leagues, featured replays, creator tournaments, cosmetics, and—only if justified by demand—selective 3D or synchronous modes.

## References

[1]: https://docs.phaser.io/phaser/concepts/physics/matter "Phaser documentation: Matter Physics"
[2]: https://www.postgresql.org/docs/current/functions-window.html "PostgreSQL documentation: Window Functions"
[3]: https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html "OWASP Cheat Sheet Series: Input Validation"
[4]: https://owasp.org/www-project-gamesec-framework/OGSF "OWASP Game Security Framework"
[5]: https://supabase.com/docs/guides/database/overview "Supabase documentation: Database"
[6]: https://supabase.com/docs/guides/auth "Supabase documentation: Auth"
[7]: https://doc.babylonjs.com/features/featuresDeepDive/physics/havokPlugin "Babylon.js documentation: Using Havok and the Havok Plugin"
[8]: https://developers.cloudflare.com/turnstile/ "Cloudflare documentation: Turnstile"
[9]: https://piqnt.github.io/planck.js/docs/ "Planck.js documentation"
[10]: https://pnpm.io/workspaces "pnpm documentation: Workspace"
[11]: https://turborepo.dev/docs "Turborepo documentation"
[12]: https://playwright.dev/docs/best-practices "Playwright documentation: Best Practices"
