import { ZodError } from "zod";

import { apiError, apiOk } from "@/lib/api/response";
import {
  getTrafficHistoryPayload,
  parseTrafficHistoryQuery,
} from "@/lib/services/traffic-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = parseTrafficHistoryQuery(url.searchParams);
    const payload = await getTrafficHistoryPayload(query);

    return apiOk(payload, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return apiError(400, "INVALID_TRAFFIC_HISTORY_QUERY", "Invalid traffic history query.", {
        headers: {
          "Cache-Control": "no-store",
        },
      });
    }

    if (error instanceof Error && error.message === "UNKNOWN_SEGMENT") {
      return apiError(404, "UNKNOWN_SEGMENT", "The requested segment is not in the corridor.", {
        headers: {
          "Cache-Control": "no-store",
        },
      });
    }

    return apiError(
      500,
      "TRAFFIC_HISTORY_READ_FAILED",
      "Unable to load historical traffic observations.",
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
