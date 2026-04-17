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

export type PredictionPayload = {
  id: string;
  segmentId: string;
  timestampUtc: string;
  predictedLabel: string;
  confidence: number | null;
  modelVersion: string;
  createdAt: string;
};

export type PredictionSegmentPayload = {
  segmentId: string;
  roadName: string;
  roadType: string | null;
  latitude: number | null;
  longitude: number | null;
  order: number;
  prediction: PredictionPayload | null;
  latestObservation: TrafficObservationPayload | null;
};

export type LatestPredictionsPayload = {
  corridor: CorridorPayload;
  generatedAtUtc: string;
  model: {
    version: string | null;
    runId: string | null;
    modelName: string | null;
    artifactPath: string | null;
    createdAt: string | null;
    warnings: string[];
  };
  freshness: {
    status: "fresh" | "stale" | "empty";
    latestPredictionTimestampUtc: string | null;
    predictedSegments: number;
    missingSegments: number;
  };
  summary: {
    predictionCounts: Record<string, number>;
    averageConfidence: number | null;
    lowConfidenceCount: number;
    currentCongestionCounts: Record<string, number>;
  };
  segments: PredictionSegmentPayload[];
};

export type PredictionTrendSegmentPayload = {
  segmentId: string;
  roadName: string;
  order: number;
  latestFeatureTimestampUtc: string | null;
  latestObservedLabel: string | null;
  predictedLabel: string | null;
  confidence: number | null;
  speedChangeRate: number | null;
  recentAverageSpeed: number | null;
  trend: "improving" | "stable" | "worsening" | "uncertain";
  reason: string;
};

export type PredictionTrendPayload = {
  corridor: CorridorPayload;
  generatedAtUtc: string;
  modelVersion: string | null;
  summary: {
    improving: number;
    stable: number;
    worsening: number;
    uncertain: number;
    averageConfidence: number | null;
  };
  segments: PredictionTrendSegmentPayload[];
};

export type InsightPayload = {
  id: string;
  title: string;
  severity: "info" | "watch" | "warning";
  body: string;
  evidence: string;
};

export type InsightsPayload = {
  corridor: CorridorPayload;
  generatedAtUtc: string;
  modelVersion: string | null;
  dataQuality: {
    status: "ready" | "limited" | "missing";
    message: string;
  };
  insights: InsightPayload[];
};

export type ScenarioMetricPayload = {
  name: string;
  label: string;
  unit: "seconds" | "meters" | "vehicles" | "percent";
  higherIsBetter: boolean;
  description: string;
  value: number;
  baselineValue: number | null;
  delta: number | null;
  deltaPercent: number | null;
};

export type ScenarioSummaryPayload = {
  id: string;
  name: string;
  type: "baseline" | "disruption" | "mitigation";
  typeLabel: string;
  summary: string;
  assumptions: string[];
  status: "ready" | "missing";
  artifactPath: string | null;
  durationSeconds: number | null;
  createdAtUtc: string | null;
  headline: {
    averageTravelTimeSeconds: number | null;
    averageDelaySeconds: number | null;
    maxQueueLengthMeters: number | null;
    relativeTravelTimeChangePercent: number | null;
  };
  metrics: ScenarioMetricPayload[];
};

export type ScenarioListPayload = {
  generatedAtUtc: string;
  latestVersion: string | null;
  status: "ready" | "missing";
  message: string;
  scenarios: ScenarioSummaryPayload[];
};

export type ScenarioDetailPayload = {
  generatedAtUtc: string;
  latestVersion: string | null;
  scenario: ScenarioSummaryPayload;
  baseline: ScenarioSummaryPayload | null;
};

export type AdminRefreshPayload = {
  generatedAtUtc: string;
  action: "ingest" | "features" | "predictions" | "scenarios" | "all";
  status: "completed";
  steps: Array<{
    name: string;
    command: string;
    durationMs: number;
    outputTail: string;
  }>;
};
