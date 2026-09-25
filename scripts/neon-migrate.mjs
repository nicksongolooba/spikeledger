// Apply every prisma/migrations/*/migration.sql to Neon over HTTPS.
//
// Why this exists: `prisma migrate deploy` spawns a Rust engine that connects
// to Postgres on port 5432. WSL on many home networks (and some corp / VPN
// setups) blocks 5432 outbound. Neon also exposes WebSocket (443) and a SQL-
// over-HTTP endpoint; this script uses the WebSocket pool from
// @neondatabase/serverless so it works wherever port 443 works.
//
// It mirrors what `prisma migrate deploy` does:
//   1. Ensure the `_prisma_migrations` bookkeeping table exists
//   2. For each migration on disk, skip if already applied, otherwise run its
//      SQL inside a single statement batch + record it
//
// Idempotent — safe to re-run.
//
// Where it runs:
//   - Vercel production builds (vercel.json buildCommand). This is the only
//     place it may touch the production database.
//   - Vercel preview builds skip it, whatever their DATABASE_URL is.
//   - Locally, against the Neon dev branch only. It refuses production.
//
// `--baseline` records every migration on disk as applied without running
// its SQL. It is for a schema-only Neon branch, which copies production's
// tables but leaves _prisma_migrations empty. Run it from a checkout of the
// commit production is on (main after its last deploy): a migration that is
// on disk but not yet in production would be recorded without being run.
// It refuses if _prisma_migrations has any rows or the "User" table is missing.

import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomUUID } from "node:crypto";
import { config as loadEnv } from "dotenv";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { refuseProductionDatabase } from "../src/lib/production-guard.mjs";

// Vercel sets VERCEL=1 and VERCEL_ENV on every build. Read them before
// loading .env, so a value in a local env file can't pass for a Vercel build.
const onVercel = process.env.VERCEL === "1";
const vercelEnv = process.env.VERCEL_ENV;

loadEnv();
neonConfig.webSocketConstructor = ws;

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "..", "prisma", "migrations");
const BASELINE = process.argv.includes("--baseline");

if (onVercel && vercelEnv !== "production") {
  console.log(`Skipping migrations: this is a Vercel ${vercelEnv ?? "non-production"} build.`);
  process.exit(0);
}

const CONNECTION = process.env.DATABASE_URL;
if (!CONNECTION) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}
if (!onVercel || BASELINE) refuseProductionDatabase("db:migrate:neon", CONNECTION);

// Match the columns Prisma's own bookkeeping table uses so a later
// `prisma migrate status` doesn't get confused.
const ENSURE_BOOKKEEPING = `
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
  "id"                    VARCHAR(36) PRIMARY KEY NOT NULL,
  "checksum"              VARCHAR(64) NOT NULL,
  "finished_at"           TIMESTAMPTZ,
  "migration_name"        VARCHAR(255) NOT NULL,
  "logs"                  TEXT,
  "rolled_back_at"        TIMESTAMPTZ,
  "started_at"            TIMESTAMPTZ NOT NULL DEFAULT now(),
  "applied_steps_count"   INTEGER NOT NULL DEFAULT 0
);
`;

function discoverMigrations() {
  const entries = readdirSync(MIGRATIONS_DIR, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((name) => /^\d{14}_/.test(name))
    .sort(); // timestamp prefix sorts chronologically
}

function readMigrationSql(name) {
  const file = join(MIGRATIONS_DIR, name, "migration.sql");
  return readFileSync(file, "utf8");
}

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

async function main() {
  const pool = new Pool({ connectionString: CONNECTION });
  console.log(`Connecting to Neon over HTTPS/WebSocket…`);

  try {
    await pool.query(ENSURE_BOOKKEEPING);
    console.log(`Bookkeeping table ready.`);

    const { rows: applied } = await pool.query(
      `SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL`,
    );
    const appliedSet = new Set(applied.map((r) => r.migration_name));

    const migrations = discoverMigrations();
    if (migrations.length === 0) {
      console.warn("No migrations found in prisma/migrations/.");
      return;
    }

    if (BASELINE) {
      // One transaction, so a dropped connection can't leave half a baseline.
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const { rows } = await client.query(`SELECT count(*)::int AS n FROM "_prisma_migrations"`);
        if (rows[0].n > 0) {
          throw new Error(`--baseline refused: _prisma_migrations already has ${rows[0].n} row(s).`);
        }
        const { rows: schema } = await client.query(`SELECT to_regclass('public."User"') IS NOT NULL AS ok`);
        if (!schema[0].ok) {
          throw new Error(`--baseline refused: this database has no "User" table, so the migrations haven't run here. Run db:migrate:neon without --baseline.`);
        }
        for (const name of migrations) {
          await client.query(
            `INSERT INTO "_prisma_migrations"
              (id, checksum, migration_name, started_at, finished_at, applied_steps_count)
             VALUES ($1, $2, $3, now(), now(), 1)`,
            [randomUUID(), sha256(readMigrationSql(name)), name],
          );
          console.log(`  ✓ ${name}  recorded as applied.`);
        }
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw err;
      } finally {
        client.release();
      }
      console.log(`\nDone. ${migrations.length} migration(s) recorded, none run.`);
      return;
    }

    let appliedThisRun = 0;
    for (const name of migrations) {
      if (appliedSet.has(name)) {
        console.log(`  ✓ ${name}  (already applied — skipping)`);
        continue;
      }
      const sql = readMigrationSql(name);
      const checksum = sha256(sql);
      const id = randomUUID();

      console.log(`  → ${name}  applying…`);
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(
          `INSERT INTO "_prisma_migrations"
            (id, checksum, migration_name, started_at, applied_steps_count)
           VALUES ($1, $2, $3, now(), 0)`,
          [id, checksum, name],
        );
        // Prisma's migration.sql files contain multiple statements separated by
        // semicolons; node-postgres handles that natively when passed as one
        // string via client.query().
        await client.query(sql);
        await client.query(
          `UPDATE "_prisma_migrations"
              SET finished_at = now(), applied_steps_count = 1
            WHERE id = $1`,
          [id],
        );
        await client.query("COMMIT");
        appliedThisRun += 1;
        console.log(`  ✓ ${name}  applied.`);
      } catch (err) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw new Error(`Migration ${name} failed: ${err.message}`);
      } finally {
        client.release();
      }
    }

    console.log(
      `\nDone. ${appliedThisRun} migration(s) applied, ${migrations.length - appliedThisRun} already up to date.`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
