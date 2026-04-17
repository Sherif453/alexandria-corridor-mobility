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

const scenarioIdSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9-]+$/);

type ScenarioNotes = {
  artifactPath?: unknown;
  durationSeconds?: unknown;
};

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

function buildScenarioSummary(params: {
  definition: ScenarioDefinition;
  rows: ScenarioMetricRow[];
  baselineRows: ScenarioMetricRow[];
}) {
  const metrics = params.rows
    .map((row) => buildScenarioMetricPayload(row, params.baselineRows))
    .filter((metric): metric is ScenarioMetricPayload => Boolean(metric));
  const notes = parseNotes(params.rows[0]?.notes ?? null);
  const relativeChange = getMetricValue(metrics, "relative_travel_time_change_percent");
  const averageTravelTime = getMetricValue(metrics, "average_travel_time_seconds");
  const averageDelay = getMetricValue(metrics, "average_delay_seconds");
  const maxQueueLength = getMetricValue(metrics, "max_queue_length_meters");

  return {
    id: params.definition.id,
    name: params.definition.name,
    type: params.definition.type,
    typeLabel: mapScenarioType(params.definition.type),
    summary: params.definition.summary,
    assumptions: params.definition.assumptions,
    status: metrics.length > 0 ? ("ready" as const) : ("missing" as const),
    artifactPath:
      typeof notes.artifactPath === "string" ? notes.artifactPath : null,
    durationSeconds:
      typeof notes.durationSeconds === "number" ? notes.durationSeconds : null,
    createdAtUtc: getLatestCreatedAt(params.rows)?.toISOString() ?? null,
    headline: {
      averageTravelTimeSeconds: averageTravelTime,
      averageDelaySeconds: averageDelay,
      maxQueueLengthMeters: maxQueueLength,
      relativeTravelTimeChangePercent: relativeChange,
    },
    metrics,
  };
}

export function parseScenarioId(value: string): string {
  return scenarioIdSchema.parse(value);
}

export async function getScenarioListPayload() {
  const latestVersion = await getLatestScenarioVersion();
  const rows = latestVersion
    ? toScenarioMetricRows(await listScenarioResultsByVersion(latestVersion))
    : [];
  const baselineRows = rows.filter((row) => row.scenarioId === "baseline");

  return {
    generatedAtUtc: new Date().toISOString(),
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
    return {
      generatedAtUtc: new Date().toISOString(),
      latestVersion: null,
      scenario: buildScenarioSummary({
        definition,
        rows: [],
        baselineRows: [],
      }),
      baseline: null,
    };
  }

  const [scenarioRows, baselineRows] = await Promise.all([
    listScenarioResultsByScenario({
      scenarioVersion: latestVersion,
      scenarioId: parsedScenarioId,
    }),
    listScenarioResultsByScenario({
      scenarioVersion: latestVersion,
      scenarioId: "baseline",
    }),
  ]);
  const typedScenarioRows = toScenarioMetricRows(scenarioRows);
  const typedBaselineRows = toScenarioMetricRows(baselineRows);
  const baselineDefinition = getScenarioDefinition("baseline");

  return {
    generatedAtUtc: new Date().toISOString(),
    latestVersion,
    scenario: buildScenarioSummary({
      definition,
      rows: typedScenarioRows,
      baselineRows: typedBaselineRows,
    }),
    baseline: baselineDefinition
      ? buildScenarioSummary({
          definition: baselineDefinition,
          rows: typedBaselineRows,
          baselineRows: typedBaselineRows,
        })
      : null,
  };
}
