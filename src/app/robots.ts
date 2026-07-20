import type { MetadataRoute } from "next";
import { publicAppUrlFromEnv } from "@/lib/app-url";

export default function robots(): MetadataRoute.Robots {
  const host = publicAppUrlFromEnv() ?? "http://localhost:3001";

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/"],
        disallow: ["/dashboard", "/dashboard/", "/g/", "/api/"],
      },
    ],
    sitemap: `${host}/sitemap.xml`,
  };
}
