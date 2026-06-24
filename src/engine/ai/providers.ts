// AI provider abstraction. The shape we care about:
//   - isAvailable():  cheap probe so we can fail over fast
//   - generateJson(): given a system + user prompt, return a parsed JSON value
//                     (any) or throw. JSON repair (markdown fence stripping
//                     etc.) lives here so callers don't have to think about it.

import Anthropic from "@anthropic-ai/sdk";
import type { InsightProvider } from "./types";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
export const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-6";

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "gemma4";
const GOOGLE_API_KEY = process.env.GOOGLE_AI_API_KEY || "";
// Must be a real, currently-served model on the Generative Language API.
// gemini-1.5-* was retired, so the default tracks a current Flash model.
// Override with GOOGLE_AI_MODEL (e.g. gemini-2.5-flash, gemini-2.5-pro).
const GOOGLE_MODEL = process.env.GOOGLE_AI_MODEL || "gemini-2.5-flash";

// A single chat turn for the free-text (conversational) path.
export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface Provider {
  name: InsightProvider;
  isAvailable(): Promise<boolean>;
  generateJson<T>(systemPrompt: string, userPrompt: string): Promise<T>;
  // Free-text multi-turn chat (no JSON enforcement). Used by "Ask Coach AI"
  // so the assistant degrades through the same provider chain as insights
  // instead of being hard-wired to a single provider.
  generateChat(systemPrompt: string, messages: ChatTurn[]): Promise<string>;
}

// Strip ```json fences, common LLM JSON-output mistake.
function extractJsonText(raw: string): string {
  const trimmed = raw.trim();
  // Strip ```json ... ``` or ``` ... ``` fences
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/);
  if (fenceMatch) return fenceMatch[1].trim();
  // Find the first { or [ and the matching close.
  const firstObj = trimmed.indexOf("{");
  const firstArr = trimmed.indexOf("[");
  let start = -1;
  let openChar = "";
  if (firstObj === -1 && firstArr === -1) return trimmed;
  if (firstObj === -1) {
    start = firstArr;
    openChar = "[";
  } else if (firstArr === -1) {
    start = firstObj;
    openChar = "{";
  } else if (firstObj < firstArr) {
    start = firstObj;
    openChar = "{";
  } else {
    start = firstArr;
    openChar = "[";
  }
  const closeChar = openChar === "{" ? "}" : "]";
  // Walk forward and balance braces respecting strings.
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === "\\") {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === openChar) {
      depth += 1;
    } else if (ch === closeChar) {
      depth -= 1;
      if (depth === 0) return trimmed.slice(start, i + 1);
    }
  }
  return trimmed.slice(start);
}

function safeParse<T>(raw: string): T {
  const text = extractJsonText(raw);
  return JSON.parse(text) as T;
}

const TIMEOUT_MS = 30_000;

async function fetchWithTimeout(url: string, init: RequestInit, ms = TIMEOUT_MS) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

class OllamaProvider implements Provider {
  name = "ollama" as const;

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetchWithTimeout(`${OLLAMA_URL}/api/tags`, {}, 1500);
      if (!res.ok) return false;
      // Confirm our model is actually present, not just that the server runs.
      const data = (await res.json()) as { models?: Array<{ name: string }> };
      const have = data.models?.some((m) =>
        m.name === OLLAMA_MODEL || m.name.startsWith(OLLAMA_MODEL + ":"),
      );
      return Boolean(have);
    } catch {
      return false;
    }
  }

  async generateJson<T>(systemPrompt: string, userPrompt: string): Promise<T> {
    const res = await fetchWithTimeout(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        stream: false,
        format: "json",                 // Ollama enforces JSON-shaped output
        options: { temperature: 0.4 },
      }),
    });
    if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
    const data = (await res.json()) as { message?: { content?: string } };
    const content = data.message?.content ?? "";
    if (!content) throw new Error("Ollama returned no content");
    return safeParse<T>(content);
  }

  async generateChat(systemPrompt: string, messages: ChatTurn[]): Promise<string> {
    const res = await fetchWithTimeout(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: false,
        options: { temperature: 0.5 },
      }),
    });
    if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
    const data = (await res.json()) as { message?: { content?: string } };
    const content = data.message?.content?.trim() ?? "";
    if (!content) throw new Error("Ollama returned no content");
    return content;
  }
}

