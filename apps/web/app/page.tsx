import type { ReactNode } from 'react';
import Image from 'next/image';
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
      <header style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
        <Image
          src="/assets/brand/logo.svg"
          alt="Stickworld Tournament logo"
          width={72}
          height={72}
          style={{ maxWidth: '100%', height: 'auto' }}
          priority
        />
        <Image
          src="/assets/brand/wordmark.svg"
          alt="Stickworld Tournament wordmark"
          width={420}
          height={72}
          style={{ maxWidth: '100%', height: 'auto', minWidth: 0 }}
          priority
        />
      </header>
      <h1>Stickworld Tournament</h1>
      <p>Scores count only after the server re-simulates the replay.</p>
      <section aria-labelledby="championship-heading">
        <h2 id="championship-heading">Championship</h2>
        <p>
          Nine fixed-course games count toward the championship. Pogo Tower is weekly-only. Maximum
          championship total: 9,000 points.
        </p>
      </section>
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
        <article>
          <h2>Hammer Throw Havoc</h2>
          <p>Spin up and release three counted throws through gates.</p>
          <p>
            <Link href="/play/hammer-throw-havoc">Practice</Link>
            {signedIn ? (
              <>
                {' '}
                <Link href="/play/hammer-throw-havoc?mode=ranked">Ranked</Link>
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
          <h2>Pogo Tower</h2>
          <p>Auto-bounce and lean up a weekly-seeded tower of shrinking ledges.</p>
          <p>
            <Link href="/play/pogo-tower">Practice</Link>
            {signedIn ? (
              <>
                {' '}
                <Link href="/play/pogo-tower?mode=ranked">Ranked</Link>
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
          <h2>Rooftop Relay</h2>
          <p>Jump and slide a kinematic runner across authored roofs.</p>
          <p>
            <Link href="/play/rooftop-relay">Practice</Link>
            {signedIn ? (
              <>
                {' '}
                <Link href="/play/rooftop-relay?mode=ranked">Ranked</Link>
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
          <h2>Balance Bike Blitz</h2>
          <p>Throttle, brake, and lean a two-wheel assembly over static ramps.</p>
          <p>
            <Link href="/play/balance-bike-blitz">Practice</Link>
            {signedIn ? (
              <>
                {' '}
                <Link href="/play/balance-bike-blitz?mode=ranked">Ranked</Link>
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
          <h2>Cargo Chaos</h2>
          <p>Hook between posts while a jointed crate keeps its integer condition.</p>
          <p>
            <Link href="/play/cargo-chaos">Practice</Link>
            {signedIn ? (
              <>
                {' '}
                <Link href="/play/cargo-chaos?mode=ranked">Ranked</Link>
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
          <h2>Demolition Dive</h2>
          <p>Aim three counted ragdoll dives into an authored stack of breakable cuboids.</p>
          <p>
            <Link href="/play/demolition-dive">Practice</Link>
            {signedIn ? (
              <>
                {' '}
                <Link href="/play/demolition-dive?mode=ranked">Ranked</Link>
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
