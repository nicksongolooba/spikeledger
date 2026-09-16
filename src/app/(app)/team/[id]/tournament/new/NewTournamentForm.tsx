"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, Plus } from "lucide-react";

export function NewTournamentForm({ teamId }: { teamId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [location, setLocation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch(`/api/teams/${teamId}/tournaments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        startDate,
        endDate: endDate || null,
        location: location || null,
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Could not create tournament.");
      return;
    }
    const tournament = await res.json();
    // "That was your last free tournament" and the courtesy banner both ride
    // back on the create response. Carried through so the tournament page can
    // say it once, in a calm moment, instead of a paywall appearing later.
    const query = tournament.notice
      ? `?notice=${encodeURIComponent(tournament.notice)}`
      : "";
    router.push(`/team/${teamId}/tournament/${tournament.id}${query}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-4 p-6">
      <div>
        <label htmlFor="t-name" className="label">Tournament name</label>
        <input
          id="t-name"
          required
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input"
          placeholder="OVA 16U Tournament 1"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="t-start" className="label">Start date</label>
          <input
            id="t-start"
            required
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="input"
          />
        </div>
        <div>
          <label htmlFor="t-end" className="label">
            End date <span className="font-normal text-slate-500">(optional)</span>
          </label>
          <input
            id="t-end"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="input"
          />
        </div>
      </div>
      <div>
        <label htmlFor="t-loc" className="label">
          Location <span className="font-normal text-slate-500">(optional)</span>
        </label>
        <input
          id="t-loc"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="input"
          placeholder="Toronto Pan Am Centre"
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertTriangle
            size={16}
            strokeWidth={2}
            className="mt-0.5 shrink-0"
            aria-hidden
          />
          <span>{error}</span>
        </div>
      )}

      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <button type="submit" disabled={loading} className="btn-primary">
          <Plus size={18} strokeWidth={2} aria-hidden />
          {loading ? "Creating…" : "Create tournament"}
        </button>
      </div>
    </form>
  );
}
