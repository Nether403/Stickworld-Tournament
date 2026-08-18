import {
  kernelAtan,
  kernelCos,
  kernelSin,
  PIO2_HI,
  PIO2_LO,
  remPio2,
} from './detmath.internal.js';

export const abs = Math.abs;
export const min = Math.min;
export const max = Math.max;
export const floor = Math.floor;
export const ceil = Math.ceil;
export const round = Math.round;
export const trunc = Math.trunc;
export const sign = Math.sign;
export const fround = Math.fround;
export const sqrt = Math.sqrt;
export const imul = Math.imul;

export function sin(x: number): number {
  if (!Number.isFinite(x)) return Number.NaN;
  const { n, y } = remPio2(x);
  const q = n & 3;
  if (q === 0) return kernelSin(y);
  if (q === 1) return kernelCos(y);
  if (q === 2) return -kernelSin(y);
  return -kernelCos(y);
}

export function cos(x: number): number {
  if (!Number.isFinite(x)) return Number.NaN;
  const { n, y } = remPio2(x);
  const q = n & 3;
  if (q === 0) return kernelCos(y);
  if (q === 1) return -kernelSin(y);
  if (q === 2) return -kernelCos(y);
  return kernelSin(y);
}

export function tan(x: number): number {
  const c = cos(x);
  if (c === 0) {
    return sin(x) < 0 ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;
  }
  return sin(x) / c;
}

export function atan(x: number): number {
  if (!Number.isFinite(x)) {
    if (x > 0) return PIO2_HI + PIO2_LO;
    if (x < 0) return -(PIO2_HI + PIO2_LO);
    return Number.NaN;
  }
  return kernelAtan(x);
}

const PI = (PIO2_HI + PIO2_LO) * 2;
const PIO2 = PIO2_HI + PIO2_LO;

export function atan2(y: number, x: number): number {
  if (x > 0) return atan(y / x);
  if (x < 0) {
    const a = atan(y / x);
    return y >= 0 ? a + PI : a - PI;
  }
  if (y > 0) return PIO2;
  if (y < 0) return -PIO2;
  return Number.NaN;
}

/** Integer exponents only. Fractional exponents are a simulation-version bump. */
export function pow(base: number, exponent: number): number {
  if (exponent !== trunc(exponent)) {
    throw new RangeError('detmath.pow only supports integer exponents');
  }
  if (exponent === 0) return 1;
  if (base === 0) {
    return exponent > 0 ? 0 : Number.POSITIVE_INFINITY;
  }
  if (exponent < 0) {
    return 1 / pow(base, -exponent);
  }
  let exp = exponent;
  let result = 1;
  let b = base;
  while (exp > 0) {
    if (exp % 2 === 1) result *= b;
    b *= b;
    exp = trunc(exp / 2);
  }
  return result;
}

export function hypot(x: number, y: number): number {
  const ax = abs(x);
  const ay = abs(y);
  const large = max(ax, ay);
  if (large === 0) return 0;
  const xr = ax / large;
  const yr = ay / large;
  return large * sqrt(xr * xr + yr * yr);
}
