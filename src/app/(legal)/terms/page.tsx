import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service - SpikeLedger",
  description: "The terms that govern your use of SpikeLedger.",
};

const UPDATED = "June 11, 2026";

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-10 text-lg font-bold text-slate-100">{children}</h2>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-sm leading-relaxed text-slate-300">{children}</p>;
}

export default function TermsPage() {
  return (
    <article>
      <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
      <p className="mt-2 text-sm text-slate-500">Last updated: {UPDATED}</p>

      <P>
        These terms govern your use of SpikeLedger, a volleyball analytics
        service operated from Canada. By creating an account or using the
        service you agree to these terms. If you don&apos;t agree, don&apos;t
        use SpikeLedger.
      </P>

      <H2>Your account</H2>
      <P>
        You are responsible for your account credentials and for everything
        recorded under your account. You must provide accurate information
        and be at least the age of majority in your province or territory to
        create an account. When you enter information about athletes -
        especially minors - you confirm you have the authority or consent to
        do so.
      </P>

      <H2>Acceptable use</H2>
      <P>
        Use SpikeLedger for coaching and team management. You agree not to:
        attempt to access other users&apos; data without authorization; probe,
        scan, or disrupt the service; scrape or bulk-extract data; upload
        unlawful, harassing, or infringing content; resell the service; or
        use it to harm the athletes whose data it holds. We may suspend or
        terminate accounts that violate these rules.
      </P>

      <H2>Subscriptions, billing, and cancellation</H2>
      <P>
        Paid plans (Coach Pro and Club) bill monthly or yearly through
        Stripe and renew automatically until cancelled. You can cancel any
        time from Settings → Billing; your plan stays active until the end of
        the period you&apos;ve paid for, after which the account moves to the
        Free plan and its limits. Except where required by law, payments are
        non-refundable. We may change pricing with at least 30 days&apos;
        notice before it affects your renewal.
      </P>

      <H2>Your data</H2>
      <P>
        You own the team and player data you enter. You grant us the limited
        rights needed to operate the service (storing, processing, and
        displaying the data, including AI-generated insights you request).
        Our handling of personal information is described in the{" "}
        <a className="text-volt-300 hover:text-volt-200" href="/privacy">
          Privacy Policy
        </a>
        .
      </P>

      <H2>Service availability</H2>
      <P>
        We aim to keep SpikeLedger reliable, but the service is provided
        &quot;as is&quot; and &quot;as available&quot; without warranties of
        any kind, express or implied. Features may change, and we may
        modify or discontinue parts of the service with reasonable notice.
      </P>

      <H2>Limitation of liability</H2>
      <P>
        To the maximum extent permitted by law, SpikeLedger and its operator
        are not liable for indirect, incidental, special, consequential, or
        punitive damages, or for loss of data, revenue, or goodwill arising
        from your use of the service. Our total liability for any claim is
        limited to the amount you paid us in the twelve months before the
        claim arose. Coaching decisions remain yours - statistics and AI
        insights are informational tools, not professional advice.
      </P>

      <H2>Termination</H2>
      <P>
        You may stop using SpikeLedger and request account deletion at any
        time. We may suspend or terminate accounts that breach these terms or
        create risk for the service or other users, with notice where
        practicable.
      </P>

      <H2>Governing law</H2>
      <P>
        These terms are governed by the laws of the Province of Ontario and
        the federal laws of Canada applicable in it. Disputes will be
        resolved in the courts of Ontario.
      </P>

      <H2>Contact</H2>
      <P>
        Questions about these terms:{" "}
        <a className="text-volt-300 hover:text-volt-200" href="mailto:spikeledger06@gmail.com">
          spikeledger06@gmail.com
        </a>
        .
      </P>
    </article>
  );
}
