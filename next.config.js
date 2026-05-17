// Security + performance configuration. The output: "standalone" line lets
// the production Dockerfile copy a minimal server bundle.

/** @type {import('next').NextConfig} */
const securityHeaders = [
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
