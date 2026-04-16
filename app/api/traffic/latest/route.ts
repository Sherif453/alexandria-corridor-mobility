import { apiError, apiOk } from "@/lib/api/response";
import { getLatestTrafficPayload } from "@/lib/services/traffic-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const payload = await getLatestTrafficPayload();

    return apiOk(payload, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return apiError(500, "LATEST_TRAFFIC_READ_FAILED", "Unable to load latest traffic state.", {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  }
}
