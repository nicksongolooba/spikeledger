// Install prompt detection, driven in a real browser.
//
// The bug this guards: the install banner kept appearing to people who had
// already installed SpikeLedger. Each case below turns on one of the signals
// the app uses and checks the banner stays away.
//
// Needs a running server and Playwright's chromium:
//   npm run build && npx next start -p 3212
//   BASE=http://127.0.0.1:3212 node --import tsx scripts/verify-install-detection.mts

import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

const BASE = process.env.BASE ?? "http://127.0.0.1:3212";
const BANNER = "[data-install-banner]";

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${name}${detail ? `  (${detail})` : ""}`);
  }
}

// tsx rewrites arrow functions in a way page.evaluate cannot deserialise, so
// every snippet below is passed as source text.
const FIRE_INSTALL_PROMPT = `(() => {
  const e = new Event("beforeinstallprompt");
  e.prompt = async () => {};
  e.userChoice = Promise.resolve({ outcome: "dismissed" });
  window.dispatchEvent(e);
  return true;
})()`;

const FIRE_APP_INSTALLED = `(() => { window.dispatchEvent(new Event("appinstalled")); return true; })()`;

const READ_INSTALLED_FLAG = `localStorage.getItem("spikeledger:pwa-installed")`;

// What an installed app window reports for the display-mode media query.
const STANDALONE_MEDIA = `(() => {
  const real = window.matchMedia.bind(window);
  window.matchMedia = (q) =>
    q === "(display-mode: standalone)"
      ? {
          matches: true,
          media: q,
          onchange: null,
          addEventListener() {},
          removeEventListener() {},
          addListener() {},
          removeListener() {},
          dispatchEvent() { return false; },
        }
      : real(q);
})();`;

// The banner only mounts once beforeinstallprompt has fired, so every case
// fires it and then looks.
async function bannerAppears(page: Page): Promise<boolean> {
  // The listener lives in a client module, so React has to hydrate before the
  // synthetic event has anywhere to land.
  await page.waitForFunction(`document.querySelector("main") !== null`).catch(() => undefined);
  await page.waitForTimeout(300);
  await page.evaluate(FIRE_INSTALL_PROMPT);
  try {
    await page.waitForSelector(BANNER, { timeout: 2500, state: "visible" });
    return true;
  } catch {
    return false;
  }
}

async function freshContext(browser: Browser, init?: string): Promise<BrowserContext> {
  const ctx = await browser.newContext();
  if (init) await ctx.addInitScript({ content: init });
  return ctx;
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  try {
    // 1. A browser with no install at all
    console.log("\n1. Fresh browser, nothing installed");
    {
      const ctx = await freshContext(browser);
      const page = await ctx.newPage();
      await page.goto(BASE, { waitUntil: "networkidle" });
      check("the install banner appears", await bannerAppears(page));
      check("the install steps are in the page for everyone", (await page.locator("text=On your home screen").count()) > 0);

      // 2. Dismissed, then reloaded
      console.log("\n2. Dismissed, then reloaded");
      await page.click(`${BANNER} button[aria-label="Dismiss"]`);
      check("it goes away when dismissed", (await page.locator(BANNER).count()) === 0);
      await page.reload({ waitUntil: "networkidle" });
      check("it stays away after a reload", !(await bannerAppears(page)));
      await ctx.close();
    }

    // 3. Running as the installed app
    console.log("\n3. Opened as the installed app");
    {
      // Headless chromium ignores CDP display-mode emulation, so the media
      // query itself is answered the way an installed window answers it. That
      // is the exact input the app reads.
      const ctx = await freshContext(browser, STANDALONE_MEDIA);
      const page = await ctx.newPage();
      await page.goto(BASE, { waitUntil: "networkidle" });
      check("display-mode standalone is detected", await page.evaluate(`window.matchMedia("(display-mode: standalone)").matches`));
      check("no banner inside the installed app", !(await bannerAppears(page)));
      await ctx.close();
    }

    // 4. Installed, but visiting in an ordinary tab
    console.log("\n4. Installed, opened in a normal browser tab");
    {
      const ctx = await freshContext(
        browser,
        `navigator.getInstalledRelatedApps = async () => [{ platform: "webapp", url: location.origin + "/manifest.json" }];`,
      );
      const page = await ctx.newPage();
      await page.goto(BASE, { waitUntil: "networkidle" });
      check("no banner when getInstalledRelatedApps finds our PWA", !(await bannerAppears(page)));
      check("the install is remembered for next time", (await page.evaluate(READ_INSTALLED_FLAG)) === "1");
      check("the steps section says it is already installed", (await page.locator("text=already have SpikeLedger installed").count()) > 0);
      await ctx.close();
    }

    // 5. A browser that has no getInstalledRelatedApps still works
    console.log("\n5. A browser without getInstalledRelatedApps");
    {
      const ctx = await freshContext(
        browser,
        `Object.defineProperty(navigator, "getInstalledRelatedApps", { value: undefined, configurable: true });`,
      );
      const page = await ctx.newPage();
      await page.goto(BASE, { waitUntil: "networkidle" });
      check("the banner still appears to someone without the app", await bannerAppears(page));
      await ctx.close();
    }

    // 6. They install it while we are watching
    console.log("\n6. Installing during the visit");
    {
      const ctx = await freshContext(browser);
      const page = await ctx.newPage();
      await page.goto(BASE, { waitUntil: "networkidle" });
      check("banner shows first", await bannerAppears(page));
      await page.evaluate(FIRE_APP_INSTALLED);
      await page.waitForTimeout(200);
      check("appinstalled hides it immediately", (await page.locator(BANNER).count()) === 0);
      check("and writes the remembered flag", (await page.evaluate(READ_INSTALLED_FLAG)) === "1");
      await page.reload({ waitUntil: "networkidle" });
      check("still gone on the next visit", !(await bannerAppears(page)));
      await ctx.close();
    }

    // 7. iOS Safari, opened from the home screen
    console.log("\n7. iOS Safari home screen app");
    {
      const ctx = await freshContext(browser, `Object.defineProperty(navigator, "standalone", { value: true, configurable: true });`);
      const page = await ctx.newPage();
      await page.goto(BASE, { waitUntil: "networkidle" });
      check("navigator.standalone is honoured", !(await bannerAppears(page)));
      await ctx.close();
    }

    // 8. Android app shell
    console.log("\n8. Android app shell referrer");
    {
      const ctx = await freshContext(
        browser,
        `Object.defineProperty(document, "referrer", { value: "android-app://app.spikeledger.twa/", configurable: true });`,
      );
      const page = await ctx.newPage();
      await page.goto(BASE, { waitUntil: "networkidle" });
      check("an android-app referrer counts as installed", !(await bannerAppears(page)));
      await ctx.close();
    }

    // 9. The manifest itself
    console.log("\n9. Manifest");
    {
      const ctx = await freshContext(browser);
      const page = await ctx.newPage();
      const res = await page.goto(`${BASE}/manifest.json`, { waitUntil: "networkidle" });
      const manifest = JSON.parse(await (await res!.body()).toString());
      check("prefer_related_applications is false", manifest.prefer_related_applications === false);
      check(
        "related_applications points at our own PWA",
        Array.isArray(manifest.related_applications) &&
          manifest.related_applications.length > 0 &&
          manifest.related_applications.every((a: { platform: string; url: string }) => a.platform === "webapp" && a.url.endsWith("/manifest.json")),
      );
      await ctx.close();
    }
  } finally {
    await browser.close();
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
