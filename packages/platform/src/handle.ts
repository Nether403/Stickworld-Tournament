import { HANDLE_MAX, HANDLE_MIN, HANDLE_PATTERN } from './limits.js';
import { RESERVED_HANDLES } from './reserved-handles.js';

const RESERVED = new Set(RESERVED_HANDLES);

export function normalizeHandle(
  raw: string,
): { ok: true; handle: string } | { ok: false; code: 'HANDLE_INVALID' } {
  if (typeof raw !== 'string') return { ok: false, code: 'HANDLE_INVALID' };
  const nfkc = raw.normalize('NFKC');
  if (nfkc !== raw) return { ok: false, code: 'HANDLE_INVALID' };
  const handle = nfkc.toLowerCase();
  if (handle.length < HANDLE_MIN || handle.length > HANDLE_MAX) {
    return { ok: false, code: 'HANDLE_INVALID' };
  }
  if (!HANDLE_PATTERN.test(handle)) return { ok: false, code: 'HANDLE_INVALID' };
  if (RESERVED.has(handle)) return { ok: false, code: 'HANDLE_INVALID' };
  return { ok: true, handle };
}
