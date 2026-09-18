// One rule, applied to every string the app generates about a player.
//
// SpikeLedger never learns a player's gender, so any pronoun it writes is a
// guess that is wrong for somebody. The rule, in order of preference:
//
//   1. use the player's own name: "Jordan's passing kept the play alive"
//   2. where there is no name, they and their
//   3. in general copy, rewrite around the pronoun rather than reaching for
//      "them": "A libero doesn't hit. The scoring should know that."
//
// The parent view already had a check like this for playing-time wording.
// This is the same idea widened to cover insights, report card copy, chat
// output, emails and the rule-based verdicts, and it is enforced by
// scripts/verify-safeguards.mts rather than left to good intentions.

export const THIRD_PERSON_PRONOUNS = [
  "she",
  "her",
  "hers",
  "herself",
  "he",
  "him",
  "his",
  "himself",
];

// Words that assume the family shape as well as the gender.
export const GENDERED_NOUNS = ["daughter", "son", "daughters", "sons"];

const WORD = (w: string) => new RegExp(`\\b${w}\\b`, "i");

// The offending word, or null when the text is clean. Word boundaries matter:
// "other" contains "her", "this" contains "his".
export function genderedWordIn(text: string): string | null {
  for (const w of [...THIRD_PERSON_PRONOUNS, ...GENDERED_NOUNS]) {
    if (WORD(w).test(text)) return w;
  }
  return null;
}

export function isGenderNeutral(text: string): boolean {
  return genderedWordIn(text) === null;
}

// ---------------------------------------------------------------------------
// Playing time
// ---------------------------------------------------------------------------
//
// Playing time is the thing that turns a parent into a Monday morning email to
// the coach, and it is the coach who decides whether parents get access at
// all. So nothing the app generates for a parent talks about it: not how many
// sets, not how many matches, not who started, not who came off.
//
// The prompts say so, but a prompt is a request, not a guarantee. This is the
// guarantee: anything the model writes for a parent is checked, and copy that
// mentions playing time is thrown away in favour of the rule-based sentence,
// which cannot produce it.

export const PLAYING_TIME_PATTERNS: { label: string; re: RegExp }[] = [
  { label: "sets played", re: /\b(sets?|games?|matches|match)\s+(played|in|out)\b/i },
  { label: "played N sets", re: /\bplayed\s+(in\s+)?\d+\b/i },
  { label: "number of sets or matches", re: /\b\d+\s+(sets?|matches|games?)\b/i },
  { label: "across N matches", re: /\b(across|over|in)\s+(all\s+)?\d+\s+(sets?|matches|games?|tournaments?)\b/i },
  { label: "time on court", re: /\b(time|minutes)\s+on\s+(the\s+)?court\b/i },
  { label: "court time", re: /\bcourt\s+time\b/i },
  { label: "playing time", re: /\bplaying\s+time\b/i },
  { label: "bench", re: /\bbench(ed|ing)?\b/i },
  { label: "substitution", re: /\bsub(bed|bing|stitut\w*)\b/i },
  { label: "starting or not", re: /\b(started|starter|starting lineup|did not (play|start)|dnp)\b/i },
  { label: "rotation count", re: /\b(every|each|most|few)\s+(sets?|matches|games?)\b/i },
  { label: "appearances", re: /\bappearances?\b/i },
];

// The first playing-time phrase in the text, or null when it is clean.
export function playingTimeMentionIn(text: string): string | null {
  for (const { label, re } of PLAYING_TIME_PATTERNS) {
    if (re.test(text)) return label;
  }
  return null;
}

export function mentionsPlayingTime(text: string): boolean {
  return playingTimeMentionIn(text) !== null;
}
