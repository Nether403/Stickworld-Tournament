# ADR-0003 — xorshift128 (32-bit), not xorshift128+

**Status:** accepted
**Date:** 2026-08-18
**Spec:** 1 / R3

## Decision

The simulation PRNG is the 32-bit xorshift128 family member with four `uint32`
lanes. Operations are `^`, `<<`, `>>>`, and `Math.imul`, with `>>> 0` after
each step. All-zero state is rejected.

This is a recorded deviation from the handoff plan, which named xorshift128+.

## Why not xorshift128+

The `+` scrambler is a 64-bit add. In JavaScript that means `BigInt`. We gain
no extra determinism — both variants are bit-identical given the same
implementation — and we pay in speed on a path that may run per-tick in
procedural generators.

The 32-bit variant is exactly reproducible across every JS runtime we care
about because it never leaves the `uint32` operations ECMAScript specifies.

## Other constraints

- `nextFloat` is `nextUint32() / 2**32`, an exact binary fraction.
- `nextInt(min, maxExclusive)` uses rejection sampling. Modulo bias would
  treat some seeded outcomes as more likely than others, which is a fairness
  bug in course generation.
- Seeds are server-issued. The client never constructs one.
