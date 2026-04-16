import { prisma } from "@/lib/db";

export type IngestionRunStatus =
  | "started"
  | "success"
  | "partial_success"
  | "failed"
  | "blocked_missing_api_key"
  | "quota_stopped"
  | "skipped_outside_active_window";

export async function createIngestionRun(runId: string) {
  return prisma.ingestionRun.create({
    data: {
      runId,
      startedAt: new Date(),
      status: "started",
      quotaUsage: 0,
    },
  });
}

export async function finishIngestionRun(
  runId: string,
  status: IngestionRunStatus,
  quotaUsage: number,
  errorMessage?: string,
) {
  return prisma.ingestionRun.update({
    where: { runId },
    data: {
      endedAt: new Date(),
      status,
      quotaUsage,
      errorMessage,
    },
  });
}

export async function sumQuotaUsageSince(since: Date): Promise<number> {
  const result = await prisma.ingestionRun.aggregate({
    _sum: {
      quotaUsage: true,
    },
    where: {
      startedAt: {
        gte: since,
      },
    },
  });

  return result._sum.quotaUsage ?? 0;
}
