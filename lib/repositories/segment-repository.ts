import {
  CORRIDOR_SEGMENTS,
  type CorridorSegmentDefinition,
} from "@/lib/corridor/definition";
import { prisma } from "@/lib/db";

export async function upsertSegments(
  segments: readonly CorridorSegmentDefinition[],
): Promise<void> {
  await prisma.$transaction(
    segments.map((segment) =>
      prisma.segment.upsert({
        where: { segmentId: segment.segmentId },
        update: {
          roadName: segment.roadName,
          geometryRef: segment.geometryRef,
          roadType: segment.roadType,
          latitude: segment.latitude,
          longitude: segment.longitude,
          sortOrder: segment.sortOrder,
        },
        create: {
          segmentId: segment.segmentId,
          roadName: segment.roadName,
          geometryRef: segment.geometryRef,
          roadType: segment.roadType,
          latitude: segment.latitude,
          longitude: segment.longitude,
          sortOrder: segment.sortOrder,
        },
      }),
    ),
  );
}

export async function listSegments() {
  return prisma.segment.findMany({
    where: {
      segmentId: {
        in: CORRIDOR_SEGMENTS.map((segment) => segment.segmentId),
      },
    },
    orderBy: {
      sortOrder: "asc",
    },
  });
}

export async function countSegments(): Promise<number> {
  return prisma.segment.count({
    where: {
      segmentId: {
        in: CORRIDOR_SEGMENTS.map((segment) => segment.segmentId),
      },
    },
  });
}
