'use client';

import { useCallback } from 'react';
import type { GameHost, PlayMode } from '@stickworld/game-host';
import { DEMOLITION_INSTRUCTIONS } from './copy';
import { PlayShell } from './PlayShell';

export default function DemolitionIsland(props: { mode: PlayMode }) {
  const mount = useCallback(async (parent: HTMLElement, hostRef: { current?: GameHost }) => {
    const [{ demolitionDiveGame }, { mountDemolitionClient }] = await Promise.all([
      import('@stickworld/game-demolition-dive'),
      import('@stickworld/game-demolition-dive/client'),
    ]);
    return {
      game: demolitionDiveGame,
      mounted: mountDemolitionClient(parent, {
        onAim(deg) {
          hostRef.current?.input(1, deg);
        },
        onPower(value) {
          hostRef.current?.input(2, value);
        },
        onLaunch(value) {
          hostRef.current?.input(3, value);
        },
      }),
    };
  }, []);

  return (
    <PlayShell
      title="Demolition Dive"
      instructions={DEMOLITION_INSTRUCTIONS}
      stageTestId="demolition-stage"
      slug="demolition-dive"
      mode={props.mode}
      mount={mount}
    />
  );
}
