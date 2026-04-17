import { apiError, apiOk } from "@/lib/api/response";
import { getScenarioListPayload } from "@/lib/services/scenario-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const payload = await getScenarioListPayload();

    return apiOk(payload, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return apiError(500, "SCENARIOS_READ_FAILED", "Unable to load scenarios.", {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  }
}
