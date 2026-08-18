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

## Secrets

Never commit anything under `Credentials/`, any `.env` file, or a GCP service
account key. Railway and Neon environment variables are the only place secrets
belong. A CI test fails the build if a matching path is tracked by git.
