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
    name: "corridor_pressure_percent",
    label: "Demand pressure",
    unit: "percent",
    higherIsBetter: false,
    description: "How strongly the scenario demand pushes the busiest part of the corridor.",
  },
  {
    name: "modeled_vehicle_count",
    label: "Vehicles modeled",
    unit: "vehicles",
    higherIsBetter: false,
    description: "Number of vehicles included in this scenario; demand surge scenarios can include more vehicles.",
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
