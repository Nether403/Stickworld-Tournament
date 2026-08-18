'use client';

import { useCallback } from 'react';
import type { GameHost, PlayMode } from '@stickworld/game-host';
import { PICKAXE_INSTRUCTIONS } from './copy';
import { PlayShell } from './PlayShell';

export default function PickaxeIsland(props: { mode: PlayMode }) {
  const mount = useCallback(async (parent: HTMLElement, hostRef: { current?: GameHost }) => {
    const [{ pickaxeAscentGame }, { mountPickaxeClient }] = await Promise.all([
      import('@stickworld/game-pickaxe-ascent'),
      import('@stickworld/game-pickaxe-ascent/client'),
    ]);
    return {
      game: pickaxeAscentGame,
      mounted: mountPickaxeClient(parent, {
        onAim(deg) {
          hostRef.current?.input(1, deg);
        },
        onHook(value) {
          hostRef.current?.input(2, value);
        },
      }),
    };
  }, []);

  return (
    <PlayShell
      title="Pickaxe Ascent"
      instructions={PICKAXE_INSTRUCTIONS}
      stageTestId="pickaxe-stage"
      slug="pickaxe-ascent"
      mode={props.mode}
      mount={mount}
    />
  );
}
