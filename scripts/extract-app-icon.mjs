// Pulls the app icon artwork out of the designer's presentation sheet
// ("spikeledger current.png" at the repo root): the big rounded-square icon
// and the circular Android version. Everything platform icons need is
// derived from these, never from each other.
//
// The sheet is a mockup page (title, size previews, palette, phone mock), so
// the icon is found by geometry: the largest connected blob of the icon's
// purple, which is the 1024 preview. Its rounded corners are then filled out
// to a full square with the icon's own edge colour, because iOS, Windows and
// Android all apply their own shape and a pre-rounded icon leaves white
// notches.

import sharp from "sharp";

export const ICON_SHEET = process.env.ICON_SHEET ?? "spikeledger current.png";

// Icon purple: blue clearly dominant, red above green. Excludes the sheet's
// navy/blue wordmark, the cyan subtitles and the green chart bars.
function isIconPurple(r, g, b) {
  return b > 90 && b > r + 25 && r > g + 5;
}
// Sheet background, page shadows and paper grey: bright and unsaturated.
function isPaper(r, g, b) {
  return Math.min(r, g, b) > 170 && Math.max(r, g, b) - Math.min(r, g, b) < 22;
}

// Every blob of icon-purple, largest first.
function purpleBlobs(data, W, H, C) {
  const seen = new Uint8Array(W * H);
  const blobs = [];
  for (let start = 0; start < W * H; start += 1) {
    if (seen[start]) continue;
    const o = start * C;
    if (!isIconPurple(data[o], data[o + 1], data[o + 2])) {
      seen[start] = 1;
      continue;
    }
    let minx = W, miny = H, maxx = -1, maxy = -1, count = 0;
    const stack = [start];
    seen[start] = 1;
    while (stack.length) {
      const i = stack.pop();
      const x = i % W;
      const y = (i - x) / W;
      count += 1;
      if (x < minx) minx = x;
      if (x > maxx) maxx = x;
      if (y < miny) miny = y;
      if (y > maxy) maxy = y;
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]) {
        if (j < 0 || seen[j]) continue;
        const p = j * C;
        seen[j] = 1;
        if (isIconPurple(data[p], data[p + 1], data[p + 2])) stack.push(j);
      }
    }
    blobs.push({ count, left: minx, top: miny, width: maxx - minx + 1, height: maxy - miny + 1 });
  }
  return blobs.sort((a, b) => b.count - a.count);
}

// Square box centred on a blob, clamped to the sheet.
function squareAround(box, W, H) {
  const side = Math.min(Math.max(box.width, box.height), W, H);
  const cx = box.left + box.width / 2;
  const cy = box.top + box.height / 2;
  return {
    left: Math.max(0, Math.min(W - side, Math.round(cx - side / 2))),
    top: Math.max(0, Math.min(H - side, Math.round(cy - side / 2))),
    width: side,
    height: side,
  };
}

// Paper reachable from the edges of the crop = outside the artwork (the
// rounded corners, and the sheet's drop shadow). Returns a mask.
function outsideMask(rgb, w, h) {
  const out = new Uint8Array(w * h);
  const stack = [];
  const push = (x, y) => {
    const i = y * w + x;
    if (out[i]) return;
    const o = i * 3;
    if (!isPaper(rgb[o], rgb[o + 1], rgb[o + 2])) return;
    out[i] = 1;
    stack.push(i);
  };
  for (let x = 0; x < w; x += 1) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y += 1) { push(0, y); push(w - 1, y); }
  while (stack.length) {
    const i = stack.pop();
    const x = i % w;
    const y = (i - x) / w;
    if (x > 0) push(x - 1, y);
    if (x < w - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < h - 1) push(x, y + 1);
  }
  return out;
}

