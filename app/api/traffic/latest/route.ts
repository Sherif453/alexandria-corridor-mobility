import { apiError, apiOk } from "@/lib/api/response";
import { proxyApiRequest } from "@/lib/api/proxy";
import { getLatestTrafficPayload } from "@/lib/services/traffic-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const proxiedResponse = await proxyApiRequest(request);

    if (proxiedResponse) {
      return proxiedResponse;
    }

    const payload = await getLatestTrafficPayload();

    return apiOk(payload, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return apiError(500, "LATEST_TRAFFIC_READ_FAILED", "Unable to load latest traffic conditions.", {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  }
}
