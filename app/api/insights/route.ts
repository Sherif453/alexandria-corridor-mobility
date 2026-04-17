import { apiError, apiOk } from "@/lib/api/response";
import { getInsightsPayload } from "@/lib/services/insights-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const payload = await getInsightsPayload();

    return apiOk(payload, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return apiError(500, "INSIGHTS_READ_FAILED", "Unable to load guidance.", {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  }
}
