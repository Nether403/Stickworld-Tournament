import type { GameManifest } from '@stickworld/sim-core';

export const rooftopRelayManifest: GameManifest = {
  id: 'rooftop-relay',
  registryId: 7,
  gameVersion: '1.0.0',
  simulationVersion: 1,
  scoringVersion: 1,
  rankedFormat: 'fixed-course',
  attemptShape: { kind: 'single' },
  maxRunTicks: 9000,
  tickRate: 60,
  actions: [
    { id: 1, name: 'run', kind: 'int', min: 0, max: 2 },
    { id: 2, name: 'jump', kind: 'bool' },
    { id: 3, name: 'slide', kind: 'bool' },
  ],
  budget: {
    maxRigidBodies: 24,
    maxColliders: 40,
    maxJoints: 0,
    maxReplayBytes: 40960,
    maxScoreEvents: 768,
  },
};
