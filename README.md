# Stickworld Tournament

A browser-based competitive platform for original single-player stickman
physics games. Scores are trusted only when the server recomputes them from
recorded inputs.

## Spec 1 (current)

Deterministic simulation and replay core. Authoritative documents:

- [`docs/competitive-spec.md`](docs/competitive-spec.md) — competition rules
- [`.kiro/specs/01-simulation-replay-core/`](.kiro/specs/01-simulation-replay-core/) — implementation spec

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
```

Test Chamber (the permanent contract game) is `@stickworld/game-test-chamber`.
Its reusable checks live at `@stickworld/game-test-chamber/contract-suite`.

## Secrets

Never commit anything under `Credentials/`, any `.env` file, or a GCP service
account key. Railway and Neon environment variables are the only place secrets
belong. A CI test fails the build if a matching path is tracked by git.
