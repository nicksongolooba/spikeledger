"use client";

// Owner-only invite tool: create an invite by email, get a copyable link.
// No email delivery yet - the owner shares the link themselves.

import { useState } from "react";
import { useRouter } from "next/navigation";

interface PendingInvite {
  id: string;
  email: string;
  code: string;
  expiresAt: string;
}

export function InvitePanel({
  pending,
  atCapacity,
}: {
  pending: PendingInvite[];
  atCapacity: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  function linkFor(code: string) {
    return `${window.location.origin}/invite/${code}`;
  }

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Clipboard can be unavailable in some webviews - show the URL instead.
      setCreatedUrl(text);
    }
  }

  async function createInvite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setCreatedUrl(null);
    const res = await fetch("/api/club/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = (await res.json().catch(() => null)) as {
      url?: string;
      error?: string;
    } | null;
    setBusy(false);
    if (!res.ok || !data?.url) {
      setError(data?.error ?? "Could not create the invite - try again.");
      return;
    }
    setCreatedUrl(data.url);
    setEmail("");
    router.refresh();
  }

  async function revoke(id: string) {
    await fetch(`/api/club/invites/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="card p-5">
      {atCapacity ? (
        <p className="text-sm text-amber-700">
          Your club is at the 15-coach maximum. Remove a coach before inviting
          another.
        </p>
      ) : (
        <form onSubmit={createInvite} className="flex flex-col gap-2 sm:flex-row">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input sm:flex-1"
            placeholder="coach@example.com"
            aria-label="Coach email"
          />
          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? "Creating…" : "Create invite link"}
          </button>
        </form>
      )}

      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

      {createdUrl && (
        <div className="mt-4 rounded-lg border border-orange-300 bg-orange-50 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-orange-700">
            Invite link created - share it with your coach
          </div>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded bg-slate-50 px-2 py-1.5 text-xs text-slate-700">
              {createdUrl}
            </code>
            <button
              type="button"
              onClick={() => copy(createdUrl, "new")}
              className="btn-secondary shrink-0 px-3 py-1.5 text-xs"
            >
              {copied === "new" ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      )}

      {pending.length > 0 && (
        <div className="mt-5">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Pending invites
          </div>
          <ul className="divide-y divide-slate-200">
            {pending.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-sm text-slate-800">{inv.email}</div>
                  <div className="text-xs text-slate-500">
                    Expires {new Date(inv.expiresAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => copy(linkFor(inv.code), inv.id)}
                    className="btn-secondary px-3 py-1.5 text-xs"
                  >
                    {copied === inv.id ? "Copied!" : "Copy link"}
                  </button>
                  <button
                    type="button"
                    onClick={() => revoke(inv.id)}
                    className="btn-danger px-3 py-1.5 text-xs"
                  >
                    Revoke
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
