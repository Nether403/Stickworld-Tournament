import type { ReactNode } from 'react';
import Link from 'next/link';
import { auth } from '@/lib/auth/server';
import { HandleForm } from './handle-form';

export const dynamic = 'force-dynamic';

export default async function HomePage(): Promise<ReactNode> {
  let signedIn: { id?: string; email?: string | null; name?: string | null } | undefined;
  if (process.env.NEON_AUTH_BASE_URL) {
    try {
      const session = await auth.getSession();
      signedIn = session.data?.user;
    } catch {
      signedIn = undefined;
    }
  }

  return (
    <main>
      <h1>Stickworld Tournament</h1>
      <p>Scores count only after the server re-simulates the replay.</p>
      {signedIn ? (
        <>
          <p>Signed in as {signedIn.email ?? signedIn.name ?? signedIn.id}</p>
          <HandleForm />
        </>
      ) : (
        <p>
          <Link href="/auth/sign-in">Sign in</Link>
        </p>
      )}
    </main>
  );
}
