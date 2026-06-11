"use client";

// "Ask Coach AI" - floating chat assistant for Coach Pro / Club coaches.
// Renders a pill button bottom-right; tapping it slides in a chat panel from
// the right (full-screen on mobile). Conversation lives in React state for
// the session only. Free-plan coaches get the upgrade prompt instead.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { youtubeSearchUrl } from "@/lib/youtube";

const UNAVAILABLE = "AI chat is temporarily unavailable. Try again in a moment.";

export type ChatContextType = "team" | "tournament" | "player" | "match";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  error?: boolean;
}

function Sparkle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2l1.6 4.4L18 8l-4.4 1.6L12 14l-1.6-4.4L6 8l4.4-1.6zM19 14l.9 2.4 2.4.9-2.4.9L19 20.6l-.9-2.4-2.4-.9 2.4-.9z" />
    </svg>
  );
}

// Render assistant text, converting [drill: search terms] tags into YouTube
// search links - same no-URL-trust pattern as the coaching insights.
function MessageBody({ content }: { content: string }) {
  const parts = content.split(/\[drill:\s*([^\]]+)\]/g);
  return (
    <div className="whitespace-pre-wrap break-words">
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <a
            key={i}
            href={youtubeSearchUrl(part)}
            target="_blank"
            rel="noopener noreferrer"
            className="my-0.5 inline-flex items-center gap-1 rounded-md border border-red-400/40 bg-red-400/10 px-2 py-0.5 text-xs font-semibold text-red-200 hover:bg-red-400/20"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3">
              <path d="M8 5v14l11-7z" />
            </svg>
            Watch: {part.trim()}
          </a>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-1">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </div>
  );
}

