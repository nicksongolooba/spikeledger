// Lightweight env validation. Called once at module load by lib/prisma so the
// app fails loudly during boot rather than silently producing 500s. Returns
// the list of missing-but-required vars; never throws.

interface EnvHealth {
  ok: boolean;
  missing: string[];
  warnings: string[];
}

export function checkEnv(): EnvHealth {
  const required = ["DATABASE_URL", "NEXTAUTH_SECRET"];
  const missing = required.filter((k) => !process.env[k]);

  const warnings: string[] = [];
  if (!process.env.STRIPE_SECRET_KEY) {
    warnings.push(
      "STRIPE_SECRET_KEY not set - billing routes will return 503 until configured.",
    );
  }
  if (!process.env.OLLAMA_URL && !process.env.GOOGLE_AI_API_KEY) {
    warnings.push(
      "No AI provider configured - coaches will see rule-based insights only.",
    );
  }
  return { ok: missing.length === 0, missing, warnings };
}

let _logged = false;
export function logEnvOnce() {
  if (_logged) return;
  _logged = true;
  const h = checkEnv();
  if (!h.ok) {
    console.error(
      `[spikeledger] Missing required env vars: ${h.missing.join(", ")}`,
    );
  }
  for (const w of h.warnings) {
    console.warn(`[spikeledger] ${w}`);
  }
}
