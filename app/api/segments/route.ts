import { apiError, apiOk } from "@/lib/api/response";
import { getSegmentsPayload } from "@/lib/services/segment-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
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
      "Unable to load corridor segment metadata.",
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
