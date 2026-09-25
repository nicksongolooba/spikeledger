// Keeps local tools off the production database.
//
// Plain JavaScript so the .mjs scripts (run with bare `node`, including the
// migration step in Vercel's build) and the TypeScript code share one copy.
//
// A Neon connection string names its compute endpoint in the hostname
// (ep-<name>-<id>.<region>.aws.neon.tech, with "-pooler" added for the pooled
// host) or in `options=endpoint%3Dep-...`. A dev branch gets its own endpoint,
// so the endpoint ID tells production apart from everything else. Production's
// ID is stored as a SHA-256 hash so the repo does not name the production host.
// If production ever moves to a new endpoint, add that endpoint's hash here.

import { createHash } from "node:crypto";
import { basename } from "node:path";

export const PRODUCTION_ENDPOINT_HASHES = [
  "1900476971f72310f361448e8c983e8bf636c6a85c0bd5731134b63a087f2884",
];

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

// Every Neon endpoint ID a connection string names, lower-cased, without the
// "-pooler" suffix. Empty when the string doesn't parse as a URL.
export function neonEndpointIds(connectionString) {
  let url;
  try {
    url = new URL(connectionString);
  } catch {
    return [];
  }
  const ids = [url.hostname.toLowerCase().split(".")[0]];
  const options = url.searchParams.get("options");
  const fromOptions = options && /endpoint=([^\s&]+)/i.exec(options);
  if (fromOptions) ids.push(fromOptions[1].toLowerCase());
  return ids.map((id) => id.replace(/-pooler$/, ""));
}

export function matchesEndpointHash(connectionString, hashes) {
  return neonEndpointIds(connectionString).some((id) => hashes.includes(sha256(id)));
}

export function isProductionDatabase(connectionString) {
  return matchesEndpointHash(connectionString, PRODUCTION_ENDPOINT_HASHES);
}

// The one-line reason to refuse, or null when the database isn't production.
export function productionRefusal(who, connectionString = process.env.DATABASE_URL) {
  if (!connectionString || !isProductionDatabase(connectionString)) return null;
  return `${who} refused: DATABASE_URL points at the production database. Local tools only run against the Neon dev branch; set DATABASE_URL in .env and .env.local to it.`;
}

// For scripts: print the reason and exit before anything connects.
export function refuseProductionDatabase(
  who = process.argv[1] ? basename(process.argv[1]) : "This script",
  connectionString = process.env.DATABASE_URL,
) {
  const refusal = productionRefusal(who, connectionString);
  if (refusal) {
    console.error(refusal);
    process.exit(1);
  }
}
