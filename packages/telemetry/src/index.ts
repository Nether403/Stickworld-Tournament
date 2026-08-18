export type PlayMode = 'practice' | 'ranked';

export type TelemetryName = 'host.start' | 'host.finish' | 'verify.shown';

export type Tags = {
  gameId: string;
  gameVersion: string;
  seasonId?: string;
  mode: PlayMode;
  browserFamily?: string;
};

/** No-op. Games must run if this is never wired. Spec 5 owns Sentry/OTel. */
export function emit(name: TelemetryName, tags: Tags): void {
  void name;
  void tags;
}
