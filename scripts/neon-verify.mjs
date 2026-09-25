// Sanity-check that what we just seeded is actually in Neon.
import { config as loadEnv } from "dotenv";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { refuseProductionDatabase } from "../src/lib/production-guard.mjs";

loadEnv();
neonConfig.webSocketConstructor = ws;
refuseProductionDatabase("neon-verify");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
try {
  const tables = await pool.query(`
    SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public'
     ORDER BY table_name
  `);
  console.log(`Tables (${tables.rows.length}):`);
  for (const r of tables.rows) console.log(`  · ${r.table_name}`);

  const counts = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM "User")        AS users,
      (SELECT COUNT(*) FROM "Team")        AS teams,
      (SELECT COUNT(*) FROM "Player")      AS players,
      (SELECT COUNT(*) FROM "Tournament")  AS tournaments,
      (SELECT COUNT(*) FROM "Match")       AS matches,
      (SELECT COUNT(*) FROM "StatLine")    AS stat_lines
  `);
  console.log("\nRow counts:");
  for (const [k, v] of Object.entries(counts.rows[0])) {
    console.log(`  ${k.padEnd(14)} ${v}`);
  }

  const stripeColumns = await pool.query(`
    SELECT column_name FROM information_schema.columns
     WHERE table_name='User'
       AND column_name IN ('stripeSubscriptionId','planExpiresAt','stripeId')
  `);
  console.log("\nStripe/billing columns on User:");
  for (const r of stripeColumns.rows) console.log(`  ✓ ${r.column_name}`);
} finally {
  await pool.end();
}
