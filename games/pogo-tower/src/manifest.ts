import type { GameManifest } from '@stickworld/sim-core';

export const pogoTowerManifest: GameManifest = {
  id: 'pogo-tower',
  registryId: 6,
  gameVersion: '1.0.0',
  simulationVersion: 1,
  scoringVersion: 1,
  rankedFormat: 'weekly-seed',
  attemptShape: { kind: 'single' },
  maxRunTicks: 7200,
  tickRate: 60,
  actions: [{ id: 1, name: 'lean', kind: 'int', min: 0, max: 200 }],
  budget: {
    maxRigidBodies: 24,
    maxColliders: 40,
    maxJoints: 0,
    maxReplayBytes: 15360,
    maxScoreEvents: 512,
  },
};
