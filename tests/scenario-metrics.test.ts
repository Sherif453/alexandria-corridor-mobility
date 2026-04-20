import assert from "node:assert/strict";
import test from "node:test";

import {
  buildScenarioMetricPayload,
  getMetricValue,
  getScenarioMetricDefinition,
  type ScenarioMetricRow,
} from "@/lib/scenarios/metrics";

const createdAt = new Date("2026-04-17T00:00:00.000Z");

function row(
  scenarioId: string,
  metricName: string,
  metricValue: number,
): ScenarioMetricRow {
  return {
    scenarioId,
    metricName,
    metricValue,
    notes: null,
    scenarioVersion: "test-version",
    createdAt,
  };
}

test("scenario metric payload includes baseline deltas", () => {
  const baselineRows = [row("baseline", "average_travel_time_seconds", 100)];
  const payload = buildScenarioMetricPayload(
    row("lane-reduction", "average_travel_time_seconds", 125),
    baselineRows,
  );

  assert.ok(payload);
  assert.equal(payload.label, "Average trip time");
  assert.equal(payload.value, 125);
  assert.equal(payload.baselineValue, 100);
  assert.equal(payload.delta, 25);
  assert.equal(payload.deltaPercent, 25);
});

test("scenario metric helper reads values by metric name", () => {
  const metrics = [
    buildScenarioMetricPayload(
      row("baseline", "average_delay_seconds", 12),
      [row("baseline", "average_delay_seconds", 12)],
    ),
  ].filter((metric): metric is NonNullable<typeof metric> => Boolean(metric));

  assert.equal(getMetricValue(metrics, "average_delay_seconds"), 12);
  assert.equal(getMetricValue(metrics, "missing"), null);
});

test("scenario metrics expose supported user-facing measures", () => {
  assert.equal(getScenarioMetricDefinition("corridor_pressure_percent")?.label, "Demand pressure");
  assert.equal(getScenarioMetricDefinition("modeled_vehicle_count")?.label, "Vehicles modeled");
  assert.equal(getScenarioMetricDefinition("completed_vehicle_count"), null);
  assert.equal(getScenarioMetricDefinition("average_waiting_time_seconds"), null);
  assert.equal(getScenarioMetricDefinition("max_queue_length_meters"), null);
});
