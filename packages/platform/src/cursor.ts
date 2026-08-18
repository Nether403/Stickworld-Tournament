export interface LeaderboardCursor {
  score: string;
  achievedAt: string;
  userId: string;
}

export function encodeCursor(cursor: LeaderboardCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodeCursor(raw: string): LeaderboardCursor | undefined {
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as LeaderboardCursor;
    if (
      typeof parsed.score !== 'string' ||
      typeof parsed.achievedAt !== 'string' ||
      typeof parsed.userId !== 'string'
    ) {
      return undefined;
    }
    return parsed;
  } catch {
    return undefined;
  }
}

export function afterCursor(
  score: bigint,
  achievedAt: Date,
  userId: string,
  cursor: LeaderboardCursor,
): boolean {
  const cursorScore = BigInt(cursor.score);
  const cursorTime = Date.parse(cursor.achievedAt);
  const t = achievedAt.getTime();
  if (score < cursorScore) return true;
  if (score > cursorScore) return false;
  if (t > cursorTime) return true;
  if (t < cursorTime) return false;
  return userId > cursor.userId;
}
