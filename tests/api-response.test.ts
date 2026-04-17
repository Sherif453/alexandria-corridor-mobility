import assert from "node:assert/strict";
import test from "node:test";

import { apiError, apiOk } from "@/lib/api/response";

test("apiOk returns the stable success envelope", async () => {
  const response = apiOk({ value: 42 });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Type"), "application/json; charset=utf-8");
  assert.deepEqual(body, {
    status: "ok",
    data: {
      value: 42,
    },
  });
});

test("apiError returns the stable error envelope", async () => {
  const response = apiError(400, "BAD_INPUT", "Invalid input.");
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.deepEqual(body, {
    status: "error",
    error: {
      code: "BAD_INPUT",
      message: "Invalid input.",
    },
  });
});
