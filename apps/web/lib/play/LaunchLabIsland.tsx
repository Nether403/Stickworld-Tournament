'use client';

import { useCallback } from 'react';
import type { GameHost, PlayMode } from '@stickworld/game-host';
import { LAUNCH_LAB_INSTRUCTIONS } from './copy';
import { PlayShell } from './PlayShell';

export default function LaunchLabIsland(props: { mode: PlayMode }) {
  const mount = useCallback(async (parent: HTMLElement, hostRef: { current?: GameHost }) => {
    const [{ launchLabGame }, { mountLaunchLabClient }] = await Promise.all([
      import('@stickworld/game-launch-lab'),
      import('@stickworld/game-launch-lab/client'),
    ]);
    return {
      game: launchLabGame,
      mounted: mountLaunchLabClient(parent, {
        onAim(deg) {
          hostRef.current?.input(1, deg);
        },
        onPower(value) {
          hostRef.current?.input(2, value);
        },
        onTuck(value) {
          hostRef.current?.input(3, value);
        },
        onLaunch(value) {
          hostRef.current?.input(4, value);
        },
      }),
    };
  }, []);

  return (
    <PlayShell
      title="Launch Lab"
      instructions={LAUNCH_LAB_INSTRUCTIONS}
      stageTestId="launch-lab-stage"
      slug="launch-lab"
      mode={props.mode}
      mount={mount}
    />
  );
}
