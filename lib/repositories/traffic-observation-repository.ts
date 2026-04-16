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
