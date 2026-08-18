'use client';

import dynamic from 'next/dynamic';
import type { PlayMode } from '@stickworld/game-host';

const PogoIsland = dynamic(() => import('@/lib/play/PogoIsland'), { ssr: false });

export function PlayClient(props: { mode: PlayMode }) {
  return <PogoIsland mode={props.mode} />;
}
