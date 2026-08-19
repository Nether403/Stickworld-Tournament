import { encodeReplay, Recorder, type InputEvent } from '@stickworld/replay';
import {
  applyInputsInOrder,
  initRapier,
  Prng,
  RAPIER_BUILD_SHA256,
  Stepper,
  type Seed128,
  type Simulation,
  type StickworldGame,
} from '@stickworld/sim-core';
import { LocalInputSource, shouldRecordChange } from '@stickworld/input';
import { classifyUserAgent, emit, type Tags } from '@stickworld/telemetry';
import { bytesToBase64, hexPrefix, packGameVersionString, uuidToBytes } from './bytes.js';
import { createRankedClient, type RankedClient } from './ranked-client.js';
import type { GameView, HostPhase, PlayMode, RankedSession } from './types.js';

const COUNTDOWN_MS = 3000;
const PRACTICE_SEED: Seed128 = [11, 22, 33, 44];

export interface GameHostConfig {
  game: StickworldGame;
  slug: string;
  mode: PlayMode;
  view: GameView;
  fetchImpl?: typeof fetch;
  now?: () => number;
  scheduleFrame?: (cb: () => void) => number;
  cancelFrame?: (id: number) => void;
  initRapier?: typeof initRapier;
  practiceSeed?: Seed128;
  rankedClient?: RankedClient;
  userAgent?: string;
}

export class GameHost {
  readonly mode: PlayMode;
  private pausedFlag = false;
  private phase: HostPhase = 'idle';
  private readonly game: StickworldGame;
  private readonly slug: string;
  private readonly view: GameView;
  private readonly now: () => number;
  private readonly scheduleFrame: (cb: () => void) => number;
  private readonly cancelFrame: (id: number) => void;
  private readonly initRapier: typeof initRapier;
  private readonly practiceSeed: Seed128;
  private readonly ranked: RankedClient;
  private readonly clientTags: Pick<Tags, 'browserFamily' | 'deviceClass'>;
  private stepper = new Stepper();
  private sim: Simulation | undefined;
  private recorder: Recorder | undefined;
  private inputs: LocalInputSource | undefined;
  private session: RankedSession | undefined;
  private lastMs = 0;
  private countdownEndsAt = 0;
  private frameId = 0;
  private looping = false;
  private finishPosted = false;
  private disposed = false;
  private lastInput = new Map<number, number>();
  private finishRunId: string | undefined;
  private visibilityHandler: (() => void) | undefined;

  constructor(config: GameHostConfig) {
    this.mode = config.mode;
    this.game = config.game;
    this.slug = config.slug;
    this.view = config.view;
    this.now = config.now ?? (() => performance.now());
    this.scheduleFrame =
      config.scheduleFrame ??
      ((cb) => {
        const raf = globalThis.requestAnimationFrame?.bind(globalThis);
        return raf ? raf(() => cb()) : 0;
      });
    this.cancelFrame =
      config.cancelFrame ??
      ((id) => {
        globalThis.cancelAnimationFrame?.(id);
      });
    this.initRapier = config.initRapier ?? initRapier;
    this.practiceSeed = config.practiceSeed ?? PRACTICE_SEED;
    this.clientTags = classifyUserAgent(config.userAgent ?? globalThis.navigator?.userAgent);
    this.ranked =
      config.rankedClient ??
      createRankedClient(config.fetchImpl ?? globalThis.fetch.bind(globalThis));
  }

  get paused(): boolean {
    return this.pausedFlag;
  }

  get hostPhase(): HostPhase {
    return this.phase;
  }

  get rankedSession(): RankedSession | undefined {
    return this.session;
  }

  get rankedFinishRunId(): string | undefined {
    return this.finishRunId;
  }

  async start(): Promise<void> {
    if (this.disposed) throw new Error('disposed');
    let seed: Seed128 = this.practiceSeed;
    if (this.mode === 'ranked') {
      this.session = await this.ranked.issueAttempt(this.slug, this.game.manifest.rankedFormat);
      seed = this.session.seed as Seed128;
    }
    const rapier = await this.initRapier();
    this.sim = this.game.createSimulation({ seed, rapier, prng: new Prng(seed) });
    this.recorder = new Recorder(this.game.manifest.actions);
    this.inputs = new LocalInputSource();
    this.stepper = new Stepper();
    this.finishPosted = false;
    this.finishRunId = undefined;
    this.lastInput.clear();
    this.pausedFlag = false;
    this.lastMs = this.now();
    this.countdownEndsAt = this.lastMs + COUNTDOWN_MS;
    this.setPhase('countdown');
    this.looping = true;
    this.bindVisibility();
    emit('host.start', {
      gameId: this.game.manifest.id,
      gameVersion: this.game.manifest.gameVersion,
      ...(this.session?.seasonId ? { seasonId: this.session.seasonId } : {}),
      mode: this.mode,
      ...this.clientTags,
    });
    this.queueFrame();
  }

  /** Drive the host with a wall-clock delta in milliseconds. Used by tests instead of rAF. */
  pump(dtMs: number): void {
    if (this.disposed || !this.sim || !this.recorder || !this.inputs) return;
    const now = this.lastMs + dtMs;
    this.lastMs = now;
    this.tickClock(now, dtMs);
  }

