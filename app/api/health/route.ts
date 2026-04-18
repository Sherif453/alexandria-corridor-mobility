import { apiError, apiOk } from "@/lib/api/response";
import { proxyApiRequest } from "@/lib/api/proxy";
import { getHealthPayload } from "@/lib/services/health-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const proxiedResponse = await proxyApiRequest(request);

    if (proxiedResponse) {
      return proxiedResponse;
    }

    const payload = await getHealthPayload();

    return apiOk(payload, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return apiError(503, "SERVICE_UNAVAILABLE", "Health check is unavailable.", {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  }
}
