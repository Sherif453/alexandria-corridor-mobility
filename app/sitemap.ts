import type { MetadataRoute } from "next";

import { getSiteUrl } from "@/lib/seo";

const routes = [
  { path: "/", priority: 1 },
  { path: "/live", priority: 0.9 },
  { path: "/predictions", priority: 0.9 },
  { path: "/history", priority: 0.8 },
  { path: "/scenarios", priority: 0.8 },
  { path: "/insights", priority: 0.7 },
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  const lastModified = new Date();

  return routes.map((route) => ({
    url: new URL(route.path, siteUrl).toString(),
    lastModified,
    changeFrequency: "hourly",
    priority: route.priority,
  }));
}
