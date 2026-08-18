'use client';

import dynamic from 'next/dynamic';
import type { PlayMode } from '@stickworld/game-host';

const PlayIsland = dynamic(() => import('@/lib/play/PlayIsland'), { ssr: false });

export function PlayClient(props: { slug: string; mode: PlayMode }) {
  return <PlayIsland slug={props.slug} mode={props.mode} />;
}
