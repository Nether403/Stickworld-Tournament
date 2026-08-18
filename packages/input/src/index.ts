/** Record-on-change: skip repeats so analog aim does not blow the replay. */
export function shouldRecordChange(
  last: Map<number, number>,
  actionId: number,
  value: number,
): boolean {
  if (last.get(actionId) === value) return false;
  last.set(actionId, value);
  return true;
}

/** Phaser/keyboard aim nudge used by Spec 3 clients. Degrees wrap 0–359. */
export function nudgeAimDegrees(
  current: number,
  left: boolean,
  right: boolean,
  up: boolean,
  down: boolean,
  step = 3,
): number {
  let deg = current;
  if (left) deg -= step;
  if (right) deg += step;
  if (up) deg += step;
  if (down) deg -= step;
  deg = ((deg % 360) + 360) % 360;
  return deg;
}

export {
  LocalInputSource,
  ReplayInputSource,
  ScriptedInputSource,
  type InputSource,
  type QuantisedInput,
} from './source.js';
