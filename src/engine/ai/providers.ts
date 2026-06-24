// AI provider abstraction. The only LLM provider is Anthropic (Claude); when
// its key is unset (or a call fails) callers fall back to the rule-based
// engine. The shape we care about:
//   - isAvailable():  cheap probe so we can fail over fast
//   - generateJson(): given a system + user prompt, return a parsed JSON value
//                     (any) or throw. JSON repair (markdown fence stripping
//                     etc.) lives here so callers don't have to think about it.
//   - generateChat(): free-text multi-turn chat for "Ask Coach AI".

import Anthropic from "@anthropic-ai/sdk";
import type { InsightProvider } from "./types";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
export const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-6";

// A single chat turn for the free-text (conversational) path.
export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface Provider {
  name: InsightProvider;
  isAvailable(): Promise<boolean>;
  generateJson<T>(systemPrompt: string, userPrompt: string): Promise<T>;
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

// Returns Claude when ANTHROPIC_API_KEY is set, otherwise null. A null result
// signals the caller to use the always-available rule-based fallback.
export async function pickProvider(): Promise<Provider | null> {
  if (await _anthropic.isAvailable()) {
    console.info("[ai] using=anthropic");
    return _anthropic;
  }
  console.warn(
    "[ai] no provider available (ANTHROPIC_API_KEY missing); falling back to rule-based",
  );
  return null;
}
