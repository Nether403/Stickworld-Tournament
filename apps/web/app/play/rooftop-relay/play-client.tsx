'use client';

import dynamic from 'next/dynamic';
import type { PlayMode } from '@stickworld/game-host';

const Island = dynamic(() => import('@/lib/play/RooftopIsland'), { ssr: false });

export function PlayClient(props: { mode: PlayMode }) {
  return <Island mode={props.mode} />;
}
