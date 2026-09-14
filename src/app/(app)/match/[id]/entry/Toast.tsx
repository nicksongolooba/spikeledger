"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type ToastTone = "success" | "danger" | "info";

export interface ToastMsg {
  id: string;
  text: string;
  tone: ToastTone;
}

export function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: ToastMsg[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-16 z-40 flex flex-col items-center gap-1.5 px-3 lg:top-4">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastMsg;
  onDismiss: (id: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    setVisible(true);
    const t = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onDismiss(toast.id), 200);
    }, 1500);
    return () => clearTimeout(t);
  }, [toast.id, onDismiss]);

  const toneClass =
    toast.tone === "success"
      ? "border-emerald-300 bg-emerald-50 text-emerald-800"
      : toast.tone === "danger"
        ? "border-red-300 bg-red-50 text-red-800"
        : "border-navy-200 bg-navy-50 text-navy-800";
  return (
    <div
      className={cn(
        "pointer-events-auto inline-flex max-w-[90%] items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-semibold shadow-lift transition-all",
        toneClass,
        visible ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0",
      )}
    >
      {toast.text}
    </div>
  );
}
