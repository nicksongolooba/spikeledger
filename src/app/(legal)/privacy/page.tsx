import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy - SpikeLedger",
  description: "How SpikeLedger collects, uses, and protects your data.",
};

const UPDATED = "September 14, 2026";

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display text-2xl font-bold tracking-tight mt-10 text-slate-900">{children}</h2>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-sm leading-relaxed text-slate-700">{children}</p>;
}

export default function PrivacyPage() {
  return (
    <article>
      <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl text-slate-900">Privacy Policy</h1>
      <p className="mt-2 text-sm text-slate-500">Last updated: {UPDATED}</p>

      <P>
        SpikeLedger (&quot;we&quot;, &quot;us&quot;) is a volleyball analytics
        service operated from Canada. This policy explains what information we
        collect, how we use it, and the choices you have. By using
        SpikeLedger, you agree to the practices described here.
      </P>

      <H2>What we collect</H2>
      <P>
        <strong>Account information:</strong> your name, email address, and a
        securely hashed password when you create an account, plus your club
        name and region if you set up a club.
      </P>
      <P>
        <strong>Team and player data:</strong> player names, jersey numbers,
        positions, and the volleyball performance statistics you record
        (serves, passes, attacks, blocks, digs, and derived metrics). Coaches
        are responsible for having appropriate permission - typically from a
        parent or guardian for youth athletes - before entering player
        information.
      </P>
      <P>
        <strong>Billing information:</strong> payments are processed by
        Stripe. We never see or store your full card number - we keep only
        your subscription status and a customer reference.
      </P>
      <P>
        <strong>Usage data:</strong> basic technical logs (such as page
        requests and error reports) used to keep the service running and
        secure.
      </P>

      <H2>How we use your data</H2>
      <P>
        We use your data solely to provide SpikeLedger&apos;s features:
        calculating statistics and Bank Account metrics, generating report
        cards and share links you create, powering AI coaching insights, and
        operating your subscription. When AI features are enabled, relevant
        team statistics are sent to our AI processing providers to generate
        insights; those providers are contractually limited to processing the
        data on our behalf.
      </P>

      <H2>What we don&apos;t do</H2>
      <P>
        We do not sell your data - or your players&apos; data - to third
        parties. We do not use player statistics for advertising. We do not
        share team data with anyone outside your account except as you direct
        (for example, public share links you generate) or as required by law.
      </P>

      <H2>Storage and security</H2>
      <P>
        Data is stored securely with encryption in transit (HTTPS/TLS
        everywhere) and at rest with our hosting providers. Passwords are
        stored only as salted bcrypt hashes. Access to production data is
        restricted to what is necessary to operate the service.
      </P>

      <H2>Sharing within clubs</H2>
      <P>
        Teams are private to the coach who created them. On the Club plan,
        the club owner can additionally view the club&apos;s teams for
        oversight. Public share links you create (for example, parent report
        cards) are viewable by anyone with the link - share them carefully.
      </P>

      <H2>Parent access</H2>
      <P>
        Coaches can give a parent or guardian a short access code for one
        player. A parent who redeems the code on a free parent account can see
        that player&apos;s statistics only: their own child&apos;s stat lines,
        Bank Account rating, season trend, report cards and coaching focus
        areas, plus team-wide averages for context. Parents never see another
        player&apos;s name or statistics, the roster, lineups, position-group
        comparisons, or the coach&apos;s tactical notes. Live updates during
        a match show the same child-only numbers.
      </P>
      <P>
        Access follows the coach: a coach can revoke a parent code at any time
        (which unlinks every parent using it), pause the parent view for a
        whole team, or remove the player from the roster - each ends the
        parent&apos;s access immediately. A parent can also unlink a player
        from their own settings. Parent accounts collect only a name, email
        address and password.
      </P>

      <H2>Data retention and deletion</H2>
      <P>
        We keep your data while your account is active. Coaches can request
        deletion of their account, their teams, or specific player data at
        any time by emailing{" "}
        <a className="text-orange-700 hover:text-orange-800" href="mailto:support@spikeledger.com">
          support@spikeledger.com
        </a>
        . We will delete the requested data within 30 days, except where we
        must retain records for legal or billing-compliance reasons.
      </P>

      <H2>Your rights</H2>
      <P>
        Under Canadian privacy law (PIPEDA), you may request access to or
        correction of personal information we hold about you, withdraw
        consent, or ask questions about our practices - all via the support
        email above.
      </P>

      <H2>Changes</H2>
      <P>
        If we make material changes to this policy, we will update this page
        and note the new date above. Continued use of SpikeLedger after a
        change means you accept the updated policy.
      </P>
    </article>
  );
}
