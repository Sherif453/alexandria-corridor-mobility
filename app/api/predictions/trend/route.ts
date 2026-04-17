import { apiError, apiOk } from "@/lib/api/response";
import { getPredictionTrendPayload } from "@/lib/services/prediction-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
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
      "Unable to load prediction trend.",
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
