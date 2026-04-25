import assert from "node:assert/strict";
import test from "node:test";

import { getSummaryObservationsForLatestTraffic } from "@/lib/services/traffic-service";

const activeLiveWindow = {
  timezone: "Africa/Cairo",
  activeFromLocal: "07:00",
  activeUntilLocal: "00:00",
  isActiveNow: true,
  checkedAtUtc: "2026-04-25T09:00:00.000Z",
};

test("latest traffic summary keeps only recent observations during active hours", () => {
  const summaryRows = getSummaryObservationsForLatestTraffic({
    latestObservations: [
      {
        id: "obs_fresh",
        segmentId: "alex-corridor-01",
        timestampUtc: new Date("2026-04-25T08:45:00.000Z"),
        speed: 30,
        freeFlowSpeed: 40,
        congestionLabel: "Low",
        source: "tomtom",
        qualityStatus: null,
        ingestionRunId: "ingest_1",
        createdAt: new Date("2026-04-25T08:45:05.000Z"),
      },
      {
        id: "obs_stale",
        segmentId: "alex-corridor-02",
        timestampUtc: new Date("2026-04-25T07:50:00.000Z"),
        speed: 12,
        freeFlowSpeed: 40,
        congestionLabel: "High",
        source: "tomtom",
        qualityStatus: null,
        ingestionRunId: "ingest_1",
        createdAt: new Date("2026-04-25T07:50:05.000Z"),
      },
      null,
    ],
    liveWindow: activeLiveWindow,
    checkedAtUtc: new Date(activeLiveWindow.checkedAtUtc),
    freshForMinutes: 30,
  });

  assert.equal(summaryRows.length, 1);
  assert.equal(summaryRows[0]?.segmentId, "alex-corridor-01");
});

test("latest traffic summary keeps saved observations outside live hours", () => {
  const summaryRows = getSummaryObservationsForLatestTraffic({
    latestObservations: [
      {
        id: "obs_saved",
        segmentId: "alex-corridor-01",
        timestampUtc: new Date("2026-04-24T21:45:00.000Z"),
        speed: 24,
        freeFlowSpeed: 40,
        congestionLabel: "Medium",
        source: "tomtom",
        qualityStatus: null,
        ingestionRunId: "ingest_1",
        createdAt: new Date("2026-04-24T21:45:05.000Z"),
      },
      null,
    ],
    liveWindow: {
      ...activeLiveWindow,
      isActiveNow: false,
    },
    checkedAtUtc: new Date("2026-04-25T02:00:00.000Z"),
    freshForMinutes: 30,
  });

  assert.equal(summaryRows.length, 1);
  assert.equal(summaryRows[0]?.segmentId, "alex-corridor-01");
});
