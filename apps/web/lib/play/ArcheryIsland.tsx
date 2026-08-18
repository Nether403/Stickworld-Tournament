'use client';

import { useCallback } from 'react';
import type { GameHost, PlayMode } from '@stickworld/game-host';
import { ARCHERY_INSTRUCTIONS } from './copy';
import { PlayShell } from './PlayShell';

export default function ArcheryIsland(props: { mode: PlayMode }) {
  const mount = useCallback(async (parent: HTMLElement, hostRef: { current?: GameHost }) => {
    const [{ ragdollArcheryRushGame }, { mountArcheryClient }] = await Promise.all([
      import('@stickworld/game-ragdoll-archery-rush'),
      import('@stickworld/game-ragdoll-archery-rush/client'),
    ]);
    return {
      game: ragdollArcheryRushGame,
      mounted: mountArcheryClient(parent, {
        onAim(deg) {
          hostRef.current?.input(1, deg);
        },
        onDraw(value) {
          hostRef.current?.input(2, value);
        },
        onFire(value) {
          hostRef.current?.input(3, value);
        },
      }),
    };
  }, []);

  return (
    <PlayShell
      title="Ragdoll Archery Rush"
      instructions={ARCHERY_INSTRUCTIONS}
      stageTestId="archery-stage"
      slug="ragdoll-archery-rush"
      mode={props.mode}
      mount={mount}
    />
  );
}
