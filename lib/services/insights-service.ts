import type { InsightPayload } from "@/lib/types/traffic";
import {
  getLatestPredictionsPayload,
  getPredictionTrendPayload,
} from "@/lib/services/prediction-service";

function formatPercent(value: number | null): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "no confidence data";
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
      message: "No persisted predictions are available yet. Generate predictions after training a model.",
    };
  }

  if (params.warnings.length > 0 || params.predictedSegments < params.totalSegments) {
    return {
      status: "limited" as const,
      message: "Predictions are available, but the current model should be treated as preliminary.",
    };
  }

  return {
    status: "ready" as const,
    message: "Predictions are available for all monitored sample points.",
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
      title: "Heavy congestion risk appears in the forecast",
      severity: "warning",
      body: `${highPredictions.length} monitored point${highPredictions.length === 1 ? "" : "s"} are forecast as heavy congestion in the next horizon.`,
      evidence: `Highest-risk points include ${names}.`,
    });
  } else if (mediumPredictions.length > 0) {
    insights.push({
      id: "medium-risk-segments",
      title: "Moderate congestion is the main forecast risk",
      severity: "watch",
      body: `${mediumPredictions.length} monitored point${mediumPredictions.length === 1 ? "" : "s"} are forecast as moderate congestion.`,
      evidence: `Current model confidence averages ${formatPercent(latest.summary.averageConfidence)}.`,
    });
  } else {
    insights.push({
      id: "low-risk-corridor",
      title: "Forecast is currently low-risk",
      severity: "info",
      body: "The latest prediction set does not contain medium or heavy congestion classes.",
      evidence: `${latest.freshness.predictedSegments} of ${totalSegments} monitored points have persisted predictions.`,
    });
  }

  if (worseningSegments.length > 0) {
    const names = worseningSegments
      .slice(0, 4)
      .map((segment) => segment.roadName)
      .join(", ");

    insights.push({
      id: "worsening-trend",
      title: "Several points are trending worse",
      severity: "watch",
      body: `${worseningSegments.length} monitored point${worseningSegments.length === 1 ? "" : "s"} show a worsening near-term trend.`,
      evidence: `Watch ${names}.`,
    });
  } else if (improvingSegments.length > 0) {
    insights.push({
      id: "improving-trend",
      title: "Some points are improving",
      severity: "info",
      body: `${improvingSegments.length} monitored point${improvingSegments.length === 1 ? "" : "s"} show improving near-term conditions.`,
      evidence: "Trend compares the latest observed feature state with the next-horizon prediction.",
    });
  }

  if (lowConfidenceSegments.length > 0) {
    insights.push({
      id: "low-confidence",
      title: "Some predictions need caution",
      severity: "watch",
      body: `${lowConfidenceSegments.length} prediction${lowConfidenceSegments.length === 1 ? "" : "s"} have confidence below 55%.`,
      evidence: "Low-confidence predictions should be shown as guidance, not certainty.",
    });
  }

  if (latest.model.warnings.length > 0) {
    insights.push({
      id: "model-limitations",
      title: "Model is still in early-data mode",
      severity: "watch",
      body: "The trained model reports data limitations that should be visible in the product.",
      evidence: latest.model.warnings[0],
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
