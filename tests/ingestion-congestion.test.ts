import assert from "node:assert/strict";
import test from "node:test";

import { getCongestionLabel } from "@/lib/services/ingestion-service";

test("getCongestionLabel treats zero speed as valid high congestion", () => {
  assert.equal(getCongestionLabel(0, 40), "High");
});

test("getCongestionLabel applies the configured ratio thresholds", () => {
  assert.equal(getCongestionLabel(19, 40), "High");
  assert.equal(getCongestionLabel(20, 40), "Medium");
  assert.equal(getCongestionLabel(32, 40), "Medium");
  assert.equal(getCongestionLabel(33, 40), "Low");
});

test("getCongestionLabel returns null only for missing or invalid free-flow data", () => {
  assert.equal(getCongestionLabel(null, 40), null);
  assert.equal(getCongestionLabel(10, null), null);
  assert.equal(getCongestionLabel(10, 0), null);
});
