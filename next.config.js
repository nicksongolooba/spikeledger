// Security + performance configuration. The output: "standalone" line lets
// the production Dockerfile copy a minimal server bundle.

/** @type {import('next').NextConfig} */
const securityHeaders = [
  // Force HTTPS for two years after first visit (incl. subdomains) so typed
  // http:// URLs never make an insecure hop before the redirect.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // Auto-upgrade any http:// subresource to https — mixed content can never
  // render even if an insecure URL slips into content later.
  { key: "Content-Security-Policy", value: "upgrade-insecure-requests" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "origin-when-cross-origin" },
  { key: "X-XSS-Protection", value: "1; mode=block" },
  // The share/[id] route renders user content — keep the connect-src tight.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  // IMAGE OPTIMIZATION IS OFF (since 2026-09-15) to stay inside Vercel's free
  // Hobby allowance. On Hobby, every size and format Next.js generates for an
  // image counts as an "image transformation" (5,000 a month included, used
  // on each cache miss). Past the limit, new images fail with a 402 and
  // visitors see the alt text instead of the photo.
  //
  // What this means now: <Image> serves each committed file as-is, with no
  // per-screen resizing, no WebP and no srcset. Lazy loading and blur
  // placeholders still work. The photos in src/assets/photos are pre-sized
  // by scripts/optimize-photos.mjs, so pages stay reasonable, but phones
  // download the same files as laptops (the landing hero is about 400 KB).
  //
  // TO RE-ENABLE: delete the `images` line below (or set unoptimized: false),
  // commit and redeploy. Nothing else changes: every image already uses
  // next/image with a `sizes` prop, so responsive WebP comes back on its own.
  // Worth doing once real traffic makes page speed matter more than the free
  // tier limit, or when the project moves to Vercel Pro.
  images: { unoptimized: true },
  // Fixed into the bundle at build time. src/lib/prisma.ts lets only a server
  // built on Vercel use the production database, so a local `next dev` or a
  // local `next build && next start` refuses it. Vercel sets VERCEL=1 during
  // its builds; scripts/neon-migrate.mjs fails the build first if it doesn't.
  env: { BUILT_ON_VERCEL: process.env.VERCEL === "1" ? "1" : "" },
  // Keep these as native Node `require()` calls — don't let webpack bundle
  // them. Bundling `ws` strips its optional native-addon fallback (bufferutil)
  // and the WebSocket Sender.frame() then crashes mid-handshake. Neon's
  // adapter sits on top of `ws`, so all three need to be external.
  experimental: {
    serverComponentsExternalPackages: [
      "@prisma/client",
      "@prisma/adapter-neon",
      "@neondatabase/serverless",
      "ws",
      "bufferutil",
      "utf-8-validate",
    ],
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

module.exports = nextConfig;
