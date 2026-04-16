import "dotenv/config";

import { PrismaClient } from "@prisma/client";

import { CORRIDOR_SEGMENTS } from "../lib/corridor/definition";

const prisma = new PrismaClient();

async function main() {
  await prisma.$transaction(
    CORRIDOR_SEGMENTS.map((segment) =>
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

  console.log(`Seeded ${CORRIDOR_SEGMENTS.length} corridor segments.`);
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
