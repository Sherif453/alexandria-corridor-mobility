import type { Metadata } from "next";

import { PageShell } from "@/components/page-shell";
import { TrafficOverview } from "@/components/traffic/traffic-overview";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Overview",
  description:
    "See the latest traffic status, corridor freshness, speed summary, and congestion snapshot for the Victoria to Sidi Gaber to Raml route in Alexandria.",
  path: "/",
  keywords: ["traffic overview", "live traffic dashboard", "Alexandria corridor overview"],
});

export default function HomePage() {
  return (
    <PageShell>
      <TrafficOverview />
    </PageShell>
  );
}
