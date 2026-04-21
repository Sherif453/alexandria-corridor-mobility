"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import { MetricCard } from "@/components/metric-card";
import { StatusPill } from "@/components/status-pill";
import { readApi } from "@/components/traffic/api";
import {
  formatDateTime,
  formatCongestionLabel,
  getLiveWindowOrDefault,
  formatPercent,
  formatSpeed,
  getCongestionTone,
} from "@/components/traffic/format";
import { LoadingPanel } from "@/components/traffic/loading-panel";
import type {
  AggregatedTrafficHistoryPoint,
  TrafficHistoryPayload,
} from "@/lib/types/traffic";

type HistoryWindow = 24 | 72 | 168;
type Granularity = "hour" | "day";

type CorridorBucket = {
  bucketStartUtc: string;
  observationCount: number;
  averageSpeed: number | null;
  averageSpeedRatio: number | null;
  dominantClass: string;
};

function isAggregatedPoint(point: TrafficHistoryPayload["series"][number]): point is AggregatedTrafficHistoryPoint {
  return "bucketStartUtc" in point;
}

function average(values: Array<number | null>): number | null {
  const usableValues = values.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );

  if (usableValues.length === 0) {
    return null;
  }

  return usableValues.reduce((sum, value) => sum + value, 0) / usableValues.length;
}

function getDominantClass(counts: Record<string, number>) {
  const entries = Object.entries(counts);

  if (entries.length === 0) {
    return "Unknown";
  }

  return entries.sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Unknown";
}

function mergeCounts(points: AggregatedTrafficHistoryPoint[]) {
  return points.reduce<Record<string, number>>((merged, point) => {
    for (const [label, count] of Object.entries(point.congestionCounts)) {
      merged[label] = (merged[label] ?? 0) + count;
    }

    return merged;
  }, {});
}

export function buildCorridorBuckets(history: TrafficHistoryPayload): CorridorBucket[] {
  const aggregatedPoints = history.series.filter(isAggregatedPoint);
  const buckets = aggregatedPoints.reduce<Map<string, AggregatedTrafficHistoryPoint[]>>(
    (bucketMap, point) => {
      const current = bucketMap.get(point.bucketStartUtc) ?? [];
      current.push(point);
      bucketMap.set(point.bucketStartUtc, current);

      return bucketMap;
    },
    new Map(),
  );

  return Array.from(buckets.entries())
    .map(([bucketStartUtc, points]) => ({
      bucketStartUtc,
      observationCount: points.reduce((sum, point) => sum + point.observationCount, 0),
      averageSpeed: average(points.map((point) => point.averageSpeed)),
      averageSpeedRatio: average(points.map((point) => point.averageSpeedRatio)),
      dominantClass: getDominantClass(mergeCounts(points)),
    }))
    .sort((a, b) => a.bucketStartUtc.localeCompare(b.bucketStartUtc));
}

