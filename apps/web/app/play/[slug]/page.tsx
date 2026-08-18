import dynamic from 'next/dynamic';
import type { PlayMode } from '@stickworld/game-host';

const PlayIsland = dynamic(() => import('@/lib/play/PlayIsland'), { ssr: false });

export default async function PlayPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const mode: PlayMode = query.mode === 'ranked' ? 'ranked' : 'practice';
  return <PlayIsland slug={slug} mode={mode} />;
}
