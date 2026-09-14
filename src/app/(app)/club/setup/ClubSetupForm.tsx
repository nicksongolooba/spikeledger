"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ClubSetupForm({
  initial,
}: {
  initial: { name: string; logo: string; province: string };
}) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [logo, setLogo] = useState(initial.logo);
  const [province, setProvince] = useState(initial.province);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/club", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, logo, province }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Could not save - try again.");
      setBusy(false);
      return;
    }
    router.push("/club");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="club-name" className="label">Club name</label>
        <input
          id="club-name"
          type="text"
          required
          minLength={2}
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input"
          placeholder="Durham Attack Volleyball Club"
        />
      </div>
      <div>
        <label htmlFor="club-logo" className="label">
          Logo URL <span className="text-slate-500">(optional)</span>
        </label>
        <input
          id="club-logo"
          type="url"
          value={logo}
          onChange={(e) => setLogo(e.target.value)}
          className="input"
          placeholder="https://yourclub.com/logo.png"
        />
        <p className="mt-1 text-xs text-slate-500">
          Paste a link to your club crest - direct image uploads are coming.
        </p>
      </div>
      <div>
        <label htmlFor="club-province" className="label">
          Province / state <span className="text-slate-500">(optional)</span>
        </label>
        <input
          id="club-province"
          type="text"
          maxLength={40}
          value={province}
          onChange={(e) => setProvince(e.target.value)}
          className="input"
          placeholder="Province / State"
        />
      </div>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <button type="submit" disabled={busy} className="btn-primary w-full py-2.5">
        {busy ? "Saving…" : "Save club"}
      </button>
    </form>
  );
}
