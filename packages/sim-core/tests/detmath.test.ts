import { describe, expect, it } from 'vitest';
import * as detmath from '../src/detmath.js';

function ulpDiff(a: number, b: number): number {
  if (Object.is(a, b)) return 0;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return Number.POSITIVE_INFINITY;
  const buf = new DataView(new ArrayBuffer(16));
  buf.setFloat64(0, a, true);
  buf.setFloat64(8, b, true);
  const ia = buf.getBigInt64(0, true);
  const ib = buf.getBigInt64(8, true);
  const d = ia > ib ? ia - ib : ib - ia;
  return d > 9007199254740991n ? Number.POSITIVE_INFINITY : Number(d);
}

describe('detmath', () => {
  it('sin/cos kernels stay within 4 ULP of Math on [-pi/4, pi/4]', () => {
    let maxSin = 0;
    let maxCos = 0;
    for (let i = -500; i <= 500; i++) {
      const x = (i / 500) * (Math.PI / 4);
      maxSin = Math.max(maxSin, ulpDiff(detmath.sin(x), Math.sin(x)));
      maxCos = Math.max(maxCos, ulpDiff(detmath.cos(x), Math.cos(x)));
    }
    expect(maxSin).toBeLessThanOrEqual(4);
    expect(maxCos).toBeLessThanOrEqual(4);
  });

  it('sin/cos stay close to Math on [-2pi, 2pi] (absolute)', () => {
    let maxAbs = 0;
    for (let i = -2000; i <= 2000; i++) {
      const x = (i / 2000) * Math.PI * 2;
      maxAbs = Math.max(maxAbs, Math.abs(detmath.sin(x) - Math.sin(x)));
      maxAbs = Math.max(maxAbs, Math.abs(detmath.cos(x) - Math.cos(x)));
    }
    expect(maxAbs).toBeLessThan(1e-9);
  });

  it('atan2 stays close to Math.atan2 on a grid', () => {
    let maxAbs = 0;
    for (let yi = -4; yi <= 4; yi++) {
      for (let xi = -4; xi <= 4; xi++) {
        if (xi === 0 && yi === 0) continue;
        const y = yi * 0.37;
        const x = xi * 0.41;
        maxAbs = Math.max(maxAbs, Math.abs(detmath.atan2(y, x) - Math.atan2(y, x)));
      }
    }
    expect(maxAbs).toBeLessThan(5e-3);
  });

  it('pow is exact for integer exponents', () => {
    expect(detmath.pow(2, 10)).toBe(1024);
    expect(detmath.pow(3, 0)).toBe(1);
    expect(detmath.pow(5, -2)).toBe(1 / (5 * 5));
    expect(() => detmath.pow(2, 0.5)).toThrow(/integer/);
  });

  it('hypot is reproducible and scales', () => {
    expect(detmath.hypot(3, 4)).toBe(5);
    expect(detmath.hypot(0, 0)).toBe(0);
  });

  it('logs sin throughput for Spec 3 frame-budget planning', () => {
    const n = 200_000;
    const t0 = performance.now();
    let acc = 0;
    for (let i = 0; i < n; i++) acc += detmath.sin(i * 0.0005);
    const ms = performance.now() - t0;
    console.log(
      `detmath.sin throughput: ${((n / ms) * 1000).toFixed(0)} calls/s (${ms.toFixed(1)} ms / ${n}, acc=${acc})`,
    );
    expect(acc).not.toBe(0);
    expect(ms).toBeGreaterThan(0);
  });

  it('committed sample vector is bit-identical', () => {
    const inputs = [0, 0.1, -0.1, 1, -1, Math.PI, -Math.PI, 2.5, 10, -10];
    const bits = inputs.map((x) => ({
      x,
      sin: detmath.sin(x),
      cos: detmath.cos(x),
      atan2: detmath.atan2(x, 1),
    }));
    expect(bits).toMatchSnapshot();
  });
});
