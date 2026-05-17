import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

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
          "/share/", // private per-report URLs — don't index
        ],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
  };
}
