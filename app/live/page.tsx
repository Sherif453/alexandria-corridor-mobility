import { PageShell } from "@/components/page-shell";
import { LiveCorridor } from "@/components/traffic/live-corridor";

export default function LivePage() {
  return (
    <PageShell>
      <LiveCorridor />
    </PageShell>
  );
}
