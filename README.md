# Stickworld Tournament

A browser-based competitive platform for original single-player stickman
physics games. Scores are trusted only when the server recomputes them from
recorded inputs.

## Baseline (Specs 1–2, on `main`)

- [`docs/competitive-spec.md`](docs/competitive-spec.md) — competition rules
- [`.kiro/specs/01-simulation-replay-core/`](.kiro/specs/01-simulation-replay-core/) — sim/replay
- [`.kiro/specs/02-tournament-platform-ranking/`](.kiro/specs/02-tournament-platform-ranking/) — ranked platform
- [`docs/adr/0001-determinism-fork.md`](docs/adr/0001-determinism-fork.md) — Branch A
- [`docs/adr/0004-spec2-platform-stack.md`](docs/adr/0004-spec2-platform-stack.md) — Neon + Next + Drizzle

## Spec 3 (this branch)

Game production kit, Hookline Sprint, Pickaxe Ascent. Full-depth design at
[`.kiro/specs/03-game-production-kit/`](.kiro/specs/03-game-production-kit/).
Approved and executed 2026-08-18. Presentation decisions:
[`docs/adr/0005-spec3-game-host-and-auth.md`](docs/adr/0005-spec3-game-host-and-auth.md).
Ragdoll is not in this spec — see ADR-0005.

Frozen v1 game contracts: [`docs/games/hookline-sprint.md`](docs/games/hookline-sprint.md),
[`docs/games/pickaxe-ascent.md`](docs/games/pickaxe-ascent.md).

## Setup

Node 22+ and pnpm 10.

```bash
pnpm install
pnpm build
pnpm test
```

`pnpm lint` and `pnpm typecheck` also run in CI.

## Determinism

```bash
pnpm determinism:node
pnpm determinism:browser
```

The fork decision lives in [`docs/adr/0001-determinism-fork.md`](docs/adr/0001-determinism-fork.md).
**Branch A:** Node and the Playwright browsers agree bit-for-bit on `stress-01`.

## Replay

```bash
pnpm build
pnpm replay:verify packages/game-test-chamber/fixtures/sample.swr
pnpm replay:verify games/hookline-sprint/fixtures/sample.swr
pnpm replay:verify games/pickaxe-ascent/fixtures/sample.swr
```

Test Chamber (the permanent contract game) is `@stickworld/game-test-chamber`.
Its reusable checks live at `@stickworld/game-test-chamber/contract-suite`.

## Secrets

Never commit anything under `Credentials/`, any `.env` file, or a GCP service
account key. Railway and Neon environment variables are the only place secrets
belong. A CI test fails the build if a matching path is tracked by git.