export function CoachChat({
  teamId,
  canChat,
  upgradeText,
  contextType = "team",
  contextId,
  contextName,
}: {
  teamId: string;
  canChat: boolean;
  upgradeText?: string;
  contextType?: ChatContextType;
  contextId?: string;
  contextName: string; // team / tournament / player name or opponent
}) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false); // drives the slide-in transition
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => setMounted(true), []);

  // Slide the panel in one frame after it mounts so the transform transitions.
  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => setShown(true));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, busy, open]);

  function close() {
    setShown(false);
    setTimeout(() => setOpen(false), 200);
  }

  const greeting =
    contextType === "tournament"
      ? `Ask me about ${contextName}.`
      : contextType === "player"
        ? `Ask me about ${contextName}.`
        : contextType === "match"
          ? `Ask me about this match vs ${contextName}.`
          : `How can I help with ${contextName}?`;

  const suggestions =
    contextType === "player"
      ? [`How is ${contextName} trending?`, `What should ${contextName} work on?`]
      : contextType === "match"
        ? ["Why did we lose this match?", "Who stood out in this match?"]
        : [
            "Who is my best passer?",
            "Who should I start against a strong serving team?",
            "Give me a practice plan based on our weaknesses",
          ];

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: message }]);
    setBusy(true);
    try {
      const history = messages
        .filter((m) => !m.error)
        .slice(-12)
        .map((m) => ({ role: m.role, content: m.content }));
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          message,
          history,
          context:
            contextType !== "team" && contextId
              ? { type: contextType, id: contextId }
              : undefined,
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        response?: string;
        remaining?: number;
        error?: string;
      } | null;
      if (!res.ok || !data?.response) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data?.error || UNAVAILABLE, error: true },
        ]);
        if (typeof data?.remaining === "number") setRemaining(data.remaining);
        return;
      }
      setMessages((prev) => [...prev, { role: "assistant", content: data.response! }]);
      if (typeof data.remaining === "number") setRemaining(data.remaining);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: UNAVAILABLE, error: true },
      ]);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  if (!mounted) return null;

  return createPortal(
    <>
      {/* Floating trigger pill */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-[90] inline-flex items-center gap-2 rounded-full border border-cyan-400/40 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-cyan-300 shadow-xl shadow-cyan-950/50 transition hover:bg-slate-800 hover:text-cyan-200"
        >
          <Sparkle className="h-4 w-4" />
          Ask Coach AI
        </button>
      )}

      {/* Slide-in panel */}
      {open && (
        <div className="fixed inset-0 z-[95]">
          <div
            className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px]"
            onMouseDown={close}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Ask Coach AI"
            className={`absolute right-0 top-0 flex h-full w-full flex-col border-l border-slate-800 bg-slate-900 shadow-2xl transition-transform duration-200 sm:w-[420px] ${
              shown ? "translate-x-0" : "translate-x-full"
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
              <div className="flex items-center gap-2">
                <Sparkle className="h-4 w-4 text-cyan-300" />
                <span className="text-sm font-bold text-slate-100">Coach AI</span>
                {remaining !== null && (
                  <span className="text-[11px] text-slate-500">
                    {remaining} left today
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setMessages([])}
                    className="rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                  >
                    Clear chat
                  </button>
                )}
                <button
                  type="button"
                  onClick={close}
                  aria-label="Close chat"
                  className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                    <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </div>

            {!canChat ? (
              /* Upgrade prompt for free plan */
              <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
                <Sparkle className="h-8 w-8 text-cyan-300/60" />
                <div className="text-sm font-bold text-slate-100">
                  Ask Coach AI is a Coach Pro feature
                </div>
                <p className="text-sm text-slate-400">
                  {upgradeText ??
                    "Chat with an AI assistant that knows your team's stats - lineups, matchups, practice plans. Coach Pro and up."}
                </p>
                <Link
                  href="/settings/billing"
                  className="mt-1 rounded-lg bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-cyan-300"
                >
                  Upgrade to Coach Pro
                </Link>
              </div>
            ) : (
              <>
                {/* Messages */}
                <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
                  <div className="max-w-[85%] rounded-2xl rounded-tl-md bg-slate-800 px-3.5 py-2.5 text-sm text-slate-200">
                    {greeting}
                  </div>
                  {messages.length === 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {suggestions.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => send(s)}
                          className="rounded-full border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-xs text-slate-300 hover:border-cyan-400/40 hover:text-cyan-200"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                  {messages.map((m, i) =>
                    m.role === "user" ? (
                      <div
                        key={i}
                        className="ml-auto max-w-[85%] rounded-2xl rounded-tr-md bg-cyan-400 px-3.5 py-2.5 text-sm font-medium text-slate-950"
                      >
                        <div className="whitespace-pre-wrap break-words">{m.content}</div>
                      </div>
                    ) : (
                      <div
                        key={i}
                        className={`max-w-[85%] rounded-2xl rounded-tl-md px-3.5 py-2.5 text-sm ${
                          m.error
                            ? "border border-amber-400/30 bg-amber-400/10 text-amber-200"
                            : "bg-slate-800 text-slate-200"
                        }`}
                      >
                        <MessageBody content={m.content} />
                      </div>
                    ),
                  )}
                  {busy && (
                    <div className="max-w-[85%] rounded-2xl rounded-tl-md bg-slate-800 px-3.5 py-2.5">
                      <TypingDots />
                    </div>
                  )}
                </div>

                {/* Input */}
                <form
                  className="flex items-end gap-2 border-t border-slate-800 p-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    send(input);
                  }}
                >
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        send(input);
                      }
                    }}
                    rows={1}
                    maxLength={2000}
                    placeholder="Ask about your team..."
                    className="max-h-28 flex-1 resize-none rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400/60 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={busy || input.trim().length === 0}
                    aria-label="Send"
                    className="rounded-xl bg-cyan-400 p-2.5 text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                      <path d="M3.4 20.4l17.45-7.48a1 1 0 000-1.84L3.4 3.6a.993.993 0 00-1.39.91L2 9.12c0 .5.37.93.87.99L17 12 2.87 13.88c-.5.07-.87.5-.87 1l.01 4.61c0 .71.73 1.2 1.39.91z" />
                    </svg>
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>,
    document.body,
  );
}
