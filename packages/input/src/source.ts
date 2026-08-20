export type QuantisedInput = { actionId: number; value: number };

export interface InputSource {
  inputsForTick(tick: number): readonly QuantisedInput[];
}

const NO_INPUTS: readonly QuantisedInput[] = [];

export class LocalInputSource implements InputSource {
  private readonly inputsByTick = new Map<number, QuantisedInput[]>();

  push(tick: number, actionId: number, value: number): void {
    const inputs = this.inputsByTick.get(tick);
    if (inputs) {
      inputs.push({ actionId, value });
      return;
    }
    this.inputsByTick.set(tick, [{ actionId, value }]);
  }

  inputsForTick(tick: number): readonly QuantisedInput[] {
    const inputs = this.inputsByTick.get(tick);
    if (!inputs) return NO_INPUTS;
    this.inputsByTick.delete(tick);
    return inputs;
  }
}

export class ReplayInputSource implements InputSource {
  private eventIndex = 0;

  constructor(
    private readonly events: readonly { tick: number; actionId: number; value: number }[],
  ) {}

  inputsForTick(tick: number): readonly QuantisedInput[] {
    while (this.eventIndex < this.events.length && this.events[this.eventIndex]!.tick < tick) {
      this.eventIndex += 1;
    }
    const inputs: QuantisedInput[] = [];
    while (this.eventIndex < this.events.length && this.events[this.eventIndex]!.tick === tick) {
      const event = this.events[this.eventIndex]!;
      inputs.push({ actionId: event.actionId, value: event.value });
      this.eventIndex += 1;
    }
    return inputs.length === 0 ? NO_INPUTS : inputs;
  }
}

export class ScriptedInputSource implements InputSource {
  constructor(
    private readonly inputsByTick: ReadonlyMap<number, readonly QuantisedInput[]>,
  ) {}

  inputsForTick(tick: number): readonly QuantisedInput[] {
    return this.inputsByTick.get(tick) ?? NO_INPUTS;
  }
}
