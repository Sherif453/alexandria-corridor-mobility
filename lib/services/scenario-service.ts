import { z } from "zod";

import {
  getLatestScenarioVersion,
  listScenarioResultsByScenario,
  listScenarioResultsByVersion,
} from "@/lib/repositories/scenario-result-repository";
import {
  getScenarioDefinition,
  SCENARIO_DEFINITIONS,
  type ScenarioDefinition,
} from "@/lib/scenarios/definitions";
import {
  buildScenarioMetricPayload,
  getMetricValue,
  type ScenarioMetricPayload,
  type ScenarioMetricRow,
} from "@/lib/scenarios/metrics";
import { listSegments } from "@/lib/repositories/segment-repository";
import { getLatestTrafficObservations } from "@/lib/repositories/traffic-observation-repository";
import { getLiveWindowPayload } from "@/lib/time/live-window";

const scenarioIdSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9-]+$/);

type ScenarioNotes = {
  artifactPath?: unknown;
  durationSeconds?: unknown;
};

type SegmentRow = Awaited<ReturnType<typeof listSegments>>[number];
type ObservationRow = Awaited<ReturnType<typeof getLatestTrafficObservations>>[number];

const congestionScores: Record<string, number> = {
  Low: 0,
  Medium: 1,
  High: 2,
};

const congestionLabels = ["Low", "Medium", "High"] as const;

function parseNotes(notes: string | null): ScenarioNotes {
  if (!notes) {
    return {};
  }

  try {
    return JSON.parse(notes) as ScenarioNotes;
  } catch {
    return {};
  }
}

function mapScenarioType(type: ScenarioDefinition["type"]) {
  if (type === "baseline") {
    return "Baseline";
  }

  if (type === "disruption") {
    return "Disruption";
  }

  return "Mitigation";
}

function getObservationLabel(observation: ObservationRow): string | null {
  return observation?.congestionLabel ?? null;
}

function scoreToLabel(score: number): string {
  return congestionLabels[Math.min(Math.max(Math.round(score), 0), 2)];
}

function getEffect(scoreDelta: number) {
  if (scoreDelta > 0) {
    return "heavier" as const;
  }

  if (scoreDelta < 0) {
    return "lighter" as const;
  }

  return "unchanged" as const;
}

function getScenarioScoreDelta(params: {
  definition: ScenarioDefinition;
  segment: SegmentRow;
  allSegments: SegmentRow[];
}) {
  if (params.definition.type === "baseline") {
    return 0;
  }

  const affectedOrders = params.allSegments
    .filter((segment) => params.definition.affectedSegmentIds.includes(segment.segmentId))
    .map((segment) => segment.sortOrder);
  const directlyAffected = params.definition.affectedSegmentIds.includes(
    params.segment.segmentId,
  );
  const nearestAffectedDistance =
    affectedOrders.length > 0
      ? Math.min(
          ...affectedOrders.map((affectedOrder) =>
            Math.abs(params.segment.sortOrder - affectedOrder),
          ),
        )
      : Number.POSITIVE_INFINITY;

  if (params.definition.type === "disruption") {
    if (directlyAffected) {
      return params.definition.affectedSpeedMultiplier <= 0.5 ? 2 : 1;
    }

    return nearestAffectedDistance <= 2 ? 1 : 0;
  }

  if (directlyAffected) {
    return params.definition.affectedSpeedMultiplier <= 0.7 ? 1 : 0;
  }

  return 0;
}

