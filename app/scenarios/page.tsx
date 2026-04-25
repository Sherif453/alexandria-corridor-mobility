import type { Metadata } from "next";

import { PageShell } from "@/components/page-shell";
import { ScenarioComparison } from "@/components/scenarios/scenario-comparison";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Scenarios",
  description:
    "Compare baseline traffic with realistic disruption and mitigation scenarios for the Alexandria corridor, including lane reduction, event surge, and curbside bottleneck cases.",
  path: "/scenarios",
  keywords: ["traffic scenarios", "scenario comparison", "transport planning"],
});

export default function ScenariosPage() {
  return (
    <PageShell>
      <ScenarioComparison />
    </PageShell>
  );
}
