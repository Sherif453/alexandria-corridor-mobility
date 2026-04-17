"use client";

import { useCallback, useEffect, useState, useTransition } from "react";

import { MetricCard } from "@/components/metric-card";
import { StatusPill } from "@/components/status-pill";
import { readApi } from "@/components/traffic/api";
import {
  formatCongestionLabel,
  formatDateTime,
  formatPercent,
  getCongestionTone,
} from "@/components/traffic/format";
import { LoadingPanel } from "@/components/traffic/loading-panel";
import type {
  LatestPredictionsPayload,
  PredictionTrendPayload,
  PredictionTrendSegmentPayload,
} from "@/lib/types/traffic";

type PredictionDashboardState = {
  latest: LatestPredictionsPayload;
  trend: PredictionTrendPayload;
};

const trendTone = {
  improving: "green",
  stable: "slate",
  worsening: "red",
  uncertain: "amber",
} as const;

function getFreshnessTone(status: LatestPredictionsPayload["freshness"]["status"]) {
  if (status === "fresh") {
    return "green" as const;
  }

  if (status === "stale") {
    return "amber" as const;
  }

  return "slate" as const;
}

function TrendDefinitionCard({
  label,
  tone,
  description,
}: {
  label: string;
  tone: "green" | "slate" | "red" | "amber";
  description: string;
}) {
  return (
    <div className="rounded-3xl border border-black/10 bg-stone-50 p-4">
      <StatusPill tone={tone}>{label}</StatusPill>
      <p className="mt-3 text-sm font-semibold leading-6 text-slate-700">
        {description}
      </p>
    </div>
  );
}

function TrendCard({ segment }: { segment: PredictionTrendSegmentPayload }) {
  return (
    <article className="rounded-3xl border border-black/10 bg-white/85 p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
            Point {segment.order}
          </p>
          <h3 className="mt-1 text-lg font-black text-slate-950">{segment.roadName}</h3>
        </div>
        <StatusPill tone={trendTone[segment.trend]}>{segment.trend}</StatusPill>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
            Current
          </p>
          <p className="mt-1 font-black text-slate-950">
            {formatCongestionLabel(segment.latestObservedLabel)}
          </p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
            Forecast
          </p>
          <p className="mt-1 font-black text-slate-950">
            {formatCongestionLabel(segment.predictedLabel)}
          </p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
            Confidence
          </p>
          <p className="mt-1 font-black text-slate-950">{formatPercent(segment.confidence)}</p>
        </div>
      </div>
      <p className="mt-4 text-sm leading-6 text-slate-600">{segment.reason}</p>
    </article>
  );
}

