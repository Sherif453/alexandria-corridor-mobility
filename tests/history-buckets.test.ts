import assert from "node:assert/strict";
import test from "node:test";

import { buildCorridorBuckets } from "@/components/traffic/history-analytics";
import type { TrafficHistoryPayload } from "@/lib/types/traffic";

test("history buckets aggregate corridor speed by time period", () => {
  const history = {
    series: [
      {
        bucketStartUtc: "2026-04-21T10:00:00.000Z",
        segmentId: "alex-corridor-01",
        observationCount: 4,
        averageSpeed: 20,
        averageFreeFlowSpeed: 25,
        averageSpeedRatio: 0.8,
        congestionCounts: { Low: 4 },
      },
      {
        bucketStartUtc: "2026-04-21T10:00:00.000Z",
        segmentId: "alex-corridor-02",
        observationCount: 4,
        averageSpeed: 10,
        averageFreeFlowSpeed: 20,
        averageSpeedRatio: 0.5,
        congestionCounts: { Medium: 4 },
      },
      {
        bucketStartUtc: "2026-04-21T11:00:00.000Z",
        segmentId: "alex-corridor-01",
        observationCount: 4,
        averageSpeed: 30,
        averageFreeFlowSpeed: 30,
        averageSpeedRatio: 1,
        congestionCounts: { Low: 4 },
      },
    ],
  } as unknown as TrafficHistoryPayload;

  const buckets = buildCorridorBuckets(history);

  assert.equal(buckets.length, 2);
  assert.equal(buckets[0]?.bucketStartUtc, "2026-04-21T10:00:00.000Z");
  assert.equal(buckets[0]?.observationCount, 8);
  assert.equal(buckets[0]?.averageSpeed, 15);
  assert.equal(buckets[0]?.averageSpeedRatio, 0.65);
  assert.equal(buckets[0]?.dominantClass, "Low");
  assert.equal(buckets[1]?.averageSpeed, 30);
});
