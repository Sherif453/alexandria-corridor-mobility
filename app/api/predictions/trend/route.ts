import { apiError, apiOk } from "@/lib/api/response";
import { proxyApiRequest } from "@/lib/api/proxy";
import { getPredictionTrendPayload } from "@/lib/services/prediction-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const proxiedResponse = await proxyApiRequest(request);

    if (proxiedResponse) {
      return proxiedResponse;
    }

    const payload = await getPredictionTrendPayload();

    return apiOk(payload, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return apiError(
      500,
      "PREDICTION_TREND_READ_FAILED",
      "Unable to load upcoming traffic changes.",
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
