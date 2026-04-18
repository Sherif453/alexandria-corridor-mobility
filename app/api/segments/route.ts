import { apiError, apiOk } from "@/lib/api/response";
import { proxyApiRequest } from "@/lib/api/proxy";
import { getSegmentsPayload } from "@/lib/services/segment-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const proxiedResponse = await proxyApiRequest(request);

    if (proxiedResponse) {
      return proxiedResponse;
    }

    const payload = await getSegmentsPayload();

    return apiOk(payload, {
      headers: {
        "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
      },
    });
  } catch {
    return apiError(
      500,
      "SEGMENT_READ_FAILED",
      "Unable to load corridor areas.",
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
