import { ZodError } from "zod";

import {
  isBackendAdminRefreshProxyEnabled,
  isBackendProxyConfigured,
  proxyApiRequest,
} from "@/lib/api/proxy";
import { apiError, apiOk } from "@/lib/api/response";
import {
  parseRefreshAction,
  runAdminRefresh,
} from "@/lib/services/admin-refresh-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    if (isBackendProxyConfigured()) {
      if (!isBackendAdminRefreshProxyEnabled()) {
        return apiError(403, "ADMIN_REFRESH_DISABLED", "Manual refresh is disabled.", {
          headers: {
            "Cache-Control": "no-store",
          },
        });
      }

      const proxiedResponse = await proxyApiRequest(request);

      if (proxiedResponse) {
        return proxiedResponse;
      }
    }

    const body = (await request.json().catch(() => ({}))) as { action?: unknown };
    const action = parseRefreshAction(body.action);
    const payload = await runAdminRefresh(action);

    return apiOk(payload, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return apiError(400, "INVALID_REFRESH_ACTION", "Invalid refresh action.", {
        headers: {
          "Cache-Control": "no-store",
        },
      });
    }

    if (error instanceof Error && error.message === "ADMIN_REFRESH_DISABLED") {
      return apiError(403, "ADMIN_REFRESH_DISABLED", "Manual refresh is disabled.", {
        headers: {
          "Cache-Control": "no-store",
        },
      });
    }

    if (error instanceof Error && error.message === "ADMIN_REFRESH_ALREADY_RUNNING") {
      return apiError(409, "ADMIN_REFRESH_ALREADY_RUNNING", "A refresh is already running.", {
        headers: {
          "Cache-Control": "no-store",
        },
      });
    }

    return apiError(500, "ADMIN_REFRESH_FAILED", "Manual refresh failed.", {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  }
}
