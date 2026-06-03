// Throwaway probe: hit the Google Generative Language API directly with a
// few candidate models and report which respond. Not wired into the app.
//   node scripts/test-google-ai.mjs
import "dotenv/config";

const KEY = process.env.GOOGLE_AI_API_KEY || "";
if (!KEY) {
  console.error("GOOGLE_AI_API_KEY is not set in .env");
  process.exit(1);
}
console.log(`Key loaded: ${KEY.slice(0, 6)}…${KEY.slice(-4)} (len ${KEY.length})\n`);

const MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-2.0-flash",
  "gemini-flash-latest",
];

async function tryModel(model) {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${encodeURIComponent(model)}:generateContent?key=${KEY}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: "Say hello" }] }],
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { model, ok: false, error: `HTTP ${res.status} ${body.slice(0, 300)}` };
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("");
    return { model, ok: true, reply: (text || "(empty)").slice(0, 80) };
  } catch (err) {
    return { model, ok: false, error: String(err) };
  }
}

for (const model of MODELS) {
  const r = await tryModel(model);
  if (r.ok) console.log(`✅ ${model} -> "${r.reply}"`);
  else console.log(`❌ ${model}\n     ${r.error}\n`);
}
