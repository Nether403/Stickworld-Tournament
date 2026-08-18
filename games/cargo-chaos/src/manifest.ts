import type { GameManifest } from '@stickworld/sim-core';

export const cargoChaosManifest: GameManifest = {
  id: 'cargo-chaos',
  registryId: 9,
  gameVersion: '1.0.0',
  simulationVersion: 1,
  scoringVersion: 1,
  rankedFormat: 'fixed-course',
  attemptShape: { kind: 'single' },
  maxRunTicks: 9000,
  tickRate: 60,
  actions: [
    { id: 1, name: 'aim', kind: 'int', min: 0, max: 359 },
    { id: 2, name: 'hook', kind: 'bool' },
  ],
  budget: {
    maxRigidBodies: 24,
    maxColliders: 40,
    maxJoints: 4,
    maxReplayBytes: 40960,
    maxScoreEvents: 512,
  },
};
