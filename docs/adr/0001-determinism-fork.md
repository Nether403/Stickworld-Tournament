# ADR-0001 — Determinism fork

**Status:** accepted
**Date:** 2026-08-18
**Spec:** 1 / R6, §5

## Decision

**Branch A.** One pinned `@dimforge/rapier2d-compat@0.20.0` non-SIMD build produces
bit-identical `stress-01` state hashes in Node, Chromium, Firefox, and WebKit,
including mobile Chromium and mobile WebKit viewports.

The validation worker in Spec 2 can run this same package headless in Node.
Specs 2–5 do not need a fork revision on the determinism axis.

## Matrix

Fixture: `stress-01` (ragdoll, rope, stack, CCD projectile, kinematic platform,
breakable joint). 10,000 ticks. Hashes at ticks 1, 10, 100, 1,000, 10,000.

Rapier WASM SHA-256:

`9cc0885ce9d3dfb96ef9e95db2c8fdfb355ee8d3c4e5229081605f57cb3c1dbd`

| runtime | t=1 | t=10 | t=100 | t=1000 | t=10000 |
|---|---|---|---|---|---|
| node 22.14.0 | a5d60100eced74df | e549517eaa9db0de | 1f13a985fcccbf35 | 131506cdb4f4d9dc | c4b7707e4f8be9a2 |
| chromium | a5d60100eced74df | e549517eaa9db0de | 1f13a985fcccbf35 | 131506cdb4f4d9dc | c4b7707e4f8be9a2 |
| firefox | a5d60100eced74df | e549517eaa9db0de | 1f13a985fcccbf35 | 131506cdb4f4d9dc | c4b7707e4f8be9a2 |
| webkit | a5d60100eced74df | e549517eaa9db0de | 1f13a985fcccbf35 | 131506cdb4f4d9dc | c4b7707e4f8be9a2 |
| mobile-chromium | a5d60100eced74df | e549517eaa9db0de | 1f13a985fcccbf35 | 131506cdb4f4d9dc | c4b7707e4f8be9a2 |
| mobile-webkit | a5d60100eced74df | e549517eaa9db0de | 1f13a985fcccbf35 | 131506cdb4f4d9dc | c4b7707e4f8be9a2 |

Earliest divergent tick: none.

## Negative control

A variant that drives the kinematic platform with `Math.sin(1e12 + t)` instead
of `detmath.sin` diverges by tick 100. The harness can fail.

## What this does not prove

- Historical Rapier versions, SIMD builds, or a future bump of `0.20.0`.
- Every joint type the ten games might invent later — `stress-01` covers the
  families in the roster, not every parameter combination.
- `detmath` accuracy versus `Math.*` (determinism is the contract; accuracy is
  "good enough and identical").

Golden hashes live in `packages/sim-core/conformance/golden/stress-01.json`.
Regenerating them requires amending this ADR.
