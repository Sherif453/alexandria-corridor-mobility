import type { InsightPayload } from "@/lib/types/traffic";
import {
  getLatestPredictionsPayload,
  getPredictionTrendPayload,
} from "@/lib/services/prediction-service";

function formatPercent(value: number | null): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "not enough data";
  }

  return `${Math.round(value * 100)}%`;
}

function getDataQuality(params: {
  modelVersion: string | null;
  predictedSegments: number;
  totalSegments: number;
  warnings: string[];
}) {
  if (!params.modelVersion || params.predictedSegments === 0) {
    return {
      status: "missing" as const,
      message: "Next-15-minute congestion results are not ready yet.",
    };
  }

  if (params.warnings.length > 0 || params.predictedSegments < params.totalSegments) {
    return {
      status: "limited" as const,
      message: "The app has next-15-minute results, but they will become stronger as more days are collected.",
    };
  }

  return {
    status: "ready" as const,
    message: "Next-15-minute results are available for all monitored areas.",
  };
}

export async function getInsightsPayload() {
  const [latest, trend] = await Promise.all([
    getLatestPredictionsPayload(),
    getPredictionTrendPayload(),
  ]);
  const insights: InsightPayload[] = [];
  const totalSegments = latest.corridor.samplePointCount;
  const highPredictions = latest.segments.filter(
    (segment) => segment.prediction?.predictedLabel === "High",
  );
  const mediumPredictions = latest.segments.filter(
    (segment) => segment.prediction?.predictedLabel === "Medium",
  );
  const lowConfidenceSegments = latest.segments.filter(
    (segment) =>
      segment.prediction?.confidence !== null &&
      segment.prediction?.confidence !== undefined &&
      segment.prediction.confidence < 0.55,
  );
  const worseningSegments = trend.segments.filter((segment) => segment.trend === "worsening");
  const improvingSegments = trend.segments.filter((segment) => segment.trend === "improving");
  const dataQuality = getDataQuality({
    modelVersion: latest.model.version,
    predictedSegments: latest.freshness.predictedSegments,
    totalSegments,
    warnings: latest.model.warnings,
  });

  if (highPredictions.length > 0) {
    const names = highPredictions
      .slice(0, 4)
      .map((segment) => segment.roadName)
      .join(", ");

    insights.push({
      id: "high-risk-segments",
      title: "Heavy congestion may appear soon",
      severity: "warning",
      body: `${highPredictions.length} monitored area${highPredictions.length === 1 ? "" : "s"} may reach heavy congestion in the next 15 minutes.`,
      evidence: `Check ${names} first.`,
    });
  } else if (mediumPredictions.length > 0) {
    insights.push({
      id: "medium-risk-segments",
      title: "Moderate congestion is the main thing to watch",
      severity: "watch",
      body: `${mediumPredictions.length} monitored area${mediumPredictions.length === 1 ? "" : "s"} may be moderately congested in the next 15 minutes.`,
      evidence: `The app is about ${formatPercent(latest.summary.averageConfidence)} sure overall.`,
    });
  } else {
    insights.push({
      id: "low-risk-corridor",
      title: "No major congestion is expected soon",
      severity: "info",
      body: "The next-15-minute results do not show medium or heavy congestion right now.",
      evidence: `${latest.freshness.predictedSegments} of ${totalSegments} monitored areas have next-15-minute results.`,
    });
  }

  if (worseningSegments.length > 0) {
    const names = worseningSegments
      .slice(0, 4)
      .map((segment) => segment.roadName)
      .join(", ");

    insights.push({
      id: "worsening-trend",
      title:
        worseningSegments.length === 1
          ? "Congestion may get worse in one area"
          : "Congestion may get worse in several areas",
      severity: "watch",
      body: `${worseningSegments.length} monitored area${worseningSegments.length === 1 ? " is" : "s are"} expected to move to heavier congestion in the next 15 minutes.`,
      evidence: `Watch ${names}. Worsening means the expected level is heavier than the current level.`,
    });
  } else if (improvingSegments.length > 0) {
    insights.push({
      id: "improving-trend",
      title:
        improvingSegments.length === 1
          ? "Congestion may ease in one area"
          : "Congestion may ease in some areas",
      severity: "info",
      body: `${improvingSegments.length} monitored area${improvingSegments.length === 1 ? " is" : "s are"} expected to move to lighter congestion in the next 15 minutes.`,
      evidence: "Improving means the expected level is lighter than the current level.",
    });
  }

  if (lowConfidenceSegments.length > 0) {
    insights.push({
      id: "low-confidence",
      title: "Some areas need extra caution",
      severity: "watch",
      body: `The app is less sure about ${lowConfidenceSegments.length} area${lowConfidenceSegments.length === 1 ? "" : "s"}.`,
      evidence: "Use these results as guidance, not certainty.",
    });
  }

  if (latest.model.warnings.length > 0) {
    insights.push({
      id: "model-limitations",
      title: "The app is still learning this corridor",
      severity: "watch",
      body: "The first days of results are useful, but reliability improves after more traffic days are collected.",
      evidence: "Keep checking the next-15-minute page, especially during rush hours.",
    });
  }

  return {
    corridor: latest.corridor,
    generatedAtUtc: new Date().toISOString(),
    modelVersion: latest.model.version,
    dataQuality,
    insights,
  };
}
