import { prisma } from "@/lib/db";

export async function getLatestScenarioVersion(): Promise<string | null> {
  const latest = await prisma.scenarioResult.findFirst({
    orderBy: {
      createdAt: "desc",
    },
    select: {
      scenarioVersion: true,
    },
  });

  return latest?.scenarioVersion ?? null;
}

export async function listScenarioResultsByVersion(scenarioVersion: string) {
  return prisma.scenarioResult.findMany({
    where: {
      scenarioVersion,
    },
    orderBy: [
      {
        scenarioId: "asc",
      },
      {
        metricName: "asc",
      },
    ],
  });
}

export async function listScenarioResultsByScenario(params: {
  scenarioVersion: string;
  scenarioId: string;
}) {
  return prisma.scenarioResult.findMany({
    where: {
      scenarioVersion: params.scenarioVersion,
      scenarioId: params.scenarioId,
    },
    orderBy: {
      metricName: "asc",
    },
  });
}
