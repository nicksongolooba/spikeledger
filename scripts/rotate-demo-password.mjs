// Rotate the demo coach's password so the publicly-known demo1234 no longer
// works. Keeps the demo account and all its data intact - only the password
// changes. Run with:  node scripts/rotate-demo-password.mjs
//
// Pass DEMO_PASSWORD=... to pick the new password; otherwise a random one is
// generated and printed once. Uses the Neon WebSocket pool (port 443) like
// every other script here, because port 5432 is blocked from this WSL.

import { randomBytes } from "node:crypto";
import { config as loadEnv } from "dotenv";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import bcrypt from "bcryptjs";
import { refuseProductionDatabase } from "../src/lib/production-guard.mjs";

loadEnv();
neonConfig.webSocketConstructor = ws;

const CONNECTION = process.env.DATABASE_URL;
if (!CONNECTION) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}
refuseProductionDatabase("rotate-demo-password", CONNECTION);

const pool = new Pool({ connectionString: CONNECTION });

const newPassword =
  process.env.DEMO_PASSWORD || randomBytes(12).toString("base64url");
const hash = bcrypt.hashSync(newPassword, 10);

const { rowCount } = await pool.query(
  `UPDATE "User" SET "passwordHash" = $1, "updatedAt" = NOW() WHERE email = 'demo@spikeledger.app'`,
  [hash],
);

if (rowCount === 0) {
  console.log("No demo@spikeledger.app user found - nothing to rotate.");
} else {
  console.log("Demo password rotated.");
  console.log(`  demo@spikeledger.app / ${newPassword}`);
  if (!process.env.DEMO_PASSWORD) {
    console.log("  (random - save it now if you still want demo access)");
  }
}

await pool.end();
