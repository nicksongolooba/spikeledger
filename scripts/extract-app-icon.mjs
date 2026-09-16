// Loads the app icon artwork, measures it, and hands back a single master:
// the disc, cropped square and centred on its own geometry, with whatever
// transparency the source has preserved.
//
// Source: "spikeledger app icon.png" at the repo root, the designer's export
// of the circular mark.
//
// Nothing here decides how big the circle should be drawn or what sits behind
// it. Those are per-platform decisions and they live in
// scripts/generate-pwa-assets.mjs, one explicit call per output file.
//
// Two things are measured rather than assumed:
//   1. the disc's real centre and diameter, because the export is not
//      perfectly centred in its canvas (it sits 2px left and 6px low), so
//      cropping the canvas would push the mark off-centre in every icon.
//   2. the deep purple immediately inside the bright ring, which is the
//      background for the icons that have to be opaque. Sampling it from the
//      art means the plate and the disc interior are the same colour and the
//      ring reads as the icon's edge instead of a circle stuck on a square.

import sharp from "sharp";

export const ICON_SOURCE = process.env.ICON_SOURCE ?? "spikeledger app icon.png";

const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

async function rawRGBA(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, W: info.width, H: info.height, C: info.channels };
}

// Tight bounding box of everything that is not transparent padding.
function alphaBox({ data, W, H, C }) {
  let left = W, top = H, right = -1, bottom = -1;
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      if (data[(y * W + x) * C + 3] > 16) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  if (right < 0) throw new Error("the source image is fully transparent");
  return { left, top, right, bottom, width: right - left + 1, height: bottom - top + 1 };
}

// True when the file carries a real alpha channel whose corners are actually
// cut out. A flattened export, or one with a checkerboard painted into the
// pixels, fails this and gets masked below instead.
function hasCutCorners({ data, W, H, C }) {
  const corner = (x, y) => data[(y * W + x) * C + 3];
  return corner(0, 0) <= 16 && corner(W - 1, 0) <= 16 && corner(0, H - 1) <= 16 && corner(W - 1, H - 1) <= 16;
}

// A painted-on transparency checkerboard alternates two greys in a fixed grid.
// If the corner area is opaque and only holds two near-grey values, say so
// loudly rather than baking the pattern into every icon.
function looksLikeCheckerboard({ data, W, H, C }) {
  const seen = new Map();
  for (let y = 0; y < Math.min(64, H); y += 1) {
    for (let x = 0; x < Math.min(64, W); x += 1) {
      const i = (y * W + x) * C;
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
      if (Math.abs(r - g) > 6 || Math.abs(g - b) > 6) return false; // not grey
      const k = `${r >> 3},${g >> 3},${b >> 3}`;
      seen.set(k, (seen.get(k) ?? 0) + 1);
    }
  }
  return seen.size <= 3;
}

// Where the mark is when the file has no usable alpha: walk in from each edge
// until the pixels stop matching the flat background colour.
function discFromBackground({ data, W, H, C }) {
  const i0 = 0;
  const bg = [data[i0], data[i0 + 1], data[i0 + 2]];
  const differs = (x, y) => {
    const i = (y * W + x) * C;
    return Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]) > 24;
  };
  const my = Math.floor(H / 2);
  const mx = Math.floor(W / 2);
  let l = 0, r = W - 1, t = 0, b = H - 1;
  while (l < W && !differs(l, my)) l += 1;
  while (r > 0 && !differs(r, my)) r -= 1;
  while (t < H && !differs(mx, t)) t += 1;
  while (b > 0 && !differs(mx, b)) b -= 1;
  return { left: l, top: t, right: r, bottom: b, width: r - l + 1, height: b - t + 1 };
}

// Square crop centred on the disc's measured centre, one pixel wider than the
// disc so the antialiased edge is never clipped.
function squareCrop(box, W, H) {
  const cx = (box.left + box.right) / 2;
  const cy = (box.top + box.bottom) / 2;
  let side = Math.max(box.width, box.height) + 2;
  if (side % 2) side += 1;
  side = Math.min(side, W, H);
  return {
    left: Math.max(0, Math.min(W - side, Math.round(cx - side / 2))),
    top: Math.max(0, Math.min(H - side, Math.round(cy - side / 2))),
    width: side,
    height: side,
  };
}

