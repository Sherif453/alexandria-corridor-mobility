import { z } from "zod";

import type { CorridorSegmentDefinition } from "@/lib/corridor/definition";
import { getEnv } from "@/lib/env";

const flowCoordinateSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
});

const flowResponseSchema = z.object({
  flowSegmentData: z.object({
    frc: z.string(),
    currentSpeed: z.number(),
    freeFlowSpeed: z.number(),
    currentTravelTime: z.number(),
    freeFlowTravelTime: z.number(),
    confidence: z.number().optional(),
    roadClosure: z.boolean().optional(),
    openlr: z.string().optional(),
    coordinates: z
      .object({
        coordinate: z.union([
          z.array(flowCoordinateSchema),
          flowCoordinateSchema.transform((value) => [value]),
        ]),
      })
      .optional(),
  }),
});

const flowErrorSchema = z.object({
  error: z.string(),
  httpStatusCode: z.number().optional(),
  detailedError: z
    .object({
      code: z.string(),
      message: z.string(),
    })
    .optional(),
});

export type TomTomFlowSegmentData = z.infer<typeof flowResponseSchema>["flowSegmentData"];

type FetchFlowSegmentParams = {
  samplePoint: CorridorSegmentDefinition;
  runId: string;
  attempt: number;
};

type FetchFlowSegmentResult = {
  payload: TomTomFlowSegmentData;
  trackingId: string | null;
};

function buildTrackingId(runId: string, segmentId: string, attempt: number): string {
  return `${runId}-${segmentId}-${attempt}`;
}

function buildRequestUrl(samplePoint: CorridorSegmentDefinition): URL {
  const env = getEnv();
  const url = new URL(
    `/traffic/services/${env.TOMTOM_FLOW_VERSION}/flowSegmentData/${env.TOMTOM_FLOW_STYLE}/${env.TOMTOM_FLOW_ZOOM}/json`,
    env.TOMTOM_BASE_URL,
  );

  url.searchParams.set("key", env.TOMTOM_API_KEY ?? "");
  url.searchParams.set(
    "point",
    `${samplePoint.latitude.toFixed(6)},${samplePoint.longitude.toFixed(6)}`,
  );
  url.searchParams.set("unit", env.TOMTOM_FLOW_UNIT);
  url.searchParams.set("openLr", "true");

  return url;
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 500 || status === 503;
}

export async function fetchFlowSegment(
  params: FetchFlowSegmentParams,
): Promise<FetchFlowSegmentResult> {
  const env = getEnv();
  const trackingId = buildTrackingId(
    params.runId,
    params.samplePoint.segmentId,
    params.attempt,
  );

  const response = await fetch(buildRequestUrl(params.samplePoint), {
    method: "GET",
    signal: AbortSignal.timeout(env.INGEST_REQUEST_TIMEOUT_MS),
    headers: {
      "Accept-Encoding": "gzip",
      "Tracking-ID": trackingId,
    },
  });

  const body = await response.json();

  if (!response.ok) {
    const parsedError = flowErrorSchema.safeParse(body);
    const errorMessage = parsedError.success
      ? parsedError.data.detailedError?.message ?? parsedError.data.error
      : `TomTom request failed with status ${response.status}.`;
    const error = new Error(errorMessage);

    Object.assign(error, {
      status: response.status,
      retryable: isRetryableStatus(response.status),
    });

    throw error;
  }

  const parsed = flowResponseSchema.parse(body);

  return {
    payload: parsed.flowSegmentData,
    trackingId: response.headers.get("Tracking-ID"),
  };
}
