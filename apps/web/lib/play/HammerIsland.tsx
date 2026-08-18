'use client';

import { useCallback } from 'react';
import type { GameHost, PlayMode } from '@stickworld/game-host';
import { HAMMER_INSTRUCTIONS } from './copy';
import { PlayShell } from './PlayShell';

export default function HammerIsland(props: { mode: PlayMode }) {
  const mount = useCallback(async (parent: HTMLElement, hostRef: { current?: GameHost }) => {
    const [{ hammerThrowHavocGame }, { mountHammerClient }] = await Promise.all([
      import('@stickworld/game-hammer-throw-havoc'),
      import('@stickworld/game-hammer-throw-havoc/client'),
    ]);
    return {
      game: hammerThrowHavocGame,
      mounted: mountHammerClient(parent, {
        onSpin(value) {
          hostRef.current?.input(1, value);
        },
        onRelease(value) {
          hostRef.current?.input(2, value);
        },
      }),
    };
  }, []);

  return (
    <PlayShell
      title="Hammer Throw Havoc"
      instructions={HAMMER_INSTRUCTIONS}
      stageTestId="hammer-stage"
      slug="hammer-throw-havoc"
      mode={props.mode}
      mount={mount}
    />
  );
}
