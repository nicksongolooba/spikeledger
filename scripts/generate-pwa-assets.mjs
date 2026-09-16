// Generates every derived brand asset.
//
// Two sources, both committed at the repo root:
//   "spikeledger app icon.png"    the circular app icon -> platform icons
//   "spikeledger logo update.png" the logo sheet        -> wordmarks
//
// Run: node scripts/generate-pwa-assets.mjs
// Then: node scripts/verify-app-icons.mjs   (measures the files it wrote)
//
// Every platform icon is written by its own call below. No file is reused for
// two jobs, because the three jobs want different things:
//
//   iPhone     opaque edge to edge with square corners, because iOS throws the
//              alpha channel away and rounds the corners itself. The disc is
//              drawn small and centred so there is real space around it, the
//              way the old icon looked on the home screen.
//   laptop     the disc alone on transparency, so nothing square appears
//   and tabs   behind it in the taskbar or the tab strip.
//   Android    opaque again, with the disc well inside the safe zone, because
//              a maskable icon is cropped to whatever shape the launcher uses.
//
// Sizes are resampled straight from the full resolution master with lanczos3.
// Nothing is produced by scaling another output.

import sharp from "sharp";
import { existsSync, writeFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { BRAND_NAVY, SHEET, extractBrandAssets } from "./extract-brand-assets.mjs";
import { ICON_SOURCE, extractAppIcon } from "./extract-app-icon.mjs";

const SPLASH_BG = "#f4f6f9"; // paper, matches the light app shell

await mkdir("public/icons", { recursive: true });
await mkdir("public/splash", { recursive: true });

// --- Wordmarks (unchanged by the icon work) -------------------------------
if (existsSync(SHEET)) {
  await extractBrandAssets(SHEET);
} else {
  console.log(`(no logo sheet at "${SHEET}" - reusing the current public/logo-*.png)`);
}

// Header copies at 2x the largest place they are drawn (52px tall), so retina
// screens get real pixels instead of a browser downscale of the master.
const HEADER_LOGO_HEIGHT = 104;
for (const name of ["logo-full", "logo-full-on-dark"]) {
  const out = await sharp(`public/${name}.png`)
    .resize({ height: HEADER_LOGO_HEIGHT, kernel: sharp.kernel.lanczos3 })
    .png()
    .toFile(`public/${name}@2x.png`);
  console.log(`public/${name}@2x.png  ${out.width}x${out.height}`);
}

// --- App icon master ------------------------------------------------------
const icon = await extractAppIcon(ICON_SOURCE);
// The plate colour behind the opaque icons, read out of the artwork itself.
const ICON_BG = icon.background.hex;

console.log(
  `app icon master ${icon.size}x${icon.size} from "${ICON_SOURCE}"\n` +
    `  disc ${icon.metrics.disc.width}x${icon.metrics.disc.height}, ` +
    `centre ${icon.metrics.centre.x},${icon.metrics.centre.y}\n` +
    `  plate colour ${ICON_BG} (sampled just inside the ring)`,
);
if (icon.diameter < 512) {
  console.log(`  note: the source disc is only ${icon.diameter}px, so the 512 icons are upscaled.`);
}

// A light unsharp pass on the small sizes holds the ball's seams and the
// chart bars together after the downscale. 128 and up is left exactly as drawn.
function sharpenFor(size) {
  if (size <= 32) return 0.5;
  if (size <= 64) return 0.4;
  return 0;
}

// The one drawing primitive: the disc at `circle` px, centred on a `canvas` px
// square. `background` null keeps the canvas transparent; a colour flattens
// the result and drops the alpha channel entirely.
async function drawIcon({ canvas, circle, background = null }) {
  const gap = canvas - circle;
  if (gap < 0) throw new Error(`circle ${circle} does not fit in ${canvas}`);
  if (gap % 2) throw new Error(`circle ${circle} cannot be centred in ${canvas}: ${gap}px left over`);
  const offset = gap / 2;

  const sigma = sharpenFor(canvas);
  let mark = sharp(icon.circle).resize(circle, circle, { kernel: sharp.kernel.lanczos3, fit: "fill" });
  if (sigma > 0) mark = mark.sharpen({ sigma });
  const markPng = await mark.png().toBuffer();

  let out = sharp({
    create: {
      width: canvas,
      height: canvas,
      channels: 4,
      background: background ?? { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite([{ input: markPng, left: offset, top: offset }]);

  if (background) out = out.flatten({ background }).removeAlpha();
  return out.png({ compressionLevel: 9 });
}

// Transparent icons leave a thin margin so the antialiased edge of the ring is
// never clipped by a platform that rounds or insets the canvas.
function transparentCircle(canvas) {
  const margin = Math.max(1, Math.round(canvas * 0.03));
  return canvas - margin * 2;
}

const written = [];
async function write(path, pipeline) {
  const out = await pipeline.toFile(path);
  written.push(path);
  console.log(`  ${path}  ${out.width}x${out.height}`);
  return out;
}

// --- A. iPhone ------------------------------------------------------------
// 180x180, opaque, square corners (iOS rounds them), disc 140px with 20px of
// plate showing on every side.
console.log("iPhone (apple touch icon, opaque, disc inset):");
const APPLE_CANVAS = 180;
const APPLE_CIRCLE = 140;
const applePng = await (await drawIcon({ canvas: APPLE_CANVAS, circle: APPLE_CIRCLE, background: ICON_BG })).toBuffer();
writeFileSync("public/icons/apple-touch-icon-180-v4.png", applePng);
console.log(`  public/icons/apple-touch-icon-180-v4.png  ${APPLE_CANVAS}x${APPLE_CANVAS}`);
// iOS and several crawlers request this path directly, without reading the
// HTML, so the site root carries the same icon.
writeFileSync("public/apple-touch-icon.png", applePng);
console.log(`  public/apple-touch-icon.png  ${APPLE_CANVAS}x${APPLE_CANVAS}`);
written.push("public/icons/apple-touch-icon-180-v4.png", "public/apple-touch-icon.png");

// --- B. Laptop, browser tabs, installed window ----------------------------
// Transparent, disc only. These are the manifest "any" icons and the favicons.
console.log('laptop and tabs ("any" icons and favicons, transparent, disc only):');
for (const size of [192, 512]) {
  await write(
    `public/icons/icon-${size}-v4.png`,
    await drawIcon({ canvas: size, circle: transparentCircle(size) }),
  );
}
const FAVICON_SIZES = [16, 32, 48, 64, 128, 256];
for (const size of FAVICON_SIZES) {
  await write(
    `public/icons/favicon-${size}-v4.png`,
    await drawIcon({ canvas: size, circle: transparentCircle(size) }),
  );
}

// favicon.ico at the site root: browsers request /favicon.ico with no prompting
// from the HTML, and Windows reads it when a site is pinned.
const ICO_SIZES = [16, 32, 48, 256];
const icoParts = [];
for (const size of ICO_SIZES) {
  icoParts.push({
    size,
    png: await (await drawIcon({ canvas: size, circle: transparentCircle(size) })).toBuffer(),
  });
}
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(icoParts.length, 4);
let offset = 6 + icoParts.length * 16;
const entries = icoParts.map(({ size, png }) => {
  const e = Buffer.alloc(16);
  e.writeUInt8(size >= 256 ? 0 : size, 0); // 0 means 256
  e.writeUInt8(size >= 256 ? 0 : size, 1);
  e.writeUInt8(0, 2); // palette
  e.writeUInt8(0, 3); // reserved
  e.writeUInt16LE(1, 4); // colour planes
  e.writeUInt16LE(32, 6); // bits per pixel
  e.writeUInt32LE(png.length, 8);
  e.writeUInt32LE(offset, 12);
  offset += png.length;
  return e;
});
writeFileSync("public/favicon.ico", Buffer.concat([header, ...entries, ...icoParts.map((p) => p.png)]));
written.push("public/favicon.ico");
console.log(`  public/favicon.ico  ${ICO_SIZES.join(", ")}`);

// --- C. Android -----------------------------------------------------------
// Maskable: the launcher crops this to its own circle, squircle or square, so
// it is opaque to the edges with the disc at 70% of the canvas, comfortably
// inside the safe zone.
console.log("Android (maskable, opaque, disc at 70%):");
await write(
  "public/icons/maskable-512-v4.png",
  await drawIcon({ canvas: 512, circle: 358, background: ICON_BG }),
);

// --- iOS splash screens ---------------------------------------------------
// [cssWidth, cssHeight, dpr] - the PNG is css*dpr, and the layout's
// appleWebApp.startupImage media queries follow the same list.
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

console.log("splash screens:");
for (const [cw, ch, dpr] of DEVICES) {
  const w = cw * dpr;
  const h = ch * dpr;
  const iconSize = Math.round(w * 0.28);
  const wordmarkWidth = Math.round(w * 0.55);
  // Our own surface, so the disc can sit on the paper background as-is.
  const mark = await sharp(icon.circle)
    .resize(iconSize, iconSize, { kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();
  const wordmark = await sharp("public/logo-full.png")
    .resize(wordmarkWidth, null, { kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();
  const wordmarkHeight = (await sharp(wordmark).metadata()).height;
  const gap = Math.round(w * 0.06);
  const blockTop = Math.round((h - (iconSize + gap + wordmarkHeight)) / 2);
  await sharp({ create: { width: w, height: h, channels: 4, background: SPLASH_BG } })
    .composite([
      { input: mark, left: Math.round((w - iconSize) / 2), top: blockTop },
      { input: wordmark, left: Math.round((w - wordmarkWidth) / 2), top: blockTop + iconSize + gap },
    ])
    .png()
    .toFile(`public/splash/apple-splash-${w}-${h}.png`);
  console.log(`  public/splash/apple-splash-${w}-${h}.png`);
}

console.log(`Done. ${written.length} icon files. Plate ${ICON_BG}, navy ${BRAND_NAVY}.`);
