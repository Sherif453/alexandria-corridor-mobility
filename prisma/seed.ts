import "dotenv/config";

import { PrismaClient } from "@prisma/client";

import { CORRIDOR_SEGMENTS } from "../lib/corridor/definition";

const prisma = new PrismaClient();

async function main() {
  const activeSegmentIds = CORRIDOR_SEGMENTS.map((segment) => segment.segmentId);

  const deletedStaleSegments = await prisma.$transaction(async (tx) => {
    for (const segment of CORRIDOR_SEGMENTS) {
      await tx.segment.upsert({
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
      });
    }

    const deleteResult = await tx.segment.deleteMany({
      where: {
        segmentId: {
          notIn: activeSegmentIds,
        },
        observations: {
          none: {},
        },
        features: {
          none: {},
        },
        predictions: {
          none: {},
        },
      },
    });

    return deleteResult.count;
  });

  console.log(
    `Seeded ${CORRIDOR_SEGMENTS.length} corridor segments. Removed ${deletedStaleSegments} stale empty segments.`,
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
