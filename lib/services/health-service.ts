import { prisma } from "@/lib/db";
import {
  CORRIDOR_DEFINITION_VERSION,
  CORRIDOR_ID,
  CORRIDOR_SAMPLE_POINT_COUNT,
  CORRIDOR_SCOPE,
} from "@/lib/corridor/definition";
import { getEnv, isTomTomConfigured } from "@/lib/env";
import { countSegments } from "@/lib/repositories/segment-repository";

export async function getHealthPayload() {
  const env = getEnv();

  await prisma.$queryRaw`SELECT 1`;
  const persistedSegmentCount = await countSegments();

  return {
    service: "alexandria-corridor-mobility-intelligence",
    status: "ok" as const,
    checkedAt: new Date().toISOString(),
    database: {
      status: "ok" as const,
      provider: "sqlite",
    },
    corridor: {
      id: CORRIDOR_ID,
      scope: CORRIDOR_SCOPE,
      definitionVersion: CORRIDOR_DEFINITION_VERSION,
      configuredSamplePointCount: CORRIDOR_SAMPLE_POINT_COUNT,
      persistedSegmentCount,
    },
    ingestion: {
      tomTomConfigured: isTomTomConfigured(),
      activeWindowLocal: `${String(env.INGEST_ACTIVE_START_HOUR_LOCAL).padStart(2, "0")}:00-${String(env.INGEST_ACTIVE_END_HOUR_LOCAL).padStart(2, "0")}:00`,
      timezone: env.INGEST_TIMEZONE,
      dailyRequestCap: env.INGEST_DAILY_REQUEST_CAP,
    },
  };
}
