import { prisma } from "@/lib/db";

export async function getLatestPredictionsForSegments(params: {
  segmentIds: string[];
  modelVersion: string;
}) {
  if (params.segmentIds.length === 0) {
    return [];
  }

  return prisma.$transaction(
    params.segmentIds.map((segmentId) =>
      prisma.prediction.findFirst({
        where: {
          segmentId,
          modelVersion: params.modelVersion,
        },
        orderBy: {
          timestampUtc: "desc",
        },
      }),
    ),
  );
}

export async function listPredictionsInRange(params: {
  segmentIds: string[];
  modelVersion: string;
  fromUtc: Date;
  toUtc: Date;
}) {
  if (params.segmentIds.length === 0) {
    return [];
  }

  return prisma.prediction.findMany({
    where: {
      segmentId: {
        in: params.segmentIds,
      },
      modelVersion: params.modelVersion,
      timestampUtc: {
        gte: params.fromUtc,
        lte: params.toUtc,
      },
    },
    orderBy: [
      {
        timestampUtc: "asc",
      },
      {
        segmentId: "asc",
      },
    ],
  });
}
