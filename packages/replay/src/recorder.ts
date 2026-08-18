import type { ActionDescriptor } from '@stickworld/sim-core';
import { InputValueOutOfRangeError, TickOrderViolationError, UnknownActionError } from './errors.js';
import type { InputEvent } from './format.js';

export function quantise(descriptor: ActionDescriptor, raw: number): number {
  if (descriptor.kind === 'bool') return raw ? 1 : 0;
  const scale = descriptor.scale ?? 1;
  return Math.round(raw * scale);
}

export class Recorder {
  private readonly actions: ReadonlyMap<number, ActionDescriptor>;
  private readonly events: InputEvent[] = [];
  private lastTick = -1;
  private lastAction = -1;

  constructor(actionTable: readonly ActionDescriptor[]) {
    this.actions = new Map(actionTable.map((a) => [a.id, a]));
  }

  record(tick: number, actionId: number, rawValue: number): InputEvent {
    const descriptor = this.actions.get(actionId);
    if (!descriptor) throw new UnknownActionError(actionId);
    const value = quantise(descriptor, rawValue);
    if (descriptor.kind === 'bool') {
      if (value !== 0 && value !== 1) throw new InputValueOutOfRangeError(actionId, value);
    } else {
      const min = descriptor.min ?? -2147483648;
      const max = descriptor.max ?? 2147483647;
      if (value < min || value > max) throw new InputValueOutOfRangeError(actionId, value);
    }
    if (tick < this.lastTick || (tick === this.lastTick && actionId < this.lastAction)) {
      throw new TickOrderViolationError();
    }
    const event = { tick, actionId, value };
    this.events.push(event);
    this.lastTick = tick;
    this.lastAction = actionId;
    return event;
  }

  snapshot(): readonly InputEvent[] {
    return this.events.slice();
  }
}
