"use client";

import { useCallback, useEffect, useState, useTransition } from "react";

import { MetricCard } from "@/components/metric-card";
import { StatusPill } from "@/components/status-pill";
import { readApi } from "@/components/traffic/api";
import { formatDateTime } from "@/components/traffic/format";
import type {
  ScenarioListPayload,
  ScenarioMetricPayload,
  ScenarioSummaryPayload,
} from "@/lib/types/traffic";

const typeTone = {
  baseline: "green",
  disruption: "red",
  mitigation: "amber",
} as const;

function formatMetricValue(metric: ScenarioMetricPayload): string {
  if (metric.unit === "seconds") {
    return `${Math.round(metric.value)} sec`;
  }

  if (metric.unit === "meters") {
    return `${Math.round(metric.value)} m`;
  }

  if (metric.unit === "vehicles") {
    return `${Math.round(metric.value)}`;
  }

  return `${metric.value > 0 ? "+" : ""}${metric.value.toFixed(1)}%`;
}

function formatHeadlineSeconds(value: number | null): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "No result";
  }

  return `${Math.round(value)} sec`;
}

function formatHeadlineMeters(value: number | null): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "No result";
  }

  return `${Math.round(value)} m`;
}

function formatChange(value: number | null): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "No comparison";
  }

  if (Math.abs(value) < 0.05) {
    return "same as baseline";
  }

  return `${value > 0 ? "+" : ""}${value.toFixed(1)}% vs baseline`;
}

function getChangeTone(value: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "default" as const;
  }

  if (value > 5) {
    return "red" as const;
  }

  if (value < -5) {
    return "green" as const;
  }

  return "amber" as const;
}

function ScenarioCard({ scenario }: { scenario: ScenarioSummaryPayload }) {
  return (
    <article className="rounded-[2rem] border border-black/10 bg-white/85 p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <StatusPill tone={typeTone[scenario.type]}>{scenario.typeLabel}</StatusPill>
          <h3 className="mt-4 text-2xl font-black leading-tight text-slate-950">
            {scenario.name}
          </h3>
        </div>
        <StatusPill tone={scenario.status === "ready" ? "green" : "amber"}>
          {scenario.status === "ready" ? "ready" : "not ready"}
        </StatusPill>
      </div>
      <p className="mt-4 text-sm leading-6 text-slate-700">{scenario.summary}</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <MetricCard
          label="Trip time"
          value={formatHeadlineSeconds(scenario.headline.averageTravelTimeSeconds)}
          detail={formatChange(scenario.headline.relativeTravelTimeChangePercent)}
          tone={getChangeTone(scenario.headline.relativeTravelTimeChangePercent)}
        />
        <MetricCard
          label="Delay"
          value={formatHeadlineSeconds(scenario.headline.averageDelaySeconds)}
          detail="Average extra time per vehicle."
        />
        <MetricCard
          label="Longest queue"
          value={formatHeadlineMeters(scenario.headline.maxQueueLengthMeters)}
          detail="Largest queue during the test."
        />
      </div>
    </article>
  );
}

