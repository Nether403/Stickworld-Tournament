'use client';

import dynamic from 'next/dynamic';
import type { PlayMode } from '@stickworld/game-host';

const LaunchLabIsland = dynamic(() => import('@/lib/play/LaunchLabIsland'), { ssr: false });

export function PlayClient(props: { mode: PlayMode }) {
  return <LaunchLabIsland mode={props.mode} />;
}