function buildScenarioSegmentImpacts(params: {
  definition: ScenarioDefinition;
  segments: SegmentRow[];
  observationsBySegmentId: Map<string, ObservationRow>;
}) {
  return params.segments.map((segment) => {
    const observationLabel = getObservationLabel(
      params.observationsBySegmentId.get(segment.segmentId) ?? null,
    );
    const baselineScore = observationLabel ? congestionScores[observationLabel] : undefined;

    if (baselineScore === undefined) {
      return {
        segmentId: segment.segmentId,
        roadName: segment.roadName,
        latitude: segment.latitude,
        longitude: segment.longitude,
        order: segment.sortOrder,
        baselineLabel: null,
        scenarioLabel: null,
        effect: "unknown" as const,
        note: "No recent congestion reading is available for this area.",
      };
    }

    const scoreDelta = getScenarioScoreDelta({
      definition: params.definition,
      segment,
      allSegments: params.segments,
    });
    const scenarioLabel = scoreToLabel(baselineScore + scoreDelta);
    const effect = getEffect(congestionScores[scenarioLabel] - baselineScore);

    return {
      segmentId: segment.segmentId,
      roadName: segment.roadName,
      latitude: segment.latitude,
      longitude: segment.longitude,
      order: segment.sortOrder,
      baselineLabel: observationLabel,
      scenarioLabel,
      effect,
      note:
        effect === "heavier"
          ? "This area is expected to become more congested under the selected scenario."
          : effect === "lighter"
            ? "This area is expected to become less congested under the selected scenario."
            : "This area is expected to stay close to its current congestion level.",
    };
  });
}

function toScenarioMetricRows(rows: Awaited<ReturnType<typeof listScenarioResultsByVersion>>) {
  return rows.map((row) => ({
    scenarioId: row.scenarioId,
    metricName: row.metricName,
    metricValue: row.metricValue,
    notes: row.notes,
    scenarioVersion: row.scenarioVersion,
    createdAt: row.createdAt,
  })) satisfies ScenarioMetricRow[];
}

function getLatestCreatedAt(rows: ScenarioMetricRow[]) {
  return rows.reduce<Date | null>((latest, row) => {
    if (!latest || row.createdAt > latest) {
      return row.createdAt;
    }

    return latest;
  }, null);
}

function buildObservationsBySegmentId(observations: Array<ObservationRow | null>) {
  return new Map(
    observations
      .filter((observation): observation is NonNullable<typeof observation> =>
        Boolean(observation),
      )
      .map((observation) => [observation.segmentId, observation]),
  );
}

function getLatestObservationTimestamp(observations: Array<ObservationRow | null>) {
  const latest = observations.reduce<Date | null>((currentLatest, observation) => {
    if (!observation) {
      return currentLatest;
    }

    if (!currentLatest || observation.timestampUtc > currentLatest) {
      return observation.timestampUtc;
    }

    return currentLatest;
  }, null);

  return latest?.toISOString() ?? null;
}

function buildScenarioSummary(params: {
  definition: ScenarioDefinition;
  rows: ScenarioMetricRow[];
  baselineRows: ScenarioMetricRow[];
  segments: SegmentRow[];
  observationsBySegmentId: Map<string, ObservationRow>;
}) {
  const metrics = params.rows
    .map((row) => buildScenarioMetricPayload(row, params.baselineRows))
    .filter((metric): metric is ScenarioMetricPayload => Boolean(metric));
  const notes = parseNotes(params.rows[0]?.notes ?? null);
  const affectedAreaNames = params.segments
    .filter((segment) => params.definition.affectedSegmentIds.includes(segment.segmentId))
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((segment) => segment.roadName);
  const relativeChange = getMetricValue(metrics, "relative_travel_time_change_percent");
  const averageTravelTime = getMetricValue(metrics, "average_travel_time_seconds");
  const averageDelay = getMetricValue(metrics, "average_delay_seconds");
  const corridorPressure = getMetricValue(metrics, "corridor_pressure_percent");
  const maxQueueLength = getMetricValue(metrics, "max_queue_length_meters");

  return {
    id: params.definition.id,
    name: params.definition.name,
    type: params.definition.type,
    typeLabel: mapScenarioType(params.definition.type),
    summary: params.definition.summary,
    assumptions: params.definition.assumptions,
    affectedAreaNames,
    status: metrics.length > 0 ? ("ready" as const) : ("missing" as const),
    artifactPath:
      typeof notes.artifactPath === "string" ? notes.artifactPath : null,
    durationSeconds:
      typeof notes.durationSeconds === "number" ? notes.durationSeconds : null,
    createdAtUtc: getLatestCreatedAt(params.rows)?.toISOString() ?? null,
    headline: {
      averageTravelTimeSeconds: averageTravelTime,
      averageDelaySeconds: averageDelay,
      corridorPressurePercent: corridorPressure,
      maxQueueLengthMeters: maxQueueLength,
      relativeTravelTimeChangePercent: relativeChange,
    },
    segmentImpacts: buildScenarioSegmentImpacts({
      definition: params.definition,
      segments: params.segments,
      observationsBySegmentId: params.observationsBySegmentId,
    }),
    metrics,
  };
}

