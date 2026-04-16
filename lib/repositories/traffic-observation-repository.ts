import { prisma } from "@/lib/db";

type TrafficObservationWrite = {
  segmentId: string;
  timestampUtc: Date;
  speed: number | null;
  freeFlowSpeed: number | null;
  congestionLabel: string | null;
  source: string;
  qualityStatus: string | null;
  ingestionRunId: string;
};

export async function createTrafficObservations(
  observations: TrafficObservationWrite[],
): Promise<void> {
  if (observations.length === 0) {
    return;
  }

  await prisma.trafficObservation.createMany({
    data: observations,
  });
}

export async function getLatestTrafficObservations(segmentIds: string[]) {
  if (segmentIds.length === 0) {
    return [];
  }

  return prisma.$transaction(
    segmentIds.map((segmentId) =>
      prisma.trafficObservation.findFirst({
        where: {
          segmentId,
        },
        orderBy: {
          timestampUtc: "desc",
        },
      }),
    ),
  );
}

export async function listTrafficObservationsInRange(params: {
  segmentIds: string[];
  fromUtc: Date;
  toUtc: Date;
}) {
  if (params.segmentIds.length === 0) {
    return [];
  }

  return prisma.trafficObservation.findMany({
    where: {
      segmentId: {
        in: params.segmentIds,
      },
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
