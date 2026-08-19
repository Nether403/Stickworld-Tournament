export async function databaseHealthResponse(check: () => Promise<unknown>): Promise<Response> {
  try {
    await check();
    return Response.json({ status: 'ok' });
  } catch {
    return Response.json({ status: 'unavailable' }, { status: 500 });
  }
}
