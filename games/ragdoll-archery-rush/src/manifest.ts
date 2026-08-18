import type { GameManifest } from '@stickworld/sim-core';

export const ragdollArcheryRushManifest: GameManifest = {
  id: 'ragdoll-archery-rush',
  registryId: 4,
  gameVersion: '1.0.0',
  simulationVersion: 1,
  scoringVersion: 1,
  rankedFormat: 'fixed-course',
  attemptShape: { kind: 'single' },
  maxRunTicks: 5400,
  tickRate: 60,
  actions: [
    { id: 1, name: 'aim', kind: 'int', min: 0, max: 359 },
    { id: 2, name: 'draw', kind: 'int', min: 0, max: 100 },
    { id: 3, name: 'fire', kind: 'bool' },
  ],
  budget: {
    maxRigidBodies: 24,
    maxColliders: 40,
    maxJoints: 16,
    maxReplayBytes: 5120,
    maxScoreEvents: 64,
  },
};
