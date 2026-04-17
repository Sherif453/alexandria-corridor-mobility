import { prisma } from "@/lib/db";

export async function getLatestFeatureSnapshotsForSegments(params: {
  segmentIds: string[];
  featureVersion?: string;
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
        },
        orderBy: {
          timestampUtc: "desc",
        },
        take: params.takePerSegment,
      }),
    ),
  );
}
