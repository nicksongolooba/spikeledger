// Main entry points used by API routes + page server components.
// Cache → Ollama → Google → rule-based fallback. Any thrown error in the LLM
// path is swallowed and we fall through to the next provider; the rule-based
// path can't throw (pure local computation), so callers never see a failure.

import {
  PLAYER_SYSTEM_PROMPT,
  buildPlayerUserPrompt,
  buildTeamSystemPrompt,
  buildTeamUserPrompt,
} from "./prompts";
import { pickProvider, type Provider } from "./providers";
import { hashRequest, readCache, writeCache } from "./cache";
import {
  generateRuleBasedPlayerInsight,
  generateRuleBasedTeamInsight,
} from "./rule-based";
import type {
  PlayerInsightRequest,
  PlayerInsightResponse,
  TeamInsightRequest,
  TeamInsightResponse,
} from "./types";

const PLAYER_SHAPE_FIELDS: (keyof PlayerInsightResponse)[] = [
  "summary",
  "strengths",
  "improvements",
  "coachingNote",
  "parentFriendly",
];

function looksLikePlayerInsight(value: unknown): value is Omit<
  PlayerInsightResponse,
  "provider" | "cached" | "generatedAt"
> {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  for (const k of PLAYER_SHAPE_FIELDS) {
    if (!(k in v)) return false;
  }
  return Array.isArray(v.strengths) && Array.isArray(v.improvements);
}

export async function getPlayerInsight(
  req: PlayerInsightRequest,
  opts: { forceRefresh?: boolean } = {},
): Promise<PlayerInsightResponse> {
  const cacheKey = "player:" + hashRequest(req);

  if (!opts.forceRefresh) {
    const cached = await readCache<PlayerInsightResponse>(cacheKey);
    if (cached) {
      return { ...cached.response, cached: true, provider: cached.provider };
    }
  }

  const provider = await pickProvider();
  if (provider) {
    try {
      const raw = await provider.generateJson<unknown>(
        PLAYER_SYSTEM_PROMPT,
        buildPlayerUserPrompt(req),
      );
      if (looksLikePlayerInsight(raw)) {
        const response: PlayerInsightResponse = {
          ...raw,
          provider: provider.name,
          cached: false,
          generatedAt: new Date().toISOString(),
        };
        await writeCache(cacheKey, "player", response, provider.name);
        return response;
      }
    } catch (err) {
      // Log so the failure is visible in server logs, then fall through to
      // the rule-based insight rather than surfacing an error to the coach.
      console.error(`[ai] ${provider.name} player insight failed:`, err);
    }
  }

  const fallback = generateRuleBasedPlayerInsight(req);
  await writeCache(cacheKey, "player", fallback, "rule-based");
  return fallback;
}

function looksLikeTeamInsight(value: unknown): value is { insights: string[] } {
  if (Array.isArray(value)) {
    return value.every((x) => typeof x === "string");
  }
  if (value && typeof value === "object" && Array.isArray((value as { insights?: unknown }).insights)) {
    return ((value as { insights: unknown[] }).insights).every(
      (x) => typeof x === "string",
    );
  }
  return false;
}

function normalizeTeamInsight(raw: unknown): string[] | null {
  if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === "string");
  if (raw && typeof raw === "object" && Array.isArray((raw as { insights?: unknown }).insights)) {
    return ((raw as { insights: unknown[] }).insights).filter(
      (x): x is string => typeof x === "string",
    );
  }
  return null;
}

export async function getTeamInsight(
  req: TeamInsightRequest,
  opts: { forceRefresh?: boolean } = {},
): Promise<TeamInsightResponse> {
  const cacheKey = "team:" + hashRequest(req);

  if (!opts.forceRefresh) {
    const cached = await readCache<TeamInsightResponse>(cacheKey);
    if (cached) {
      return { ...cached.response, cached: true, provider: cached.provider };
    }
  }

  const provider = await pickProvider();
  if (provider) {
    try {
      const raw = await provider.generateJson<unknown>(
        buildTeamSystemPrompt(),
        buildTeamUserPrompt(req),
      );
      if (looksLikeTeamInsight(raw)) {
        const insights = normalizeTeamInsight(raw) ?? [];
        const response: TeamInsightResponse = {
          insights,
          provider: provider.name,
          cached: false,
          generatedAt: new Date().toISOString(),
        };
        await writeCache(cacheKey, "team", response, provider.name);
        return response;
      }
    } catch (err) {
      console.error(`[ai] ${provider.name} team insight failed:`, err);
    }
  }

  const fallback = generateRuleBasedTeamInsight(req);
  await writeCache(cacheKey, "team", fallback, "rule-based");
  return fallback;
}

export { hashRequest };
