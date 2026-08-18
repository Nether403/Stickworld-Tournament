'use client';

export function Countdown(props: { seconds: number }) {
  return <p data-testid="countdown">Countdown {props.seconds}</p>;
}
