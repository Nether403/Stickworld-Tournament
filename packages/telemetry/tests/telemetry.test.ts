import { afterEach, describe, expect, it, vi } from 'vitest';
import { classifyUserAgent, emit } from '../src/index.ts';

const originalTelemetry = process.env.STICKWORLD_TELEMETRY;

afterEach(() => {
  vi.restoreAllMocks();
  if (originalTelemetry === undefined) delete process.env.STICKWORLD_TELEMETRY;
  else process.env.STICKWORLD_TELEMETRY = originalTelemetry;
});

describe('telemetry emit', () => {
  it('does not write when telemetry is disabled', () => {
    delete process.env.STICKWORLD_TELEMETRY;
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    emit('host.start', {
      gameId: 'hookline-sprint',
      gameVersion: '1.0.0',
      mode: 'practice',
      browserFamily: 'chrome',
      deviceClass: 'desktop',
    });

    expect(write).not.toHaveBeenCalled();
  });

  it('writes one JSON line with the event name and tags when enabled', () => {
    process.env.STICKWORLD_TELEMETRY = '1';
    const lines: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      lines.push(String(chunk));
      return true;
    });

    emit('attempt.issue', {
      gameId: 'hookline-sprint',
      gameVersion: '1.0.0',
      seasonId: 'season-1',
      mode: 'ranked',
      browserFamily: 'safari',
      deviceClass: 'mobile',
    });

    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/\n$/);
    expect(JSON.parse(lines[0]!)).toMatchObject({
      name: 'attempt.issue',
      gameId: 'hookline-sprint',
      gameVersion: '1.0.0',
      seasonId: 'season-1',
      mode: 'ranked',
      browserFamily: 'safari',
      deviceClass: 'mobile',
    });
    expect(Number.isNaN(Date.parse(String(JSON.parse(lines[0]!).ts)))).toBe(false);
  });
});

describe('classifyUserAgent', () => {
  it('classifies a desktop Chromium user agent', () => {
    expect(
      classifyUserAgent(
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36',
      ),
    ).toEqual({ browserFamily: 'chrome', deviceClass: 'desktop' });
  });

  it('classifies mobile Safari without trusting a client field', () => {
    expect(
      classifyUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 Version/17.6 Mobile/15E148 Safari/604.1',
      ),
    ).toEqual({ browserFamily: 'safari', deviceClass: 'mobile' });
  });

  it('classifies Edge before its Chromium token', () => {
    expect(
      classifyUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0',
      ),
    ).toEqual({ browserFamily: 'edge', deviceClass: 'desktop' });
  });

  it('uses unknown tags when the user agent is absent', () => {
    expect(classifyUserAgent(null)).toEqual({
      browserFamily: 'unknown',
      deviceClass: 'unknown',
    });
  });
});
