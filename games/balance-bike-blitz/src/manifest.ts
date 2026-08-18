import type { GameManifest } from '@stickworld/sim-core';

export const balanceBikeBlitzManifest: GameManifest = {
  id: 'balance-bike-blitz',
  registryId: 8,
  gameVersion: '1.0.0',
  simulationVersion: 1,
  scoringVersion: 1,
  rankedFormat: 'fixed-course',
  attemptShape: { kind: 'single' },
  maxRunTicks: 9000,
  tickRate: 60,
  actions: [
    { id: 1, name: 'throttle', kind: 'bool' },
    { id: 2, name: 'brake', kind: 'bool' },
    { id: 3, name: 'lean', kind: 'int', min: 0, max: 200 },
  ],
  budget: {
    maxRigidBodies: 20,
    maxColliders: 32,
    maxJoints: 8,
    maxReplayBytes: 40960,
    maxScoreEvents: 768,
  },
};
