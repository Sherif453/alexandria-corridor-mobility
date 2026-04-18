"use client";

import { useCallback, useEffect, useState, useTransition } from "react";

import { MetricCard } from "@/components/metric-card";
import { StatusPill } from "@/components/status-pill";
import { CorridorMap } from "@/components/traffic/corridor-map";
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

function formatFreshnessText(status: LatestPredictionsPayload["freshness"]["status"]) {
  if (status === "fresh") {
    return "up to date";
  }

  if (status === "stale") {
    return "needs refresh";
  }

  return "not ready";
}

function formatAreaCount(count: number) {
  return `${count} area${count === 1 ? "" : "s"}`;
}

function TrendCard({ segment }: { segment: PredictionTrendSegmentPayload }) {
  return (
    <article className="rounded-3xl border border-black/10 bg-white/85 p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
            Area {segment.order}
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
            Next 15 minutes
          </p>
          <p className="mt-1 font-black text-slate-950">
            {formatCongestionLabel(segment.predictedLabel)}
          </p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
            How sure
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
        loadError instanceof Error
          ? loadError.message
          : "Unable to load next-15-minute results.",
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
        title="Loading next 15 minutes"
        message="Checking the latest expected congestion levels."
      />
    );
  }

  if (!state) {
    return (
      <LoadingPanel
        title="Next 15 minutes unavailable"
        message={error ?? "The page could not load the latest expected congestion levels."}
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
  const predictionMapSegments = latest.segments.map((segment) => ({
    segmentId: segment.segmentId,
    roadName: segment.roadName,
    latitude: segment.latitude,
    longitude: segment.longitude,
    order: segment.order,
    observation: null,
  }));
  const predictionCongestionBySegmentId = Object.fromEntries(
    latest.segments.map((segment) => [
      segment.segmentId,
      segment.prediction?.predictedLabel ?? null,
    ]),
  );
  const predictionPopupDetailBySegmentId = Object.fromEntries(
    latest.segments.map((segment) => [
      segment.segmentId,
      `Current ${formatCongestionLabel(
        segment.latestObservation?.congestionLabel,
      )}; expected ${formatCongestionLabel(segment.prediction?.predictedLabel)}; sure ${formatPercent(
        segment.prediction?.confidence,
      )}`,
    ]),
  );

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-black/10 bg-[#101820] p-5 text-white shadow-xl sm:rounded-[2.5rem] sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <StatusPill tone={getFreshnessTone(latest.freshness.status)}>
              {formatFreshnessText(latest.freshness.status)}
            </StatusPill>
            <h2 className="mt-5 max-w-3xl text-4xl font-black leading-tight tracking-tight sm:text-6xl">
              Congestion expected in the next 15 minutes.
            </h2>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-stone-200">
              This page shows each monitored area from Victoria to Raml, compares
              the current congestion level with the expected level in the next
              15-minute window, and highlights where traffic may get worse.
              These results update from 7:00 AM to midnight Cairo time.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadPredictions()}
            disabled={isPending}
            className="w-full rounded-full border border-white/20 px-5 py-3 text-sm font-black text-white transition hover:bg-white hover:text-slate-950 disabled:opacity-60 sm:w-fit"
          >
            {isPending ? "Refreshing" : "Refresh"}
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Areas checked"
          value={`${predictedSegments}/${totalSegments}`}
          detail="Monitored areas with a next-15-minute result."
          tone={predictedSegments === totalSegments ? "green" : "amber"}
        />
        <MetricCard
          label="Next 15 minutes"
          value={`${highCount} high congestion / ${mediumCount} medium congestion`}
          detail="Expected congestion levels for the coming 15-minute window."
          tone={highCount > 0 ? "red" : mediumCount > 0 ? "amber" : "green"}
        />
        <MetricCard
          label="How sure overall"
          value={formatPercent(latest.summary.averageConfidence)}
          detail={`${formatAreaCount(latest.summary.lowConfidenceCount)} need extra caution.`}
        />
        <MetricCard
          label="Last updated"
          value={formatDateTime(latest.freshness.latestPredictionTimestampUtc)}
          detail="Latest calculation from the daily 7:00 AM to midnight live window."
        />
      </section>

      {latest.model.warnings.length > 0 ? (
        <section className="rounded-[2rem] border border-amber-700/20 bg-amber-50 p-5 shadow-sm">
          <StatusPill tone="amber">early data notice</StatusPill>
          <h3 className="mt-4 text-xl font-black text-slate-950">
            Results will get stronger as more days are collected
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            The app is already using real collected traffic data, but the first
            days of predictions should be treated as guidance rather than certainty.
          </p>
        </section>
      ) : null}

      <section className="space-y-4">
        <div>
          <h3 className="text-2xl font-black text-slate-950">
            Map of expected congestion
          </h3>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
            This uses the same corridor map as the live page, but each marker
            shows the congestion level expected in the next 15 minutes.
          </p>
        </div>
        <CorridorMap
          segments={predictionMapSegments}
          congestionBySegmentId={predictionCongestionBySegmentId}
          popupDetailBySegmentId={predictionPopupDetailBySegmentId}
          popupLabel="Next 15 minutes"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[2rem] border border-black/10 bg-white/80 p-5 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-xl font-black text-slate-950">Areas to check first</h3>
            <StatusPill tone="slate">next 15 minutes</StatusPill>
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
                        Area {segment.order}
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
                    Next 15 minutes:{" "}
                    {formatCongestionLabel(segment.prediction?.predictedLabel)}.
                    Current level:{" "}
                    {formatCongestionLabel(segment.latestObservation?.congestionLabel)}.
                    The app is {formatPercent(segment.prediction?.confidence)} sure.
                  </p>
                </div>
              ))
            ) : (
              <p className="rounded-3xl border border-dashed border-black/15 p-5 text-sm leading-6 text-slate-600">
                Next-15-minute results are not ready yet. Check again after the
                next system update.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-[2rem] border border-black/10 bg-white/80 p-5 shadow-sm">
          <h3 className="text-xl font-black text-slate-950">What is changing soon</h3>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <MetricCard
              label="Improving"
              value={String(trend.summary.improving)}
              detail="Expected to move to lighter congestion."
              tone="green"
            />
            <MetricCard
              label="Stable"
              value={String(trend.summary.stable)}
              detail="Expected to stay at the current level."
            />
            <MetricCard
              label="Worsening"
              value={String(trend.summary.worsening)}
              detail="Expected to move to heavier congestion."
              tone={trend.summary.worsening > 0 ? "red" : "default"}
            />
            <MetricCard
              label="Uncertain"
              value={String(trend.summary.uncertain)}
              detail="Not enough current information."
              tone={trend.summary.uncertain > 0 ? "amber" : "default"}
            />
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-black/10 bg-white/80 p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-xl font-black text-slate-950">How to read this page</h3>
          <p className="text-sm font-semibold text-slate-600">
            The app compares now with the next 15 minutes.
          </p>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <TrendDefinitionCard
            label="Improving"
            tone="green"
            description="Traffic is expected to move to a lighter congestion level."
          />
          <TrendDefinitionCard
            label="Stable"
            tone="slate"
            description="Traffic is expected to stay at the same congestion level."
          />
          <TrendDefinitionCard
            label="Worsening"
            tone="red"
            description="Traffic is expected to move to a heavier congestion level."
          />
          <TrendDefinitionCard
            label="Uncertain"
            tone="amber"
            description="The app does not have enough recent information for this area."
          />
        </div>
      </section>

      <section className="rounded-[2rem] border border-black/10 bg-[#fdf8ed] p-5 shadow-sm">
        <h3 className="text-xl font-black text-slate-950">What the levels mean</h3>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-3xl bg-emerald-50 p-4">
            <StatusPill tone="green">Low congestion</StatusPill>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-700">
              Traffic is moving close to its usual clear-road speed.
            </p>
          </div>
          <div className="rounded-3xl bg-amber-50 p-4">
            <StatusPill tone="amber">Medium congestion</StatusPill>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-700">
              Traffic is noticeably slower, so delays are more likely.
            </p>
          </div>
          <div className="rounded-3xl bg-red-50 p-4">
            <StatusPill tone="red">High congestion</StatusPill>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-700">
              Traffic is much slower than usual and should be treated as a problem area.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-2xl font-black text-slate-950">All monitored areas</h3>
          <p className="text-sm font-semibold text-slate-600">
            Current level compared with the next 15 minutes
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
