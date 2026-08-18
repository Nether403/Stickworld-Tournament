'use client';

export function PbToast(props: { message: string }) {
  if (!props.message) return null;
  return <p data-testid="verify-status">{props.message}</p>;
}
