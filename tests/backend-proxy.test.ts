import assert from "node:assert/strict";
import test from "node:test";

import { buildBackendApiUrl } from "@/lib/api/proxy";

test("backend proxy preserves API path and query", () => {
  const targetUrl = buildBackendApiUrl(
    "https://frontend.example.com/api/traffic/history?hours=24&granularity=hour",
    "https://api.example.com",
  );

  assert.equal(
    targetUrl,
    "https://api.example.com/api/traffic/history?hours=24&granularity=hour",
  );
});

test("backend proxy skips same-origin targets to avoid loops", () => {
  const targetUrl = buildBackendApiUrl(
    "https://api.example.com/api/traffic/latest",
    "https://api.example.com",
  );

  assert.equal(targetUrl, "");
});
