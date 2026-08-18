/* eslint-disable no-loss-of-precision -- fdlibm decimal forms; JS rounds them identically everywhere */
/**
 * fdlibm-style kernels (public domain fdlibm / Sun Microsystems).
 * Only IEEE-754-exact operations: + - * / and Math.sqrt.
 */

export const PIO2_HI = 1.57079632673412561417;
export const PIO2_LO = 6.07710050650619224932e-11;
export const PIO4 = 0.785398163397448309615;
export const INV_PIO2 = 0.636619772367581382043;

const PIO2_1 = 1.57079632673412561417;
const PIO2_1T = 6.07710050650619224932e-11;
const PIO2_2 = 6.0771005063039659766e-11;
const PIO2_2T = 2.02226624879595063154e-21;
const PIO2_3 = 2.02226624871116636592e-21;
const PIO2_3T = 8.47842766036889956952e-32;

const S1 = -1.66666666666666324348e-1;
const S2 = 8.33333333332248946124e-3;
const S3 = -1.98412698298579493134e-4;
const S4 = 2.75573137070700676789e-6;
const S5 = -2.50507602534068634195e-8;
const S6 = 1.58969099521155010221e-10;

const C1 = 4.16666666666666019037e-2;
const C2 = -1.38888888888741095749e-3;
const C3 = 2.48015872894767294178e-5;
const C4 = -2.75573143513906633035e-7;
const C5 = 2.0875723212981748279e-9;
const C6 = -1.13596475577881948265e-11;

export function kernelSin(x: number): number {
  const z = x * x;
  const v = z * x;
  const r = S2 + z * (S3 + z * (S4 + z * (S5 + z * S6)));
  return x + v * (S1 + z * r);
}

export function kernelCos(x: number): number {
  const z = x * x;
  const r = z * (C1 + z * (C2 + z * (C3 + z * (C4 + z * (C5 + z * C6)))));
  const hz = 0.5 * z;
  const w = 1 - hz;
  return w + (1 - w - hz + z * r);
}

/**
 * Reduce x to y with x = n * pi/2 + y and |y| <= pi/4.
 * Cody–Waite; accurate for |x| below about 1e6 (far beyond gameplay angles).
 */
export function remPio2(x: number): { n: number; y: number } {
  if (!Number.isFinite(x)) {
    return { n: 0, y: Number.NaN };
  }
  const ax = Math.abs(x);
  if (ax <= PIO4) {
    return { n: 0, y: x };
  }

  let n = Math.floor(ax * INV_PIO2 + 0.5);
  let y = ax - n * PIO2_1 - n * PIO2_1T;
  y = y - n * PIO2_2 - n * PIO2_2T;
  y = y - n * PIO2_3 - n * PIO2_3T;

  if (y > PIO4) {
    n += 1;
    y = ax - n * PIO2_1 - n * PIO2_1T;
  } else if (y < -PIO4) {
    n -= 1;
    y = ax - n * PIO2_1 - n * PIO2_1T;
  }

  if (x < 0) {
    return { n: -n, y: -y };
  }
  return { n, y };
}

/** Minimax on [0,1], then the 1/x identity. */
export function kernelAtan(x: number): number {
  const ax = Math.abs(x);
  const invert = ax > 1;
  const t = invert ? 1 / ax : ax;
  const z = t * t;
  const p =
    t *
    (1 +
      z *
        (-0.3333314528 +
          z *
            (0.1999355085 +
              z * (-0.1420889944 + z * (0.1065626393 + z * (-0.07528964 + z * 0.0429096138))))));
  const a = invert ? PIO2_HI + PIO2_LO - p : p;
  return x < 0 ? -a : a;
}
