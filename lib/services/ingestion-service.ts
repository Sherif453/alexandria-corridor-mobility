import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { CorridorSegmentDefinition } from "@/lib/corridor/definition";
import { CORRIDOR_SEGMENTS } from "@/lib/corridor/definition";
import { getEnv } from "@/lib/env";
import {
  createIngestionRun,
  finishIngestionRun,
  sumQuotaUsageSince,
  type IngestionRunStatus,
} from "@/lib/repositories/ingestion-run-repository";
import { createTrafficObservations } from "@/lib/repositories/traffic-observation-repository";
import { syncSegmentsFromDefinition } from "@/lib/services/segment-service";
import { fetchFlowSegment } from "@/lib/tomtom/flow-segment-client";

type RawIngestionRecord = {
  segmentId: string;
  requestedPoint: {
    latitude: number;
    longitude: number;
  };
  status: "success" | "error";
  trackingId: string | null;
  requestedAt: string;
  completedAt: string;
  response?: unknown;
  error?: string;
};

type IngestionSummary = {
  runId: string;
  status: IngestionRunStatus;
  quotaUsage: number;
  recordedObservations: number;
  failures: number;
  message: string;
};

function getLocalHour(date: Date, timeZone: string): number {
  const formatted = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hour12: false,
    timeZone,
  }).format(date);

  return Number(formatted);
}

function isWithinActiveWindow(date: Date): boolean {
  const env = getEnv();
  const localHour = getLocalHour(date, env.INGEST_TIMEZONE);

  if (env.INGEST_ACTIVE_END_HOUR_LOCAL === 24) {
    return localHour >= env.INGEST_ACTIVE_START_HOUR_LOCAL && localHour <= 23;
  }

  return (
    localHour >= env.INGEST_ACTIVE_START_HOUR_LOCAL &&
    localHour < env.INGEST_ACTIVE_END_HOUR_LOCAL
  );
}

function getCongestionLabel(speed: number | null, freeFlowSpeed: number | null) {
  if (!speed || !freeFlowSpeed || freeFlowSpeed <= 0) {
    return null;
  }

  const ratio = speed / freeFlowSpeed;

  if (ratio < 0.4) {
    return "High";
  }

  if (ratio <= 0.7) {
    return "Medium";
  }

  return "Low";
}

function getQualityStatus(confidence?: number, roadClosure?: boolean): string {
  if (roadClosure) {
    return "road_closure";
  }

  if (confidence === undefined) {
    return "unknown";
  }

  if (confidence < 0.5) {
    return "low_confidence";
  }

  if (confidence < 0.8) {
    return "moderate_confidence";
  }

  return "ok";
}

async function writeRawRunArtifact(runId: string, records: RawIngestionRecord[]) {
  const isoDate = new Date().toISOString().slice(0, 10);
  const targetDir = path.join(process.cwd(), "data", "raw", "tomtom", isoDate);

  await mkdir(targetDir, { recursive: true });
  await writeFile(
    path.join(targetDir, `${runId}.json`),
    JSON.stringify(
      {
        runId,
        capturedAt: new Date().toISOString(),
        records,
      },
      null,
      2,
    ),
    "utf8",
  );
}

