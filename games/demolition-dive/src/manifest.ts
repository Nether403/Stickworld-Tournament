import type { GameManifest } from '@stickworld/sim-core';

export const demolitionDiveManifest: GameManifest = {
  id: 'demolition-dive',
  registryId: 10,
  gameVersion: '1.0.0',
  simulationVersion: 1,
  scoringVersion: 1,
  rankedFormat: 'fixed-course',
  attemptShape: { kind: 'best-of', count: 3 },
  maxRunTicks: 5400,
  tickRate: 60,
  actions: [
    { id: 1, name: 'aim', kind: 'int', min: 0, max: 359 },
    { id: 2, name: 'power', kind: 'int', min: 0, max: 100 },
    { id: 3, name: 'launch', kind: 'bool' },
  ],
  budget: {
    maxRigidBodies: 28,
    maxColliders: 48,
    maxJoints: 16,
    maxReplayBytes: 81920,
    maxScoreEvents: 256,
  },
};
