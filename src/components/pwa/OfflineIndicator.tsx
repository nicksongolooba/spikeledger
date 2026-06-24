"use client";

import { useEffect, useState } from "react";

// Global "you're offline" pill, shown on every page. The courtside entry page
// also reflects offline state inline; this gives consistent feedback app-wide.
export function OfflineIndicator() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-0 z-[200] flex justify-center px-3"
      style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
    >
      <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-400/15 px-3 py-1.5 text-xs font-semibold text-amber-200 shadow-lg backdrop-blur">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
        Offline - stats will sync when connected
      </div>
    </div>
  );
}
