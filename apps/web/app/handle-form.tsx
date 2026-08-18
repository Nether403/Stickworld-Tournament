'use client';

import { useState } from 'react';

export function HandleForm() {
  const [handle, setHandle] = useState('');
  const [message, setMessage] = useState('');

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void (async () => {
          const res = await fetch('/v1/me/handle', {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ handle }),
          });
          if (res.status === 204) {
            setMessage(`Kept ${handle}`);
            return;
          }
          const body = (await res.json()) as { handle?: string; error?: { message?: string } };
          setMessage(body.handle ? `Claimed ${body.handle}` : (body.error?.message ?? 'Could not claim handle'));
        })();
      }}
    >
      <label>
        Handle
        <input
          name="handle"
          value={handle}
          onChange={(event) => setHandle(event.target.value)}
          minLength={3}
          maxLength={20}
          required
        />
      </label>
      <button type="submit">Claim handle</button>
      {message ? <p>{message}</p> : null}
    </form>
  );
}
