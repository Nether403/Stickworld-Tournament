# Stickworld Tournament

Browser stickman physics games with a championship that only trusts scores the
server can reproduce.

The client never chooses a ranked seed. It records every input that affected
the simulation. A Node worker replays those inputs on the same 60 Hz, fixed-tick
physics and accepts the score only when the result matches. Practice runs are
local and never become ranked scores.

Names in this repository are **working titles** until IP counsel clears them.
The competition is recreational: **age 13+**, **no prizes**.

## Status

This is not a public launch. Specs 1–4 are on `main`. Spec 5 (assets,
integrity, operations, launch gates) is implemented in-repo. Public `season-1`
stays closed until counsel review and trademark searches start — see
[`docs/legal/brand-and-ip-clearance.md`](docs/legal/brand-and-ip-clearance.md).

| In the repository                                            | Still blocked outside the repo                                                      |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| Ten frozen ranked games, verify path, GDPR/moderation routes | Live `internal-0` staff tournament and 24-invite `beta-0`                           |
| Rulebook and competitive spec version 2                      | Counsel review; public `season-1`                                                   |
| Health, telemetry, Railway/Neon runbooks                     | Railway staging rollback demo and live env-key listing                              |
| Cross-browser Playwright projects                            | Real iPhone and Android captures ([`docs/ops/device-qa.md`](docs/ops/device-qa.md)) |

Known product caveats: [`docs/known-issues.md`](docs/known-issues.md).
Gameplay ships **silent** (no announcer VO).

## Games

Nine fixed-course games count toward the championship (max **9,000** points).
Pogo Tower is weekly-only and does not count.

| Game                 | Slug                   | Championship | Contract                                                                   |
| -------------------- | ---------------------- | ------------ | -------------------------------------------------------------------------- |
| Hookline Sprint      | `hookline-sprint`      | Yes          | [`docs/games/hookline-sprint.md`](docs/games/hookline-sprint.md)           |
| Pickaxe Ascent       | `pickaxe-ascent`       | Yes          | [`docs/games/pickaxe-ascent.md`](docs/games/pickaxe-ascent.md)             |
| Launch Lab           | `launch-lab`           | Yes          | [`docs/games/launch-lab.md`](docs/games/launch-lab.md)                     |
| Ragdoll Archery Rush | `ragdoll-archery-rush` | Yes          | [`docs/games/ragdoll-archery-rush.md`](docs/games/ragdoll-archery-rush.md) |
| Hammer Throw Havoc   | `hammer-throw-havoc`   | Yes          | [`docs/games/hammer-throw-havoc.md`](docs/games/hammer-throw-havoc.md)     |
| Pogo Tower           | `pogo-tower`           | Weekly only  | [`docs/games/pogo-tower.md`](docs/games/pogo-tower.md)                     |
| Rooftop Relay        | `rooftop-relay`        | Yes          | [`docs/games/rooftop-relay.md`](docs/games/rooftop-relay.md)               |
| Balance Bike Blitz   | `balance-bike-blitz`   | Yes          | [`docs/games/balance-bike-blitz.md`](docs/games/balance-bike-blitz.md)     |
| Cargo Chaos          | `cargo-chaos`          | Yes          | [`docs/games/cargo-chaos.md`](docs/games/cargo-chaos.md)                   |
| Demolition Dive      | `demolition-dive`      | Yes          | [`docs/games/demolition-dive.md`](docs/games/demolition-dive.md)           |

Local play routes are `/play/<slug>` (practice) and `/play/<slug>?mode=ranked`.

Player-facing rules: [`docs/rulebook.md`](docs/rulebook.md).
Simulation contract (wins until it is version-bumped):
[`docs/competitive-spec.md`](docs/competitive-spec.md).
Per-game frozen contracts live in [`docs/games/`](docs/games/).

Test Chamber (`@stickworld/game-test-chamber`) is the permanent contract game.
It is not in the championship.

## Stack

pnpm workspace, Node **22.14+**, pnpm **10.33.3**.

| Layer           | Pin / choice                                                                                                     |
| --------------- | ---------------------------------------------------------------------------------------------------------------- |
| Web + `/v1` API | Next.js 16.3.1, React 19.2.8                                                                                     |
| Presentation    | Phaser 4.2.1 (view only; it does not step the sim)                                                               |
| Physics         | Rapier `-compat` **0.20.0** (see [`docs/adr/0002-rapier-compat-build.md`](docs/adr/0002-rapier-compat-build.md)) |
| Database        | Neon Postgres, Drizzle, `node-postgres`                                                                          |
| Auth            | Neon Auth (Google OAuth; email signup configured; GitHub deferred)                                               |
| Hosting         | Railway: public `web`, private `worker`, cron from the same repo                                                 |
| E2E             | Playwright 1.62.1 (Chromium, Firefox, WebKit, iPhone 12, Pixel 5)                                                |

Vendors in production are **Neon and Railway only**. No Sentry, Cloudflare,
object store, Resend, or OpenTelemetry.

Determinism is **Branch A**: Node and Playwright browsers agree bit-for-bit on
`stress-01` ([`docs/adr/0001-determinism-fork.md`](docs/adr/0001-determinism-fork.md)).

## Repository layout

