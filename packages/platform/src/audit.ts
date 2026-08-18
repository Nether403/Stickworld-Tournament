import { auditEvents, type Database } from '@stickworld/db';
import type { ReasonCode } from './reason-codes.js';

export async function audit(
  db: Database,
  input: {
    actor: string | null;
    action: string;
    target: string;
    meta?: Record<string, unknown>;
    reason?: ReasonCode;
  },
): Promise<void> {
  await db.insert(auditEvents).values({
    actor: input.actor,
    action: input.action,
    target: input.target,
    requestMeta: { ...input.meta, reason: input.reason ?? null },
  });
}
