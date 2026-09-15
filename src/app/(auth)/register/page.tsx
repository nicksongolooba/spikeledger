"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Suspense, useState } from "react";
import { ClipboardList, Heart } from "lucide-react";
import { cn } from "@/lib/utils";

type Role = "COACH" | "PARENT";

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="card h-96 animate-pulse-soft" />}>
      <RegisterForm />
    </Suspense>
  );
}

function RegisterForm() {
  const router = useRouter();
  const search = useSearchParams();
  const inviteCode = search.get("invite");
  const [role, setRole] = useState<Role>(search.get("role") === "parent" ? "PARENT" : "COACH");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [parentCode, setParentCode] = useState(search.get("code") ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        password,
        role,
        inviteCode: role === "COACH" ? inviteCode ?? undefined : undefined,
        parentCode: role === "PARENT" && parentCode.trim() ? parentCode.trim() : undefined,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      joinedClub?: string | null;
      inviteError?: string | null;
      linkedPlayer?: string | null;
      parentCodeError?: string | null;
    };
    if (!res.ok) {
      setError(data.error || "Registration failed.");
      setLoading(false);
      return;
    }
    const signin = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (!signin || signin.error) {
      setError("Account created - please log in.");
      router.push("/login");
      return;
    }
    if (role === "PARENT") {
      // A bad code shouldn't strand them - settings lets them try again.
      router.push(data.parentCodeError ? "/parent/settings?codeError=1" : "/parent");
      router.refresh();
      return;
    }
    // Invited coaches land on their new club; the invite page handles any
    // join failure (expired/full) with a clear message.
    router.push(
      data.joinedClub ? "/club" : inviteCode ? `/invite/${inviteCode}` : "/dashboard",
    );
    router.refresh();
  }

  return (
    <div className="card p-7">
      <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
        Create your account
      </h1>
      <p className="mt-1 text-sm text-slate-600">
        {inviteCode
          ? "Create your account to join your club on SpikeLedger."
          : role === "PARENT"
            ? "Free for parents. You'll see your own child's stats, nothing else."
            : "Free forever for one team. No credit card required."}
      </p>

      {!inviteCode && (
        <div className="mt-5 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Account type">
          <RoleChoice
            active={role === "COACH"}
            onClick={() => setRole("COACH")}
            icon={<ClipboardList size={18} strokeWidth={2} aria-hidden />}
            title="I'm a coach"
            body="Teams, courtside stats, report cards"
          />
          <RoleChoice
            active={role === "PARENT"}
            onClick={() => setRole("PARENT")}
            icon={<Heart size={18} strokeWidth={2} aria-hidden />}
            title="I'm a parent"
            body="Follow my child with a code from the coach"
          />
        </div>
      )}

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="name" className="label">Name</label>
          <input
            id="name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input"
            placeholder={role === "PARENT" ? "Sam Reyes" : "Coach Smith"}
          />
        </div>
        <div>
          <label htmlFor="email" className="label">Email</label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
            placeholder={role === "PARENT" ? "parent@example.com" : "coach@example.com"}
          />
        </div>
        <div>
          <label htmlFor="password" className="label">Password</label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
            placeholder="At least 8 characters"
          />
        </div>
        <div>
          <label htmlFor="confirm" className="label">Confirm password</label>
          <input
            id="confirm"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="input"
            placeholder="Repeat password"
          />
        </div>
        {role === "PARENT" && (
          <div>
            <label htmlFor="parent-code" className="label">
              Parent code from the coach{" "}
              <span className="font-normal text-slate-500">(optional now, add later in settings)</span>
            </label>
            <input
              id="parent-code"
              type="text"
              value={parentCode}
              onChange={(e) => setParentCode(e.target.value.toUpperCase())}
              className="input stat-number text-lg tracking-wider"
              placeholder="HAWK-7K2"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
          {loading ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-cyan-700 hover:text-cyan-800">
          Log in
        </Link>
      </p>
    </div>
  );
}

function RoleChoice({
  active,
  onClick,
  icon,
  title,
  body,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "rounded-lg border-2 p-3 text-left transition-colors",
        active ? "border-navy-900 bg-navy-50" : "border-slate-200 bg-white hover:border-slate-400",
      )}
    >
      <span className={cn("flex items-center gap-2 font-semibold", active ? "text-navy-900" : "text-slate-900")}>
        {icon}
        {title}
      </span>
      <span className="mt-1 block text-xs text-slate-600">{body}</span>
    </button>
  );
}