// A full-bleed square: crop just inside the rounded corners so the icon's own
// gradient reaches all four corners. No white notches and no smeared fill,
// and nothing important is lost because every platform masks its own shape
// back on. This is the smallest inset where all four corners are artwork,
// plus a hair to clear the outer glow.
function squareInset(rgb, outside, w, h) {
  const artwork = (x, y) => !outside[y * w + x];
  const paperAt = (x, y) => {
    const o = (y * w + x) * 3;
    return isPaper(rgb[o], rgb[o + 1], rgb[o + 2]);
  };
  // Grow the inset until all four corners are artwork AND the two outermost
  // rings hold no paper or glow pixels.
  const limit = Math.floor(w * 0.2);
  for (let d = 0; d < limit; d += 1) {
    if (!(artwork(d, d) && artwork(w - 1 - d, d) && artwork(d, h - 1 - d) && artwork(w - 1 - d, h - 1 - d))) continue;
    let clean = true;
    for (let ring = 0; ring < 2 && clean; ring += 1) {
      const lo = d + ring;
      const hiX = w - 1 - lo;
      const hiY = h - 1 - lo;
      for (let x = lo; x <= hiX && clean; x += 1) if (paperAt(x, lo) || paperAt(x, hiY)) clean = false;
      for (let y = lo; y <= hiY && clean; y += 1) if (paperAt(lo, y) || paperAt(hiX, y)) clean = false;
    }
    if (clean) return d;
  }
  throw new Error("could not find a full-bleed square inside the icon artwork");
}

// Same crop, but the outside becomes transparent: the icon keeps the
// designer's rounded corners, for use on our own surfaces (splash screens).
function cutout(rgb, w, h) {
  const outside = outsideMask(rgb, w, h);
  const out = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i += 1) {
    out[i * 4] = rgb[i * 3];
    out[i * 4 + 1] = rgb[i * 3 + 1];
    out[i * 4 + 2] = rgb[i * 3 + 2];
    out[i * 4 + 3] = outside[i] ? 0 : 255;
  }
  return out;
}

// Largest square that fits inside a circle of this bounding box.
function inscribedSquare(box) {
  const side = Math.floor(box.width * 0.707);
  const off = Math.round((box.width - side) / 2);
  return { left: box.left + off, top: box.top + off, width: side, height: side };
}

export async function extractAppIcon(sheet = ICON_SHEET) {
  const { data, info } = await sharp(sheet).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const blobs = purpleBlobs(data, info.width, info.height, info.channels);
  if (blobs.length < 2) throw new Error(`no icon artwork found in ${sheet}`);
  const [big, circle] = blobs;

  const squareBox = squareAround(big, info.width, info.height);
  const squareRgb = await sharp(sheet).removeAlpha().extract(squareBox).raw().toBuffer();
  const side = squareBox.width;
  const inset = squareInset(squareRgb, outsideMask(squareRgb, side, side), side, side);
  const bleedBox = {
    left: squareBox.left + inset,
    top: squareBox.top + inset,
    width: side - inset * 2,
    height: side - inset * 2,
  };

  const circleBox = squareAround(circle, info.width, info.height);
  const circleRgb = await sharp(sheet).removeAlpha().extract(circleBox).raw().toBuffer();

  const raw = (buf, w, channels) => ({ raw: { width: w, height: w, channels } });
  return {
    size: bleedBox.width,
    // Full-bleed square, no transparency: the shape platforms mask themselves.
    square: await sharp(sheet).removeAlpha().extract(bleedBox).png().toBuffer(),
    // Designer's rounded square on transparency, for our own surfaces.
    rounded: await sharp(cutout(squareRgb, side, side), raw(null, side, 4)).png().toBuffer(),
    // Circular version on transparency. This is the icon itself on any
    // surface that allows transparency: browser tabs, the Windows taskbar,
    // installed app windows.
    circle: await sharp(cutout(circleRgb, circleBox.width, circleBox.width), raw(null, circleBox.width, 4)).png().toBuffer(),
    // What the circle contains: the largest square that fits inside the disc,
    // so it is opaque to the edges. Used where transparency is not allowed
    // (iOS home screens) or gets masked away (Android adaptive icons), which
    // is what stops the icon reading as a circle inside a square.
    contents: await sharp(sheet)
      .removeAlpha()
      .extract(inscribedSquare(circleBox))
      .png()
      .toBuffer(),
    boxes: { artwork: squareBox, square: bleedBox, circle: circleBox, contents: inscribedSquare(circleBox) },
  };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split(/[\\/]/).pop())) {
  const out = await extractAppIcon();
  console.log(JSON.stringify(out.boxes), "native side:", out.size);
  const dir = process.env.OUT_DIR ?? ".";
  for (const [name, buf] of [["square", out.square], ["rounded", out.rounded], ["circle", out.circle], ["contents", out.contents]]) {
    await sharp(buf).toFile(`${dir}/app-icon-${name}.png`);
    console.log(`${dir}/app-icon-${name}.png`);
  }
}
