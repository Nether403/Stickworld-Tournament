import type { GameManifest } from '@stickworld/sim-core';

export const hooklineSprintManifest: GameManifest = {
  id: 'hookline-sprint',
  registryId: 1,
  gameVersion: '1.0.0',
  simulationVersion: 1,
  scoringVersion: 1,
  rankedFormat: 'fixed-course',
  attemptShape: { kind: 'single' },
  maxRunTicks: 5400,
  tickRate: 60,
  actions: [
    { id: 1, name: 'aim', kind: 'int', min: 0, max: 359 },
    { id: 2, name: 'hook', kind: 'bool' },
  ],
  budget: {
    maxRigidBodies: 16,
    maxColliders: 32,
    maxJoints: 4,
    maxReplayBytes: 8192,
    maxScoreEvents: 512,
  },
};
