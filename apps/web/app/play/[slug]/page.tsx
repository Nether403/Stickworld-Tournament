import type { PlayMode } from '@stickworld/game-host';
import { PlayClient } from './play-client';

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
  return <PlayClient slug={slug} mode={mode} />;
}
