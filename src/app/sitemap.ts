import type { MetadataRoute } from "next";
import { publicAppUrlFromEnv } from "@/lib/app-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const host = publicAppUrlFromEnv() ?? "http://localhost:3001";

  return [
    {
      url: host,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${host}/login`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
