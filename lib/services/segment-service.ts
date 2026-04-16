import {
  CORRIDOR_DEFINITION_VERSION,
  CORRIDOR_ID,
  CORRIDOR_NAME,
  CORRIDOR_SCOPE,
  CORRIDOR_SEGMENTS,
} from "@/lib/corridor/definition";
import { listSegments, upsertSegments } from "@/lib/repositories/segment-repository";

export async function syncSegmentsFromDefinition(): Promise<void> {
  await upsertSegments(CORRIDOR_SEGMENTS);
}

export async function getSegmentsPayload() {
  await syncSegmentsFromDefinition();

  const segments = await listSegments();

  return {
    corridor: {
      id: CORRIDOR_ID,
      name: CORRIDOR_NAME,
      scope: CORRIDOR_SCOPE,
      definitionVersion: CORRIDOR_DEFINITION_VERSION,
      samplePointCount: segments.length,
    },
    segments: segments.map((segment) => ({
      segmentId: segment.segmentId,
      roadName: segment.roadName,
      geometryRef: segment.geometryRef,
      roadType: segment.roadType,
      latitude: segment.latitude,
      longitude: segment.longitude,
      order: segment.sortOrder,
    })),
  };
}
