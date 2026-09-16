// Cuts the base brand art out of the logo sheet and writes the files every
// other brand asset is built from. Run on its own, or let
// scripts/generate-pwa-assets.mjs call it first.
//
//   node scripts/extract-brand-assets.mjs            # uses "spikeledger logo update.png"
//   LOGO_SHEET=path/to/sheet.png node scripts/...   # a different sheet
//
// The sheet is the designer's 4-panel export: horizontal logo on navy,
// horizontal logo on white, standalone circular icon, rounded-square app
// icon. Each panel has a small grey label top-left; the search boxes below
// skip those. Backgrounds are keyed to transparency, with the edge pixels
// un-blended so nothing gets a halo on a different surface.
//
// Outputs:
//   public/logo-full.png            horizontal logo for light surfaces
//   public/logo-full-on-dark.png    horizontal logo for navy surfaces
//   public/logo-icon.png            circular icon, 512, transparent outside the ring
//
// Platform icons (favicon, apple touch icon, manifest and maskable icons) do
// NOT come from here: they are built from the dedicated app icon sheet by
// scripts/extract-app-icon.mjs.

import sharp from "sharp";
import { existsSync } from "node:fs";

export const SHEET = process.env.LOGO_SHEET ?? "spikeledger logo update.png";
// The navy behind the app icon on the sheet - used wherever we need a solid
// brand background (apple touch icon, maskable icons).
export const BRAND_NAVY = "#031025";
const NAVY_RGB = [3, 16, 37];
const WHITE_RGB = [254, 254, 254];

// Where to look for each variant (fractions of the sheet, so a re-export at
// another size still works), the background to key, and how to key it:
//   "all"      every background-coloured pixel goes transparent (wordmarks;
//              the ball's white panels vanish too, which is right on a light
//              surface and invisible on navy for the navy-keyed variant)
//   "exterior" only background connected to the outside edge goes
//              transparent (icons keep their white interior)
// `edge` says which pixels mark the outer extent of the artwork: the cyan
// ring/wordmark ("saturated") for the logos and circular icon, the navy
// square ("dark") for the app icon. The grey panel labels match neither.
const VARIANTS = {
  horizontalOnDark: { box: [0.0, 0.0, 1.0, 0.3], bg: NAVY_RGB, mode: "all", edge: "saturated" },
  horizontalOnLight: { box: [0.0, 0.3, 1.0, 0.6], bg: WHITE_RGB, mode: "all", edge: "saturated" },
  circleIcon: { box: [0.0, 0.6, 0.5, 1.0], bg: WHITE_RGB, mode: "exterior", edge: "saturated", mask: "circle" },
};
const PAD = 6;

function diff(data, i, bg) {
  return Math.max(Math.abs(data[i] - bg[0]), Math.abs(data[i + 1] - bg[1]), Math.abs(data[i + 2] - bg[2]));
}
const EDGE = {
  saturated: (data, i) => Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2]) > 90,
  dark: (data, i) => data[i] + data[i + 1] + data[i + 2] < 180,
};

// Tight box (plus padding, clamped to the sheet) around the artwork's edge
// pixels inside a search box.
function findBox(data, W, H, C, [fx0, fy0, fx1, fy1], edge) {
  let minx = Infinity, miny = Infinity, maxx = -1, maxy = -1;
  const isEdge = EDGE[edge];
  for (let y = Math.floor(fy0 * H); y < Math.floor(fy1 * H); y++) {
    for (let x = Math.floor(fx0 * W); x < Math.floor(fx1 * W); x++) {
      if (isEdge(data, (y * W + x) * C)) {
        if (x < minx) minx = x;
        if (x > maxx) maxx = x;
        if (y < miny) miny = y;
        if (y > maxy) maxy = y;
      }
    }
  }
  if (maxx < 0) throw new Error("no artwork found in search box");
  const left = Math.max(0, minx - PAD);
  const top = Math.max(0, miny - PAD);
  return { left, top, width: Math.min(W, maxx + 1 + PAD) - left, height: Math.min(H, maxy + 1 + PAD) - top };
}

