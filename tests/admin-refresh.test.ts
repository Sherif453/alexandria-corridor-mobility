import assert from "node:assert/strict";
import test from "node:test";
import { ZodError } from "zod";

import { parseRefreshAction } from "@/lib/services/admin-refresh-service";

test("refresh action defaults to prediction refresh", () => {
  assert.equal(parseRefreshAction(undefined), "predictions");
});

test("refresh action accepts only known actions", () => {
  assert.equal(parseRefreshAction("scenarios"), "scenarios");
  assert.throws(() => parseRefreshAction("delete-everything"), ZodError);
});
