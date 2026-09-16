// Measures the icon files on disk. Nothing here trusts the sizes that were
// passed to the generator: every number below is read back out of the pixels.
//
// Run: node scripts/verify-app-icons.mjs
// Exits non-zero if any check fails.

import sharp from "sharp";
import { readFileSync, existsSync } from "node:fs";

const results = [];
function check(group, name, pass, detail) {
  results.push({ group, name, pass, detail });
}

async function raw(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, W: info.width, H: info.height, C: info.channels };
}

const px = ({ data, W, C }, x, y) => {
  const i = (y * W + x) * C;
  return [data[i], data[i + 1], data[i + 2], data[i + 3]];
};

// Bounding box of the mark. On a transparent icon that is everything with
// alpha; on an opaque one it is everything that is not the flat plate colour,
// which is the outside of the bright ring.
function markBox(img, plate) {
  const { W, H } = img;
  const isMark = plate
    ? (x, y) => {
        const p = px(img, x, y);
        return Math.abs(p[0] - plate[0]) + Math.abs(p[1] - plate[1]) + Math.abs(p[2] - plate[2]) > 16;
      }
    : (x, y) => px(img, x, y)[3] > 16;
  let left = W, top = H, right = -1, bottom = -1;
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      if (isMark(x, y)) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  return {
    left, top, right, bottom,
    width: right - left + 1,
    height: bottom - top + 1,
    cx: (left + right) / 2,
    cy: (top + bottom) / 2,
  };
}

async function isOpaque(file) {
  const meta = await sharp(file).metadata();
  if (!meta.hasAlpha) return { opaque: true, how: `${meta.channels} channels, no alpha` };
  const { data, W, H, C } = await raw(file);
  for (let i = 0; i < W * H; i += 1) {
    if (data[i * C + 3] !== 255) return { opaque: false, how: `alpha ${data[i * C + 3]} found` };
  }
  return { opaque: true, how: "alpha present but every pixel 255" };
}

// ---------------------------------------------------------------- A. iPhone
const PLATE = [0x1b, 0x02, 0x46]; // #1b0246, sampled from just inside the ring

for (const file of ["public/icons/apple-touch-icon-180-v4.png", "public/apple-touch-icon.png"]) {
  const g = `A iPhone ${file.split("/").pop()}`;
  if (!existsSync(file)) { check(g, "file exists", false, "missing"); continue; }
  const meta = await sharp(file).metadata();
  check(g, "exactly 180x180", meta.width === 180 && meta.height === 180, `${meta.width}x${meta.height}`);

  const { opaque, how } = await isOpaque(file);
  check(g, "fully opaque", opaque, how);

  const img = await raw(file);
  const corners = [[0, 0], [meta.width - 1, 0], [0, meta.height - 1], [meta.width - 1, meta.height - 1]];
  const cornerOk = corners.every(([x, y]) => {
    const p = px(img, x, y);
    return Math.abs(p[0] - PLATE[0]) <= 2 && Math.abs(p[1] - PLATE[1]) <= 2 && Math.abs(p[2] - PLATE[2]) <= 2;
  });
  check(g, "corners match the plate colour", cornerOk,
    corners.map(([x, y]) => px(img, x, y).slice(0, 3).join(",")).join(" | "));

  const box = markBox(img, PLATE);
  check(g, "circle 135-145px wide", box.width >= 135 && box.width <= 145, `${box.width}x${box.height}px`);
  const target = (meta.width - 1) / 2;
  const off = Math.max(Math.abs(box.cx - target), Math.abs(box.cy - target));
  check(g, "centred within 2px", off <= 2, `centre ${box.cx},${box.cy} vs ${target},${target} (off ${off.toFixed(1)}px)`);
  const margins = [box.left, meta.width - 1 - box.right, box.top, meta.height - 1 - box.bottom];
  check(g, "at least 17px clear on every side", Math.min(...margins) >= 17,
    `L${margins[0]} R${margins[1]} T${margins[2]} B${margins[3]}`);
}

// ------------------------------------------------- B. laptop, tabs ("any")
const ANY_ICONS = [
  "public/icons/icon-192-v4.png",
  "public/icons/icon-512-v4.png",
  "public/icons/favicon-16-v4.png",
  "public/icons/favicon-32-v4.png",
  "public/icons/favicon-48-v4.png",
  "public/icons/favicon-64-v4.png",
  "public/icons/favicon-128-v4.png",
  "public/icons/favicon-256-v4.png",
];