function TrendBars({ buckets }: { buckets: CorridorBucket[] }) {
  const maxSpeed = Math.max(
    1,
    ...buckets.map((bucket) => bucket.averageSpeed ?? 0).filter(Number.isFinite),
  );
  const roundedMaxSpeed = Math.max(10, Math.ceil(maxSpeed / 5) * 5);

  if (buckets.length === 0) {
    return (
      <div className="rounded-[2rem] border border-dashed border-black/20 bg-white/70 p-8 text-center">
        <p className="font-black text-slate-950">No history yet</p>
        <p className="mt-2 text-sm text-slate-600">
          The system is collecting traffic readings. This chart fills once enough readings are available.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[2rem] border border-black/10 bg-white/85 p-5 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-xl font-black text-slate-950">Corridor speed trend</h3>
          <p className="mt-1 text-sm text-slate-600">
            Each bar shows average speed for the selected time period.
          </p>
        </div>
        <StatusPill tone="slate">{buckets.length} periods</StatusPill>
      </div>
      <div className="mt-6 overflow-x-auto rounded-3xl bg-stone-100 p-4">
        <div className="relative min-w-[620px]">
          <div className="pointer-events-none absolute inset-x-0 top-0 bottom-10 flex flex-col justify-between">
            {[roundedMaxSpeed, roundedMaxSpeed / 2, 0].map((value) => (
              <div key={value} className="flex items-center gap-2">
                <span className="w-10 text-right text-[10px] font-black text-slate-400">
                  {Math.round(value)}
                </span>
                <span className="h-px flex-1 bg-black/5" />
              </div>
            ))}
          </div>
          <div
            className="relative grid h-72 items-end gap-2 pl-12"
            style={{ gridTemplateColumns: `repeat(${buckets.length}, minmax(28px, 1fr))` }}
          >
            {buckets.map((bucket) => {
              const speed = bucket.averageSpeed ?? 0;
              const height = `${Math.max(4, (speed / roundedMaxSpeed) * 100)}%`;
              const tone = getCongestionTone(bucket.dominantClass);
              const barColor =
                tone === "green"
                  ? "bg-emerald-700"
                  : tone === "amber"
                    ? "bg-amber-500"
                    : tone === "red"
                      ? "bg-red-700"
                      : "bg-slate-500";

              return (
                <div
                  key={bucket.bucketStartUtc}
                  className="group flex h-full min-w-7 flex-col items-center justify-end gap-2"
                  title={`${formatDateTime(bucket.bucketStartUtc)} | ${formatSpeed(
                    bucket.averageSpeed,
                  )}`}
                >
                  <div className="relative flex h-56 w-full items-end justify-center">
                    <span className="absolute -top-5 hidden whitespace-nowrap text-[10px] font-black text-slate-500 group-hover:block">
                      {formatSpeed(bucket.averageSpeed)}
                    </span>
                    <div
                      className={`w-full min-w-6 rounded-t-2xl ${barColor} shadow-sm transition group-hover:opacity-80`}
                      style={{ height }}
                    />
                  </div>
                  <span className="hidden max-w-14 rotate-[-35deg] truncate text-[10px] font-bold text-slate-500 sm:block">
                    {new Intl.DateTimeFormat("en-EG", {
                      hour: "2-digit",
                      day: "2-digit",
                      timeZone: "Africa/Cairo",
                    }).format(new Date(bucket.bucketStartUtc))}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function BucketTable({ buckets }: { buckets: CorridorBucket[] }) {
  return (
    <div className="overflow-hidden rounded-[2rem] border border-black/10 bg-white/85 shadow-sm">
      <div className="border-b border-black/10 p-5">
        <h3 className="text-xl font-black text-slate-950">Time period details</h3>
        <p className="mt-1 text-sm text-slate-600">
          Average corridor conditions for each time period.
        </p>
      </div>
      <div className="grid gap-3 p-4 md:hidden">
        {buckets.slice(-12).map((bucket) => (
          <article key={bucket.bucketStartUtc} className="rounded-3xl border border-black/10 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                  Period
                </p>
                <h4 className="mt-1 font-black text-slate-950">
                  {formatDateTime(bucket.bucketStartUtc)}
                </h4>
              </div>
              <StatusPill tone={getCongestionTone(bucket.dominantClass)}>
                {formatCongestionLabel(bucket.dominantClass)}
              </StatusPill>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <div className="rounded-2xl bg-stone-50 p-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                  Speed
                </p>
                <p className="mt-1 text-xs font-black text-slate-950">
                  {formatSpeed(bucket.averageSpeed)}
                </p>
              </div>
              <div className="rounded-2xl bg-stone-50 p-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                  Clear-road %
                </p>
                <p className="mt-1 text-xs font-black text-slate-950">
                  {formatPercent(bucket.averageSpeedRatio)}
                </p>
              </div>
              <div className="rounded-2xl bg-stone-50 p-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                  Readings
                </p>
                <p className="mt-1 text-xs font-black text-slate-950">
                  {bucket.observationCount}
                </p>
              </div>
            </div>
          </article>
        ))}
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead>
            <tr className="bg-stone-100 text-xs font-black uppercase tracking-[0.18em] text-slate-500">
              <th className="py-3 pr-4 pl-5">Period</th>
              <th className="px-4 py-3">Most common level</th>
              <th className="px-4 py-3">Avg speed</th>
              <th className="px-4 py-3">Clear-road %</th>
              <th className="py-3 pr-5 pl-4">Readings</th>
            </tr>
          </thead>
          <tbody>
            {buckets.slice(-24).map((bucket) => (
              <tr key={bucket.bucketStartUtc} className="border-b border-black/5 last:border-b-0">
                <td className="py-4 pr-4 pl-5 text-sm font-bold text-slate-800">
                  {formatDateTime(bucket.bucketStartUtc)}
                </td>
                <td className="px-4 py-4">
                  <StatusPill tone={getCongestionTone(bucket.dominantClass)}>
                    {formatCongestionLabel(bucket.dominantClass)}
                  </StatusPill>
                </td>
                <td className="px-4 py-4 text-sm font-bold text-slate-800">
                  {formatSpeed(bucket.averageSpeed)}
                </td>
                <td className="px-4 py-4 text-sm font-bold text-slate-800">
                  {formatPercent(bucket.averageSpeedRatio)}
                </td>
                <td className="py-4 pr-5 pl-4 text-sm text-slate-600">
                  {bucket.observationCount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function HistoryAnalytics() {
  const [hours, setHours] = useState<HistoryWindow>(24);
  const [granularity, setGranularity] = useState<Granularity>("hour");
  const [history, setHistory] = useState<TrafficHistoryPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadHistory = useCallback(async () => {
    try {
      const payload = await readApi<TrafficHistoryPayload>(
        `/api/traffic/history?hours=${hours}&granularity=${granularity}`,
      );

      startTransition(() => {
        setHistory(payload);
        setError(null);
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load history.");
    }
  }, [granularity, hours]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      void loadHistory();
    }, 0);

    return () => window.clearTimeout(initialLoad);
  }, [loadHistory]);

  const buckets = useMemo(() => (history ? buildCorridorBuckets(history) : []), [history]);

  if (!history && !error) {
    return <LoadingPanel title="Loading history" message="Preparing traffic history." />;
  }

  if (!history) {
    return <LoadingPanel title="History unavailable" message={error ?? "No history response is available."} />;
  }
  const liveWindow = getLiveWindowOrDefault(history.liveWindow);

  return (
    <div className="space-y-8">
      <section className="rounded-[2.5rem] border border-black/10 bg-[#fdf8ed] p-6 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-teal-900">
              Traffic history
            </p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                How traffic changed over time
              </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              Review speed and congestion patterns for the selected time window.
              New live readings are collected daily from{" "}
              {liveWindow.activeFromLocal} to midnight Cairo time.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[24, 72, 168].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setHours(value as HistoryWindow)}
                className={`rounded-full px-4 text-sm font-black transition ${
                  hours === value
                    ? "bg-slate-950 py-3 text-white"
                    : "border border-black/10 bg-white py-3 text-slate-800 hover:bg-slate-100"
                }`}
              >
                {value === 24 ? "24h" : value === 72 ? "3d" : "7d"}
              </button>
            ))}
            {(["hour", "day"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setGranularity(value)}
                className={`rounded-full px-4 text-sm font-black capitalize transition ${
                  granularity === value
                    ? "bg-teal-900 py-3 text-white"
                    : "border border-black/10 bg-white py-3 text-slate-800 hover:bg-slate-100"
                }`}
              >
                {value}
              </button>
            ))}
            <button
              type="button"
              onClick={() => void loadHistory()}
              disabled={isPending}
              className="rounded-full border border-black/10 bg-white px-4 py-3 text-sm font-black text-slate-800 transition hover:bg-slate-950 hover:text-white disabled:opacity-60"
            >
              {isPending ? "Refreshing" : "Refresh"}
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-4">
        <MetricCard
          label="Readings"
          value={String(history.summary.observationCount)}
          detail={`${history.summary.segmentCount} monitored areas in scope.`}
        />
        <MetricCard
          label="Average speed"
          value={formatSpeed(history.summary.averageSpeed)}
          detail="Mean speed across the selected historical window."
          tone="green"
        />
        <MetricCard
          label="Clear-road comparison"
          value={formatPercent(history.summary.averageSpeedRatio)}
          detail="How close traffic was to usual clear-road speed."
        />
        <MetricCard
          label="Latest reading"
          value={formatDateTime(history.summary.latestTimestampUtc)}
          detail="Most recent reading in this view."
        />
      </section>

      <TrendBars buckets={buckets} />
      <BucketTable buckets={buckets} />
    </div>
  );
}