// RGB crop -> RGBA with the background keyed out.
function keyBackground(rgb, w, h, bg, mode, mask) {
  const LO = 10, HI = 64; // diff below LO = background, above HI = solid art
  const n = w * h;
  const exterior = new Uint8Array(n);
  if (mode === "exterior") {
    // Flood fill background-coloured pixels from the border.
    const stack = [];
    const push = (x, y) => {
      const i = y * w + x;
      if (exterior[i] || diff(rgb, i * 3, bg) >= LO) return;
      exterior[i] = 1;
      stack.push(i);
    };
    for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
    for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
    while (stack.length) {
      const i = stack.pop();
      const x = i % w, y = (i - x) / w;
      if (x > 0) push(x - 1, y);
      if (x < w - 1) push(x + 1, y);
      if (y > 0) push(x, y - 1);
      if (y < h - 1) push(x, y + 1);
    }
  }
  // Pixels within a few px of the exterior are anti-aliased edges and get a
  // soft alpha; everything else inside stays solid.
  const band = new Uint8Array(n);
  if (mode === "exterior") {
    let frontier = [];
    for (let i = 0; i < n; i++) if (exterior[i]) frontier.push(i);
    for (let depth = 0; depth < 4; depth++) {
      const next = [];
      for (const i of frontier) {
        const x = i % w, y = (i - x) / w;
        for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
          if (j >= 0 && !exterior[j] && !band[j]) { band[j] = 1; next.push(j); }
        }
      }
      frontier = next;
    }
  }
  // Optional circular mask: the circular icon's crop box is the ring's
  // bounding box, so anything outside the inscribed circle (the tail of the
  // panel label, say) is not part of the icon.
  const cx = (w - 1) / 2, cy = (h - 1) / 2, r = Math.min(w, h) / 2;
  const out = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i++) {
    const d = diff(rgb, i * 3, bg);
    let a;
    if (mode === "all") a = Math.min(1, Math.max(0, (d - LO) / (HI - LO)));
    else if (exterior[i]) a = 0;
    else if (band[i]) a = Math.min(1, Math.max(0, (d - LO) / (HI - LO)));
    else a = 1;
    if (mask === "circle") {
      const x = i % w, y = (i - x) / w;
      if (Math.hypot(x - cx, y - cy) > r) a = 0;
    }
    if (a <= 0.02) {
      out[i * 4] = bg[0]; out[i * 4 + 1] = bg[1]; out[i * 4 + 2] = bg[2]; out[i * 4 + 3] = 0;
      continue;
    }
    for (let c = 0; c < 3; c++) {
      // Un-blend: the pixel is a*fg + (1-a)*bg, recover fg.
      const v = a >= 1 ? rgb[i * 3 + c] : (rgb[i * 3 + c] - (1 - a) * bg[c]) / a;
      out[i * 4 + c] = Math.max(0, Math.min(255, Math.round(v)));
    }
    out[i * 4 + 3] = Math.round(a * 255);
  }
  return out;
}

async function cut(sheet, variant) {
  const { data, info } = await sharp(sheet).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const box = findBox(data, info.width, info.height, info.channels, variant.box, variant.edge);
  const crop = await sharp(sheet).removeAlpha().extract(box).raw().toBuffer();
  const rgba = keyBackground(crop, box.width, box.height, variant.bg, variant.mode, variant.mask);
  return { box, image: sharp(rgba, { raw: { width: box.width, height: box.height, channels: 4 } }) };
}

export async function extractBrandAssets(sheet = SHEET) {
  if (!existsSync(sheet)) throw new Error(`logo sheet not found: ${sheet}`);
  const clear = { r: 0, g: 0, b: 0, alpha: 0 };

  const dark = await cut(sheet, VARIANTS.horizontalOnDark);
  const light = await cut(sheet, VARIANTS.horizontalOnLight);
  // Same canvas for both wordmarks so one aspect ratio serves the component.
  const wmW = Math.max(dark.box.width, light.box.width);
  const wmH = Math.max(dark.box.height, light.box.height);
  for (const [name, v] of [["logo-full-on-dark", dark], ["logo-full", light]]) {
    await v.image
      .resize(wmW, wmH, { fit: "contain", background: clear })
      .png()
      .toFile(`public/${name}.png`);
    console.log(`public/${name}.png  ${wmW}x${wmH}  (from sheet box ${JSON.stringify(v.box)})`);
  }

  const circle = await cut(sheet, VARIANTS.circleIcon);
  const circleSide = Math.max(circle.box.width, circle.box.height);
  const circlePng = await circle.image
    .resize(circleSide, circleSide, { fit: "contain", background: clear })
    .png()
    .toBuffer();
  await sharp(circlePng).resize(512, 512).png().toFile("public/logo-icon.png");
  console.log(`public/logo-icon.png  512x512  (from sheet box ${JSON.stringify(circle.box)})`);

  return { wordmark: { width: wmW, height: wmH } };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split(/[\\/]/).pop())) {
  await extractBrandAssets();
  console.log("Done.");
}