```
apps/web          Next.js UI, game host, `/v1` ranked API, `/legal`
apps/worker       Replay verification, ranking cron, season close
packages/         sim-core, replay, platform, db, input, game-host, …
games/            Ten ranked games (one package each)
docs/             Rulebook, ADRs, ops runbooks, legal, asset ledger
.kiro/specs/      Specs 1–5 (requirements, design, tasks)
```

Ranked input flows through `@stickworld/input` (`LocalInputSource`,
`ReplayInputSource`, `ScriptedInputSource`). There is no `NetworkInputSource`;
that seam is reserved ([`docs/adr/0008-pvp-seam.md`](docs/adr/0008-pvp-seam.md)).

## Local development

```bash
pnpm install
cp .env.example .env.local   # fill Neon + attempt HMAC values; never commit
pnpm build
pnpm db:migrate              # uses DATABASE_URL_UNPOOLED
pnpm db:seed                 # CI-shaped season only; not a public launch
pnpm --filter @stickworld/web dev
```

Web listens on [http://127.0.0.1:3000](http://127.0.0.1:3000). Practice pages
work without a ranked session. Ranked play needs a signed-in user, applied
migrations including `0002_spec5_compliance`, and a running worker (after
`pnpm build`):

```bash
pnpm --filter @stickworld/worker start
```

Environment names: [`.env.example`](.env.example). Store real values in
`.env.local` or Railway, never in git. `pnpm db:migrate` uses the **direct**
Neon URL; web, worker, and cron use the **pooled** URL.

Brand SVGs are committed under `apps/web/public/assets/brand/`. Generated
binaries are gitignored:

```bash
pnpm assets:build    # writes assets/generated/
```

Invite-only seasons `internal-0` and `beta-0` are **not** created by
`pnpm db:seed`. Operators use `pnpm --filter @stickworld/db seed:invite-season`
as documented in [`docs/ops/seasons.md`](docs/ops/seasons.md). The helper
rejects `season-1`.

## Tests

```bash
pnpm lint
pnpm typecheck
pnpm build
pnpm test
```

CI also runs those plus asset-ledger, no-runtime-AI, and hashed play-chunk
gates (`.github/workflows/ci.yml`).

Determinism and replay (after `pnpm build`):

```bash
pnpm determinism:node
pnpm determinism:browser
pnpm replay:verify packages/game-test-chamber/fixtures/sample.swr
pnpm replay:verify games/hookline-sprint/fixtures/sample.swr
pnpm replay:verify games/pickaxe-ascent/fixtures/sample.swr
```

Every ranked game ships `games/<slug>/fixtures/sample.swr`. Frozen goldens
must not be regenerated: Hookline `9c52d8f426f31ee1`, Pickaxe
`6b03896db5837763`.

Cross-browser e2e (install browsers first):

```bash
pnpm --filter @stickworld/web exec playwright install --with-deps firefox webkit
pnpm --filter @stickworld/web e2e
```

Schema CI needs GitHub secrets `NEON_API_KEY` and `NEON_PROJECT_ID`. Forks
skip that job when the secrets are absent. Details:
[`packages/db/README.md`](packages/db/README.md).

## Operations

| Topic                                  | Doc                                                            |
| -------------------------------------- | -------------------------------------------------------------- |
| Railway services, health, env names    | [`docs/ops/railway.md`](docs/ops/railway.md)                   |
| Neon connections, autosuspend, migrate | [`docs/ops/neon.md`](docs/ops/neon.md)                         |
| Rollback                               | [`docs/ops/rollback.md`](docs/ops/rollback.md)                 |
| PITR restore drill                     | [`docs/ops/pitr-restore.md`](docs/ops/pitr-restore.md)         |
| Telemetry JSON on stdout               | [`docs/ops/metrics.md`](docs/ops/metrics.md)                   |
| Invite seasons                         | [`docs/ops/seasons.md`](docs/ops/seasons.md)                   |
| CSP / security headers                 | [`docs/ops/security-headers.md`](docs/ops/security-headers.md) |

`GET /v1/health` is the only public healthcheck. Set
`STICKWORLD_TELEMETRY=1` on web, worker, and cron to emit JSON events; unset
keeps telemetry silent. The worker refuses to start if committed migrations
are missing from the database.

Production web release command is `pnpm db:migrate`, then
`pnpm --filter @stickworld/web start`. Do not expose the worker on a public
route.

## Specs and decisions

| Spec                                                                                     | What it locked                                         |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| [1 — simulation / replay](.kiro/specs/01-simulation-replay-core/)                        | Fixed-tick sim, replay format, Branch A determinism    |
| [2 — tournament platform](.kiro/specs/02-tournament-platform-ranking/)                   | Ranked API, Neon, worker verify, standings             |
| [3 — game production kit](.kiro/specs/03-game-production-kit/)                           | GameHost, Hookline, Pickaxe                            |
| [4 — roster](.kiro/specs/04-roster-production/)                                          | Games 3–10                                             |
| [5 — assets, integrity, ops, launch](.kiro/specs/05-assets-integrity-operations-launch/) | Ledger, GDPR, moderation, Railway/Neon ops, legal stop |

Architecture Decision Records: [`docs/adr/`](docs/adr/). Spec 5 launch
contracts: [`docs/adr/0007-spec5-launch-contracts.md`](docs/adr/0007-spec5-launch-contracts.md).

## Secrets

Never commit anything under `Credentials/`, any `.env` file, or a GCP service
account key. Railway and Neon environment variables are the only place secrets
belong. CI fails the build if a matching path is tracked by git.
