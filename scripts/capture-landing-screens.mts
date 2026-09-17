// Re-captures the product screenshots on the landing page
// (src/assets/screens/*.png) plus header shots, against a running dev server,
// as the preview coach created by scripts/seed-landing-preview.mts. Run after
// any change to the app shell, courtside page, report cards or brand art.
//
//   npm run dev                                              # in another shell
//   node --import tsx scripts/seed-landing-preview.mts
//   node --import tsx scripts/capture-landing-screens.mts   # needs Playwright chromium
//   node --import tsx scripts/seed-landing-preview.mts --delete
//
// Env: BASE_URL (default http://localhost:3000), PREVIEW_IDS (the seeder's
// JSON), SHOTS_DIR (where the extra header shots go, default /tmp/shots).
import { chromium, type Page } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import JSZip from "jszip";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SHOTS = process.env.SHOTS_DIR ?? "/tmp/shots";
const ids = JSON.parse(readFileSync(process.env.PREVIEW_IDS ?? "/tmp/spikeledger-landing-preview.json", "utf8"));
const OUT = "src/assets/screens";
mkdirSync(SHOTS, { recursive: true });

type Team = { id: string; name: string; players: { id: string; name: string; number: number; position: string }[]; tournaments: { id: string; name: string; matches: { id: string; opponent: string; matchNumber: number }[] }[] };
const t16: Team = ids.teams.find((t: Team) => t.name.endsWith("16U"));
const byName = (n: string) => t16.players.find((p) => p.name === n)!;
const jade = byName("Jade");
const nyq = t16.tournaments.find((t) => t.name === "New Year Qualifier")!;
const match = nyq.matches.find((m) => m.opponent === "Storm Volleyball") ?? nyq.matches[1];

async function login(page: Page) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.waitForSelector("#email", { timeout: 90000 });
  await page.waitForTimeout(1500);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.fill("#email", ids.email);
    await page.fill("#password", ids.password);
    const resP = page.waitForResponse((r) => r.url().includes("/api/auth/callback/credentials"), { timeout: 20000 }).catch(() => null);
    await page.click('button[type="submit"]');
    if (!(await resP)) continue;
    try {
      await page.waitForURL(/\/dashboard/, { timeout: 90000 });
      return;
    } catch {
      /* retry */
    }
  }
  throw new Error("login failed");
}

async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
}

async function main() {
  const browser = await chromium.launch();
  try {
    // ---- Desktop: dashboard + player page (1440x900 @1x, like the originals) ----
    const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    const page = await desktop.newPage();
    await login(page);
    await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
    await settle(page);
    await page.screenshot({ path: `${OUT}/dashboard.png` });
    console.log("dashboard.png");
    await page.goto(`${BASE}/reports/player/${jade.id}`, { waitUntil: "networkidle" });
    await settle(page);
    await page.screenshot({ path: `${OUT}/player.png` });
    console.log("player.png");

    // Header shots for the user (2x for crispness): app sidebar + landing header.
    const hi = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, storageState: await desktop.storageState() });
    const hp = await hi.newPage();
    await hp.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
    await settle(hp);
    await hp.screenshot({ path: `${SHOTS}/header-app-sidebar.png`, clip: { x: 0, y: 0, width: 720, height: 220 } });
    await hp.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await settle(hp);
    await hp.screenshot({ path: `${SHOTS}/header-landing.png`, clip: { x: 0, y: 0, width: 1440, height: 96 } });
    await hp.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await settle(hp);
    await hp.screenshot({ path: `${SHOTS}/login-page.png` });
    await hp.goto(`${BASE}/blog`, { waitUntil: "networkidle" });
    await settle(hp);
    await hp.screenshot({ path: `${SHOTS}/header-blog.png`, clip: { x: 0, y: 0, width: 1440, height: 96 } });
    console.log("header shots");

    // ---- Report cards: generate for Jade (Full Season), download the ZIP ----
    await page.goto(`${BASE}/reports/generate/${t16.id}?player=${jade.id}`, { waitUntil: "networkidle" });
    await settle(page);
    const gen = page.getByRole("button", { name: /^Generate$/ });
    await gen.waitFor({ timeout: 30000 });
    await gen.click();
    // Per-player "ZIP" button appears once rendering is done.
    const dl = page.getByRole("button", { name: /^ZIP$/ }).first();
    await dl.waitFor({ timeout: 120000 });
    const [download] = await Promise.all([page.waitForEvent("download", { timeout: 60000 }), dl.click()]);
    const zipPath = `${SHOTS}/cards.zip`;
    await download.saveAs(zipPath);
    const zip = await JSZip.loadAsync(readFileSync(zipPath));
    for (const [key, dest] of [["overview", "card-overview.png"], ["bank", "card-bank.png"]] as const) {
      const name = Object.keys(zip.files).find((n) => n.includes(`_${key}_`));
      if (!name) throw new Error(`no ${key} card in the zip`);
      writeFileSync(`${OUT}/${dest}`, await zip.files[name].async("nodebuffer"));
      console.log(dest);
    }

    // ---- Mobile courtside (390x844 @2x, like the originals) ----
    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, storageState: await desktop.storageState() });
    const mp = await mobile.newPage();
    const onCourt = ["Riley", "Maya", "Tess", "Nia", "Jade", "Mateo"].map((n) => byName(n).id);
    const positions = Object.fromEntries(t16.players.map((p) => [p.id, p.position]));
    const persisted = { onCourt, positions, setIdx: 0, sets: [{ us: 0, them: 0 }], rotation: 1, serving: "us", undo: [], opponentErrors: 0, liberoSwap: null, configuredSets: [0] };
    await mp.addInitScript(({ key, value }) => { window.localStorage.setItem(key, value); }, { key: `spikeledger:entry:${match.id}`, value: JSON.stringify(persisted) });
    await mp.goto(`${BASE}/match/${match.id}/entry`, { waitUntil: "networkidle" });
    await settle(mp);
    const cancel = mp.locator('[role="dialog"] button:visible', { hasText: /Cancel/ });
    if (await cancel.count()) { await cancel.first().click(); await mp.waitForTimeout(300); }
    // Select Jade so the action pad reads "Recording for Jade".
    await mp.locator("button", { hasText: "Jade" }).first().click();
    await mp.waitForTimeout(400);
    await mp.evaluate(() => window.scrollTo(0, 0));
    await mp.waitForTimeout(300);
    await mp.screenshot({ path: `${OUT}/entry.png` });
    console.log("entry.png");
    await mp.locator("text=OPP ERROR").first().evaluate((el) => {
      const card = el.closest("button") ?? el;
      const y = card.getBoundingClientRect().top + window.scrollY - 70;
      window.scrollTo(0, y);
    });
    await mp.waitForTimeout(400);
    await mp.screenshot({ path: `${OUT}/entry-actions.png` });
    await mp.screenshot({ path: `${SHOTS}/header-mobile.png`, clip: { x: 0, y: 0, width: 390, height: 56 } });
    console.log("entry-actions.png");
  } finally {
    await browser.close();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