// Median colour of the annulus just inside the bright ring, ignoring the ball
// and the chart bars where they reach into it.
function ringInteriorColour({ data, W, C }, box) {
  const cx = (box.left + box.right) / 2;
  const cy = (box.top + box.bottom) / 2;
  const R = Math.max(box.width, box.height) / 2;
  const at = (x, y) => {
    const i = (y * W + x) * C;
    return [data[i], data[i + 1], data[i + 2], data[i + 3]];
  };
  const ringAt = (f) => {
    let sum = 0, n = 0;
    for (let t = 0; t < 720; t += 1) {
      const a = (t / 720) * 2 * Math.PI;
      const p = at(Math.round(cx + Math.cos(a) * f * R), Math.round(cy + Math.sin(a) * f * R));
      if (p[3] < 200) continue;
      sum += lum(p[0], p[1], p[2]);
      n += 1;
    }
    return n ? sum / n : Infinity;
  };
  // The darkest ring of pixels between the artwork and the outer band is the
  // inner edge of the ring.
  let inner = 0.8, best = Infinity;
  for (let f = 0.6; f <= 0.95; f += 0.01) {
    const l = ringAt(f);
    if (l < best) { best = l; inner = f; }
  }
  const rs = [], gs = [], bs = [];
  for (let f = inner - 0.06; f <= inner + 0.005; f += 0.004) {
    for (let t = 0; t < 1440; t += 1) {
      const a = (t / 1440) * 2 * Math.PI;
      const p = at(Math.round(cx + Math.cos(a) * f * R), Math.round(cy + Math.sin(a) * f * R));
      if (p[3] < 200) continue;
      if (Math.min(p[0], p[1], p[2]) > 100) continue; // the ball and the bars
      rs.push(p[0]); gs.push(p[1]); bs.push(p[2]);
    }
  }
  const mid = (arr) => { arr.sort((a, b) => a - b); return arr[Math.floor(arr.length / 2)] ?? 0; };
  const rgb = [mid(rs), mid(gs), mid(bs)];
  return {
    rgb,
    hex: `#${rgb.map((v) => v.toString(16).padStart(2, "0")).join("")}`,
    innerEdge: Number(inner.toFixed(3)),
  };
}

export async function extractAppIcon(source = ICON_SOURCE) {
  const img = await rawRGBA(source);
  const meta = await sharp(source).metadata();

  let box;
  let masked = false;
  if (meta.hasAlpha && hasCutCorners(img)) {
    box = alphaBox(img);
  } else {
    if (looksLikeCheckerboard(img)) {
      throw new Error(
        `${source} has a transparency checkerboard painted into the pixels. Re-export it with a real alpha channel.`,
      );
    }
    box = discFromBackground(img);
    masked = true;
  }

  const background = ringInteriorColour(img, box);
  const crop = squareCrop(box, img.W, img.H);

  let circle = sharp(source).extract(crop).ensureAlpha();
  if (masked) {
    // Cut the disc out with an antialiased circular mask, sized to the
    // measured edge, so none of the old flat background survives as a halo.
    const d = crop.width;
    const mask = Buffer.from(
      `<svg width="${d}" height="${d}"><circle cx="${d / 2}" cy="${d / 2}" r="${Math.max(box.width, box.height) / 2}" fill="#fff"/></svg>`,
    );
    circle = circle.composite([{ input: mask, blend: "dest-in" }]);
  }

  return {
    size: crop.width,
    diameter: Math.max(box.width, box.height),
    circle: await circle.png().toBuffer(),
    background,
    masked,
    metrics: {
      canvas: { width: img.W, height: img.H },
      disc: { left: box.left, top: box.top, width: box.width, height: box.height },
      centre: { x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2 },
      canvasCentre: { x: (img.W - 1) / 2, y: (img.H - 1) / 2 },
      crop,
    },
  };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split(/[\\/]/).pop())) {
  const out = await extractAppIcon();
  console.log(`${ICON_SOURCE}`);
  console.log(`  disc ${out.metrics.disc.width}x${out.metrics.disc.height} at`,
    `${out.metrics.disc.left},${out.metrics.disc.top}`);
  console.log(`  centre ${out.metrics.centre.x},${out.metrics.centre.y} vs canvas centre`,
    `${out.metrics.canvasCentre.x},${out.metrics.canvasCentre.y}`);
  console.log(`  master crop ${JSON.stringify(out.metrics.crop)}`);
  console.log(`  ring interior ${out.background.hex} rgb(${out.background.rgb})`,
    `at r=${out.background.innerEdge}`);
  console.log(`  circular mask applied: ${out.masked}`);
}
