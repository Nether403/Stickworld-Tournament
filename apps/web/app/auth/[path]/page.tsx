'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { authClient } from '@/lib/auth/client';
import { signInWithEmail, signUpWithEmail } from '@/lib/auth/email';

export default function AuthPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');

  return (
    <main>
      <header>
        <Link href="/">
          <Image
            src="/assets/brand/logo.svg"
            alt="Stickworld Tournament logo"
            width={64}
            height={64}
            priority
          />
          <Image
            src="/assets/brand/wordmark.svg"
            alt="Stickworld Tournament wordmark"
            width={350}
            height={60}
            priority
          />
        </Link>
      </header>
      <h1>Sign in</h1>
      <p>
        Google works in development with Neon shared credentials. Email uses the Neon Auth bundled
        sender.
      </p>
      <p>
        <button
          type="button"
          onClick={() => {
            void authClient.signIn.social({ provider: 'google', callbackURL: '/' });
          }}
        >
          Continue with Google
        </button>
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void (async () => {
            const result = await signInWithEmail(email, password);
            setMessage(result.error?.message ?? 'Signed in.');
          })();
        }}
      >
        <h2>Email sign in</h2>
        <label>
          Email
          <input
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        <button type="submit">Sign in with email</button>
      </form>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void (async () => {
            const result = await signUpWithEmail(email, password, name || 'Player');
            setMessage(result.error?.message ?? 'Check your inbox if confirmation is required.');
          })();
        }}
      >
        <h2>Email sign up</h2>
        <label>
          Name
          <input
            name="name"
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label>
          Email
          <input
            type="email"
            name="signup-email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            name="signup-password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={8}
          />
        </label>
        <button type="submit">Create account</button>
      </form>
      {message ? <p>{message}</p> : null}
    </main>
  );
}
