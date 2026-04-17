import assert from "node:assert/strict";
import test from "node:test";
import { ZodError } from "zod";

import { parseTrafficHistoryQuery } from "@/lib/services/traffic-service";

test("traffic history query applies safe defaults", () => {
  const query = parseTrafficHistoryQuery(new URLSearchParams());

  assert.deepEqual(query, {
    hours: 24,
    granularity: "raw",
  });
});

test("traffic history query validates range and granularity", () => {
  const query = parseTrafficHistoryQuery(
    new URLSearchParams("segmentId=alex-corridor-01&hours=72&granularity=day"),
  );

  assert.deepEqual(query, {
    segmentId: "alex-corridor-01",
    hours: 72,
    granularity: "day",
  });
});

test("traffic history query rejects invalid values", () => {
  assert.throws(
    () => parseTrafficHistoryQuery(new URLSearchParams("hours=5000")),
    ZodError,
  );
});
