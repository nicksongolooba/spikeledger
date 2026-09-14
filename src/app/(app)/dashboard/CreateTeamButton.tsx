"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Plan } from "@prisma/client";
import { Plus } from "lucide-react";
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
