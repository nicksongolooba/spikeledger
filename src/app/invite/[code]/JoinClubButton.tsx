"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function JoinClubButton({ code }: { code: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/club/invites/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    if (!res.ok) {
      setError(data?.error ?? "Something went wrong - try again.");
      setBusy(false);
      return;
    }
    router.push("/club");
    router.refresh();
  }

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={join}
        disabled={busy}
        className="btn-primary w-full"
      >
        {busy ? "Joining…" : "Join club"}
      </button>
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
    </div>
  );
}
