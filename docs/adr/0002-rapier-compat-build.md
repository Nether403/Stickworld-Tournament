# ADR-0002 — Use `@dimforge/rapier2d-compat`, exact `0.20.0`, non-SIMD

**Status:** accepted
**Date:** 2026-08-18
**Spec:** 1 / R1

## Decision

Depend on `@dimforge/rapier2d-compat@0.20.0` with no version range. Do not
introduce a `-simd` package. Hash the decoded WASM bytes at init and treat a
hash change as competition-affecting.

## Why `-compat`

The `-compat` build inlines WASM as base64 in a single JS module. Browser and
Node therefore load the same bytes, and a bundler cannot quietly substitute a
different `.wasm`. That property is load-bearing for score verification.

Cost: a larger JS payload and `await RAPIER.init()` before use. Accepted.

## Why not SIMD

SIMD builds can differ across runtimes and CPUs. Spec 1 exists to prove
cross-runtime identity; starting on SIMD would mix the thing we are measuring
with a known variance source.

## Why an exact pin

A Rapier bump invalidates historical replays. Renovate/Dependabot must ignore
this package. Upgrades are a versioned competitive change, not maintenance.

## Consequences

- `packages/sim-core` is the only package that may depend on Rapier.
- CI fails if a `-simd` variant appears, or if the version is ranged.
- `RAPIER_BUILD_SHA256` is committed after the first successful init.
