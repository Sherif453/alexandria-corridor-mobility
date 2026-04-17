import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { z } from "zod";

import { getEnv } from "@/lib/env";

const execFileAsync = promisify(execFile);

const refreshActionSchema = z.enum(["ingest", "features", "predictions", "scenarios", "all"]);

type RefreshAction = z.infer<typeof refreshActionSchema>;

type RefreshStep = {
  name: string;
  script: string;
};

let refreshRunning = false;

const stepPlans: Record<RefreshAction, RefreshStep[]> = {
  ingest: [{ name: "Collect latest traffic", script: "ingest:once" }],
  features: [{ name: "Rebuild learning rows", script: "features:build" }],
  predictions: [
    { name: "Rebuild learning rows", script: "features:build" },
    { name: "Refresh next 15 minutes", script: "predictions:generate" },
  ],
  scenarios: [{ name: "Run scenario comparison", script: "scenarios:run" }],
  all: [
    { name: "Collect latest traffic", script: "ingest:once" },
    { name: "Rebuild learning rows", script: "features:build" },
    { name: "Refresh next 15 minutes", script: "predictions:generate" },
    { name: "Run scenario comparison", script: "scenarios:run" },
  ],
};

export function parseRefreshAction(value: unknown): RefreshAction {
  return refreshActionSchema.default("predictions").parse(value);
}

function trimOutput(value: string): string {
  const trimmed = value.trim();

  if (trimmed.length <= 3000) {
    return trimmed;
  }

  return trimmed.slice(-3000);
}

async function runRefreshStep(step: RefreshStep, timeoutMs: number) {
  const startedAt = Date.now();
  const { stdout, stderr } = await execFileAsync("npm", ["run", step.script], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      TMPDIR: process.env.TMPDIR ?? ".tmp",
    },
    timeout: timeoutMs,
    maxBuffer: 1024 * 1024 * 5,
  });

  return {
    name: step.name,
    command: `npm run ${step.script}`,
    durationMs: Date.now() - startedAt,
    outputTail: trimOutput([stdout, stderr].filter(Boolean).join("\n")),
  };
}

export async function runAdminRefresh(action: RefreshAction) {
  const env = getEnv();

  if (!env.ADMIN_REFRESH_ENABLED) {
    throw new Error("ADMIN_REFRESH_DISABLED");
  }

  if (refreshRunning) {
    throw new Error("ADMIN_REFRESH_ALREADY_RUNNING");
  }

  refreshRunning = true;

  try {
    const steps = [];
    const timeoutMs = env.ADMIN_REFRESH_MAX_SECONDS * 1000;

    for (const step of stepPlans[action]) {
      steps.push(await runRefreshStep(step, timeoutMs));
    }

    return {
      generatedAtUtc: new Date().toISOString(),
      action,
      status: "completed" as const,
      steps,
    };
  } finally {
    refreshRunning = false;
  }
}
