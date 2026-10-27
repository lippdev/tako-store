import type { MetadataRoute } from "next";

const BASE = process.env["NEXT_PUBLIC_SITE_URL"] ?? "http://localhost:5174";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/ir"] }],
    sitemap: `${BASE}/sitemap.xml`,
  };
}
