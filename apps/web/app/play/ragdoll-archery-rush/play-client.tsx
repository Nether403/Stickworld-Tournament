'use client';

import dynamic from 'next/dynamic';
import type { PlayMode } from '@stickworld/game-host';

const ArcheryIsland = dynamic(() => import('@/lib/play/ArcheryIsland'), { ssr: false });

export function PlayClient(props: { mode: PlayMode }) {
  return <ArcheryIsland mode={props.mode} />;
}
