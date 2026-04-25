import type { Metadata } from "next";

import { PageShell } from "@/components/page-shell";
import { PredictionDashboard } from "@/components/predictions/prediction-dashboard";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Next 15 Minutes",
  description:
    "Check next-15-minute congestion predictions, confidence levels, and trend direction for each monitored Alexandria corridor area before making traffic decisions.",
  path: "/predictions",
  keywords: ["traffic prediction", "15-minute forecast", "congestion forecast"],
});

export default function PredictionsPage() {
  return (
    <PageShell>
      <PredictionDashboard />
    </PageShell>
  );
}
