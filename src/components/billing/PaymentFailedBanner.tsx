import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import type { DunningState } from "@/lib/dunning";

// Shown to the person who holds the subscription, and to nobody else.
//
// Invited coaches never see this. They cannot update someone else's card, so
// warning them would only cause alarm about something they cannot fix. It is
// rendered from the signed-in user's own row, which is what keeps it that way.
export function PaymentFailedBanner({ state }: { state: DunningState }) {
  if (!state.failing || !state.deadlineLabel) return null;
  const what = state.isClub ? "club access" : "Coach Pro";
  return (
    <div className="mb-4 flex flex-wrap items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <AlertTriangle size={18} strokeWidth={2} className="mt-0.5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">
          Payment failed. Update your card by {state.deadlineLabel} to keep {what}.
        </p>
        <p className="mt-0.5 text-amber-800">
          {state.isClub
            ? "Everything keeps working until then, for you and for every coach in the club."
            : "Everything keeps working until then."}
        </p>
      </div>
      <Link href="/api/stripe/portal-redirect" className="btn-primary shrink-0 px-3 py-1.5 text-xs">
        Update card
      </Link>
    </div>
  );
}
