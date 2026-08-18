'use client';

export function PauseControl(props: { paused: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={props.onToggle}>
      {props.paused ? 'Resume' : 'Pause'}
    </button>
  );
}
