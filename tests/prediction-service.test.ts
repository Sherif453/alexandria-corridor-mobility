import assert from "node:assert/strict";
import test from "node:test";

import { selectBestPredictionSnapshot } from "@/lib/services/prediction-service";

test("prediction snapshot selection prefers fuller recent snapshots", () => {
  const snapshot = selectBestPredictionSnapshot([
    {
      modelVersion: "v8",
      timestampUtc: new Date("2026-04-25T09:15:00.000Z"),
      predictedSegments: 6,
    },
    {
      modelVersion: "v8",
      timestampUtc: new Date("2026-04-25T09:00:00.000Z"),
      predictedSegments: 38,
    },
    {
      modelVersion: "v8",
      timestampUtc: new Date("2026-04-25T08:45:00.000Z"),
      predictedSegments: 38,
    },
  ]);

  assert.ok(snapshot);
  assert.equal(snapshot?.timestampUtc.toISOString(), "2026-04-25T09:00:00.000Z");
  assert.equal(snapshot?.predictedSegments, 38);
});

test("prediction snapshot selection returns null for empty candidates", () => {
  assert.equal(selectBestPredictionSnapshot([]), null);
});
