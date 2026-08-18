'use client';

import dynamic from 'next/dynamic';
import type { PlayMode } from '@stickworld/game-host';

const PickaxeIsland = dynamic(() => import('@/lib/play/PickaxeIsland'), { ssr: false });

export function PlayClient(props: { mode: PlayMode }) {
  return <PickaxeIsland mode={props.mode} />;
}
