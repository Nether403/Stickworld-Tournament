export function healthFailForced(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.STICKWORLD_HEALTH_FAIL === '1';
}

export async function databaseHealthResponse(check: () => Promise<unknown>): Promise<Response> {
  if (healthFailForced()) {
    return Response.json({ status: 'unavailable' }, { status: 500 });
  }
  try {
    await check();
    return Response.json({ status: 'ok' });
  } catch {
    return Response.json({ status: 'unavailable' }, { status: 500 });
  }
}
