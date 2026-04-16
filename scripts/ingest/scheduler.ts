import "dotenv/config";

import cron from "node-cron";

import { getEnv } from "@/lib/env";
import { runTrafficIngestion } from "@/lib/services/ingestion-service";

const env = getEnv();
let isIngestionRunning = false;

async function triggerIngestion(trigger: "cron" | "manual") {
  if (isIngestionRunning) {
    console.warn(
      `[${trigger}] skipped because the previous ingestion run is still active.`,
    );
    return;
  }

  isIngestionRunning = true;

  try {
    const summary = await runTrafficIngestion();
    console.log(`[${trigger}]`, JSON.stringify(summary));
  } catch (error) {
    console.error(`[${trigger}] ingestion failed`, error);
  } finally {
    isIngestionRunning = false;
  }
}

console.log(
  `Starting ingestion scheduler in ${env.INGEST_TIMEZONE} with 15-minute cadence from ${String(env.INGEST_ACTIVE_START_HOUR_LOCAL).padStart(2, "0")}:00 to ${String(env.INGEST_ACTIVE_END_HOUR_LOCAL).padStart(2, "0")}:00.`,
);

cron.schedule(
  "*/15 * * * *",
  async () => {
    await triggerIngestion("cron");
  },
  {
    timezone: env.INGEST_TIMEZONE,
  },
);
