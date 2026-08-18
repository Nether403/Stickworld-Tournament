'use client';

import { useCallback } from 'react';
import type { GameHost, PlayMode } from '@stickworld/game-host';
import { BIKE_INSTRUCTIONS } from './copy';
import { PlayShell } from './PlayShell';

export default function BikeIsland(props: { mode: PlayMode }) {
  const mount = useCallback(async (parent: HTMLElement, hostRef: { current?: GameHost }) => {
    const [{ balanceBikeBlitzGame }, { mountBikeClient }] = await Promise.all([
      import('@stickworld/game-balance-bike-blitz'),
      import('@stickworld/game-balance-bike-blitz/client'),
    ]);
    return {
      game: balanceBikeBlitzGame,
      mounted: mountBikeClient(parent, {
        onThrottle(value) {
          hostRef.current?.input(1, value);
        },
        onBrake(value) {
          hostRef.current?.input(2, value);
        },
        onLean(value) {
          hostRef.current?.input(3, value);
        },
      }),
    };
  }, []);

  return (
    <PlayShell
      title="Balance Bike Blitz"
      instructions={BIKE_INSTRUCTIONS}
      stageTestId="bike-stage"
      slug="balance-bike-blitz"
      mode={props.mode}
      mount={mount}
    />
  );
}
