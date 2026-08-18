export type PlayMode = 'practice' | 'ranked';

export type HostPhase = 'idle' | 'countdown' | 'playing' | 'paused' | 'results';

export interface GameView {
  onFrame(args: {
    renderState: unknown;
    interpolationAlpha: number;
    tick: number;
    events: readonly import('@stickworld/sim-core').ScoreEvent[];
    score: number;
    finished: boolean;
  }): void;
  onPhase(phase: HostPhase): void;
}

export interface RankedSession {
  attemptId: string;
  token: string;
  seed: readonly [number, number, number, number];
  gameVersion: string;
  expiresAt: string;
}

export interface IssueAttemptBody {
  seedPolicy?: 'fixed-course' | 'daily-seed' | 'weekly-seed';
}

export interface FinishAttemptBody {
  token: string;
  replay: string;
  claimedScore: string;
}
