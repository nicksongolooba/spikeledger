"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Plan } from "@prisma/client";
import { Modal } from "@/components/ui/Modal";
import { useUpgradePrompt } from "@/components/billing/UpgradePrompt";
import { canUserPerformAction } from "@/lib/plan-limits";

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
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, ageGroup, season }),
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
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
        </svg>
        New Team
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
              placeholder="Thunder Hawks 16U"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="age-group" className="label">Age group</label>
              <input
                id="age-group"
                value={ageGroup}
                onChange={(e) => setAgeGroup(e.target.value)}
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

          {error && (
            <div className="rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-300">
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
