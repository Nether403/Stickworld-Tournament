import { describe, expect, it } from 'vitest';
import {
  LocalInputSource,
  ReplayInputSource,
  ScriptedInputSource,
  type QuantisedInput,
} from '../src/index.ts';

describe('LocalInputSource', () => {
  it('groups pushed inputs by tick and consumes each tick once', () => {
    const source = new LocalInputSource();
    source.push(3, 2, 20);
    source.push(3, 1, 10);
    source.push(5, 4, 40);

    expect(source.inputsForTick(3)).toEqual([
      { actionId: 2, value: 20 },
      { actionId: 1, value: 10 },
    ]);
    expect(source.inputsForTick(3)).toEqual([]);
    expect(source.inputsForTick(4)).toEqual([]);
    expect(source.inputsForTick(5)).toEqual([{ actionId: 4, value: 40 }]);
  });
});

describe('ReplayInputSource', () => {
  it('walks sorted events in same-tick groups', () => {
    const source = new ReplayInputSource([
      { tick: 1, actionId: 1, value: 10 },
      { tick: 1, actionId: 2, value: 20 },
      { tick: 4, actionId: 3, value: 30 },
    ]);

    expect(source.inputsForTick(0)).toEqual([]);
    expect(source.inputsForTick(1)).toEqual([
      { actionId: 1, value: 10 },
      { actionId: 2, value: 20 },
    ]);
    expect(source.inputsForTick(2)).toEqual([]);
    expect(source.inputsForTick(4)).toEqual([{ actionId: 3, value: 30 }]);
  });
});

describe('ScriptedInputSource', () => {
  it('returns readonly groups from its tick map', () => {
    const tickInputs: readonly QuantisedInput[] = [{ actionId: 7, value: -3 }];
    const source = new ScriptedInputSource(new Map([[8, tickInputs]]));

    expect(source.inputsForTick(7)).toEqual([]);
    expect(source.inputsForTick(8)).toBe(tickInputs);
  });
});
