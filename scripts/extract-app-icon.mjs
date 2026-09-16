// Loads the app icon artwork and derives the two shapes every platform icon
// is built from.
//
// Source: "spikeledger app icon.png" at the repo root, the designer's export
// of the circular mark on a transparent background.
//
//   circle    the disc, trimmed to its own edges, transparency kept. This is
//             the icon anywhere transparency works: browser tabs, the Windows
//             taskbar and Start menu, installed app windows.
//   contents  the largest square that fits inside the disc, so it is opaque
//             edge to edge. Used where transparency is not allowed (iOS
//             renders it black) or gets masked away (Android adaptive icons).
//             Filling the tile with the contents is what stops the icon
//             reading as a circle inside a square next to other apps.

import sharp from "sharp";

export const ICON_SOURCE = process.env.ICON_SOURCE ?? "spikeledger app icon.png";

// Tight bounding box of everything that is not transparent padding.
async function artworkBox(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
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
  if (right < 0) throw new Error(`${file} is fully transparent`);
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

// Square box centred on the artwork, clamped to the image.
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

// Largest square that fits inside a circle of the given diameter.
function inscribedSquare(box) {
  const side = Math.floor(box.width * 0.707);
  const off = Math.round((box.width - side) / 2);
  return { left: box.left + off, top: box.top + off, width: side, height: side };
}

export async function extractAppIcon(source = ICON_SOURCE) {
  const meta = await sharp(source).metadata();
  if (!meta.hasAlpha) {
    throw new Error(`${source} has no transparency; expected the circular mark on a transparent background`);
  }
  const box = squareAround(await artworkBox(source), meta.width, meta.height);
  const contentsBox = inscribedSquare(box);
  return {
    size: box.width,
    circle: await sharp(source).extract(box).png().toBuffer(),
    contents: await sharp(source).extract(contentsBox).removeAlpha().png().toBuffer(),
    boxes: { circle: box, contents: contentsBox },
  };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split(/[\\/]/).pop())) {
  const out = await extractAppIcon();
  console.log(`${ICON_SOURCE}: disc ${out.size}x${out.size}`, JSON.stringify(out.boxes));
  const dir = process.env.OUT_DIR ?? ".";
  for (const [name, buf] of [["circle", out.circle], ["contents", out.contents]]) {
    await sharp(buf).toFile(`${dir}/app-icon-${name}.png`);
    console.log(`${dir}/app-icon-${name}.png`);
  }
}
