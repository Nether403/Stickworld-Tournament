import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { testChamberGame } from '@stickworld/game-test-chamber';
import { hooklineSprintGame } from '@stickworld/game-hookline-sprint';
import { decodeReplay, playReplay } from '@stickworld/replay';
import { initRapier, Prng, type StickworldGame } from '@stickworld/sim-core';
import { describe, expect, it } from 'vitest';

const VERIFY_DURATION_CEILING_MS = 5_000;

const fixtures: readonly {
  name: string;
  game: StickworldGame;
  url: URL;
}[] = [
  {
    name: 'Test Chamber',
    game: testChamberGame,
    url: new URL('../../game-test-chamber/fixtures/sample.swr', import.meta.url),
  },
  {
    name: 'Hookline Sprint',
    game: hooklineSprintGame,
    url: new URL('../../../games/hookline-sprint/fixtures/sample.swr', import.meta.url),
  },
];

describe('replay verification duration budget', () => {
  for (const fixture of fixtures) {
    it(`${fixture.name} verifies in under 5 seconds`, async () => {
      const decoded = await decodeReplay(readFileSync(fileURLToPath(fixture.url)));
      if (!decoded.ok) throw decoded.error;

      const rapier = await initRapier();
      const simulation = fixture.game.createSimulation({
        seed: decoded.header.seed,
        rapier,
        prng: new Prng(decoded.header.seed),
      });

      try {
        const startedAt = performance.now();
        playReplay(simulation, decoded.header, decoded.events, fixture.game.manifest.actions);
        const durationMs = performance.now() - startedAt;

        expect(durationMs).toBeLessThan(VERIFY_DURATION_CEILING_MS);
      } finally {
        simulation.dispose();
      }
    });
  }
});
