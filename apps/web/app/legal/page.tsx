import Link from 'next/link';

const OPERATOR_EMAIL = process.env.OPERATOR_EMAIL ?? 'operator@stickworldtournament.com';

export default function LegalPage() {
  return (
    <main>
      <h1>Legal and community terms</h1>
      <p>
        Stickworld Tournament is for people who are 13 or older. Creating an account confirms that
        you meet this age policy.
      </p>
      <h2>Handles and reports</h2>
      <p>
        Player handles are user-generated content. Do not impersonate others or choose offensive
        handles. Anyone may report a handle through the public reporting service.
      </p>
      <h2>Your data</h2>
      <p>
        Signed-in players may export their account data and delete their profile. Deletion
        anonymises tournament records so verified standings remain auditable; the public display
        name becomes “retired.”
      </p>
      <h2>Tournament terms</h2>
      <p>
        Stickworld Tournament is a recreational competition. There are no prizes, cash awards, or
        prize substitutes.
      </p>
      <h2>Operator and redress</h2>
      <p>
        To question a moderation decision or contact the operator, email{' '}
        <a href={`mailto:${OPERATOR_EMAIL}`}>{OPERATOR_EMAIL}</a>.
      </p>
      <p>
        <Link href="/">Return to Stickworld Tournament</Link>
      </p>
    </main>
  );
}
