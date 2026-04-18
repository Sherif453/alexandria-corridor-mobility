"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";

import { MetricCard } from "@/components/metric-card";
import { StatusPill } from "@/components/status-pill";
import { readApi } from "@/components/traffic/api";
import { CongestionStack } from "@/components/traffic/congestion-stack";
import {
  formatDateTime,
  formatPercent,
  formatSpeed,
} from "@/components/traffic/format";
import { LoadingPanel } from "@/components/traffic/loading-panel";
import type { LatestTrafficPayload, TrafficHistoryPayload } from "@/lib/types/traffic";

type DashboardState = {
  latest: LatestTrafficPayload;
  history: TrafficHistoryPayload;
};

function getFreshnessTone(status: LatestTrafficPayload["freshness"]["status"]) {
  if (status === "fresh") {
    return "green" as const;
  }

  if (status === "stale") {
    return "amber" as const;
  }

  return "slate" as const;
}

function formatFreshnessText(status: LatestTrafficPayload["freshness"]["status"]) {
  if (status === "fresh") {
    return "up to date";
  }

  if (status === "stale") {
    return "needs refresh";
  }

  return "waiting for data";
}

export function TrafficOverview() {
  const [state, setState] = useState<DashboardState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadDashboard = useCallback(async () => {
    try {
      const [latest, history] = await Promise.all([
        readApi<LatestTrafficPayload>("/api/traffic/latest"),
        readApi<TrafficHistoryPayload>("/api/traffic/history?hours=24&granularity=hour"),
      ]);

      startTransition(() => {
        setState({ latest, history });
        setError(null);
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load traffic data.");
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      void loadDashboard();
    }, 0);
    const interval = window.setInterval(() => {
      void loadDashboard();
    }, 60_000);

    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
    };
  }, [loadDashboard]);

  if (!state && !error) {
    return <LoadingPanel title="Loading corridor" message="Checking the latest traffic readings." />;
  }

  if (!state) {
    return <LoadingPanel title="Traffic data unavailable" message={error ?? "The page could not load."} />;
  }

  const { latest, history } = state;
  const observedSegments = latest.freshness.observedSegments;
  const totalSegments = latest.corridor.samplePointCount;

  return (
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[2rem] border border-black/10 bg-[#16201d] p-5 text-white shadow-xl sm:rounded-[2.5rem] sm:p-8">
          <StatusPill tone={getFreshnessTone(latest.freshness.status)}>
            {formatFreshnessText(latest.freshness.status)}
          </StatusPill>
          <h2 className="mt-6 max-w-3xl text-4xl font-black leading-tight tracking-tight sm:text-6xl">
            Current traffic from Victoria to Raml.
          </h2>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-stone-200">
            See where traffic is moving well, where it is slowing down, and
            when the corridor was last updated. Live readings are collected
            from 7:00 AM to midnight Cairo time.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link
              href="/live"
              className="rounded-full bg-amber-400 px-5 py-3 text-center text-sm font-black text-slate-950 transition hover:bg-amber-300"
            >
              Open live corridor
            </Link>
            <Link
              href="/history"
              className="rounded-full border border-white/20 px-5 py-3 text-center text-sm font-black text-white transition hover:bg-white hover:text-slate-950"
            >
              View historical patterns
            </Link>
            <button
              type="button"
              onClick={() => void loadDashboard()}
              className="rounded-full border border-white/20 px-5 py-3 text-sm font-black text-white transition hover:bg-white hover:text-slate-950 disabled:opacity-60"
              disabled={isPending}
            >
              {isPending ? "Refreshing" : "Refresh"}
            </button>
          </div>
        </div>
        <div className="grid gap-4">
          <MetricCard
            label="Average speed"
            value={formatSpeed(latest.summary.averageSpeed)}
            detail="Average of the latest speeds across the monitored areas."
            tone="green"
          />
          <MetricCard
            label="Clear-road comparison"
            value={formatPercent(latest.summary.averageSpeedRatio)}
            detail="100% means traffic is close to its usual clear-road speed."
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
          <MetricCard
            label="Latest update"
            value={formatDateTime(latest.freshness.latestTimestampUtc)}
            detail={`${observedSegments} of ${totalSegments} monitored areas have recent readings during the daily live window.`}
          />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <CongestionStack counts={latest.summary.congestionCounts} total={observedSegments} />
        <div className="rounded-[2rem] border border-black/10 bg-white/80 p-5 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-xl font-black text-slate-950">Last 24 hours</h3>
            <StatusPill tone={history.summary.observationCount > 0 ? "green" : "slate"}>
              {history.summary.observationCount} readings
            </StatusPill>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <MetricCard
              label="Historical avg speed"
              value={formatSpeed(history.summary.averageSpeed)}
              detail="Average speed across the last 24 hours."
            />
            <MetricCard
              label="Clear-road comparison"
              value={formatPercent(history.summary.averageSpeedRatio)}
              detail="How close traffic was to usual clear-road speed."
            />
            <MetricCard
              label="Latest reading"
              value={formatDateTime(history.summary.latestTimestampUtc)}
              detail="Most recent reading in the 24-hour view."
            />
          </div>
        </div>
      </section>
    </div>
  );
}