export function parseScenarioId(value: string): string {
  return scenarioIdSchema.parse(value);
}

export async function getScenarioListPayload() {
  const segments = await listSegments();
  const latestObservations = await getLatestTrafficObservations(
    segments.map((segment) => segment.segmentId),
  );
  const observationsBySegmentId = buildObservationsBySegmentId(latestObservations);
  const latestVersion = await getLatestScenarioVersion();
  const rows = latestVersion
    ? toScenarioMetricRows(await listScenarioResultsByVersion(latestVersion))
    : [];
  const baselineRows = rows.filter((row) => row.scenarioId === "baseline");

  return {
    generatedAtUtc: new Date().toISOString(),
    liveWindow: getLiveWindowPayload(),
    latestTrafficTimestampUtc: getLatestObservationTimestamp(latestObservations),
    latestVersion,
    status: latestVersion ? ("ready" as const) : ("missing" as const),
    message: latestVersion
      ? "Scenario comparison is ready."
      : "Scenario comparison is not ready yet. Run the scenario pipeline first.",
    scenarios: SCENARIO_DEFINITIONS.map((definition) =>
      buildScenarioSummary({
        definition,
        rows: rows.filter((row) => row.scenarioId === definition.id),
        baselineRows,
        segments,
        observationsBySegmentId,
      }),
    ),
  };
}

export async function getScenarioDetailPayload(scenarioId: string) {
  const parsedScenarioId = parseScenarioId(scenarioId);
  const definition = getScenarioDefinition(parsedScenarioId);

  if (!definition) {
    throw new Error("UNKNOWN_SCENARIO");
  }

  const latestVersion = await getLatestScenarioVersion();

  if (!latestVersion) {
    const segments = await listSegments();
    const latestObservations = await getLatestTrafficObservations(
      segments.map((segment) => segment.segmentId),
    );
    const observationsBySegmentId = buildObservationsBySegmentId(latestObservations);

    return {
      generatedAtUtc: new Date().toISOString(),
      liveWindow: getLiveWindowPayload(),
      latestTrafficTimestampUtc: getLatestObservationTimestamp(latestObservations),
      latestVersion: null,
      scenario: buildScenarioSummary({
        definition,
        rows: [],
        baselineRows: [],
        segments,
        observationsBySegmentId,
      }),
      baseline: null,
    };
  }

  const [scenarioRows, baselineRows, segments] = await Promise.all([
    listScenarioResultsByScenario({
      scenarioVersion: latestVersion,
      scenarioId: parsedScenarioId,
    }),
    listScenarioResultsByScenario({
      scenarioVersion: latestVersion,
      scenarioId: "baseline",
    }),
    listSegments(),
  ]);
  const latestObservations = await getLatestTrafficObservations(
    segments.map((segment) => segment.segmentId),
  );
  const observationsBySegmentId = buildObservationsBySegmentId(latestObservations);
  const typedScenarioRows = toScenarioMetricRows(scenarioRows);
  const typedBaselineRows = toScenarioMetricRows(baselineRows);
  const baselineDefinition = getScenarioDefinition("baseline");

  return {
    generatedAtUtc: new Date().toISOString(),
    liveWindow: getLiveWindowPayload(),
    latestTrafficTimestampUtc: getLatestObservationTimestamp(latestObservations),
    latestVersion,
    scenario: buildScenarioSummary({
      definition,
      rows: typedScenarioRows,
      baselineRows: typedBaselineRows,
      segments,
      observationsBySegmentId,
    }),
    baseline: baselineDefinition
      ? buildScenarioSummary({
          definition: baselineDefinition,
          rows: typedBaselineRows,
          baselineRows: typedBaselineRows,
          segments,
          observationsBySegmentId,
        })
      : null,
  };
}
