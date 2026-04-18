import { apiError, apiOk } from "@/lib/api/response";
import { proxyApiRequest } from "@/lib/api/proxy";
import { getLatestPredictionsPayload } from "@/lib/services/prediction-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const proxiedResponse = await proxyApiRequest(request);

    if (proxiedResponse) {
      return proxiedResponse;
    }

    const payload = await getLatestPredictionsPayload();

    return apiOk(payload, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return apiError(
      500,
      "LATEST_PREDICTIONS_READ_FAILED",
      "Unable to load next-15-minute results.",
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
