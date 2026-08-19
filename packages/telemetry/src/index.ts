export type PlayMode = 'practice' | 'ranked';

export type DeviceClass = 'desktop' | 'mobile' | 'unknown';

export type TelemetryName =
  | 'host.start'
  | 'host.finish'
  | 'verify.shown'
  | 'verify.ok'
  | 'verify.reject'
  | 'verify.duration_ms'
  | 'attempt.issue'
  | 'attempt.finish';

export type Tags = {
  gameId: string;
  gameVersion: string;
  seasonId?: string;
  mode: PlayMode;
  browserFamily: string;
  deviceClass: DeviceClass;
  reasonCode?: string;
  durationMs?: number;
};

export function classifyUserAgent(
  userAgent: string | null | undefined,
): Pick<Tags, 'browserFamily' | 'deviceClass'> {
  if (!userAgent) return { browserFamily: 'unknown', deviceClass: 'unknown' };

  const browserFamily = /Edg(?:e|A|iOS)?\//i.test(userAgent)
    ? 'edge'
    : /OPR\/|Opera\//i.test(userAgent)
      ? 'opera'
      : /Firefox\/|FxiOS\//i.test(userAgent)
        ? 'firefox'
        : /Chrome\/|CriOS\//i.test(userAgent)
          ? 'chrome'
          : /Safari\//i.test(userAgent)
            ? 'safari'
            : 'unknown';
  const deviceClass: DeviceClass = /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent)
    ? 'mobile'
    : /Mozilla|Windows|Macintosh|Linux|CrOS/i.test(userAgent)
      ? 'desktop'
      : 'unknown';

  return { browserFamily, deviceClass };
}

/** Emit newline-delimited JSON for Railway logs, or remain a no-op when disabled. */
export function emit(name: TelemetryName, tags: Tags): void {
  if (process.env.STICKWORLD_TELEMETRY === '1') {
    process.stdout.write(JSON.stringify({ ts: new Date().toISOString(), name, ...tags }) + '\n');
  }
}
