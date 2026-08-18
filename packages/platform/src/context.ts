export interface Clock {
  now(): Date;
}

export const systemClock: Clock = {
  now: () => new Date(),
};

export interface Entropy {
  randomBytes(size: number): Uint8Array;
}

export interface PlatformSecrets {
  hmacSecret: string;
  hmacSecretPrev: string;
}

export interface PlatformContext {
  clock: Clock;
  entropy: Entropy;
  secrets: PlatformSecrets;
}
