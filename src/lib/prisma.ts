import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { logEnvOnce } from "./env-check";
import { productionRefusal, refuseProductionDatabase } from "./production-guard.mjs";

logEnvOnce();

// Node runtimes (WSL dev, self-hosted Docker) don't have a global WebSocket -
// hand the Neon driver the `ws` package. Vercel's Node-18 runtime already has
// one and this is harmless there.
if (!neonConfig.webSocketConstructor) {
  neonConfig.webSocketConstructor = ws;
}

// Every Prisma query goes through Neon's WebSocket-backed Pool (port 443),
// avoiding the blocked-5432 problem on dev networks.
function makeClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. See .env.example.");
  }
  // Scripts under scripts/ import this file through tsx, where NEXT_RUNTIME is
  // unset: they must never reach production. Inside Next, only a server built
  // on Vercel may (BUILT_ON_VERCEL, next.config.js), so `next dev` and a local
  // `next build && next start` refuse it too.
  if (!process.env.NEXT_RUNTIME) {
    refuseProductionDatabase(undefined, connectionString);
  } else if (process.env.BUILT_ON_VERCEL !== "1") {
    const refusal = productionRefusal("This local Next server", connectionString);
    if (refusal) throw new Error(refusal);
  }
  const pool = new Pool({ connectionString });
  const adapter = new PrismaNeon(pool);
  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? makeClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
