import { ZodError } from "zod";

import { proxyApiRequest } from "@/lib/api/proxy";
import { apiError, apiOk } from "@/lib/api/response";
import { getScenarioDetailPayload } from "@/lib/services/scenario-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const proxiedResponse = await proxyApiRequest(_request);

    if (proxiedResponse) {
      return proxiedResponse;
    }

    const { id } = await context.params;
    const payload = await getScenarioDetailPayload(id);

    return apiOk(payload, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return apiError(400, "INVALID_SCENARIO_ID", "Invalid scenario id.", {
        headers: {
          "Cache-Control": "no-store",
        },
      });
    }

    if (error instanceof Error && error.message === "UNKNOWN_SCENARIO") {
      return apiError(404, "UNKNOWN_SCENARIO", "Scenario not found.", {
        headers: {
          "Cache-Control": "no-store",
        },
      });
    }

    return apiError(500, "SCENARIO_READ_FAILED", "Unable to load scenario.", {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  }
}
