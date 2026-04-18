"use client";

import { useCallback, useEffect, useState, useTransition } from "react";

import { MetricCard } from "@/components/metric-card";
import { StatusPill } from "@/components/status-pill";
import { readApi } from "@/components/traffic/api";
import { CongestionStack } from "@/components/traffic/congestion-stack";
import { CorridorMap } from "@/components/traffic/corridor-map";
import {
  formatDateTime,
  formatCongestionLabel,
  formatPercent,
  formatSpeed,
  getCongestionTone,
} from "@/components/traffic/format";
import { LoadingPanel } from "@/components/traffic/loading-panel";
import type { LatestTrafficPayload, TrafficSegmentPayload } from "@/lib/types/traffic";

function getSortedSegments(segments: TrafficSegmentPayload[]) {
  return [...segments].sort((a, b) => {
    const aObserved = a.observation ? 1 : 0;
    const bObserved = b.observation ? 1 : 0;

    if (aObserved !== bObserved) {
      return bObserved - aObserved;
    }

    return a.order - b.order;
  });
}

function SegmentRow({ segment }: { segment: TrafficSegmentPayload }) {
  const label = formatCongestionLabel(segment.observation?.congestionLabel);
  const tone = getCongestionTone(segment.observation?.congestionLabel);

  return (
    <tr className="border-b border-black/5 last:border-b-0">
      <td className="py-4 pr-4 align-top">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-950 text-sm font-black text-white">
            {segment.order}
          </span>
          <div>
            <p className="font-black text-slate-950">{segment.roadName}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-4 align-top">
        <StatusPill tone={tone}>{label}</StatusPill>
      </td>
      <td className="px-4 py-4 align-top text-sm font-bold text-slate-800">
        {formatSpeed(segment.observation?.speed)}
      </td>
      <td className="px-4 py-4 align-top text-sm font-bold text-slate-800">
        {formatPercent(segment.observation?.speedRatio)}
      </td>
      <td className="py-4 pl-4 align-top text-sm text-slate-600">
        {formatDateTime(segment.observation?.timestampUtc)}
      </td>
    </tr>
  );
}

function SegmentCard({ segment }: { segment: TrafficSegmentPayload }) {
  const label = formatCongestionLabel(segment.observation?.congestionLabel);
  const tone = getCongestionTone(segment.observation?.congestionLabel);

  return (
    <article className="rounded-3xl border border-black/10 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-950 text-sm font-black text-white">
            {segment.order}
          </span>
          <div>
            <h4 className="font-black leading-5 text-slate-950">{segment.roadName}</h4>
          </div>
        </div>
        <StatusPill tone={tone}>{label}</StatusPill>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-stone-50 p-3">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
            Speed
          </p>
          <p className="mt-1 text-sm font-black text-slate-950">
            {formatSpeed(segment.observation?.speed)}
          </p>
        </div>
        <div className="rounded-2xl bg-stone-50 p-3">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
            Clear-road %
          </p>
          <p className="mt-1 text-sm font-black text-slate-950">
            {formatPercent(segment.observation?.speedRatio)}
          </p>
        </div>
      </div>
      <p className="mt-3 text-xs font-bold text-slate-500">
        Updated {formatDateTime(segment.observation?.timestampUtc)}
      </p>
    </article>
  );
}

export function LiveCorridor() {
  const [latest, setLatest] = useState<LatestTrafficPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadLatest = useCallback(async () => {
    try {
      const payload = await readApi<LatestTrafficPayload>("/api/traffic/latest");
      startTransition(() => {
        setLatest(payload);
        setError(null);
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load current traffic.");
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      void loadLatest();
    }, 0);
    const interval = window.setInterval(() => {
      void loadLatest();
    }, 60_000);

    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
    };
  }, [loadLatest]);

  if (!latest && !error) {
    return <LoadingPanel title="Loading live map" message="Checking the latest traffic readings." />;
  }

  if (!latest) {
    return <LoadingPanel title="Live corridor unavailable" message={error ?? "No live response is available."} />;
  }

  const sortedSegments = getSortedSegments(latest.segments);

  return (
    <div className="space-y-8">
      <section className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <div>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-teal-900">
                Live corridor
              </p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                Current traffic from Victoria to Raml
              </h2>
              <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
                Live readings update from 7:00 AM to midnight Cairo time. After
                midnight, this page keeps showing the latest saved corridor
                reading until collection starts again.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadLatest()}
              disabled={isPending}
              className="w-full rounded-full border border-black/10 bg-white px-5 py-3 text-sm font-black text-slate-900 shadow-sm transition hover:bg-slate-950 hover:text-white disabled:opacity-60 sm:w-fit"
            >
              {isPending ? "Refreshing" : "Refresh"}
            </button>
          </div>
          <CorridorMap segments={latest.segments} />
        </div>
        <aside className="grid gap-4">
          <MetricCard
            label="Update status"
            value={
              latest.freshness.status === "fresh"
                ? "up to date"
                : latest.freshness.status === "stale"
                  ? "needs refresh"
                  : "waiting"
            }
            detail={`Latest reading: ${formatDateTime(latest.freshness.latestTimestampUtc)}`}
            tone={latest.freshness.status === "fresh" ? "green" : "amber"}
          />
          <MetricCard
            label="Coverage"
            value={`${latest.freshness.observedSegments}/${latest.corridor.samplePointCount}`}
            detail="Monitored areas with recent readings."
          />
          <MetricCard
            label="Clear-road comparison"
            value={formatPercent(latest.summary.averageSpeedRatio)}
            detail="100% means traffic is close to usual clear-road speed."
            tone={
              latest.summary.averageSpeedRatio === null
                ? "default"
                : latest.summary.averageSpeedRatio < 0.4
                  ? "red"
                  : latest.summary.averageSpeedRatio <= 0.7
                    ? "amber"
                    : "green"
            }
          />
        </aside>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.7fr_1.3fr]">
        <CongestionStack
          counts={latest.summary.congestionCounts}
          total={latest.freshness.observedSegments}
        />
        <div className="overflow-hidden rounded-[2rem] border border-black/10 bg-white/85 shadow-sm">
          <div className="border-b border-black/10 p-5">
            <h3 className="text-xl font-black text-slate-950">Area details</h3>
            <p className="mt-1 text-sm text-slate-600">
              Latest reading for each monitored area, ordered from Victoria to Raml.
            </p>
          </div>
          <div className="grid gap-3 p-4 md:hidden">
            {sortedSegments.map((segment) => (
              <SegmentCard key={segment.segmentId} segment={segment} />
            ))}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[760px] border-collapse text-left">
              <thead>
                <tr className="bg-stone-100 text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                  <th className="py-3 pr-4 pl-5">Area</th>
                  <th className="px-4 py-3">Congestion</th>
                  <th className="px-4 py-3">Speed</th>
                  <th className="px-4 py-3">Clear-road %</th>
                  <th className="py-3 pr-5 pl-4">Updated</th>
                </tr>
              </thead>
              <tbody>
                {sortedSegments.map((segment) => (
                  <SegmentRow key={segment.segmentId} segment={segment} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
