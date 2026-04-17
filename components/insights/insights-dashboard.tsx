"use client";

import { useCallback, useEffect, useState, useTransition } from "react";

import { MetricCard } from "@/components/metric-card";
import { StatusPill } from "@/components/status-pill";
import { readApi } from "@/components/traffic/api";
import { formatDateTime } from "@/components/traffic/format";
import { LoadingPanel } from "@/components/traffic/loading-panel";
import type { InsightPayload, InsightsPayload } from "@/lib/types/traffic";

const severityTone = {
  info: "green",
  watch: "amber",
  warning: "red",
} as const;

const qualityTone = {
  ready: "green",
  limited: "amber",
  missing: "red",
} as const;

const severityLabel = {
  info: "clear",
  watch: "watch",
  warning: "attention",
} as const;

const qualityLabel = {
  ready: "ready",
  limited: "still learning",
  missing: "not ready",
} as const;

function InsightCard({ insight }: { insight: InsightPayload }) {
  return (
    <article className="rounded-[2rem] border border-black/10 bg-white/85 p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <h3 className="text-xl font-black text-slate-950">{insight.title}</h3>
        <StatusPill tone={severityTone[insight.severity]}>
          {severityLabel[insight.severity]}
        </StatusPill>
      </div>
      <p className="mt-4 text-base leading-7 text-slate-700">{insight.body}</p>
      <p className="mt-4 rounded-2xl bg-stone-100 p-4 text-sm font-semibold leading-6 text-slate-700">
        {insight.evidence}
      </p>
    </article>
  );
}

export function InsightsDashboard() {
  const [state, setState] = useState<InsightsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadInsights = useCallback(async () => {
    try {
      const payload = await readApi<InsightsPayload>("/api/insights");

      startTransition(() => {
        setState(payload);
        setError(null);
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load guidance.");
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      void loadInsights();
    }, 0);
    const interval = window.setInterval(() => {
      void loadInsights();
    }, 60_000);

    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
    };
  }, [loadInsights]);

  if (!state && !error) {
    return (
      <LoadingPanel
        title="Loading guidance"
        message="Checking what changed across the corridor."
      />
    );
  }

  if (!state) {
    return (
      <LoadingPanel
        title="Guidance unavailable"
        message={error ?? "The guidance page could not load."}
      />
    );
  }

  const warningCount = state.insights.filter((insight) => insight.severity === "warning").length;
  const watchCount = state.insights.filter((insight) => insight.severity === "watch").length;

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-black/10 bg-[#1f1a14] p-5 text-white shadow-xl sm:rounded-[2.5rem] sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <StatusPill tone={qualityTone[state.dataQuality.status]}>
              {qualityLabel[state.dataQuality.status]}
            </StatusPill>
            <h2 className="mt-5 max-w-3xl text-4xl font-black leading-tight tracking-tight sm:text-6xl">
              What to watch on the corridor.
            </h2>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-stone-200">
              Plain-language guidance for the next 15 minutes: where congestion
              may appear, where it may ease, and which areas need extra caution.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadInsights()}
            disabled={isPending}
            className="rounded-full border border-white/20 px-5 py-3 text-sm font-black text-white transition hover:bg-white hover:text-slate-950 disabled:opacity-60"
          >
            {isPending ? "Refreshing" : "Refresh"}
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Guidance items"
          value={String(state.insights.length)}
          detail="Plain notes based on the latest corridor results."
        />
        <MetricCard
          label="Need attention"
          value={String(warningCount)}
          detail={`${watchCount} more item${watchCount === 1 ? "" : "s"} to watch.`}
          tone={warningCount > 0 ? "red" : watchCount > 0 ? "amber" : "green"}
        />
        <MetricCard
          label="Updated"
          value={formatDateTime(state.generatedAtUtc)}
          detail="Time this guidance was last refreshed."
        />
      </section>

      <section className="rounded-[2rem] border border-black/10 bg-white/80 p-5 shadow-sm">
        <StatusPill tone={qualityTone[state.dataQuality.status]}>coverage</StatusPill>
        <p className="mt-4 text-base leading-7 text-slate-700">
          {state.dataQuality.message}
        </p>
      </section>

      <section className="rounded-[2rem] border border-black/10 bg-white/80 p-5 shadow-sm">
        <h3 className="text-xl font-black text-slate-950">How to read traffic changes</h3>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-3xl bg-emerald-50 p-4">
            <StatusPill tone="green">improving</StatusPill>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-700">
              Traffic is expected to move to a lighter congestion level.
            </p>
          </div>
          <div className="rounded-3xl bg-stone-100 p-4">
            <StatusPill tone="slate">stable</StatusPill>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-700">
              Traffic is expected to stay at the same congestion level.
            </p>
          </div>
          <div className="rounded-3xl bg-red-50 p-4">
            <StatusPill tone="red">worsening</StatusPill>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-700">
              Traffic is expected to move to a heavier congestion level.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {state.insights.map((insight) => (
          <InsightCard key={insight.id} insight={insight} />
        ))}
      </section>
    </div>
  );
}
