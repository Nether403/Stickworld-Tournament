'use client';

import { useCallback } from 'react';
import type { GameHost, PlayMode } from '@stickworld/game-host';
import { POGO_INSTRUCTIONS } from './copy';
import { PlayShell } from './PlayShell';

export default function PogoIsland(props: { mode: PlayMode }) {
  const mount = useCallback(async (parent: HTMLElement, hostRef: { current?: GameHost }) => {
    const [{ pogoTowerGame }, { mountPogoClient }] = await Promise.all([
      import('@stickworld/game-pogo-tower'),
      import('@stickworld/game-pogo-tower/client'),
    ]);
    return {
      game: pogoTowerGame,
      mounted: mountPogoClient(parent, {
        onLean(value) {
          hostRef.current?.input(1, value);
        },
      }),
    };
  }, []);

  return (
    <PlayShell
      title="Pogo Tower"
      instructions={POGO_INSTRUCTIONS}
      stageTestId="pogo-stage"
      slug="pogo-tower"
      mode={props.mode}
      mount={mount}
    />
  );
}
