'use client';

import { useCallback } from 'react';
import type { GameHost, PlayMode } from '@stickworld/game-host';
import { HOOKLINE_INSTRUCTIONS } from './copy';
import { PlayShell } from './PlayShell';

export default function HooklineIsland(props: { mode: PlayMode }) {
  const mount = useCallback(async (parent: HTMLElement, hostRef: { current?: GameHost }) => {
    const [{ hooklineSprintGame }, { mountHooklineClient }] = await Promise.all([
      import('@stickworld/game-hookline-sprint'),
      import('@stickworld/game-hookline-sprint/client'),
    ]);
    return {
      game: hooklineSprintGame,
      mounted: mountHooklineClient(parent, {
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
      title="Hookline Sprint"
      instructions={HOOKLINE_INSTRUCTIONS}
      stageTestId="hookline-stage"
      slug="hookline-sprint"
      mode={props.mode}
      mount={mount}
    />
  );
}