async function fetchWithRetry(
  samplePoint: CorridorSegmentDefinition,
  runId: string,
): Promise<{
  requestCount: number;
  rawRecord: RawIngestionRecord;
  observation?: {
    segmentId: string;
    timestampUtc: Date;
    speed: number | null;
    freeFlowSpeed: number | null;
    congestionLabel: string | null;
    source: string;
    qualityStatus: string | null;
    ingestionRunId: string;
  };
}> {
  const env = getEnv();
  let attempt = 0;
  let lastError: Error | null = null;
  const requestedAt = new Date().toISOString();

  while (attempt <= env.INGEST_MAX_RETRIES) {
    attempt += 1;

    try {
      const result = await fetchFlowSegment({
        samplePoint,
        runId,
        attempt,
      });

      return {
        requestCount: attempt,
        rawRecord: {
          segmentId: samplePoint.segmentId,
          requestedPoint: {
            latitude: samplePoint.latitude,
            longitude: samplePoint.longitude,
          },
          status: "success",
          trackingId: result.trackingId,
          requestedAt,
          completedAt: new Date().toISOString(),
          response: result.payload,
        },
        observation: {
          segmentId: samplePoint.segmentId,
          timestampUtc: new Date(),
          speed: result.payload.currentSpeed ?? null,
          freeFlowSpeed: result.payload.freeFlowSpeed ?? null,
          congestionLabel: getCongestionLabel(
            result.payload.currentSpeed ?? null,
            result.payload.freeFlowSpeed ?? null,
          ),
          source: "tomtom.flow-segment-data.v4",
          qualityStatus: getQualityStatus(
            result.payload.confidence,
            result.payload.roadClosure,
          ),
          ingestionRunId: runId,
        },
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unknown ingestion error.");
      const retryable =
        typeof error === "object" &&
        error !== null &&
        "retryable" in error &&
        Boolean(error.retryable);

      if (!retryable || attempt > env.INGEST_MAX_RETRIES) {
        break;
      }

      await new Promise((resolve) =>
        setTimeout(resolve, 250 * 2 ** (attempt - 1)),
      );
    }
  }

  return {
    requestCount: Math.max(1, attempt),
    rawRecord: {
      segmentId: samplePoint.segmentId,
      requestedPoint: {
        latitude: samplePoint.latitude,
        longitude: samplePoint.longitude,
      },
      status: "error",
      trackingId: null,
      requestedAt,
      completedAt: new Date().toISOString(),
      error: lastError?.message ?? "Unknown ingestion error.",
    },
  };
}

export async function runTrafficIngestion(): Promise<IngestionSummary> {
  const env = getEnv();
  const runId = crypto.randomUUID();

  await syncSegmentsFromDefinition();
  await createIngestionRun(runId);

  if (!env.TOMTOM_API_KEY) {
    await finishIngestionRun(
      runId,
      "blocked_missing_api_key",
      0,
      "TOMTOM_API_KEY is not configured.",
    );

    return {
      runId,
      status: "blocked_missing_api_key",
      quotaUsage: 0,
      recordedObservations: 0,
      failures: 0,
      message: "TOMTOM_API_KEY is missing. Configure it in .env to start ingestion.",
    };
  }

  if (!isWithinActiveWindow(new Date())) {
    await finishIngestionRun(
      runId,
      "skipped_outside_active_window",
      0,
      "Current local time is outside the ingestion window.",
    );

    return {
      runId,
      status: "skipped_outside_active_window",
      quotaUsage: 0,
      recordedObservations: 0,
      failures: 0,
      message: "Skipped because the current local time is outside the ingestion window.",
    };
  }

  const quotaUsageLast24Hours = await sumQuotaUsageSince(
    new Date(Date.now() - 24 * 60 * 60 * 1000),
  );

  if (quotaUsageLast24Hours + CORRIDOR_SEGMENTS.length > env.INGEST_DAILY_REQUEST_CAP) {
    await finishIngestionRun(
      runId,
      "quota_stopped",
      0,
      "The stop-before-cap quota guard blocked this run.",
    );

    return {
      runId,
      status: "quota_stopped",
      quotaUsage: 0,
      recordedObservations: 0,
      failures: 0,
      message: "Skipped because the stop-before-cap quota guard would be exceeded.",
    };
  }

  const rawRecords: RawIngestionRecord[] = [];
  const observations: Parameters<typeof createTrafficObservations>[0] = [];
  let requestCount = 0;
  let failureCount = 0;

  for (const samplePoint of CORRIDOR_SEGMENTS) {
    const result = await fetchWithRetry(samplePoint, runId);
    requestCount += result.requestCount;
    rawRecords.push(result.rawRecord);

    if (result.observation) {
      observations.push(result.observation);
    } else {
      failureCount += 1;
    }
  }

  await createTrafficObservations(observations);
  await writeRawRunArtifact(runId, rawRecords);

  const status: IngestionRunStatus =
    failureCount === 0 ? "success" : observations.length > 0 ? "partial_success" : "failed";
  const message =
    status === "success"
      ? `Recorded ${observations.length} observations.`
      : status === "partial_success"
        ? `Recorded ${observations.length} observations with ${failureCount} failures.`
        : "The ingestion run failed and no observations were recorded.";

  await finishIngestionRun(
    runId,
    status,
    requestCount,
    failureCount > 0 ? `${failureCount} sample points failed.` : undefined,
  );

  return {
    runId,
    status,
    quotaUsage: requestCount,
    recordedObservations: observations.length,
    failures: failureCount,
    message,
  };
}
