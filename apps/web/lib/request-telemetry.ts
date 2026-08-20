import { classifyUserAgent, emit, type PlayMode, type TelemetryName } from '@stickworld/telemetry';

export interface RequestTelemetryTags {
  gameId: string;
  gameVersion: string;
  seasonId?: string;
  mode: PlayMode;
}

export function emitRequestTelemetry(
  request: Request,
  name: Extract<TelemetryName, 'attempt.issue' | 'attempt.finish'>,
  tags: RequestTelemetryTags,
): void {
  emit(name, {
    ...tags,
    ...classifyUserAgent(request.headers.get('user-agent')),
  });
}
