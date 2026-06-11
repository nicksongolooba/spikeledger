import type { MetadataRoute } from "next";

// Public-facing URLs must always be https - fall back to the production
// domain, never localhost, so a missing env var can't emit http:// links.
const BASE = process.env.NEXT_PUBLIC_APP_URL || "https://www.spikeledger.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login", "/register"],
        disallow: [
          "/dashboard/",
          "/team/",
          "/match/",
          "/reports/",
          "/settings/",
          "/api/",
          "/share/", // private per-report URLs - don't index
        ],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
  };
}
