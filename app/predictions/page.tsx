import { PageShell } from "@/components/page-shell";
import { PredictionDashboard } from "@/components/predictions/prediction-dashboard";

export default function PredictionsPage() {
  return (
    <PageShell>
      <PredictionDashboard />
    </PageShell>
  );
}
