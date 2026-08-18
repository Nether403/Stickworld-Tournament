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
      <section aria-label="Game catalogue">
        <article>
          <h2>Hookline Sprint</h2>
          <p>Attach, swing, and release. Race the line without falling.</p>
          <p>
            <Link href="/play/hookline-sprint">Practice</Link>
            {signedIn ? (
              <>
                {' '}
                <Link href="/play/hookline-sprint?mode=ranked">Ranked</Link>
              </>
            ) : (
              <>
                {' '}
                <Link href="/auth/sign-in">Sign in to play ranked</Link>
              </>
            )}
          </p>
        </article>
        <article>
          <h2>Pickaxe Ascent</h2>
          <p>Bite a ledge, swing, and climb the shaft.</p>
          <p>
            <Link href="/play/pickaxe-ascent">Practice</Link>
            {signedIn ? (
              <>
                {' '}
                <Link href="/play/pickaxe-ascent?mode=ranked">Ranked</Link>
              </>
            ) : (
              <>
                {' '}
                <Link href="/auth/sign-in">Sign in to play ranked</Link>
              </>
            )}
          </p>
        </article>
        <article>
          <h2>Launch Lab</h2>
          <p>Aim, power, and tuck three counted launches through rings onto the deck.</p>
          <p>
            <Link href="/play/launch-lab">Practice</Link>
            {signedIn ? (
              <>
                {' '}
                <Link href="/play/launch-lab?mode=ranked">Ranked</Link>
              </>
            ) : (
              <>
                {' '}
                <Link href="/auth/sign-in">Sign in to play ranked</Link>
              </>
            )}
          </p>
        </article>
        <article>
          <h2>Ragdoll Archery Rush</h2>
          <p>Draw, aim, and release at static discs. Recoil is simulated.</p>
          <p>
            <Link href="/play/ragdoll-archery-rush">Practice</Link>
            {signedIn ? (
              <>
                {' '}
                <Link href="/play/ragdoll-archery-rush?mode=ranked">Ranked</Link>
              </>
            ) : (
              <>
                {' '}
                <Link href="/auth/sign-in">Sign in to play ranked</Link>
              </>
            )}
          </p>
        </article>
      </section>
    </main>
  );
}