function MetricTable({ scenarios }: { scenarios: ScenarioSummaryPayload[] }) {
  const readyScenarios = scenarios.filter((scenario) => scenario.status === "ready");
  const metricNames = Array.from(
    new Set(readyScenarios.flatMap((scenario) => scenario.metrics.map((metric) => metric.name))),
  );

  if (readyScenarios.length === 0) {
    return (
      <div className="rounded-[2rem] border border-dashed border-black/20 bg-white/70 p-8 text-center">
        <p className="font-black text-slate-950">Scenario results are not ready yet</p>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Run the scenario pipeline after installing SUMO. This page will then
          show baseline, disruption, and mitigation results.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[2rem] border border-black/10 bg-white/85 shadow-sm">
      <div className="border-b border-black/10 p-5">
        <h3 className="text-xl font-black text-slate-950">Detailed comparison</h3>
        <p className="mt-1 text-sm text-slate-600">
          Lower trip time, delay, and queue length are better. More completed
          vehicles are better.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[780px] border-collapse text-left">
          <thead>
            <tr className="bg-stone-100 text-xs font-black uppercase tracking-[0.16em] text-slate-500">
              <th className="py-3 pr-4 pl-5">Measure</th>
              {readyScenarios.map((scenario) => (
                <th key={scenario.id} className="px-4 py-3">
                  {scenario.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metricNames.map((metricName) => {
              const firstMetric = readyScenarios
                .flatMap((scenario) => scenario.metrics)
                .find((metric) => metric.name === metricName);

              if (!firstMetric) {
                return null;
              }

              return (
                <tr key={metricName} className="border-b border-black/5 last:border-b-0">
                  <td className="py-4 pr-4 pl-5 align-top">
                    <p className="font-black text-slate-950">{firstMetric.label}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-600">
                      {firstMetric.description}
                    </p>
                  </td>
                  {readyScenarios.map((scenario) => {
                    const metric = scenario.metrics.find((item) => item.name === metricName);

                    return (
                      <td key={scenario.id} className="px-4 py-4 align-top">
                        {metric ? (
                          <>
                            <p className="font-black text-slate-950">
                              {formatMetricValue(metric)}
                            </p>
                            {metric.deltaPercent !== null && scenario.type !== "baseline" ? (
                              <p className="mt-1 text-xs font-bold text-slate-600">
                                {formatChange(metric.deltaPercent)}
                              </p>
                            ) : null}
                          </>
                        ) : (
                          <span className="text-sm text-slate-500">No result</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ScenarioComparison() {
  const [payload, setPayload] = useState<ScenarioListPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadScenarios = useCallback(async () => {
    try {
      const response = await readApi<ScenarioListPayload>("/api/scenarios");

      startTransition(() => {
        setPayload(response);
        setError(null);
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load scenarios.");
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      void loadScenarios();
    }, 0);

    return () => window.clearTimeout(initialLoad);
  }, [loadScenarios]);

  if (!payload && !error) {
    return (
      <section className="rounded-[2rem] border border-black/10 bg-white/80 p-8 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-teal-900">
          Loading scenarios
        </p>
        <p className="mt-3 text-lg text-slate-700">Checking the latest scenario results.</p>
      </section>
    );
  }

  if (!payload) {
    return (
      <section className="rounded-[2rem] border border-black/10 bg-white/80 p-8 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-red-900">
          Scenarios unavailable
        </p>
        <p className="mt-3 text-lg text-slate-700">
          {error ?? "The scenario page could not load."}
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-black/10 bg-[#15251f] p-5 text-white shadow-xl sm:rounded-[2.5rem] sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <StatusPill tone={payload.status === "ready" ? "green" : "amber"}>
              {payload.status === "ready" ? "ready" : "not ready"}
            </StatusPill>
            <h2 className="mt-5 max-w-3xl text-4xl font-black leading-tight tracking-tight sm:text-6xl">
              What happens if the corridor is disrupted?
            </h2>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-stone-200">
              Compare normal conditions, a lane reduction, and a mitigation plan
              using travel time, delay, and queue length.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadScenarios()}
            disabled={isPending}
            className="rounded-full border border-white/20 px-5 py-3 text-sm font-black text-white transition hover:bg-white hover:text-slate-950 disabled:opacity-60"
          >
            {isPending ? "Refreshing" : "Refresh"}
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Scenario sets"
          value={String(payload.scenarios.length)}
          detail="Baseline, disruption, and mitigation."
        />
        <MetricCard
          label="Last run"
          value={payload.latestVersion ? formatDateTime(payload.generatedAtUtc) : "No run yet"}
          detail={payload.message}
          tone={payload.status === "ready" ? "green" : "amber"}
        />
        <MetricCard
          label="Best comparison"
          value="Trip time"
          detail="Use the percent change to compare each scenario with baseline."
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        {payload.scenarios.map((scenario) => (
          <ScenarioCard key={scenario.id} scenario={scenario} />
        ))}
      </section>

      <MetricTable scenarios={payload.scenarios} />
    </div>
  );
}
