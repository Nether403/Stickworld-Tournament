import type { GameManifest } from '@stickworld/sim-core';

export const pickaxeAscentManifest: GameManifest = {
  id: 'pickaxe-ascent',
  registryId: 2,
  gameVersion: '1.0.0',
  simulationVersion: 1,
  scoringVersion: 1,
  rankedFormat: 'fixed-course',
  attemptShape: { kind: 'single' },
  maxRunTicks: 7200,
  tickRate: 60,
  actions: [
    { id: 1, name: 'aim', kind: 'int', min: 0, max: 359 },
    { id: 2, name: 'hook', kind: 'bool' },
  ],
  budget: {
    maxRigidBodies: 24,
    maxColliders: 40,
    maxJoints: 4,
    maxReplayBytes: 15360,
    maxScoreEvents: 768,
  },
};
