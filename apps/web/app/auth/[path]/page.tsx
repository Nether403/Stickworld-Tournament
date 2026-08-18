'use client';

import { authClient } from '@/lib/auth/client';

export default function AuthPage() {
  return (
    <main>
      <h1>Sign in</h1>
      <p>
        Google works in development with Neon shared credentials. GitHub needs a
        GitHub <strong>OAuth App</strong> (Developer settings, not a GitHub App).
        Homepage URL can be the repo or localhost; the Authorization callback URL
        is Neon&apos;s <code>/callback/github</code>, not this page. Paste the
        Client ID and secret into Neon Auth.
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
