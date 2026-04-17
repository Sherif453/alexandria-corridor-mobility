export type ScenarioMetricDefinition = {
  name: string;
  label: string;
  unit: "seconds" | "meters" | "vehicles" | "percent";
  higherIsBetter: boolean;
  description: string;
};

export type ScenarioMetricRow = {
  scenarioId: string;
  metricName: string;
  metricValue: number;
  notes: string | null;
  scenarioVersion: string;
  createdAt: Date;
};

export type ScenarioMetricPayload = ScenarioMetricDefinition & {
  value: number;
  baselineValue: number | null;
  delta: number | null;
  deltaPercent: number | null;
};

export const SCENARIO_METRICS: ScenarioMetricDefinition[] = [
  {
    name: "average_travel_time_seconds",
    label: "Average trip time",
    unit: "seconds",
    higherIsBetter: false,
    description: "Average time a vehicle needed to cross the simulated corridor.",
  },
  {
    name: "average_delay_seconds",
    label: "Average delay",
    unit: "seconds",
    higherIsBetter: false,
    description: "Average extra time lost because vehicles moved slower than desired.",
  },
  {
    name: "average_waiting_time_seconds",
    label: "Average stopped time",
    unit: "seconds",
    higherIsBetter: false,
    description: "Average time vehicles spent stopped or nearly stopped.",
  },
  {
    name: "max_queue_length_meters",
    label: "Longest queue",
    unit: "meters",
    higherIsBetter: false,
    description: "Longest queue measured during the simulation.",
  },
  {
    name: "completed_vehicle_count",
    label: "Vehicles completed",
    unit: "vehicles",
    higherIsBetter: true,
    description: "Number of simulated vehicles that completed the corridor run.",
  },
  {
    name: "relative_travel_time_change_percent",
    label: "Trip time change",
    unit: "percent",
    higherIsBetter: false,
    description: "Trip time change compared with the baseline scenario.",
  },
];

export function getScenarioMetricDefinition(metricName: string) {
  return SCENARIO_METRICS.find((metric) => metric.name === metricName) ?? null;
}

export function buildScenarioMetricPayload(
  row: ScenarioMetricRow,
  baselineRows: ScenarioMetricRow[],
): ScenarioMetricPayload | null {
  const definition = getScenarioMetricDefinition(row.metricName);

  if (!definition) {
    return null;
  }

  const baselineRow = baselineRows.find(
    (baselineMetric) => baselineMetric.metricName === row.metricName,
  );
  const baselineValue = baselineRow?.metricValue ?? null;
  const delta = baselineValue === null ? null : row.metricValue - baselineValue;
  const deltaPercent =
    baselineValue === null || baselineValue === 0 || delta === null
      ? null
      : (delta / baselineValue) * 100;

  return {
    ...definition,
    value: row.metricValue,
    baselineValue,
    delta,
    deltaPercent,
  };
}

export function getMetricValue(
  metrics: ScenarioMetricPayload[],
  metricName: string,
): number | null {
  return metrics.find((metric) => metric.name === metricName)?.value ?? null;
}
