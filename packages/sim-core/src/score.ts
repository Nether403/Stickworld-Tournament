export interface ScoreEvent {
  readonly tick: number;
  readonly type: string;
  readonly points: number;
  readonly multiplier: number;
}

export function aggregateScore(events: readonly ScoreEvent[]): number {
  let hundredths = 0;
  for (const event of events) {
    hundredths += event.points * event.multiplier;
  }
  return hundredths < 0 ? -Math.trunc(-hundredths / 100) : Math.trunc(hundredths / 100);
}

export interface ScoreDiff {
  readonly tick: number;
  readonly type: string;
  readonly client: ScoreEvent | undefined;
  readonly server: ScoreEvent | undefined;
}

export function diffScoreEvents(
  client: readonly ScoreEvent[],
  server: readonly ScoreEvent[],
): ScoreDiff | undefined {
  const n = Math.max(client.length, server.length);
  for (let i = 0; i < n; i++) {
    const a = client[i];
    const b = server[i];
    if (
      !a ||
      !b ||
      a.tick !== b.tick ||
      a.type !== b.type ||
      a.points !== b.points ||
      a.multiplier !== b.multiplier
    ) {
      return { tick: b?.tick ?? a?.tick ?? 0, type: b?.type ?? a?.type ?? 'missing', client: a, server: b };
    }
  }
  return undefined;
}
