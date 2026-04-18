import assert from "node:assert/strict";
import test from "node:test";

import {
  getLiveWindowPayload,
  getWindowAwareFreshnessStatus,
} from "@/lib/time/live-window";

process.env.DATABASE_URL = "file:./dev.db";
process.env.INGEST_TIMEZONE = "Africa/Cairo";
process.env.INGEST_ACTIVE_START_HOUR_LOCAL = "7";
process.env.INGEST_ACTIVE_END_HOUR_LOCAL = "24";

test("live window is active during Cairo daytime collection", () => {
  const liveWindow = getLiveWindowPayload(new Date("2026-04-18T21:30:00.000Z"));

  assert.equal(liveWindow.isActiveNow, true);
  assert.equal(liveWindow.activeFromLocal, "07:00");
  assert.equal(liveWindow.activeUntilLocal, "00:00");
});

test("live window is inactive after midnight Cairo time", () => {
  const liveWindow = getLiveWindowPayload(new Date("2026-04-18T22:50:00.000Z"));

  assert.equal(liveWindow.isActiveNow, false);
});

test("freshness becomes latest saved result outside live hours", () => {
  const liveWindow = getLiveWindowPayload(new Date("2026-04-18T22:50:00.000Z"));
  const status = getWindowAwareFreshnessStatus({
    latestTimestampUtc: new Date("2026-04-18T22:45:00.000Z"),
    liveWindow,
    freshForMinutes: 30,
  });

  assert.equal(status, "saved");
});
