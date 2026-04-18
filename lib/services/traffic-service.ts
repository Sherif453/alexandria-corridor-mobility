import { z } from "zod";

import {
  CORRIDOR_DEFINITION_VERSION,
  CORRIDOR_ID,
  CORRIDOR_NAME,
  CORRIDOR_SCOPE,
} from "@/lib/corridor/definition";
import { listSegments } from "@/lib/repositories/segment-repository";
import {
  getLatestTrafficObservations,
  listTrafficObservationsInRange,
} from "@/lib/repositories/traffic-observation-repository";
import { syncSegmentsFromDefinition } from "@/lib/services/segment-service";
import {
  getLiveWindowPayload,
  getWindowAwareFreshnessStatus,
} from "@/lib/time/live-window";

const historyQuerySchema = z.object({
  segmentId: z.string().min(1).optional(),
  hours: z.coerce.number().int().min(1).max(744).default(24),
  granularity: z.enum(["raw", "hour", "day"]).default("raw"),
});

type HistoryQuery = z.infer<typeof historyQuerySchema>;

type TrafficObservationRecord = Awaited<
  ReturnType<typeof listTrafficObservationsInRange>
>[number];

function toIsoString(date: Date | null | undefined): string | null {
  return date ? date.toISOString() : null;
}

function average(values: Array<number | null | undefined>): number | null {
  const usableValues = values.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );

  if (usableValues.length === 0) {
    return null;
  }

  return usableValues.reduce((sum, value) => sum + value, 0) / usableValues.length;
}

function getSpeedRatio(speed: number | null, freeFlowSpeed: number | null): number | null {
  if (speed === null || freeFlowSpeed === null || freeFlowSpeed <= 0) {
    return null;
  }

  return speed / freeFlowSpeed;
}

function getBucketStart(date: Date, granularity: "hour" | "day"): string {
  const bucket = new Date(date);

  if (granularity === "day") {
    bucket.setUTCHours(0, 0, 0, 0);
  } else {
    bucket.setUTCMinutes(0, 0, 0);
  }

  return bucket.toISOString();
}

function summarizeCongestionLabels(
  observations: Array<{ congestionLabel: string | null }>,
) {
  return observations.reduce<Record<string, number>>((counts, observation) => {
    const label = observation.congestionLabel ?? "Unknown";
    counts[label] = (counts[label] ?? 0) + 1;

    return counts;
  }, {});
}

function buildCorridorPayload(segmentCount: number) {
  return {
    id: CORRIDOR_ID,
    name: CORRIDOR_NAME,
    scope: CORRIDOR_SCOPE,
    definitionVersion: CORRIDOR_DEFINITION_VERSION,
    samplePointCount: segmentCount,
  };
}

function mapObservation(observation: TrafficObservationRecord) {
  return {
    id: observation.id,
    segmentId: observation.segmentId,
    timestampUtc: observation.timestampUtc.toISOString(),
    speed: observation.speed,
    freeFlowSpeed: observation.freeFlowSpeed,
    speedRatio: getSpeedRatio(observation.speed, observation.freeFlowSpeed),
    congestionLabel: observation.congestionLabel,
    source: observation.source,
    qualityStatus: observation.qualityStatus,
    ingestionRunId: observation.ingestionRunId,
  };
}

export async function getLatestTrafficPayload() {
  await syncSegmentsFromDefinition();

  const segments = await listSegments();
  const latestObservations = await getLatestTrafficObservations(
    segments.map((segment) => segment.segmentId),
  );
  const observationsBySegmentId = new Map(
    latestObservations
      .filter((observation): observation is NonNullable<typeof observation> =>
        Boolean(observation),
      )
      .map((observation) => [observation.segmentId, observation]),
  );
  const latestTimestampUtc =
    latestObservations.reduce<Date | null>((latest, observation) => {
      if (!observation) {
        return latest;
      }

      if (!latest || observation.timestampUtc > latest) {
        return observation.timestampUtc;
      }

      return latest;
    }, null);
  const observedSegments = latestObservations.filter(Boolean).length;
  const liveWindow = getLiveWindowPayload();

  return {
    corridor: buildCorridorPayload(segments.length),
    generatedAtUtc: new Date().toISOString(),
    liveWindow,
    freshness: {
      status: getWindowAwareFreshnessStatus({
        latestTimestampUtc,
        liveWindow,
        freshForMinutes: 30,
      }),
      latestTimestampUtc: toIsoString(latestTimestampUtc),
      observedSegments,
      missingSegments: segments.length - observedSegments,
    },
    summary: {
      averageSpeed: average(latestObservations.map((observation) => observation?.speed)),
      averageFreeFlowSpeed: average(
        latestObservations.map((observation) => observation?.freeFlowSpeed),
      ),
      averageSpeedRatio: average(
        latestObservations.map((observation) =>
          observation ? getSpeedRatio(observation.speed, observation.freeFlowSpeed) : null,
        ),
      ),
      congestionCounts: summarizeCongestionLabels(
        latestObservations.filter(
          (observation): observation is NonNullable<typeof observation> =>
            Boolean(observation),
        ),
      ),
    },
    segments: segments.map((segment) => {
      const observation = observationsBySegmentId.get(segment.segmentId);

      return {
        segmentId: segment.segmentId,
        roadName: segment.roadName,
        geometryRef: segment.geometryRef,
        roadType: segment.roadType,
        latitude: segment.latitude,
        longitude: segment.longitude,
        order: segment.sortOrder,
        observation: observation ? mapObservation(observation) : null,
      };
    }),
  };
}

