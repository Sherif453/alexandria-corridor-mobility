import type { Metadata } from "next";

import { PageShell } from "@/components/page-shell";
import { HistoryAnalytics } from "@/components/traffic/history-analytics";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "History",
  description:
    "Review corridor traffic history, speed trends, congestion patterns, and time-period summaries for the Alexandria route over recent hours and days.",
  path: "/history",
  keywords: ["traffic history", "corridor trends", "Alexandria traffic analytics"],
});

export default function HistoryPage() {
  return (
    <PageShell>
      <HistoryAnalytics />
    </PageShell>
  );
}
