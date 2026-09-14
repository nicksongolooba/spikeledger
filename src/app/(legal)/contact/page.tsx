import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact - SpikeLedger",
  description: "Get in touch with the SpikeLedger team.",
};

export default function ContactPage() {
  return (
    <article className="text-center sm:text-left">
      <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl text-slate-900">Contact</h1>
      <p className="mt-4 text-base leading-relaxed text-slate-700">
        Questions or feedback? Email us at{" "}
        <a
          className="font-semibold text-cyan-700 hover:text-cyan-800"
          href="mailto:support@spikeledger.com"
        >
          support@spikeledger.com
        </a>
        .
      </p>
      <p className="mt-3 text-sm text-slate-600">
        We&apos;re a small team built by a volleyball coach - we read
        everything, and feature ideas from working coaches shape what gets
        built next.
      </p>
    </article>
  );
}
