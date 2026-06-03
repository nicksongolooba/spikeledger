// Canonical fields the import accepts, plus a heuristic auto-mapper that
// tries to guess which spreadsheet column corresponds to which canonical field.

import type { Position } from "@prisma/client";

export const CANONICAL_FIELDS = [
  "match",
  "player",
  "position",
  "kills",
  "attackErrors",
  "attackAttempts",
  "aces",
  "serveErrors",
  "serveAttempts",
  "blocks",
  "blockErrors",
  "assists",
  "settingErrors",
  "sr0",
  "sr1",
  "sr2",
  "sr3",
  "digs",
  "generalErrors",
  "setsPlayed",
] as const;

export type CanonicalField = (typeof CANONICAL_FIELDS)[number];

export const CANONICAL_LABELS: Record<CanonicalField, string> = {
  match: "Match (opponent or label)",
  player: "Player name",
  position: "Position played",
  kills: "Kills",
  attackErrors: "Attack errors",
  attackAttempts: "Attack attempts",
  aces: "Aces",
  serveErrors: "Serve errors",
  serveAttempts: "Serve attempts",
  blocks: "Blocks",
  blockErrors: "Block / net errors",
  assists: "Assists",
  settingErrors: "Setting errors",
  sr0: "SR 0 (shanks)",
  sr1: "SR 1 (poor)",
  sr2: "SR 2 (good)",
  sr3: "SR 3 (perfect)",
  digs: "Digs",
  generalErrors: "General errors",
  setsPlayed: "Sets / matches played",
};

// Only the player column is mandatory. If no match column is mapped, the
// importer rolls every row for a player into one "Tournament Aggregate" match -
// the shape coaches get when their historical data is season/tournament totals.
export const REQUIRED_FIELDS: CanonicalField[] = ["player"];

// Label used for the synthetic match when the sheet has no per-match breakdown.
export const AGGREGATE_MATCH_LABEL = "Tournament Aggregate";

// Synonyms for auto-detection. Lowercased, no whitespace.
const HEADER_ALIASES: Record<CanonicalField, string[]> = {
  match: ["match", "opponent", "game", "vs", "matchname", "matchnumber"],
  player: ["player", "name", "playername", "athlete"],
  position: ["position", "pos", "role"],
  kills: ["kills", "k", "kill"],
  attackErrors: ["attackerrors", "attackerror", "aerr", "ae", "hittingerrors", "kill_err", "hitting_errors"],
  attackAttempts: ["attackattempts", "attempts", "atts", "hittingattempts", "swings"],
  aces: ["aces", "ace", "serviceaces"],
  serveErrors: ["serveerrors", "serveerror", "serr", "se", "service_errors"],
  serveAttempts: ["serveattempts", "serves", "serveatt", "serveattempt"],
  blocks: ["blocks", "blk", "block"],
  blockErrors: ["blockerrors", "neterrors", "neterror", "neterr", "blockerr", "nettouches"],
  assists: ["assists", "ast", "assist"],
  settingErrors: ["settingerrors", "settingerror", "setterr"],
  sr0: ["sr0", "passing0", "p0", "shank", "shanks"],
  sr1: ["sr1", "passing1", "p1"],
  sr2: ["sr2", "passing2", "p2", "goodpass", "goodpasses"],
  sr3: ["sr3", "passing3", "p3", "perfectpass", "perfectpasses"],
  digs: ["digs", "dig", "d"],
  generalErrors: ["generalerrors", "generalerror", "errors", "err", "miscerrors", "otherrors"],
  setsPlayed: ["setsplayed", "sets", "setplayed", "sp", "matchesplayed", "matchplayed", "gamesplayed", "mp", "gp"],
};

function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Build a mapping {csvColumnName: canonicalField | null}. csv column names
// that didn't match anything stay null and the user maps them manually.
export function autoMap(
  csvHeaders: string[],
): Record<string, CanonicalField | null> {
  const mapping: Record<string, CanonicalField | null> = {};
  for (const header of csvHeaders) {
    const norm = normalize(header);
    let match: CanonicalField | null = null;
    for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [
      CanonicalField,
      string[],
    ][]) {
      if (aliases.includes(norm)) {
        match = field;
        break;
      }
    }
    mapping[header] = match;
  }
  return mapping;
}

// Normalize position strings ("OH", "Outside Hitter", "outside", etc.).
const POSITION_ALIASES: Record<string, Position> = {
  oh: "OH",
  outside: "OH",
  outsidehitter: "OH",
  rs: "RS",
  rightside: "RS",
  opp: "OPP",
  opposite: "OPP",
  mb: "MB",
  middle: "MB",
  middleblocker: "MB",
  s: "S",
  setter: "S",
  l: "L",
  lib: "L",
  libero: "L",
  ds: "DS",
  defensivespecialist: "DS",
  util: "UTIL",
  utility: "UTIL",
};

export function parsePosition(value: string | undefined): Position | null {
  if (!value) return null;
  return POSITION_ALIASES[normalize(value)] ?? null;
}

export function parseNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "" || trimmed === "-") return 0;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}
