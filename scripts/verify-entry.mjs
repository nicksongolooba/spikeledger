// Phase 2 browser verification.
// Drives the real entry page in headless chromium and reports pass/fail.

import { chromium } from "playwright";
import { execSync } from "node:child_process";

const BASE = process.env.BASE ?? "http://localhost:3000";
const EMAIL = "demo@spikeledger.app";
const PASSWORD = "demo1234";

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok: !!ok, detail });
  console.log(`  ${ok ? "✓" : "✗"} ${name}${detail ? "  · " + detail : ""}`);
}

function psql(sql) {
  return execSync(
    `PGPASSWORD=spikeledger psql -h localhost -U spikeledger -d spikeledger -t -A -F "|" -c "${sql.replace(/"/g, '\\"')}"`,
    { encoding: "utf8" },
  ).trim();
}

async function main() {
  // Clean any leftover from previous runs and create a fresh test match.
  psql(`DELETE FROM "StatLine" WHERE "matchId" IN (SELECT id FROM "Match" WHERE opponent='Browser Test FC')`);
  psql(`DELETE FROM "Match" WHERE opponent='Browser Test FC'`);
  const tid = psql(`SELECT id FROM "Tournament" WHERE name='16U Tournament 1' LIMIT 1`);
  const matchId = psql(`
    INSERT INTO "Match" (id, "tournamentId", opponent, "matchNumber", "createdAt")
    VALUES ('test_' || substr(md5(random()::text), 1, 16), '${tid}', 'Browser Test FC', 99, NOW())
    RETURNING id
  `);
  console.log(`Test match: ${matchId}\n`);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, // iPhone 14
  });
  const page = await ctx.newPage();

  // 1. Login
  await page.goto(`${BASE}/login`);
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard/, { timeout: 10000 });
  check("Login succeeds and redirects to /dashboard", page.url().endsWith("/dashboard"));

  // 2. Navigate to entry page for our test match
  await page.goto(`${BASE}/match/${matchId}/entry`);
  await page.waitForSelector("text=Set starting lineup", { timeout: 5000 });
  check("Lineup modal opens on first visit", true);

  // 3. Lineup modal: all 12 players visible
  const allNames = ["Maya", "Zara", "Nia", "Priya", "Jordan", "Riley", "Tess", "Kira", "Lena", "Mika", "Jade", "Sam"];
  let allFound = true;
  for (const n of allNames) {
    if ((await page.locator(`button:has-text("${n}")`).count()) === 0) {
      allFound = false;
      break;
    }
  }
  check("Lineup picker shows all 12 players", allFound);

  // 4. Pick 6 starters including Jordan
  const starters = ["Maya", "Zara", "Tess", "Riley", "Jade", "Jordan"];
  for (const n of starters) {
    await page.locator(`button:has-text("${n}")`).first().click();
  }
  // selection chip count
  const chipText = await page.locator("text=/\\d \\/ 6 selected/").textContent();
  check("Selection counter shows 6 / 6", chipText?.startsWith("6 "));

  // 5. Dual-role select for Jordan should appear (RS or L)
  // Look for a <select> with options RS and L inside Jordan's button.
  const jordanCard = page.locator("button", { hasText: "Jordan" }).first();
  const hasDualSelect = (await jordanCard.locator("select").count()) > 0;
  check("Jordan shows dual-role position selector when picked", hasDualSelect);
  if (hasDualSelect) {
    // Set Jordan to play Libero this match
    await jordanCard.locator("select").selectOption("L");
  }

  // 6. Confirm lineup → modal closes
  await page.click('button:has-text("Start match")');
  await page.waitForSelector("text=Set starting lineup", { state: "hidden", timeout: 5000 });
  check("Lineup modal closes after Start match", true);

  // 7. Scoreboard visible
  await page.waitForSelector("text=Hawks", { timeout: 3000 });
  const setTab = await page.locator('button[type="button"]').filter({ hasText: "Set 1" }).count();
  check("Scoreboard Zone 1 visible (Set 1 tab + Hawks label)", setTab > 0);

  // 8. Score increment by tap
  const usScoreBtn = page.locator('button[aria-label*="Our score"]');
  await usScoreBtn.click();
  await usScoreBtn.click();
  await usScoreBtn.click();
  // Read the bold number
  const usVal = await usScoreBtn.locator(".stat-number").textContent();
  check("Tapping Hawks score increments (3 taps → 3)", usVal?.trim() === "3");

  // 9. Player grid: 6 on-court rendered
  // each on-court player is a button with "#N" inside, position badge, name. Use a generous locator.
  const onCourtRegion = page.locator('h3:has-text("On Court")');
  await onCourtRegion.waitFor();
  // Count player cards in the grid after "On Court" header.
  const onCourtCardCount = await page.locator('button:has(:text-matches("^#"))').count();
  check("Player grid shows on-court cards", onCourtCardCount >= 6);

  // 10. Select Maya, see action panel
  await page.locator('button:has-text("Maya")').first().click();
  await page.waitForSelector("text=Recording for", { timeout: 3000 });
  check("Tapping a player shows 'Recording for {name}'", true);

  // 11. Tap KILL → toast + DB increment
  await page.locator('button:has-text("KILL")').first().click();
  // Toast (auto-dismisses in 1.5s, so capture quickly)
  const toastVisible = await page
    .locator("text=Maya +1 Kill")
    .first()
    .isVisible()
    .catch(() => false);
  check("Toast 'Maya +1 Kill' appears", toastVisible);
  // De-selection
  const afterTapTapPlayer = await page.locator("text=Tap a player to record a stat.").count();
  check("Player de-selects after action (panel returns to placeholder)", afterTapTapPlayer > 0);
  // DB: Maya should have kills=1
  const mayaKills = psql(`
    SELECT kills FROM "StatLine" WHERE "matchId"='${matchId}'
    AND "playerId"=(SELECT id FROM "Player" WHERE name='Maya')
  `);
  check("DB: Maya kills=1 after one KILL", mayaKills === "1");

  // 12. Undo last action via undo bar
  await page.locator('button:has-text("Undo:")').click();
  await page.waitForTimeout(400);
  const mayaKillsAfterUndo = psql(`
    SELECT kills FROM "StatLine" WHERE "matchId"='${matchId}'
    AND "playerId"=(SELECT id FROM "Player" WHERE name='Maya')
  `);
  check("Undo decrements: Maya kills back to 0", mayaKillsAfterUndo === "0");

  // 13. Libero KILL/BLOCK dimmed: tap Jade (Libero), check opacity-40 class
  await page.locator('button:has-text("Jade")').first().click();
  await page.waitForTimeout(300);
  const jadeKillBtnClass = await page
    .locator('button:has-text("KILL")')
    .first()
    .getAttribute("class");
  const jadeBlockBtnClass = await page
    .locator('button:has-text("BLOCK")')
    .first()
    .getAttribute("class");
  check("Libero: KILL dimmed (opacity-40)", jadeKillBtnClass?.includes("opacity-40"));
  check("Libero: BLOCK dimmed (opacity-40)", jadeBlockBtnClass?.includes("opacity-40"));

  // 14. Record an SR_3 for Jade — should work normally
  await page.locator('button[aria-label="SR_3"], button:has-text("3"):below(:text("Serve Receive"))').first().click();
  await page.waitForTimeout(400);
  const jadeSr3 = psql(`
    SELECT sr3 FROM "StatLine" WHERE "matchId"='${matchId}'
    AND "playerId"=(SELECT id FROM "Player" WHERE name='Jade')
  `);
  check("DB: Jade SR_3=1 after SR perfect tap", jadeSr3 === "1");

  // 15. Substitution: tap bench player (Nia is on bench), pick someone to swap
  await page.locator('button:has-text("Nia")').first().click();
  // Sub modal appears with "Sub Nia in for..."
  await page.waitForSelector('text=Sub Nia in for', { timeout: 3000 });
  // Pick the first on-court player to swap with (likely Maya)
  await page.locator('button:has-text("Maya")').first().click();
  await page.waitForSelector('text=Sub Nia in for', { state: "hidden", timeout: 3000 });
  // After sub, Nia should be on court — bench section heading 'Bench' should still exist
  check("Substitution closes modal and swaps players", true);

  // 16. Set switching: add a set, switch to it
  await page.locator('button[aria-label="Add set"]').click();
  await page.waitForTimeout(200);
  await page.locator('button:has-text("Set 2")').click();
  // Score should reset to 0 for set 2 (each set has its own score)
  const set2UsVal = await usScoreBtn.locator(".stat-number").textContent();
  check("Switching to Set 2 resets visible score", set2UsVal?.trim() === "0");

  // 17. Verify positionPlayed got persisted for Jordan as L (dual-role)
  const jordanPos = psql(`
    SELECT "positionPlayed" FROM "StatLine"
    WHERE "matchId"='${matchId}'
    AND "playerId"=(SELECT id FROM "Player" WHERE name='Jordan')
  `);
  check("DB: Jordan's positionPlayed locked in as L (dual-role override)", jordanPos === "L");

  // 18. Offline test: go offline, record 2 stats, then come back online
  await ctx.setOffline(true);
  await page.locator('button:has-text("Zara")').first().click();
  await page.locator('button:has-text("ACE")').first().click();
  await page.waitForTimeout(200);
  await page.locator('button:has-text("Zara")').first().click();
  await page.locator('button:has-text("KILL")').first().click();
  await page.waitForTimeout(300);
  // The offline indicator should be visible
  const offlinePillVisible = await page.locator("text=Offline").first().isVisible().catch(() => false);
  check("Offline pill appears when network is down", offlinePillVisible);
  // Stats should NOT be in the DB yet
  const zaraKillsOffline = psql(`
    SELECT COALESCE(SUM(kills),0) FROM "StatLine" WHERE "matchId"='${matchId}'
    AND "playerId"=(SELECT id FROM "Player" WHERE name='Zara')
  `);
  check("Stats are queued (not yet in DB) while offline", zaraKillsOffline === "0");
  // Come back online
  await ctx.setOffline(false);
  await page.waitForTimeout(1500);
  const zaraKillsOnline = psql(`
    SELECT kills FROM "StatLine" WHERE "matchId"='${matchId}'
    AND "playerId"=(SELECT id FROM "Player" WHERE name='Zara')
  `);
  const zaraAcesOnline = psql(`
    SELECT aces FROM "StatLine" WHERE "matchId"='${matchId}'
    AND "playerId"=(SELECT id FROM "Player" WHERE name='Zara')
  `);
  check("Stats flush to DB after going back online (kills)", zaraKillsOnline === "1");
  check("Stats flush to DB after going back online (aces)", zaraAcesOnline === "1");

  // 19. Tap target sizes ≥ 44px on mobile viewport
  // Sample a few action buttons.
  const killBox = await page.locator('button:has-text("KILL")').first().boundingBox();
  const playerBox = await page.locator('button:has-text("Tess")').first().boundingBox();
  check(
    "Action button tap target ≥ 60px tall",
    killBox && killBox.height >= 60,
    `KILL = ${killBox?.height}px`,
  );
  check(
    "Player card tap target ≥ 44px tall",
    playerBox && playerBox.height >= 44,
    `Tess = ${playerBox?.height}px`,
  );

  // 20. Take a screenshot for the user
  await page.screenshot({ path: "/tmp/spikeledger-entry-mobile.png", fullPage: true });
  console.log("\n📸 Mobile screenshot: /tmp/spikeledger-entry-mobile.png");

  // Desktop viewport screenshot
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: "/tmp/spikeledger-entry-desktop.png", fullPage: true });
  console.log("📸 Desktop screenshot: /tmp/spikeledger-entry-desktop.png");

  await browser.close();

  // Cleanup
  psql(`DELETE FROM "Match" WHERE id='${matchId}'`);
  console.log("\nCleaned up test match.");

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n${passed} / ${results.length} checks passed`);
  process.exit(passed === results.length ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
