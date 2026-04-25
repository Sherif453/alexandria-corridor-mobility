import { prisma } from "@/lib/db";

export async function getLatestFeatureSnapshotsForSegments(params: {
  segmentIds: string[];
  featureVersion?: string;
  atOrBeforeUtc?: Date;
}) {
  if (params.segmentIds.length === 0) {
    return [];
  }

  return prisma.$transaction(
    params.segmentIds.map((segmentId) =>
      prisma.featureSnapshot.findFirst({
        where: {
          segmentId,
          featureVersion: params.featureVersion,
          ...(params.atOrBeforeUtc
            ? {
                timestampUtc: {
                  lte: params.atOrBeforeUtc,
                },
              }
            : {}),
        },
        orderBy: {
          timestampUtc: "desc",
        },
      }),
    ),
  );
}

export async function getRecentFeatureSnapshotsForSegments(params: {
  segmentIds: string[];
  featureVersion?: string;
  takePerSegment: number;
  atOrBeforeUtc?: Date;
}) {
  if (params.segmentIds.length === 0) {
    return [];
  }

  return prisma.$transaction(
    params.segmentIds.map((segmentId) =>
      prisma.featureSnapshot.findMany({
        where: {
          segmentId,
          featureVersion: params.featureVersion,
          ...(params.atOrBeforeUtc
            ? {
                timestampUtc: {
                  lte: params.atOrBeforeUtc,
                },
              }
            : {}),
        },
        orderBy: {
          timestampUtc: "desc",
        },
        take: params.takePerSegment,
      }),
    ),
  );
}

export async function getFeatureSnapshotsForSegmentsAtTimestamp(params: {
  segmentIds: string[];
  featureVersion?: string;
  timestampUtc: Date;
}) {
  if (params.segmentIds.length === 0) {
    return [];
  }

  return prisma.$transaction(
    params.segmentIds.map((segmentId) =>
      prisma.featureSnapshot.findFirst({
        where: {
          segmentId,
          featureVersion: params.featureVersion,
          timestampUtc: params.timestampUtc,
        },
        orderBy: {
          createdAt: "desc",
        },
      }),
    ),
  );
}
