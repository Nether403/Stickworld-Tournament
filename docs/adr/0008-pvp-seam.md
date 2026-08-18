# ADR-0008 — PvP input seam

**Status:** accepted 2026-08-18  
**Spec:** 5  
**Depends on:** ADR-0007

## Context

Local play and replay verification already feed deterministic, quantised inputs
into the same simulation contract. Future authoritative multiplayer must be able
to provide those inputs without coupling room infrastructure to games or replay
encoding.

Spec 5 preserves that option without building multiplayer.

## Decision

`@stickworld/input` owns the `InputSource` interface and the
`LocalInputSource`, `ReplayInputSource`, and `ScriptedInputSource`
implementations. GameHost and replay playback obtain each tick's inputs through
that interface before applying them in deterministic action order.

A future authoritative-room design would add:

- room lifecycle and matchmaking;
- a transport plus a `NetworkInputSource`;
- authoritative per-tick input broadcast and validation;
- latency handling and reconciliation.

It would not change:

- the `Simulation` contract or game implementations;
- the `SWR1` replay format;
- scoring aggregators;
- the Neon schema or existing verification worker.

## Scope boundary

This decision does not build rooms, matchmaking, netcode, reconciliation,
rollback networking, or `NetworkInputSource`.

## Consequences

Local, replay, and scripted sources can be checked for score and state-hash
identity now. A later room architecture can supply the same quantised per-tick
inputs while deterministic simulation, replay verification, and scoring remain
independent of transport.
