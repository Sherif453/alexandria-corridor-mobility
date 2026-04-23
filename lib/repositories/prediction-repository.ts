import { prisma } from "@/lib/db";

export async function getLatestPredictionTimestamp(params: { modelVersion: string }) {
  const prediction = await prisma.prediction.findFirst({
    where: {
      modelVersion: params.modelVersion,
    },
    orderBy: [
      {
        timestampUtc: "desc",
      },
      {
        createdAt: "desc",
      },
    ],
    select: {
      timestampUtc: true,
    },
  });

  return prediction?.timestampUtc ?? null;
}

export async function getPredictionsForSegmentsAtTimestamp(params: {
  segmentIds: string[];
  modelVersion: string;
  timestampUtc: Date;
}) {
  if (params.segmentIds.length === 0) {
    return [];
  }

  const predictions = await prisma.prediction.findMany({
    where: {
      segmentId: {
        in: params.segmentIds,
      },
      modelVersion: params.modelVersion,
      timestampUtc: params.timestampUtc,
    },
    orderBy: [
      {
        segmentId: "asc",
      },
      {
        createdAt: "desc",
      },
    ],
  });

  const predictionsBySegmentId = new Map<string, (typeof predictions)[number]>();

  for (const prediction of predictions) {
    if (!predictionsBySegmentId.has(prediction.segmentId)) {
      predictionsBySegmentId.set(prediction.segmentId, prediction);
    }
  }

  return params.segmentIds.map((segmentId) => predictionsBySegmentId.get(segmentId) ?? null);
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
