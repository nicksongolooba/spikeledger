import { createHash } from "node:crypto";

// Weak ETag from the JSON form of a value. Two payloads with the same
// content get the same tag, so a poll that finds nothing changed can answer
// 304 with no body.
export function weakEtag(value: unknown): string {
  const hash = createHash("sha1").update(JSON.stringify(value)).digest("hex").slice(0, 20);
  return `W/"${hash}"`;
}
