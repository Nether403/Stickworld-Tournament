import type { PlayMode } from '@stickworld/game-host';
import { PlayClient } from './play-client';

export default async function HooklinePlayPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const query = await searchParams;
  const mode: PlayMode = query.mode === 'ranked' ? 'ranked' : 'practice';
  return <PlayClient mode={mode} />;
}
