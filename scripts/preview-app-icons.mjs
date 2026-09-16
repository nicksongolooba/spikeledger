// Renders one sheet showing the icons on the surfaces that actually draw
// them, so the result can be looked at instead of assumed.
//
// Run: node scripts/preview-app-icons.mjs [outfile]
// Default output: icon-preview.png in the current directory.

import sharp from "sharp";

const OUT = process.argv[2] ?? "icon-preview.png";
const W = 1040;
const H = 860;
const PAPER = "#ffffff";

const text = (t, x, y, size = 17, fill = "#0b1524", weight = 400) =>
  `<text x="${x}" y="${y}" font-family="DejaVu Sans, Helvetica, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}">${t}</text>`;

// iOS masks home screen icons with a rounded square, roughly a 22% radius.
async function iosRounded(file, size) {
  const r = Math.round(size * 0.2237);
  const mask = Buffer.from(
    `<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="#fff"/></svg>`,
  );
  return sharp(file)
    .resize(size, size, { kernel: sharp.kernel.lanczos3 })
    .ensureAlpha()
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();
}

async function maskedTo(file, size, shape) {
  const d = size;
  const path =
    shape === "circle"
      ? `<circle cx="${d / 2}" cy="${d / 2}" r="${d / 2}" fill="#fff"/>`
      : `<rect width="${d}" height="${d}" rx="${Math.round(d * 0.28)}" ry="${Math.round(d * 0.28)}" fill="#fff"/>`;
  const mask = Buffer.from(`<svg width="${d}" height="${d}">${path}</svg>`);
  return sharp(file)
    .resize(d, d, { kernel: sharp.kernel.lanczos3 })
    .ensureAlpha()
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();
}

const layers = [];

// --- iPhone home screen ---------------------------------------------------
// A wallpaper-ish gradient, so it is obvious where the icon's plate ends.
layers.push({
  input: Buffer.from(
    `<svg width="440" height="230"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#8e7cc3"/><stop offset="0.5" stop-color="#3b2b63"/><stop offset="1" stop-color="#101a3a"/>
    </linearGradient></defs><rect width="440" height="230" rx="18" fill="url(#g)"/></svg>`,
  ),
  left: 40,
  top: 124,
});
let ix = 74;
for (const size of [120, 90, 60]) {
  layers.push({
    input: await iosRounded("public/icons/apple-touch-icon-180-v4.png", size),
    left: ix,
    top: 124 + Math.round((230 - size) / 2),
  });
  ix += size + 34;
}

// --- Windows / macOS taskbar strips ---------------------------------------
const TASKBAR = [
  ["#202020", "dark taskbar", 100],
  ["#f3f3f3", "light taskbar", 208],
];
for (const [bg, , top] of TASKBAR) {
  layers.push({
    input: Buffer.from(`<svg width="420" height="76"><rect width="420" height="76" rx="10" fill="${bg}"/></svg>`),
    left: 560,
    top,
  });
  let x = 592;
  for (const size of [24, 32, 48]) {
    layers.push({
      input: await sharp("public/icons/icon-192-v4.png")
        .resize(size, size, { kernel: sharp.kernel.lanczos3 })
        .png()
        .toBuffer(),
      left: x,
      top: top + Math.round((76 - size) / 2),
    });
    x += size + 46;
  }
}

// --- Android launcher -----------------------------------------------------
let ax = 74;
for (const shape of ["circle", "squircle"]) {
  layers.push({ input: await maskedTo("public/icons/maskable-512-v4.png", 104, shape), left: ax, top: 440 });
  ax += 150;
}

// --- Browser tab strip ----------------------------------------------------
layers.push({
  input: Buffer.from(
    `<svg width="420" height="86"><rect width="420" height="86" fill="#dee1e6"/>
     <rect x="14" y="18" width="200" height="60" rx="9" fill="#ffffff"/>
     <rect x="224" y="18" width="180" height="60" rx="9" fill="#dee1e6"/></svg>`,
  ),
  left: 560,
  top: 420,
});
layers.push({
  input: await sharp("public/icons/favicon-16-v4.png").png().toBuffer(),
  left: 586,
  top: 440,
});
layers.push({
  input: await sharp("public/icons/favicon-32-v4.png").png().toBuffer(),
  left: 700,
  top: 432,
});

// --- Actual size favicon row ---------------------------------------------
let fx = 74;
for (const [file, size] of [
  ["public/icons/favicon-16-v4.png", 16],
  ["public/icons/favicon-32-v4.png", 32],
  ["public/icons/favicon-48-v4.png", 48],
  ["public/icons/favicon-64-v4.png", 64],
]) {
  layers.push({ input: await sharp(file).png().toBuffer(), left: fx, top: 640 - Math.round(size / 2) });
  fx += size + 34;
}

// --- 32px magnified -------------------------------------------------------
layers.push({
  input: await sharp("public/icons/favicon-32-v4.png")
    .resize(192, 192, { kernel: "nearest" })
    .png()
    .toBuffer(),
  left: 560,
  top: 570,
});
layers.push({
  input: await sharp("public/icons/apple-touch-icon-180-v4.png")
    .resize(192, 192, { kernel: "nearest" })
    .png()
    .toBuffer(),
  left: 790,
  top: 570,
});

const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="${PAPER}"/>
  ${text("SpikeLedger app icons", 40, 48, 27, "#0b1524", 700)}
  ${text("every file measured in scripts/verify-app-icons.mjs", 40, 74, 16, "#63718a")}

  ${text("iPhone home screen, iOS corner mask", 40, 112, 16, "#63718a")}
  ${text("opaque plate, circle inset, even space all round", 40, 376, 15, "#63718a")}

  ${text("Installed app on the taskbar, transparent, no plate", 560, 86, 16, "#63718a")}
  ${text("24 / 32 / 48 px on #202020", 592, 194, 14, "#63718a")}
  ${text("24 / 32 / 48 px on #f3f3f3", 592, 302, 14, "#63718a")}

  ${text("Android launcher masks the maskable file", 40, 424, 16, "#63718a")}
  ${text("circle", 96, 570, 14, "#63718a")}
  ${text("squircle", 238, 570, 14, "#63718a")}

  ${text("Browser tab strip, 16 and 32 px", 560, 410, 16, "#63718a")}

  ${text("Favicons at actual size: 16 / 32 / 48 / 64", 40, 600, 16, "#63718a")}

  ${text("32 px at 6x", 560, 560, 14, "#63718a")}
  ${text("iPhone 180 at 1.07x", 790, 560, 14, "#63718a")}

  ${text("The laptop icon is the disc alone: the strips above show background, not a square.", 40, 800, 16, "#0b1524")}
  ${text("The iPhone icon is the only one with a plate, and the plate is the colour just inside the ring.", 40, 826, 16, "#0b1524")}
</svg>`;

await sharp(Buffer.from(svg)).composite(layers).png().toFile(OUT);
console.log(`wrote ${OUT}`);
