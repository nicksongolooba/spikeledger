"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface TeamSettings {
  id: string;
  name: string;
  ageGroup: string | null;
  season: string | null;
  usesPositions: boolean;
  allowParentView: boolean;
  playerCount: number;
}

export function TeamSettingsForm({ team }: { team: TeamSettings }) {
  const router = useRouter();
  const [name, setName] = useState(team.name);
  const [ageGroup, setAgeGroup] = useState(team.ageGroup ?? "");
  const [season, setSeason] = useState(team.season ?? "");
  const [usesPositions, setUsesPositions] = useState(team.usesPositions);
  const [allowParentView, setAllowParentView] = useState(team.allowParentView);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    const res = await fetch(`/api/teams/${team.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, ageGroup, season, usesPositions, allowParentView }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Could not save settings.");
      return;
    }
    // Turning positions ON for a team that had none: walk the coach through
    // assigning one to each player.
    if (usesPositions && !team.usesPositions && team.playerCount > 0) {
      router.push(`/team/${team.id}/roster?assignPositions=1`);
      router.refresh();
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <section className="card p-5">
        <h2 className="font-display text-lg font-bold text-slate-900">Team</h2>
        <div className="mt-4 space-y-4">
          <div>
            <label htmlFor="t-name" className="label">Team name</label>
            <input id="t-name" required value={name} onChange={(e) => setName(e.target.value)} className="input" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="t-age" className="label">Age group</label>
              <input id="t-age" value={ageGroup} onChange={(e) => setAgeGroup(e.target.value)} className="input" placeholder="16U" />
            </div>
            <div>
              <label htmlFor="t-season" className="label">Season</label>
              <input id="t-season" value={season} onChange={(e) => setSeason(e.target.value)} className="input" placeholder="2025-2026" />
            </div>
          </div>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="font-display text-lg font-bold text-slate-900">
          Does your team play with set positions?
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Younger teams usually rotate everyone through everything. You can
          switch this any time - positions are kept in the background.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <ModeOption
            active={usesPositions}
            onClick={() => setUsesPositions(true)}
            title="Yes - set positions"
            body="Setters, liberos, hitters, middles. Position-fair Bank Account."
          />
          <ModeOption
            active={!usesPositions}
            onClick={() => setUsesPositions(false)}
            title="No - everyone rotates"
            body="Every player is scored on the same all-around formula."
          />
        </div>
        {usesPositions !== team.usesPositions && (
          <p className="mt-3 flex items-start gap-2 text-xs text-slate-600">
            <AlertTriangle size={14} strokeWidth={2} className="mt-0.5 shrink-0 text-amber-600" aria-hidden />
            {usesPositions
              ? "After saving you'll be asked to give each player a position. The Bank Account switches back to position-fair rules."
              : "Positions stay saved but are hidden. The Bank Account recalculates with the universal formula for the whole season."}
          </p>
        )}
      </section>

      <section className="card p-5">
        <h2 className="font-display text-lg font-bold text-slate-900">Parents</h2>
        <label className="mt-3 flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={allowParentView}
            onChange={(e) => setAllowParentView(e.target.checked)}
            className="mt-1 h-4 w-4 accent-orange-500"
          />
          <span>
            <span className="block font-semibold text-slate-900">Allow parent live view</span>
            <span className="block text-sm text-slate-600">
              Linked parents can see their own child&apos;s stats, live during
              matches and across the season. Turn it off to pause every
              parent&apos;s view without unlinking anyone.
            </span>
          </span>
        </label>
      </section>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertTriangle size={16} strokeWidth={2} className="mt-0.5 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={busy} className="btn-primary">
          {busy ? "Saving…" : "Save settings"}
        </button>
        {saved && (
          <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700">
            <Check size={16} strokeWidth={2.5} aria-hidden />
            Saved
          </span>
        )}
      </div>
    </form>
  );
}

function ModeOption({
  active,
  onClick,
  title,
  body,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  body: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-lg border-2 p-4 text-left transition-colors",
        active ? "border-navy-900 bg-navy-50" : "border-slate-200 bg-white hover:border-slate-400",
      )}
    >
      <span className="block font-semibold text-slate-900">{title}</span>
      <span className="mt-1 block text-sm text-slate-600">{body}</span>
    </button>
  );
}
