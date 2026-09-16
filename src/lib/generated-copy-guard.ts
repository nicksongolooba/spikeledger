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
