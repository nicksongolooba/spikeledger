"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Plan } from "@prisma/client";
import { Plus } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useUpgradePrompt } from "@/components/billing/UpgradePrompt";
import { canUserPerformAction } from "@/lib/plan-limits";
import { suggestUsesPositions } from "@/lib/positions";
import { cn } from "@/lib/utils";

export function CreateTeamButton({
  variant = "default",
  plan,
  currentTeamCount,
}: {
  variant?: "default" | "prominent";
  plan: Plan;
  currentTeamCount: number;
}) {
  const router = useRouter();
  const upgrade = useUpgradePrompt();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [ageGroup, setAgeGroup] = useState("");
  const [season, setSeason] = useState("");
  // Suggested from the age group until the coach picks explicitly.
  const [usesPositions, setUsesPositions] = useState<boolean>(true);
  const [positionsTouched, setPositionsTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onAgeGroupChange(value: string) {
    setAgeGroup(value);
    if (!positionsTouched) setUsesPositions(suggestUsesPositions(value));
  }
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, ageGroup, season, usesPositions }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Could not create team.");
      return;
    }
    const team = await res.json();
    setOpen(false);
    router.push(`/team/${team.id}`);
    router.refresh();
  }

  function tryOpen() {
    const check = canUserPerformAction(plan, "add-team", {
      currentTeamCount,
    });
    if (!check.allowed && check.reason) {
      upgrade.open(check.reason);
      return;
    }
    setOpen(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={tryOpen}
        className={variant === "prominent" ? "btn-primary px-5 py-2.5" : "btn-primary"}
      >
        <Plus size={16} strokeWidth={2.5} aria-hidden />
        New team
      </button>
      {upgrade.modal}
      <Modal open={open} onClose={() => setOpen(false)} title="Create a new team">
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="team-name" className="label">Team name</label>
            <input
              id="team-name"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
              placeholder="Lakeshore Storm 16U"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="age-group" className="label">Age group</label>
              <input
                id="age-group"
                value={ageGroup}
                onChange={(e) => onAgeGroupChange(e.target.value)}
                className="input"
                placeholder="16U"
              />
            </div>
            <div>
              <label htmlFor="season" className="label">Season</label>
              <input
                id="season"
                value={season}
                onChange={(e) => setSeason(e.target.value)}
                className="input"
                placeholder="2025-2026"
              />
            </div>
          </div>

          <fieldset>
            <legend className="label">Does your team play with set positions?</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              <PositionsChoice
                active={usesPositions}
                onClick={() => { setUsesPositions(true); setPositionsTouched(true); }}
                title="Yes"
                body="We have setters, liberos, hitters, middles"
              />
              <PositionsChoice
                active={!usesPositions}
                onClick={() => { setUsesPositions(false); setPositionsTouched(true); }}
                title="No"
                body="Everyone rotates through all positions"
              />
            </div>
            <p className="mt-1.5 text-xs text-slate-500">
              {ageGroup.trim()
                ? `Suggested for ${ageGroup.trim()}: ${suggestUsesPositions(ageGroup) ? "set positions" : "no positions"}. You can change it later in team settings.`
                : "12U to 14U teams usually pick no. You can change it later in team settings."}
            </p>
          </fieldset>

          {error && (
            <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Creating…" : "Create team"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

function PositionsChoice({
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
        "rounded-md border-2 px-3 py-2.5 text-left transition-colors",
        active ? "border-navy-900 bg-navy-50" : "border-slate-200 bg-white hover:border-slate-400",
      )}
    >
      <span className="block font-semibold text-slate-900">{title}</span>
      <span className="block text-xs text-slate-600">{body}</span>
    </button>
  );
}
