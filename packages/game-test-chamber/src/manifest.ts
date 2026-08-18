import type { GameManifest } from '@stickworld/sim-core';

export const testChamberManifest: GameManifest = {
  id: 'test-chamber',
  registryId: 0,
  gameVersion: '1.0.0',
  simulationVersion: 1,
  scoringVersion: 1,
  rankedFormat: 'fixed-course',
  attemptShape: { kind: 'single' },
  maxRunTicks: 600,
  tickRate: 60,
  actions: [{ id: 1, name: 'burst', kind: 'bool' }],
  budget: {
    maxRigidBodies: 16,
    maxColliders: 16,
    maxJoints: 8,
    maxReplayBytes: 4096,
    maxScoreEvents: 64,
  },
};
