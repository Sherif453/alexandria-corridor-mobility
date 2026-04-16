import { apiError, apiOk } from "@/lib/api/response";
import { getHealthPayload } from "@/lib/services/health-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
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
