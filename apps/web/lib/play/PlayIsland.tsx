'use client';

import { useEffect, useRef, useState } from 'react';
import { GameHost, createRankedClient, type HostPhase, type PlayMode } from '@stickworld/game-host';
import type { ScoreEvent } from '@stickworld/sim-core';
import {
  Countdown,
  LeaderboardWidget,
  PauseControl,
  PbToast,
  ResultsTable,
  tokens,
} from '@stickworld/ui';
import { HOOKLINE_INSTRUCTIONS } from './copy';

interface FrameSnap {
  score: number;
  tick: number;
  finished: boolean;
  events: readonly ScoreEvent[];
}

export default function PlayIsland(props: { slug: string; mode: PlayMode }) {
  const parentRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<GameHost | undefined>(undefined);
  const [phase, setPhase] = useState<HostPhase>('idle');
  const [frame, setFrame] = useState<FrameSnap>({ score: 0, tick: 0, finished: false, events: [] });
  const [error, setError] = useState<string>('');
  const [verify, setVerify] = useState<string>('');
  const [countdown, setCountdown] = useState(3);
  const [seasonId, setSeasonId] = useState('');

  useEffect(() => {
    const parent = parentRef.current;
    if (!parent) return;
    let cancelled = false;
    let destroyClient: (() => void) | undefined;
    let host: GameHost | undefined;

    void (async () => {
      try {
        if (props.slug !== 'hookline-sprint') {
          setError('That game is not available yet.');
          return;
        }
        const [{ hooklineSprintGame }, { mountHooklineClient }] = await Promise.all([
          import('@stickworld/game-hookline-sprint'),
          import('@stickworld/game-hookline-sprint/client'),
        ]);
        if (cancelled) return;
        const mounted = mountHooklineClient(parent, {
          onAim(deg) {
            host?.input(1, deg);
          },
          onHook(value) {
            host?.input(2, value);
          },
        });
        destroyClient = mounted.destroy;
        host = new GameHost({
          game: hooklineSprintGame,
          slug: props.slug,
          mode: props.mode,
          view: {
            onFrame(args) {
              mounted.view.onFrame(args);
              setFrame({
                score: args.score,
                tick: args.tick,
                finished: args.finished,
                events: args.events,
              });
            },
            onPhase(next) {
              setPhase(next);
            },
          },
        });
        hostRef.current = host;
        await host.start();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not start';
        setError(message === 'UNAUTHENTICATED' ? 'Sign in required for ranked play.' : message);
      }
    })();

    return () => {
      cancelled = true;
      host?.dispose();
      destroyClient?.();
      hostRef.current = undefined;
    };
  }, [props.slug, props.mode]);

  useEffect(() => {
    if (phase !== 'countdown') return;
    setCountdown(3);
    const started = Date.now();
    const id = window.setInterval(() => {
      const left = Math.max(0, 3 - Math.floor((Date.now() - started) / 1000));
      setCountdown(left);
    }, 200);
    return () => window.clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'results' || props.mode !== 'ranked') return;
    const ranked = createRankedClient(fetch);
    let stopped = false;
    const started = Date.now();
    const tick = async () => {
      const runId = hostRef.current?.rankedFinishRunId;
      if (!runId) {
        if (Date.now() - started < 15_000) window.setTimeout(() => void tick(), 250);
        return;
      }
      while (!stopped && Date.now() - started < 30_000) {
        const row = await ranked.readRun(runId);
        if (row.status === 'verified') {
          setVerify(`Verified ${row.verifiedScore ?? ''}`);
          return;
        }
        if (row.status === 'rejected') {
          setVerify(row.reasonCode ?? 'rejected');
          return;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 400));
      }
    };
    void tick();
    return () => {
      stopped = true;
    };
  }, [phase, props.mode]);

  useEffect(() => {
    void (async () => {
      const res = await fetch('/v1/seasons/current');
      if (!res.ok) return;
      const body = (await res.json()) as { season?: { id?: string } };
      if (body.season?.id) setSeasonId(body.season.id);
    })();
  }, []);

  return (
    <div style={{ fontFamily: tokens.font, color: tokens.ink, background: tokens.bg, minHeight: '100vh', padding: 16 }}>
      <h1>Hookline Sprint</h1>
      <p data-testid="instructions" style={{ maxWidth: 720, color: tokens.muted, whiteSpace: 'pre-wrap' }}>
        {HOOKLINE_INSTRUCTIONS}
      </p>
      <p>
        Mode: {props.mode} · Phase: {phase} · Score: {frame.score} · Tick: {frame.tick}
      </p>
      {phase === 'countdown' ? <Countdown seconds={countdown} /> : null}
      {props.mode === 'practice' ? (
        <p>
          <PauseControl
            paused={phase === 'paused'}
            onToggle={() => {
              const host = hostRef.current;
              if (!host) return;
              host.setPaused(!host.paused);
            }}
          />
        </p>
      ) : (
        <p>Ranked runs cannot pause.</p>
      )}
      {error ? (
        <p role="alert" style={{ color: tokens.hazard }}>
          {error}
        </p>
      ) : null}
      <div
        ref={parentRef}
        data-testid="hookline-stage"
        style={{ width: 'min(960px, 100%)', height: 540, background: tokens.bg }}
      />
      {phase === 'results' ? (
        <section>
          <h2>Results</h2>
          <PbToast message={verify} />
          {seasonId ? <LeaderboardWidget seasonId={seasonId} gameSlug={props.slug} /> : null}
          <ResultsTable events={frame.events} />
        </section>
      ) : null}
    </div>
  );
}
