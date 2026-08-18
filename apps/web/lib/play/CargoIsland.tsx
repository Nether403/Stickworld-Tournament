'use client';

import { useCallback } from 'react';
import type { GameHost, PlayMode } from '@stickworld/game-host';
import { CARGO_INSTRUCTIONS } from './copy';
import { PlayShell } from './PlayShell';

export default function CargoIsland(props: { mode: PlayMode }) {
  const mount = useCallback(async (parent: HTMLElement, hostRef: { current?: GameHost }) => {
    const [{ cargoChaosGame }, { mountCargoClient }] = await Promise.all([
      import('@stickworld/game-cargo-chaos'),
      import('@stickworld/game-cargo-chaos/client'),
    ]);
    return {
      game: cargoChaosGame,
      mounted: mountCargoClient(parent, {
        onAim(value) {
          hostRef.current?.input(1, value);
        },
        onHook(value) {
          hostRef.current?.input(2, value);
        },
      }),
    };
  }, []);

  return (
    <PlayShell
      title="Cargo Chaos"
      instructions={CARGO_INSTRUCTIONS}
      stageTestId="cargo-stage"
      slug="cargo-chaos"
      mode={props.mode}
      mount={mount}
    />
  );
}