  input(actionId: number, value: number): void {
    if (
      this.phase !== 'playing' ||
      this.pausedFlag ||
      !this.sim ||
      !this.recorder ||
      !this.inputs
    ) {
      return;
    }
    if (!shouldRecordChange(this.lastInput, actionId, value)) return;
    const event = this.recorder.record(this.sim.tick, actionId, value);
    this.inputs.push(event.tick, event.actionId, event.value);
  }

  setPaused(paused: boolean): void {
    if (this.mode === 'ranked' && paused) {
      throw new Error('ranked pause is not allowed');
    }
    this.pausedFlag = paused;
    if (paused) this.setPhase('paused');
    else if (this.phase === 'paused') this.setPhase('playing');
  }

  stop(): void {
    this.looping = false;
    if (this.frameId) this.cancelFrame(this.frameId);
    this.frameId = 0;
    this.unbindVisibility();
    this.sim?.dispose();
    this.sim = undefined;
    this.recorder = undefined;
    this.inputs = undefined;
    this.setPhase('idle');
  }

  dispose(): void {
    this.stop();
    this.disposed = true;
  }

  private setPhase(phase: HostPhase): void {
    this.phase = phase;
    this.view.onPhase(phase);
  }

  private queueFrame(): void {
    if (!this.looping) return;
    this.frameId = this.scheduleFrame(() => {
      const now = this.now();
      const dt = now - this.lastMs;
      this.lastMs = now;
      this.tickClock(now, dt);
      this.queueFrame();
    });
  }

  private tickClock(now: number, dtMs: number): void {
    if (!this.sim || !this.recorder || !this.inputs) return;
    if (this.phase === 'countdown') {
      if (now >= this.countdownEndsAt) {
        this.setPhase('playing');
      } else {
        this.emitFrame(0);
        return;
      }
    }
    if (this.phase === 'paused' || this.pausedFlag) {
      this.emitFrame(this.stepper.interpolationAlpha);
      return;
    }
    if (this.phase !== 'playing') return;

    const consumed = this.stepper.advance(dtMs / 1000);
    for (let i = 0; i < consumed; i++) {
      const tick = this.sim.tick;
      applyInputsInOrder(
        (id, value) => this.sim!.applyInput(id, value),
        this.inputs.inputsForTick(tick),
      );
      this.sim.step();
    }
    this.emitFrame(this.stepper.interpolationAlpha);
    if (this.sim.finished) {
      void this.complete();
    }
  }

  private emitFrame(alpha: number): void {
    if (!this.sim) return;
    this.view.onFrame({
      renderState: this.sim.renderState(),
      interpolationAlpha: alpha,
      tick: this.sim.tick,
      events: this.sim.scoreEvents(),
      score: this.sim.score(),
      finished: this.sim.finished,
    });
  }

  private async complete(): Promise<void> {
    if (!this.sim || !this.recorder) return;
    this.looping = false;
    this.setPhase('results');
    emit('host.finish', {
      gameId: this.game.manifest.id,
      gameVersion: this.game.manifest.gameVersion,
      ...(this.session?.seasonId ? { seasonId: this.session.seasonId } : {}),
      mode: this.mode,
      ...this.clientTags,
    });
    if (this.mode !== 'ranked' || !this.session || this.finishPosted) return;
    this.finishPosted = true;
    const events: readonly InputEvent[] = this.recorder.snapshot();
    const header = {
      formatVersion: 1,
      gameRegistryId: this.game.manifest.registryId,
      gameVersion: packGameVersionString(this.game.manifest.gameVersion),
      simulationVersion: this.game.manifest.simulationVersion,
      scoringVersion: this.game.manifest.scoringVersion,
      rapierBuildHashPrefix: hexPrefix(RAPIER_BUILD_SHA256),
      seed: this.session.seed as Seed128,
      attemptId: uuidToBytes(this.session.attemptId),
      tickRate: 60 as const,
      totalTicks: this.sim.tick,
      claimedScore: BigInt(this.sim.score()),
      eventCount: events.length,
      finalStateHash: this.sim.stateHash(),
    };
    const bytes = await encodeReplay(header, events);
    const submitted = await this.ranked.finishAttempt(this.session.attemptId, {
      token: this.session.token,
      replay: bytesToBase64(bytes),
      claimedScore: String(this.sim.score()),
    });
    this.finishRunId = submitted.runId;
  }

  private bindVisibility(): void {
    this.unbindVisibility();
    if (this.mode !== 'practice' || typeof document === 'undefined') return;
    this.visibilityHandler = () => {
      if (document.visibilityState === 'hidden' && this.phase === 'playing') {
        this.setPaused(true);
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  private unbindVisibility(): void {
    if (!this.visibilityHandler || typeof document === 'undefined') {
      this.visibilityHandler = undefined;
      return;
    }
    document.removeEventListener('visibilitychange', this.visibilityHandler);
    this.visibilityHandler = undefined;
  }
}

export type { GameView, HostPhase, PlayMode, RankedSession } from './types.js';
