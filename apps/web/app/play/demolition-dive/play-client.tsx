'use client';

import dynamic from 'next/dynamic';
import type { PlayMode } from '@stickworld/game-host';

const DemolitionIsland = dynamic(() => import('@/lib/play/DemolitionIsland'), { ssr: false });

export function PlayClient(props: { mode: PlayMode }) {
  return <DemolitionIsland mode={props.mode} />;
}
