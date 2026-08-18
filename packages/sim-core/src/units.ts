export const PIXELS_PER_METRE = 50;
export const GRAVITY_Y = -9.81;
export const GRAVITY = { x: 0, y: GRAVITY_Y } as const;

export function metresToPixels(metres: number): number {
  return metres * PIXELS_PER_METRE;
}

export function pixelsToMetres(pixels: number): number {
  return pixels / PIXELS_PER_METRE;
}
