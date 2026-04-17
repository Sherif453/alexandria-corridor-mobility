import { prisma } from "@/lib/db";

export async function getLatestModelRun() {
  return prisma.modelRun.findFirst({
    orderBy: {
      createdAt: "desc",
    },
  });
}
