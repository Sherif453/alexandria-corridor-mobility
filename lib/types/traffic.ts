export type ApiEnvelope<T> =
  | {
      status: "ok";
      data: T;
    }
  | {
      status: "error";
      error: {
        code: string;
        message: string;
      };
    };

export type CorridorPayload = {
  id: string;
  name: string;
  scope: string;
  definitionVersion: string;
  samplePointCount: number;
};

export type TrafficObservationPayload = {
  id: string;
  segmentId: string;
  timestampUtc: string;
  speed: number | null;
  freeFlowSpeed: number | null;
  speedRatio: number | null;
  congestionLabel: string | null;
  source: string;
  qualityStatus: string | null;
  ingestionRunId: string | null;
};

export type TrafficSegmentPayload = {
  segmentId: string;
  roadName: string;
  geometryRef: string | null;
  roadType: string | null;
  latitude: number | null;
  longitude: number | null;
  order: number;
  observation: TrafficObservationPayload | null;
};

export type LatestTrafficPayload = {
  corridor: CorridorPayload;
  generatedAtUtc: string;
  freshness: {
    status: "fresh" | "stale" | "empty";
    latestTimestampUtc: string | null;
    observedSegments: number;
    missingSegments: number;
  };
  summary: {
    averageSpeed: number | null;
    averageFreeFlowSpeed: number | null;
    averageSpeedRatio: number | null;
    congestionCounts: Record<string, number>;
  };
  segments: TrafficSegmentPayload[];
};

export type RawTrafficHistoryPoint = TrafficObservationPayload;

export type AggregatedTrafficHistoryPoint = {
  bucketStartUtc: string;
  segmentId: string;
  observationCount: number;
  averageSpeed: number | null;
  averageFreeFlowSpeed: number | null;
  averageSpeedRatio: number | null;
  congestionCounts: Record<string, number>;
};

export type TrafficHistoryPayload = {
  corridor: CorridorPayload;
  generatedAtUtc: string;
  query: {
    segmentId: string | null;
    hours: number;
    granularity: "raw" | "hour" | "day";
  };
  range: {
    fromUtc: string;
    toUtc: string;
  };
  summary: {
    observationCount: number;
    segmentCount: number;
    latestTimestampUtc: string | null;
    averageSpeed: number | null;
    averageFreeFlowSpeed: number | null;
    averageSpeedRatio: number | null;
    congestionCounts: Record<string, number>;
  };
  series: Array<RawTrafficHistoryPoint | AggregatedTrafficHistoryPoint>;
};
