// Shared between client + server. Maps each tappable action on the entry
// page to the StatLine column it increments.

export type StatActionId =
  | "KILL"
  | "ACE"
  | "BLOCK"
  | "ASSIST"
  | "DIG"
  | "S_ERR"
  | "NET_ERR"
  | "A_ERR"
  | "GEN_ERR"
  | "SR_0"
  | "SR_1"
  | "SR_2"
  | "SR_3";

export const STAT_ACTION_FIELDS = {
  KILL: "kills",
  ACE: "aces",
  BLOCK: "blocks",
  ASSIST: "assists",
  DIG: "digs",
  S_ERR: "serveErrors",
  NET_ERR: "blockErrors",
  A_ERR: "attackErrors",
  GEN_ERR: "generalErrors",
  SR_0: "sr0",
  SR_1: "sr1",
  SR_2: "sr2",
  SR_3: "sr3",
} as const satisfies Record<StatActionId, string>;

export type StatField = (typeof STAT_ACTION_FIELDS)[StatActionId];

export const STAT_ACTION_LABELS: Record<StatActionId, string> = {
  KILL: "Kill",
  ACE: "Ace",
  BLOCK: "Block",
  ASSIST: "Assist",
  DIG: "Dig",
  S_ERR: "S.Err",
  NET_ERR: "Net.Err",
  A_ERR: "A.Err",
  GEN_ERR: "Gen.Err",
  SR_0: "SR 0",
  SR_1: "SR 1",
  SR_2: "SR 2",
  SR_3: "SR 3",
};

export type ActionCategory = "positive" | "neutral" | "negative" | "sr";

export const STAT_ACTION_CATEGORY: Record<StatActionId, ActionCategory> = {
  KILL: "positive",
  ACE: "positive",
  BLOCK: "positive",
  ASSIST: "neutral",
  DIG: "neutral",
  S_ERR: "negative",
  NET_ERR: "negative",
  A_ERR: "negative",
  GEN_ERR: "negative",
  SR_0: "sr",
  SR_1: "sr",
  SR_2: "sr",
  SR_3: "sr",
};

export const STAT_ACTION_IDS = Object.keys(STAT_ACTION_FIELDS) as StatActionId[];

export function isStatActionId(value: unknown): value is StatActionId {
  return typeof value === "string" && value in STAT_ACTION_FIELDS;
}
