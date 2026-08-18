'use client';

import dynamic from 'next/dynamic';
import type { PlayMode } from '@stickworld/game-host';

const HooklineIsland = dynamic(() => import('@/lib/play/HooklineIsland'), { ssr: false });

export function PlayClient(props: { mode: PlayMode }) {
  return <HooklineIsland mode={props.mode} />;
}
