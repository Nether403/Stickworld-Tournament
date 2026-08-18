# Stickworld Tournament Research Notes

## Client engine and physics findings

- **Phaser + Matter** is a strong fit for a 2D stickman platform: Phaser documents that its bundled Matter integration supports full-body physics, complex body shapes, constraints, joints, rigid-body dynamics, and collision detection. These are directly useful for grapples, ragdolls, launchers, vehicles, and obstacle courses. Source: https://docs.phaser.io/phaser/concepts/physics/matter
- **Planck.js** is a JavaScript/TypeScript rewrite of Box2D intended for cross-platform HTML5 game development. It is a viable lower-level alternative when simulation control and determinism matter more than the complete Phaser scene/input/asset stack. Source: https://piqnt.github.io/planck.js/docs/
- **Babylon.js + Havok** is a capable WebAssembly-backed 3D physics option, but adds initialisation and device-support considerations; Babylon notes that Havok requires WebAssembly SIMD, unavailable on iOS prior to 16.4. It is therefore not the recommended launch baseline for a primarily 2D stickman collection, but can be retained for a later 3D mode. Source: https://doc.babylonjs.com/features/featuresDeepDive/physics/havokPlugin

## Preliminary decision direction

Use a 2D-first Phaser 3 + Matter stack for the shared game shell. Avoid building ten independent frontend applications. Use a platform package that owns boot, controls, accessibility, telemetry, attempt lifecycle, versioning, and score-submission contracts. Each game should provide a small implementation of that contract.

## Research streams

1. Tournament-suitable game mechanics and transparent scoring.
2. Browser game engine and browser-performance stack.
3. Identity, score storage, ranking semantics, anti-cheat, and launch process.

## Leaderboard, identity, and data-protection findings

- **PostgreSQL** has built-in `rank`, `dense_rank`, `row_number`, and `percent_rank` window functions. The ranking functions give identical outputs to peer rows, letting the platform explicitly choose either competition ranks with gaps (`rank`) or gap-free ranks (`dense_rank`). Source: https://www.postgresql.org/docs/current/functions-window.html
- **Supabase Auth** provides passwordless, password, OTP, and social sign-in options, uses JWTs, and integrates authentication with database authorization. Source: https://supabase.com/docs/guides/auth
- **Supabase** offers a full PostgreSQL database as the base for Auth, Storage, Realtime, and Edge Functions. This is a pragmatic early-stage managed-stack option for a small team while preserving PostgreSQL portability. Source: https://supabase.com/docs/guides/database/overview
- Its RLS documentation warns that exposed-schema tables must enable RLS, and that server/service keys which bypass RLS must never reach browsers. This supports the architecture decision that raw attempt inserts and authoritative score promotion must go through a privileged server endpoint rather than a client-writable score table. Source: https://supabase.com/docs/guides/database/postgres/row-level-security

## Architecture direction

Use PostgreSQL for authoritative tournament data. Expose public, read-only leaderboard views; do not permit browsers to insert or update accepted score rows. A server-side score-validation endpoint owns score acceptance, attempt rate limits, anti-replay checks, game-version validation, and transactional updates to the player’s best result. Create rankings dynamically or through materialized snapshots using PostgreSQL window functions, with clear tie-breaker rules.

## Competitive-integrity findings

OWASP states that client-side validation can be bypassed and that validation must be implemented on the server before data is processed. For score handling, this means a browser-reported score is evidence to evaluate, never an authoritative fact. Source: https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html

The OWASP Game Security Framework identifies the client/server boundary as a core trust boundary. It recommends that a server not implicitly trust client data, and describes authoritative-server design and layered protections as the response to game-state manipulation and automation. For a launch scope of asynchronous single-player games, full real-time server simulation is usually disproportionate; the platform should instead use a progressively stronger evidence model: server-issued attempt token and seed, constrained score envelope and duration validation, one-time replay protection, telemetry anomaly flags, and mandatory replay/event-log verification for record scores. Source: https://owasp.org/www-project-gamesec-framework/OGSF

Cloudflare Turnstile is a non-CAPTCHA visitor-verification option that can be embedded independently of Cloudflare’s CDN; its managed mode adapts whether it displays a checkbox. It is optional at score submission or flagged-account challenges, not a replacement for server-side validation. Source: https://developers.cloudflare.com/turnstile/

## Codebase and quality findings

pnpm has built-in workspace support for multi-package repositories, with a root `pnpm-workspace.yaml` and `workspace:` protocol that prevents accidental resolution of a shared internal package from the public registry. This supports a monorepo where the platform and ten games share stable internal packages. Source: https://pnpm.io/workspaces

Turborepo is an optional task orchestrator that schedules monorepo tasks and can cache task results; add it once parallel CI builds become material rather than as a launch prerequisite. Source: https://turborepo.dev/docs

Playwright recommends testing user-visible behavior, isolating tests and their data, using resilient user-facing locators, and testing browser coverage in CI. For Stickworld, pair it with deterministic-seed game simulations and score-submission contract tests, so a failed run is reproducible and games have launch gates beyond manual playtesting. Source: https://playwright.dev/docs/best-practices

