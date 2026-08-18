'use client';

import { useCallback } from 'react';
import type { GameHost, PlayMode } from '@stickworld/game-host';
import { ROOFTOP_INSTRUCTIONS } from './copy';
import { PlayShell } from './PlayShell';

export default function RooftopIsland(props: { mode: PlayMode }) {
  const mount = useCallback(async (parent: HTMLElement, hostRef: { current?: GameHost }) => {
    const [{ rooftopRelayGame }, { mountRooftopClient }] = await Promise.all([
      import('@stickworld/game-rooftop-relay'),
      import('@stickworld/game-rooftop-relay/client'),
    ]);
    return {
      game: rooftopRelayGame,
      mounted: mountRooftopClient(parent, {
        onRun(value) {
          hostRef.current?.input(1, value);
        },
        onJump(value) {
          hostRef.current?.input(2, value);
        },
        onSlide(value) {
          hostRef.current?.input(3, value);
        },
      }),
    };
  }, []);

  return (
    <PlayShell
      title="Rooftop Relay"
      instructions={ROOFTOP_INSTRUCTIONS}
      stageTestId="rooftop-stage"
      slug="rooftop-relay"
      mode={props.mode}
      mount={mount}
    />
  );
}
