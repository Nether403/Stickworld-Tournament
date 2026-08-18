import type { GameManifest } from '@stickworld/sim-core';

export const hammerThrowHavocManifest: GameManifest = {
  id: 'hammer-throw-havoc',
  registryId: 5,
  gameVersion: '1.0.0',
  simulationVersion: 1,
  scoringVersion: 1,
  rankedFormat: 'fixed-course',
  attemptShape: { kind: 'best-of', count: 3 },
  maxRunTicks: 5400,
  tickRate: 60,
  actions: [
    { id: 1, name: 'spin', kind: 'bool' },
    { id: 2, name: 'release', kind: 'bool' },
  ],
  budget: {
    maxRigidBodies: 16,
    maxColliders: 24,
    maxJoints: 2,
    maxReplayBytes: 5120,
    maxScoreEvents: 256,
  },
};
