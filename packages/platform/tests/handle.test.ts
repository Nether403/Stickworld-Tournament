import { describe, expect, it } from 'vitest';
import { normalizeHandle } from '../src/handle.js';

describe('normalizeHandle', () => {
  it('accepts a simple handle', () => {
    expect(normalizeHandle('Ada_1')).toEqual({ ok: true, handle: 'ada_1' });
  });

  it('rejects reserved, short, and NFKC-changing input', () => {
    expect(normalizeHandle('admin')).toEqual({ ok: false, code: 'HANDLE_INVALID' });
    expect(normalizeHandle('ab')).toEqual({ ok: false, code: 'HANDLE_INVALID' });
    expect(normalizeHandle('_nope')).toEqual({ ok: false, code: 'HANDLE_INVALID' });
    expect(normalizeHandle('Ａbc')).toEqual({ ok: false, code: 'HANDLE_INVALID' });
  });

  it('rejects handles reserved for anonymised profiles', () => {
    expect(normalizeHandle('d-0123456789ab')).toEqual({ ok: false, code: 'HANDLE_INVALID' });
    expect(normalizeHandle('D-0123456789ABC')).toEqual({ ok: false, code: 'HANDLE_INVALID' });
    expect(normalizeHandle('d-0123456789abcdef')).toEqual({
      ok: true,
      handle: 'd-0123456789abcdef',
    });
  });
});
