"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check } from "lucide-react";

// Redeem a parent code: "HAWK-7K2" -> linked player.
export function LinkPlayerForm({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linked, setLinked] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setLinked(null);
    const res = await fetch("/api/parent/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; player?: { name: string } };
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not link that code.");
      return;
    }
    setLinked(data.player?.name ?? "Player");
    setCode("");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className={compact ? "" : "card p-5"}>
      {!compact && (
        <>
          <div className="eyebrow">Add a player</div>
          <h2 className="mt-1 font-display text-2xl font-bold text-slate-900">
            Enter the code from the coach
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            The coach creates it from the roster page. It looks like HAWK-7K2.
            Have more than one kid playing? Add each code here.
          </p>
        </>
      )}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          className="input stat-number text-lg tracking-wider sm:max-w-xs"
          placeholder="HAWK-7K2"
          aria-label="Parent code"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          required
        />
        <button type="submit" disabled={busy || code.trim().length < 5} className="btn-primary">
          {busy ? "Linking…" : "Link player"}
        </button>
      </div>
      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertTriangle size={16} strokeWidth={2} className="mt-0.5 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      )}
      {linked && (
        <div className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700">
          <Check size={16} strokeWidth={2.5} aria-hidden />
          Linked to {linked}.
        </div>
      )}
    </form>
  );
}