class GoogleProvider implements Provider {
  name = "google" as const;

  async isAvailable(): Promise<boolean> {
    return GOOGLE_API_KEY.length > 0;
  }

  async generateJson<T>(systemPrompt: string, userPrompt: string): Promise<T> {
    if (!GOOGLE_API_KEY) throw new Error("Google AI API key not configured");
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/` +
      `${encodeURIComponent(GOOGLE_MODEL)}:generateContent?key=${GOOGLE_API_KEY}`;
    const res = await fetchWithTimeout(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: 0.4,
          responseMimeType: "application/json",
        },
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Google AI HTTP ${res.status} ${errText.slice(0, 200)}`);
    }
    type Resp = {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const data = (await res.json()) as Resp;
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("");
    if (!text) throw new Error("Google AI returned no content");
    return safeParse<T>(text);
  }

  async generateChat(systemPrompt: string, messages: ChatTurn[]): Promise<string> {
    if (!GOOGLE_API_KEY) throw new Error("Google AI API key not configured");
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/` +
      `${encodeURIComponent(GOOGLE_MODEL)}:generateContent?key=${GOOGLE_API_KEY}`;
    const res = await fetchWithTimeout(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        // Gemini calls the assistant role "model".
        contents: messages.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
        generationConfig: { temperature: 0.5 },
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Google AI HTTP ${res.status} ${errText.slice(0, 200)}`);
    }
    type Resp = {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const data = (await res.json()) as Resp;
    const text = data.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? "")
      .join("")
      .trim();
    if (!text) throw new Error("Google AI returned no content");
    return text;
  }
}

// Lazily constructed so importing this module without a key never throws.
let _anthropicClient: Anthropic | null = null;
export function getAnthropicClient(): Anthropic | null {
  if (!ANTHROPIC_API_KEY) return null;
  if (!_anthropicClient) {
    _anthropicClient = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  }
  return _anthropicClient;
}

class AnthropicProvider implements Provider {
  name = "anthropic" as const;

  async isAvailable(): Promise<boolean> {
    return ANTHROPIC_API_KEY.length > 0;
  }

  async generateJson<T>(systemPrompt: string, userPrompt: string): Promise<T> {
    const client = getAnthropicClient();
    if (!client) throw new Error("Anthropic API key not configured");
    const response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    if (!text) throw new Error("Anthropic returned no content");
    return safeParse<T>(text);
  }

  async generateChat(systemPrompt: string, messages: ChatTurn[]): Promise<string> {
    const client = getAnthropicClient();
    if (!client) throw new Error("Anthropic API key not configured");
    const response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 2048,
      system: systemPrompt,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    if (!text) throw new Error("Anthropic returned no content");
    return text;
  }
}

const _anthropic = new AnthropicProvider();
const _ollama = new OllamaProvider();
const _google = new GoogleProvider();

// Picks the first available provider. Claude is always preferred when its key
// is set (highest-quality coaching insights); AI_PROVIDER only orders the
// Ollama/Google fallbacks. Returning null signals the rule-based fallback.
export async function pickProvider(): Promise<Provider | null> {
  const preference = (process.env.AI_PROVIDER || "ollama").toLowerCase();
  const order: Provider[] =
    preference === "google"
      ? [_anthropic, _google, _ollama]
      : [_anthropic, _ollama, _google];
  for (const p of order) {
    if (await p.isAvailable()) {
      console.info(`[ai] provider preference=${preference}, using=${p.name}`);
      return p;
    }
  }
  console.warn(
    `[ai] no provider available (preference=${preference}, anthropicKey=${ANTHROPIC_API_KEY ? "set" : "missing"}, googleKey=${GOOGLE_API_KEY ? "set" : "missing"}); falling back to rule-based`,
  );
  return null;
}
