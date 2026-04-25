import type { Metadata } from "next";

import { PageShell } from "@/components/page-shell";
import { LiveCorridor } from "@/components/traffic/live-corridor";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Live Corridor",
  description:
    "Open the live Alexandria corridor map to inspect current monitored areas, latest update times, speeds, and congestion labels from Victoria through Sidi Gaber to Raml.",
  path: "/live",
  keywords: ["live corridor map", "live traffic map", "Alexandria live traffic"],
});

export default function LivePage() {
  return (
    <PageShell>
      <LiveCorridor />
    </PageShell>
  );
}
