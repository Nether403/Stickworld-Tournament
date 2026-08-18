import { DegenerateSeedError } from './errors.js';

export type Seed128 = readonly [number, number, number, number];

const TWO32 = 4294967296;

function u32(n: number): number {
  return n >>> 0;
}

export class Prng {
  private readonly s: Uint32Array;

  constructor(seed: Seed128) {
    const a = u32(seed[0]);
    const b = u32(seed[1]);
    const c = u32(seed[2]);
    const d = u32(seed[3]);
    if ((a | b | c | d) === 0) {
      throw new DegenerateSeedError();
    }
    this.s = new Uint32Array([a, b, c, d]);
  }

  nextUint32(): number {
    const s = this.s;
    let t = s[3]!;
    const u = s[0]!;
    s[3] = s[2]!;
    s[2] = s[1]!;
    s[1] = u;
    t = u32(t ^ u32(t << 11));
    t = u32(t ^ (t >>> 8));
    s[0] = u32(t ^ u ^ (u >>> 19));
    return s[0]!;
  }

  nextFloat(): number {
    return this.nextUint32() / TWO32;
  }

  nextInt(minInclusive: number, maxExclusive: number): number {
    const min = minInclusive | 0;
    const max = maxExclusive | 0;
    const range = max - min;
    if (range <= 0) {
      throw new RangeError('nextInt range must be positive');
    }
    const leftover = TWO32 % range;
    const limit = leftover === 0 ? TWO32 : TWO32 - leftover;
    let x = this.nextUint32();
    while (x >= limit) {
      x = this.nextUint32();
    }
    return min + (x % range);
  }

  clone(): Prng {
    return new Prng(this.state());
  }

  state(): Seed128 {
    return [this.s[0]!, this.s[1]!, this.s[2]!, this.s[3]!];
  }
}
