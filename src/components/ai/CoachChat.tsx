"use client";

// "Ask Coach AI" - floating chat assistant for Coach Pro / Club coaches.
// Renders a pill button bottom-right; tapping it slides in a chat panel from
// the right (full-screen on mobile). Conversation lives in React state for
// the session only. Free-plan coaches get the upgrade prompt instead.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { CirclePlay, Lock, MessageSquareText, Send, X } from "lucide-react";
import { youtubeSearchUrl } from "@/lib/youtube";

const UNAVAILABLE = "AI chat is temporarily unavailable. Try again in a moment.";

export type ChatContextType = "team" | "tournament" | "player" | "match";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  error?: boolean;
}

// Render **bold** spans within a plain-text segment.
function BoldText({ text }: { text: string }) {
  const parts = text.split(/\*\*([^*]+)\*\*/g);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <strong key={i} className="font-bold text-slate-900">
            {p}
          </strong>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

// Render assistant text: **bold** drill headers, and [drill: search terms]
// tags converted into YouTube search links - same no-URL-trust pattern as
// the coaching insights (the AI supplies words, the app builds the URL).
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
            className="my-0.5 inline-flex items-center gap-1 rounded border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-xs font-semibold text-cyan-800 hover:bg-cyan-100"
          >
            <CirclePlay size={12} strokeWidth={2} aria-hidden />
            Watch drill videos
          </a>
        ) : (
          <BoldText key={i} text={part} />
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
          className="fixed bottom-20 right-4 z-[90] inline-flex items-center gap-2 rounded-full bg-navy-900 px-4 py-2.5 text-sm font-semibold text-white shadow-lift transition hover:bg-navy-800 lg:bottom-5 lg:right-5"
        >
          <MessageSquareText size={18} strokeWidth={2} aria-hidden />
          Ask Coach AI
        </button>
      )}

      {/* Slide-in panel */}
      {open && (
        <div className="fixed inset-0 z-[95]">
          <div
            className="absolute inset-0 bg-navy-950/50 backdrop-blur-[2px]"
            onMouseDown={close}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Ask Coach AI"
            className={`absolute right-0 top-0 flex h-full w-full flex-col border-l border-slate-200 bg-white shadow-2xl transition-transform duration-200 sm:w-[420px] ${
              shown ? "translate-x-0" : "translate-x-full"
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div className="flex items-center gap-2">
                <MessageSquareText size={18} strokeWidth={2} className="text-navy-700" aria-hidden />
                <span className="font-display text-lg font-bold text-slate-900">Ask Coach AI</span>
                {remaining !== null && (
                  <span className="chip">{remaining} left today</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setMessages([])}
                    className="rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 hover:text-slate-800"
                  >
                    Clear chat
                  </button>
                )}
                <button
                  type="button"
                  onClick={close}
                  aria-label="Close chat"
                  className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-800"
                >
                  <X size={18} strokeWidth={2} aria-hidden />
                </button>
              </div>
            </div>

            {!canChat ? (
              /* Upgrade prompt for free plan */
              <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-navy-50 text-navy-700">
                  <Lock size={22} strokeWidth={2} aria-hidden />
                </span>
                <div className="font-display text-xl font-bold text-slate-900">
                  Ask Coach AI is a Coach Pro feature
                </div>
                <p className="text-sm text-slate-600">
                  {upgradeText ??
                    "Chat with an AI assistant that knows your team's stats - lineups, matchups, practice plans. Coach Pro and up."}
                </p>
                <Link
                  href="/settings/billing"
                  className="btn-primary mt-1"
                >
                  Upgrade to Coach Pro
                </Link>
              </div>
            ) : (
              <>
                {/* Messages */}
                <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
                  <div className="max-w-[85%] rounded-lg rounded-tl-sm border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800">
                    {greeting}
                  </div>
                  {messages.length === 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {suggestions.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => send(s)}
                          className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-navy-400 hover:text-navy-800"
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
                        className="ml-auto max-w-[85%] rounded-lg rounded-tr-sm bg-navy-900 px-3.5 py-2.5 text-sm font-medium text-white"
                      >
                        <div className="whitespace-pre-wrap break-words">{m.content}</div>
                      </div>
                    ) : (
                      <div
                        key={i}
                        className={`max-w-[85%] rounded-lg rounded-tl-sm border px-3.5 py-2.5 text-sm ${
                          m.error
                            ? "border-amber-300 bg-amber-50 text-amber-800"
                            : "border-slate-200 bg-slate-50 text-slate-800"
                        }`}
                      >
                        <MessageBody content={m.content} />
                      </div>
                    ),
                  )}
                  {busy && (
                    <div className="max-w-[85%] rounded-lg rounded-tl-sm border border-slate-200 bg-slate-50 px-3.5 py-2.5">
                      <TypingDots />
                    </div>
                  )}
                </div>

                {/* Input */}
                <form
                  className="flex items-end gap-2 border-t border-slate-200 p-3"
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
                    className="input max-h-28 flex-1 resize-none py-2.5"
                  />
                  <button
                    type="submit"
                    disabled={busy || input.trim().length === 0}
                    aria-label="Send"
                    className="btn-primary h-[42px] w-[42px] p-0"
                  >
                    <Send size={18} strokeWidth={2} aria-hidden />
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