for (const file of ANY_ICONS) {
  const g = `B laptop ${file.split("/").pop()}`;
  if (!existsSync(file)) { check(g, "file exists", false, "missing"); continue; }
  const meta = await sharp(file).metadata();
  const img = await raw(file);

  const corners = [[0, 0], [meta.width - 1, 0], [0, meta.height - 1], [meta.width - 1, meta.height - 1]];
  const alphas = corners.map(([x, y]) => px(img, x, y)[3]);
  check(g, "corners fully transparent", alphas.every((a) => a === 0), `alpha ${alphas.join(",")}`);

  const box = markBox(img, null);
  const pct = (box.width / meta.width) * 100;
  // 16px is the one size where an integer-centred 94% circle does not exist:
  // 0.94 x 16 = 15.04, and a 15px circle cannot sit centred in 16px.
  const lo = meta.width === 16 ? 85 : 90;
  check(g, `circle ${lo}-96% of the canvas`, pct >= lo && pct <= 96,
    `${box.width}/${meta.width} = ${pct.toFixed(1)}%`);
  const target = (meta.width - 1) / 2;
  const off = Math.max(Math.abs(box.cx - target), Math.abs(box.cy - target));
  check(g, "centred within 1px", off <= 1, `centre ${box.cx},${box.cy} vs ${target} (off ${off.toFixed(1)}px)`);
}

// --------------------------------------------------------------- C. Android
{
  const file = "public/icons/maskable-512-v4.png";
  const g = "C Android maskable-512-v4.png";
  const meta = await sharp(file).metadata();
  check(g, "exactly 512x512", meta.width === 512 && meta.height === 512, `${meta.width}x${meta.height}`);
  const { opaque, how } = await isOpaque(file);
  check(g, "fully opaque", opaque, how);
  const img = await raw(file);
  const box = markBox(img, PLATE);
  const pct = (box.width / meta.width) * 100;
  check(g, "circle no wider than 80%", pct <= 80, `${box.width}/512 = ${pct.toFixed(1)}%`);
  const target = (meta.width - 1) / 2;
  const off = Math.max(Math.abs(box.cx - target), Math.abs(box.cy - target));
  check(g, "centred within 2px", off <= 2, `off ${off.toFixed(1)}px`);
}

// ----------------------------------------------------------- favicon.ico
{
  const g = "B favicon.ico";
  const file = "public/favicon.ico";
  const buf = readFileSync(file);
  const count = buf.readUInt16LE(4);
  const sizes = [];
  for (let i = 0; i < count; i += 1) {
    const e = 6 + i * 16;
    sizes.push(buf.readUInt8(e) === 0 ? 256 : buf.readUInt8(e));
  }
  check(g, "at the site root", existsSync(file), file);
  check(g, "holds 16, 32, 48 and 256", sizes.join(",") === "16,32,48,256", sizes.join(","));
}

// ------------------------------------------------------------- manifest
{
  const g = "manifest.json";
  const m = JSON.parse(readFileSync("public/manifest.json", "utf8"));
  const any = m.icons.filter((i) => i.purpose === "any");
  const mask = m.icons.filter((i) => i.purpose === "maskable");
  check(g, 'no "any maskable" on any entry',
    !m.icons.some((i) => (i.purpose ?? "").trim().split(/\s+/).length > 1),
    m.icons.map((i) => i.purpose).join(" | "));
  check(g, '"any" icons are 192 and 512',
    any.length === 2 && any.map((i) => i.sizes).sort().join(",") === "192x192,512x512",
    any.map((i) => `${i.src} ${i.sizes}`).join(" | "));
  check(g, "one maskable at 512", mask.length === 1 && mask[0].sizes === "512x512",
    mask.map((i) => `${i.src} ${i.sizes}`).join(" | "));
  const missing = m.icons.filter((i) => !existsSync(`public${i.src}`));
  check(g, "every listed file exists", missing.length === 0,
    missing.length ? missing.map((i) => i.src).join(", ") : "all present");
  const unversioned = m.icons.filter((i) => !i.src.includes("-v4"));
  check(g, "every icon URL is a new -v4 path", unversioned.length === 0,
    unversioned.length ? unversioned.map((i) => i.src).join(", ") : "all versioned");
}

// -------------------------------------------------------------- old files
{
  const g = "old files";
  const gone = [
    "src/app/icon.png", "src/app/apple-icon.png", "src/app/favicon.ico",
    "public/icons/icon-192.png", "public/icons/icon-512.png",
    "public/icons/maskable-192.png", "public/icons/maskable-512.png",
    "public/icons/tile-256.png", "public/icons/favicon-32.png",
  ];
  const left = gone.filter((f) => existsSync(f));
  check(g, "superseded icon files removed", left.length === 0, left.length ? left.join(", ") : "none left");
}

// ------------------------------------------------------------------ report
const width = Math.max(...results.map((r) => r.group.length));
let failed = 0;
let lastGroup = "";
for (const r of results) {
  if (r.group !== lastGroup) { console.log(`\n${r.group}`); lastGroup = r.group; }
  if (!r.pass) failed += 1;
  console.log(`  ${r.pass ? "PASS" : "FAIL"}  ${r.name.padEnd(34)} ${r.detail}`);
}
console.log(`\n${results.length - failed}/${results.length} checks passed.`);
process.exit(failed ? 1 : 0);
