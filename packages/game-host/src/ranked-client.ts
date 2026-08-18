import type { RankedSession } from './types.js';

export interface RankedClient {
  issueAttempt(slug: string, seedPolicy?: 'fixed-course' | 'daily-seed' | 'weekly-seed'): Promise<RankedSession>;
  finishAttempt(
    attemptId: string,
    body: { token: string; replay: string; claimedScore: string },
  ): Promise<{ runId: string; status: string }>;
  readRun(runId: string): Promise<{ status: string; verifiedScore: string | null; reasonCode: string | null }>;
}

export function createRankedClient(fetchImpl: typeof fetch, baseUrl = ''): RankedClient {
  return {
    async issueAttempt(slug, seedPolicy = 'fixed-course') {
      const res = await fetchImpl(`${baseUrl}/v1/games/${slug}/attempts`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ seedPolicy }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: { code?: string } };
        throw new Error(body.error?.code ?? `issue failed ${res.status}`);
      }
      return (await res.json()) as RankedSession;
    },
    async finishAttempt(attemptId, body) {
      const res = await fetchImpl(`${baseUrl}/v1/attempts/${attemptId}/finish`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: { code?: string } };
        throw new Error(payload.error?.code ?? `finish failed ${res.status}`);
      }
      return (await res.json()) as { runId: string; status: string };
    },
    async readRun(runId) {
      const res = await fetchImpl(`${baseUrl}/v1/runs/${runId}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`run ${res.status}`);
      return (await res.json()) as {
        status: string;
        verifiedScore: string | null;
        reasonCode: string | null;
      };
    },
  };
}
