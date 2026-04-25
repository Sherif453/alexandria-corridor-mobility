import { prisma } from "@/lib/db";

export async function getLatestModelRun() {
  return prisma.modelRun.findFirst({
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function getModelRunByVersion(version: string) {
  return prisma.modelRun.findFirst({
    where: {
      version,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}
