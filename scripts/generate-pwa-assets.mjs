// Generates every derived brand asset: first the base art out of the logo
// sheet (see scripts/extract-brand-assets.mjs), then the PWA manifest icons
// and iOS splash screens from that.
// Run: node scripts/generate-pwa-assets.mjs
// Sources: "spikeledger logo update.png" at the repo root (or LOGO_SHEET=...).
// If the sheet is missing, the existing public/logo-icon.png (512 circular
// icon) and public/logo-full.png (horizontal logo) are used as-is.

import sharp from "sharp";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { BRAND_NAVY, SHEET, extractBrandAssets } from "./extract-brand-assets.mjs";

if (existsSync(SHEET)) {
  await extractBrandAssets(SHEET);
} else {
  console.log(`(no logo sheet at "${SHEET}" - reusing the current public/logo-*.png)`);
}

const MASKABLE_BG = BRAND_NAVY; // the sheet's navy behind the circular mark
const SPLASH_BG = "#f4f6f9"; // paper - matches the light app shell
const ICON_SRC = "public/logo-icon.png";
const WORDMARK_SRC = "public/logo-full.png";

await mkdir("public/icons", { recursive: true });
await mkdir("public/splash", { recursive: true });

// --- Manifest icons (purpose: any) --------------------------------------
for (const size of [192, 384, 512]) {
  await sharp(ICON_SRC)
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(`public/icons/icon-${size}.png`);
  console.log(`icon-${size}.png`);
}

// --- Maskable icons (purpose: maskable): logo in the 80% safe zone on BG --
for (const size of [192, 512]) {
  const inner = Math.round(size * 0.7);
  const logo = await sharp(ICON_SRC)
    .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: MASKABLE_BG },
  })
    .composite([{ input: logo, gravity: "centre" }])
    .png()
    .toFile(`public/icons/maskable-${size}.png`);
  console.log(`maskable-${size}.png`);
}

// --- iOS splash screens: paper bg + centered wordmark --------------------
// [cssWidth, cssHeight, dpr] — used to build both the PNG (px = css*dpr) and
// the media query in the layout's appleWebApp.startupImage list.
const DEVICES = [
  [375, 667, 2], // iPhone SE / 8 / 7 / 6s
  [414, 896, 2], // iPhone XR / 11
  [375, 812, 3], // iPhone X / XS / 11 Pro
  [414, 896, 3], // iPhone XS Max / 11 Pro Max
  [390, 844, 3], // iPhone 12 / 13 / 14
  [428, 926, 3], // iPhone 12/13 Pro Max / 14 Plus
  [393, 852, 3], // iPhone 14 Pro / 15 / 16
  [430, 932, 3], // iPhone 14 Pro Max / 15 Pro Max
];

for (const [cw, ch, dpr] of DEVICES) {
  const w = cw * dpr;
  const h = ch * dpr;
  const logoW = Math.round(w * 0.55);
  const logo = await sharp(WORDMARK_SRC)
    .resize(logoW, null, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  await sharp({
    create: { width: w, height: h, channels: 4, background: SPLASH_BG },
  })
    .composite([{ input: logo, gravity: "centre" }])
    .png()
    .toFile(`public/splash/apple-splash-${w}-${h}.png`);
  console.log(`apple-splash-${w}-${h}.png`);
}

console.log("Done.");
