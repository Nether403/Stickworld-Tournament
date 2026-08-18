'use client';

import dynamic from 'next/dynamic';
import type { PlayMode } from '@stickworld/game-host';

const HammerIsland = dynamic(() => import('@/lib/play/HammerIsland'), { ssr: false });

export function PlayClient(props: { mode: PlayMode }) {
  return <HammerIsland mode={props.mode} />;
}
