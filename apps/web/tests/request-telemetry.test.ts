import { afterEach, describe, expect, it, vi } from 'vitest';
import { emitRequestTelemetry } from '../lib/request-telemetry.js';

const originalTelemetry = process.env.STICKWORLD_TELEMETRY;

afterEach(() => {
  vi.restoreAllMocks();
  if (originalTelemetry === undefined) delete process.env.STICKWORLD_TELEMETRY;
  else process.env.STICKWORLD_TELEMETRY = originalTelemetry;
});

describe('emitRequestTelemetry', () => {
  it.each(['attempt.issue', 'attempt.finish'] as const)(
    'derives device tags from the server request for %s',
    (name) => {
      process.env.STICKWORLD_TELEMETRY = '1';
      const lines: string[] = [];
      vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
        lines.push(String(chunk));
        return true;
      });
      const request = new Request('https://stick.world/v1/example', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'user-agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36',
        },
        body: JSON.stringify({ deviceClass: 'mobile' }),
      });

      emitRequestTelemetry(request, name, {
        gameId: 'hookline-sprint',
        gameVersion: '1.0.0',
        seasonId: 'season-1',
        mode: 'ranked',
      });

      expect(JSON.parse(lines[0]!)).toMatchObject({
        name,
        gameId: 'hookline-sprint',
        gameVersion: '1.0.0',
        seasonId: 'season-1',
        browserFamily: 'chrome',
        deviceClass: 'desktop',
        mode: 'ranked',
      });
    },
  );
});
