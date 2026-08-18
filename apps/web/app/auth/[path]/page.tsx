'use client';

import { authClient } from '@/lib/auth/client';

export default function AuthPage() {
  return (
    <main>
      <h1>Sign in</h1>
      <p>Google works in development with Neon shared credentials. GitHub needs an OAuth app in the Neon console.</p>
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
      <p>
        <button
          type="button"
          onClick={() => {
            void authClient.signIn.social({ provider: 'github', callbackURL: '/' });
          }}
        >
          Continue with GitHub
        </button>
      </p>
    </main>
  );
}
