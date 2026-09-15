// Web copies of the site photography.
//
// Originals (full-size camera/stock files) live in public/images/ and are
// git-ignored: 30 MB of JPEGs has no business in the repo or the deploy.
// This script writes right-sized copies to src/assets/photos/, which the
// pages import statically so next/image serves responsive WebP with blur
// placeholders. Metadata (EXIF, GPS, camera info) is stripped.
//
// Run after adding or replacing a photo:  node scripts/optimize-photos.mjs

import sharp from "sharp";
import { existsSync, statSync } from "node:fs";

const SRC = "public/images";
const OUT = "src/assets/photos";

// width = longest useful display width at 2x; crop = optional extract box as
// fractions of the (auto-oriented) original, for slots whose shape differs
// from the photo's.
const PHOTOS = [
  { name: "hero-court", width: 2400 }, // landing hero background, full bleed
  { name: "coach-courtside", width: 1200 }, // courtside stat entry, portrait panel
  { name: "player-spike", width: 1800 }, // Bank Account (hitters)
  { name: "player-pass", width: 1800 }, // position-fair comparison (liberos)
  { name: "player-set", width: 1200 }, // portrait original, kept for reuse
  // Blog headers: a 16:9 band from the top of the portrait shot, so the
  // ball, the setter's hands and face all stay in frame.
  { name: "player-set", out: "player-set-wide", width: 1600, crop: { left: 0, top: 0.01, width: 1, height: 0.375 } },
  { name: "team-huddle", width: 1200 }, // built by a coach
  { name: "phone-gym", width: 1200 }, // install on your phone
  { name: "parents-bleachers", width: 1800 }, // WhatsApp-ready reports
];

const kb = (bytes) => `${Math.round(bytes / 1024)} KB`;
let total = 0;
for (const p of PHOTOS) {
  const input = `${SRC}/${p.name}.jpg`;
  if (!existsSync(input)) {
    console.error(`missing ${input}`);
    process.exitCode = 1;
    continue;
  }
  // Auto-orient first so crop fractions refer to what a viewer sees.
  const oriented = await sharp(input).rotate().toBuffer({ resolveWithObject: true });
  let img = sharp(oriented.data);
  if (p.crop) {
    const { width: w, height: h } = oriented.info;
    img = img.extract({
      left: Math.round(p.crop.left * w),
      top: Math.round(p.crop.top * h),
      width: Math.round(p.crop.width * w),
      height: Math.min(Math.round(p.crop.height * h), h - Math.round(p.crop.top * h)),
    });
  }
  const file = `${OUT}/${p.out ?? p.name}.jpg`;
  const info = await img
    .resize({ width: p.width, withoutEnlargement: true })
    .jpeg({ quality: 80, mozjpeg: true, progressive: true })
    .toFile(file);
  total += info.size;
  console.log(`${file.padEnd(40)} ${String(info.width).padStart(4)}x${String(info.height).padEnd(5)} ${kb(info.size).padStart(7)}  (original ${kb(statSync(input).size)})`);
}
console.log(`total ${kb(total)}`);
