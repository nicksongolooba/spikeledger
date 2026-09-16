"use client";

import { useState } from "react";
import { Check, Copy, Link2Off } from "lucide-react";
import { SHARE_LINK_NOTICE } from "@/lib/share-links";
import { cn, formatDate } from "@/lib/utils";

export interface ShareLinkRow {
  id: string;
  playerLabel: string;
  scopeLabel: string;
  createdAt: string; // ISO
  expiresAt: string | null; // ISO
  daysLeft: number;
}

// Every public link this team has open, and a way to turn any of them off.
// A coach who texts a link to the wrong group chat needs this to be one tap,
// not a support request.
export function ShareLinkList({ links }: { links: ShareLinkRow[] }) {
  const [rows, setRows] = useState(links);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function revoke(id: string) {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/reports/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("The server would not turn that link off.");
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function copy(id: string) {
    const url = `${window.location.origin}/share/${id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(id);
      setTimeout(() => setCopied((c) => (c === id ? null : c)), 2000);
    } catch {
      setError("Copying is blocked in this browser. The link is /share/" + id);
    }
  }

  return (
    <section className="card mt-10 overflow-hidden">
      <div className="border-b border-slate-200 px-5 py-3.5">
        <h2 className="font-display text-lg font-bold text-slate-900">Active share links</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          {SHARE_LINK_NOTICE} Turn one off here and it stops working straight away.
        </p>
      </div>

      {error && (
        <p className="border-b border-red-200 bg-red-50 px-5 py-2 text-sm text-red-700">{error}</p>
      )}

      {rows.length === 0 ? (
        <p className="px-5 py-4 text-sm text-slate-600">
          No share links are open for this team.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-slate-900">{row.playerLabel}</div>
                <div className="text-xs text-slate-500">
                  {row.scopeLabel} · made {formatDate(row.createdAt)} ·{" "}
                  <span className={cn(row.daysLeft <= 3 && "font-semibold text-amber-700")}>
                    {row.daysLeft === 0
                      ? "expires today"
                      : `${row.daysLeft} ${row.daysLeft === 1 ? "day" : "days"} left`}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => void copy(row.id)}
                  className="btn-ghost px-2 py-1 text-xs"
                >
                  {copied === row.id ? (
                    <>
                      <Check size={14} strokeWidth={2.5} aria-hidden />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy size={14} strokeWidth={2} aria-hidden />
                      Copy
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => void revoke(row.id)}
                  disabled={busy === row.id}
                  className="btn-ghost px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                >
                  <Link2Off size={14} strokeWidth={2} aria-hidden />
                  {busy === row.id ? "Turning off…" : "Turn off"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
