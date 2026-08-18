'use client';

import { useEffect, useState } from 'react';

export function LeaderboardWidget(props: { seasonId?: string; gameSlug: string }) {
  const [text, setText] = useState('');
  useEffect(() => {
    if (!props.seasonId) return;
    void (async () => {
      const res = await fetch(`/v1/leaderboards/${props.seasonId}/${props.gameSlug}`);
      if (!res.ok) return;
      const body = (await res.json()) as { viewer?: { score?: string; rank?: number } };
      if (body.viewer?.score) {
        setText(`Your board row: rank ${body.viewer.rank ?? '—'} · ${body.viewer.score}`);
      }
    })();
  }, [props.seasonId, props.gameSlug]);
  if (!text) return null;
  return <p>{text}</p>;
}