export function PredictionDashboard() {
  const [state, setState] = useState<PredictionDashboardState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadPredictions = useCallback(async () => {
    try {
      const [latest, trend] = await Promise.all([
        readApi<LatestPredictionsPayload>("/api/predictions/latest"),
        readApi<PredictionTrendPayload>("/api/predictions/trend"),
      ]);

      startTransition(() => {
        setState({ latest, trend });
        setError(null);
      });
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Unable to load predictions.",
      );
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      void loadPredictions();
    }, 0);
    const interval = window.setInterval(() => {
      void loadPredictions();
    }, 60_000);

    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
    };
  }, [loadPredictions]);

  if (!state && !error) {
    return (
      <LoadingPanel
        title="Loading predictions"
        message="Reading persisted model forecasts from the backend."
      />
    );
  }

  if (!state) {
    return (
      <LoadingPanel
        title="Predictions unavailable"
        message={error ?? "The prediction page could not load."}
      />
    );
  }

  const { latest, trend } = state;
  const predictedSegments = latest.freshness.predictedSegments;
  const totalSegments = latest.corridor.samplePointCount;
  const highCount = latest.summary.predictionCounts.High ?? 0;
  const mediumCount = latest.summary.predictionCounts.Medium ?? 0;
  const leadingSegments = latest.segments
    .filter((segment) => segment.prediction)
    .sort((left, right) => {
      const leftScore =
        left.prediction?.predictedLabel === "High"
          ? 2
          : left.prediction?.predictedLabel === "Medium"
            ? 1
            : 0;
      const rightScore =
        right.prediction?.predictedLabel === "High"
          ? 2
          : right.prediction?.predictedLabel === "Medium"
            ? 1
            : 0;

      if (rightScore !== leftScore) {
        return rightScore - leftScore;
      }

      return (right.prediction?.confidence ?? 0) - (left.prediction?.confidence ?? 0);
    })
    .slice(0, 8);

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-black/10 bg-[#101820] p-5 text-white shadow-xl sm:rounded-[2.5rem] sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <StatusPill tone={getFreshnessTone(latest.freshness.status)}>
              {latest.freshness.status}
            </StatusPill>
            <h2 className="mt-5 max-w-3xl text-4xl font-black leading-tight tracking-tight sm:text-6xl">
              Next-horizon congestion forecast.
            </h2>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-stone-200">
              Forecasts are generated from stored feature snapshots and persisted
              model artifacts. Confidence is model confidence, not a guarantee.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadPredictions()}
            disabled={isPending}
            className="rounded-full border border-white/20 px-5 py-3 text-sm font-black text-white transition hover:bg-white hover:text-slate-950 disabled:opacity-60"
          >
            {isPending ? "Refreshing" : "Refresh"}
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Predicted points"
          value={`${predictedSegments}/${totalSegments}`}
          detail="Segments with persisted next-horizon forecasts."
          tone={predictedSegments === totalSegments ? "green" : "amber"}
        />
        <MetricCard
          label="Risk forecast"
          value={`${highCount} high / ${mediumCount} medium`}
          detail="Predicted congestion classes for the latest forecast set."
          tone={highCount > 0 ? "red" : mediumCount > 0 ? "amber" : "green"}
        />
        <MetricCard
          label="Avg confidence"
          value={formatPercent(latest.summary.averageConfidence)}
          detail={`${latest.summary.lowConfidenceCount} predictions are below 55% confidence.`}
        />
        <MetricCard
          label="Forecast time"
          value={formatDateTime(latest.freshness.latestPredictionTimestampUtc)}
          detail={latest.model.version ?? "No model version available."}
        />
      </section>

      {latest.model.warnings.length > 0 ? (
        <section className="rounded-[2rem] border border-amber-700/20 bg-amber-50 p-5 shadow-sm">
          <StatusPill tone="amber">model caveat</StatusPill>
          <h3 className="mt-4 text-xl font-black text-slate-950">
            Current model is preliminary
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            {latest.model.warnings[0]}
          </p>
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[2rem] border border-black/10 bg-white/80 p-5 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-xl font-black text-slate-950">Highest-priority points</h3>
            <StatusPill tone="slate">latest model</StatusPill>
          </div>
          <div className="mt-5 grid gap-3">
            {leadingSegments.length > 0 ? (
              leadingSegments.map((segment) => (
                <div
                  key={segment.segmentId}
                  className="rounded-3xl border border-black/10 bg-stone-50 p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                        Point {segment.order}
                      </p>
                      <p className="mt-1 text-lg font-black text-slate-950">
                        {segment.roadName}
                      </p>
                    </div>
                    <StatusPill tone={getCongestionTone(segment.prediction?.predictedLabel)}>
                      {formatCongestionLabel(segment.prediction?.predictedLabel)}
                    </StatusPill>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    Confidence {formatPercent(segment.prediction?.confidence)}.
                    Current observed state is{" "}
                    {formatCongestionLabel(segment.latestObservation?.congestionLabel)}.
                  </p>
                </div>
              ))
            ) : (
              <p className="rounded-3xl border border-dashed border-black/15 p-5 text-sm leading-6 text-slate-600">
                No prediction rows are available yet. Run `npm run predictions:generate`
                after training a model.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-[2rem] border border-black/10 bg-white/80 p-5 shadow-sm">
          <h3 className="text-xl font-black text-slate-950">Trend summary</h3>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <MetricCard
              label="Improving"
              value={String(trend.summary.improving)}
              detail="Predicted congestion class is lower than the latest observed class."
              tone="green"
            />
            <MetricCard
              label="Stable"
              value={String(trend.summary.stable)}
              detail="Predicted congestion class is the same as the latest observed class."
            />
            <MetricCard
              label="Worsening"
              value={String(trend.summary.worsening)}
              detail="Predicted congestion class is higher than the latest observed class."
              tone={trend.summary.worsening > 0 ? "red" : "default"}
            />
            <MetricCard
              label="Uncertain"
              value={String(trend.summary.uncertain)}
              detail="Current observation or prediction is missing."
              tone={trend.summary.uncertain > 0 ? "amber" : "default"}
            />
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-black/10 bg-white/80 p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-xl font-black text-slate-950">What trend means</h3>
          <p className="text-sm font-semibold text-slate-600">
            Trend is based on congestion class movement, not speed alone.
          </p>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <TrendDefinitionCard
            label="Improving"
            tone="green"
            description="Congestion is forecast to decrease, for example Medium to Low or High to Medium."
          />
          <TrendDefinitionCard
            label="Stable"
            tone="slate"
            description="Congestion is forecast to stay in the same class. Speed may move, but the class is unchanged."
          />
          <TrendDefinitionCard
            label="Worsening"
            tone="red"
            description="Congestion is forecast to increase, for example Low to Medium or Medium to High."
          />
          <TrendDefinitionCard
            label="Uncertain"
            tone="amber"
            description="The app cannot classify the trend because the current observation or prediction is missing."
          />
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-2xl font-black text-slate-950">Segment trend details</h3>
          <p className="text-sm font-semibold text-slate-600">
            Current class vs next-horizon prediction
          </p>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {trend.segments.map((segment) => (
            <TrendCard key={segment.segmentId} segment={segment} />
          ))}
        </div>
      </section>
    </div>
  );
}
