import type { ActionDescriptor, Simulation } from '@stickworld/sim-core';
import { applyInputsInOrder } from '@stickworld/sim-core';
import {
  InputValueOutOfRangeError,
  ScoreMismatchError,
  StateHashMismatchError,
  TickCountMismatchError,
  UnknownActionError,
} from './errors.js';
import type { InputEvent, ReplayHeader } from './format.js';

export interface PlayResult {
  score: number;
  stateHash: bigint;
  ticks: number;
}

function assertValue(desc: ActionDescriptor, value: number): void {
  if (desc.kind === 'bool') {
    if (value !== 0 && value !== 1) throw new InputValueOutOfRangeError(desc.id, value);
    return;
  }
  const min = desc.min ?? -2147483648;
  const max = desc.max ?? 2147483647;
  if (value < min || value > max) throw new InputValueOutOfRangeError(desc.id, value);
}

export function playReplay(
  simulation: Simulation,
  header: ReplayHeader,
  events: readonly InputEvent[],
  actions: readonly ActionDescriptor[],
): PlayResult {
  const byId = new Map(actions.map((action) => [action.id, action]));
  let eventIndex = 0;
  for (let tick = 0; tick < header.totalTicks; tick++) {
    const batch: { actionId: number; value: number }[] = [];
    while (eventIndex < events.length && events[eventIndex]!.tick === tick) {
      const event = events[eventIndex]!;
      const desc = byId.get(event.actionId);
      if (!desc) throw new UnknownActionError(event.actionId);
      assertValue(desc, event.value);
      batch.push({ actionId: event.actionId, value: event.value });
      eventIndex += 1;
    }
    applyInputsInOrder((id, value) => simulation.applyInput(id, value), batch);
    simulation.step();
  }
  if (simulation.tick !== header.totalTicks) throw new TickCountMismatchError();
  const score = simulation.score();
  const stateHash = simulation.stateHash();
  if (BigInt(score) !== header.claimedScore) throw new ScoreMismatchError();
  if (stateHash !== header.finalStateHash) throw new StateHashMismatchError();
  return { score, stateHash, ticks: simulation.tick };
}
