import { PageShell } from "@/components/page-shell";
import { TrafficOverview } from "@/components/traffic/traffic-overview";

export default function HomePage() {
  return (
    <PageShell>
      <TrafficOverview />
    </PageShell>
  );
}
