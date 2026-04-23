import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCongestionLabelBackfillPlan,
  parseBackfillCongestionArgs,
} from "@/lib/services/congestion-label-backfill-service";

test("backfill args default to dry-run with the standard batch size", () => {
  assert.deepEqual(parseBackfillCongestionArgs([]), {
    apply: false,
    batchSize: 500,
  });
});

test("backfill args accept apply mode and a custom batch size", () => {
  assert.deepEqual(parseBackfillCongestionArgs(["--apply", "--batch-size=200"]), {
    apply: true,
    batchSize: 200,
  });
});

test("backfill args reject unknown flags and invalid batch sizes", () => {
  assert.throws(() => parseBackfillCongestionArgs(["--unknown"]));
  assert.throws(() => parseBackfillCongestionArgs(["--batch-size=0"]));
});

test("backfill plan identifies only rows whose computed label changed", () => {
  const result = buildCongestionLabelBackfillPlan([
    {
      id: "obs-1",
      speed: 0,
      freeFlowSpeed: 40,
      congestionLabel: null,
    },
    {
      id: "obs-2",
      speed: 18,
      freeFlowSpeed: 40,
      congestionLabel: "Medium",
    },
    {
      id: "obs-3",
      speed: 32,
      freeFlowSpeed: 40,
      congestionLabel: "Medium",
    },
  ]);

  assert.equal(result.summary.scanned, 3);
  assert.equal(result.summary.unchanged, 1);
  assert.equal(result.summary.updates, 2);
  assert.deepEqual(result.summary.changeCounts, {
    "Medium=>Low": 1,
    "null=>High": 1,
  });
  assert.deepEqual(result.updates, [
    {
      id: "obs-1",
      previousLabel: null,
      nextLabel: "High",
    },
    {
      id: "obs-3",
      previousLabel: "Medium",
      nextLabel: "Low",
    },
  ]);
});
