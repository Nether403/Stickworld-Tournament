import { readFile } from 'node:fs/promises';
import { initRapier, Prng, type StickworldGame } from '@stickworld/sim-core';
import { decodeReplay } from '../src/decode.js';
import { playReplay } from '../src/player.js';

const file = process.argv[2];
if (!file) {
  console.error('usage: replay-verify <file.swr>');
  process.exit(2);
}

async function loadGame(registryId: number): Promise<StickworldGame | undefined> {
  if (registryId === 0) {
    const url = new URL('../../../game-test-chamber/dist/index.js', import.meta.url);
    try {
      const mod = (await import(url.href)) as { testChamberGame: StickworldGame };
      return mod.testChamberGame;
    } catch {
      return undefined;
    }
  }
  if (registryId === 1) {
    const url = new URL('../../../../games/hookline-sprint/dist/index.js', import.meta.url);
    try {
      const mod = (await import(url.href)) as { hooklineSprintGame: StickworldGame };
      return mod.hooklineSprintGame;
    } catch {
      return undefined;
    }
  }
  if (registryId === 2) {
    const url = new URL('../../../../games/pickaxe-ascent/dist/index.js', import.meta.url);
    try {
      const mod = (await import(url.href)) as { pickaxeAscentGame: StickworldGame };
      return mod.pickaxeAscentGame;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

const bytes = new Uint8Array(await readFile(file));
const decoded = await decodeReplay(bytes);
if (!decoded.ok) {
  console.error(`FAIL ${decoded.error.code}: ${decoded.error.message}`);
  process.exit(1);
}

const game = await loadGame(decoded.header.gameRegistryId);
if (!game) {
  console.log(
    JSON.stringify(
      {
        ok: true,
        simulated: false,
        ticks: decoded.header.totalTicks,
        claimedScore: decoded.header.claimedScore.toString(),
        events: decoded.events.length,
        hash: decoded.header.finalStateHash.toString(16).padStart(16, '0'),
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

const rapier = await initRapier();
const seed = decoded.header.seed;
const simulation = game.createSimulation({ seed, rapier, prng: new Prng(seed) });
try {
  const played = playReplay(simulation, decoded.header, decoded.events, game.manifest.actions);
  console.log(
    JSON.stringify(
      {
        ok: true,
        simulated: true,
        ticks: played.ticks,
        score: played.score,
        claimedScore: decoded.header.claimedScore.toString(),
        hash: played.stateHash.toString(16).padStart(16, '0'),
        hashMatch: true,
        scoreMatch: true,
      },
      null,
      2,
    ),
  );
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  const code = error instanceof Error && 'code' in error ? String(error.code) : 'VERIFY_FAILED';
  console.error(`FAIL ${code}: ${message}`);
  process.exit(1);
} finally {
  simulation.dispose();
}