export function parseTrafficHistoryQuery(searchParams: URLSearchParams): HistoryQuery {
  return historyQuerySchema.parse(Object.fromEntries(searchParams));
}

export async function getTrafficHistoryPayload(query: HistoryQuery) {
  await syncSegmentsFromDefinition();

  const segments = await listSegments();
  const activeSegmentIds = segments.map((segment) => segment.segmentId);
  const segmentIds = query.segmentId ? [query.segmentId] : activeSegmentIds;

  if (query.segmentId && !activeSegmentIds.includes(query.segmentId)) {
    throw new Error("UNKNOWN_SEGMENT");
  }

  const toUtc = new Date();
  const fromUtc = new Date(toUtc.getTime() - query.hours * 60 * 60 * 1000);
  const observations = await listTrafficObservationsInRange({
    segmentIds,
    fromUtc,
    toUtc,
  });

  const rawSeries = observations.map(mapObservation);
  let series:
    | typeof rawSeries
    | Array<{
        bucketStartUtc: string;
        segmentId: string;
        observationCount: number;
        averageSpeed: number | null;
        averageFreeFlowSpeed: number | null;
        averageSpeedRatio: number | null;
        congestionCounts: Record<string, number>;
      }>;

  if (query.granularity === "raw") {
    series = rawSeries;
  } else {
    const granularity = query.granularity;
    series = Array.from(
      observations
        .reduce<Map<string, TrafficObservationRecord[]>>((buckets, observation) => {
          const bucketKey = `${getBucketStart(
            observation.timestampUtc,
            granularity,
          )}|${observation.segmentId}`;
          const existing = buckets.get(bucketKey) ?? [];
          existing.push(observation);
          buckets.set(bucketKey, existing);

          return buckets;
        }, new Map())
        .entries(),
    )
      .map(([bucketKey, bucketObservations]) => {
        const [bucketStartUtc, segmentId] = bucketKey.split("|");

        return {
          bucketStartUtc,
          segmentId,
          observationCount: bucketObservations.length,
          averageSpeed: average(bucketObservations.map((observation) => observation.speed)),
          averageFreeFlowSpeed: average(
            bucketObservations.map((observation) => observation.freeFlowSpeed),
          ),
          averageSpeedRatio: average(
            bucketObservations.map((observation) =>
              getSpeedRatio(observation.speed, observation.freeFlowSpeed),
            ),
          ),
          congestionCounts: summarizeCongestionLabels(bucketObservations),
        };
      })
      .sort((a, b) =>
        a.bucketStartUtc === b.bucketStartUtc
          ? a.segmentId.localeCompare(b.segmentId)
          : a.bucketStartUtc.localeCompare(b.bucketStartUtc),
      );
  }

  return {
    corridor: buildCorridorPayload(segments.length),
    generatedAtUtc: new Date().toISOString(),
    liveWindow: getLiveWindowPayload(),
    query: {
      segmentId: query.segmentId ?? null,
      hours: query.hours,
      granularity: query.granularity,
    },
    range: {
      fromUtc: fromUtc.toISOString(),
      toUtc: toUtc.toISOString(),
    },
    summary: {
      observationCount: observations.length,
      segmentCount: segmentIds.length,
      latestTimestampUtc: toIsoString(
        observations.reduce<Date | null>((latest, observation) => {
          if (!latest || observation.timestampUtc > latest) {
            return observation.timestampUtc;
          }

          return latest;
        }, null),
      ),
      averageSpeed: average(observations.map((observation) => observation.speed)),
      averageFreeFlowSpeed: average(
        observations.map((observation) => observation.freeFlowSpeed),
      ),
      averageSpeedRatio: average(
        observations.map((observation) =>
          getSpeedRatio(observation.speed, observation.freeFlowSpeed),
        ),
      ),
      congestionCounts: summarizeCongestionLabels(observations),
    },
    series,
  };
}
