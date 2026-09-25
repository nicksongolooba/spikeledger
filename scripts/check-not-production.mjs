// Runs ahead of the Prisma CLI commands in package.json (db:push, db:migrate,
// db:studio). The CLI starts its own engine, so there is no code of ours to
// put a check in; this stops the npm script before the CLI starts.
// Usage: node scripts/check-not-production.mjs <name shown in the refusal>

import "dotenv/config"; // the same .env the Prisma CLI reads
import { refuseProductionDatabase } from "../src/lib/production-guard.mjs";

refuseProductionDatabase(process.argv[2] ?? "This command");
