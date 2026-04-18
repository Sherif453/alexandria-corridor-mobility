"use client";

import { useCallback, useEffect, useState, useTransition } from "react";

import { MetricCard } from "@/components/metric-card";
import { StatusPill } from "@/components/status-pill";
import { readApi } from "@/components/traffic/api";
import { CorridorMap } from "@/components/traffic/corridor-map";
import {
  formatCongestionLabel,
  formatDateTime,
  getCongestionTone,
} from "@/components/traffic/format";
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

const effectTone = {
  lighter: "green",
  unchanged: "slate",
  heavier: "red",
  unknown: "amber",
} as const;

function formatMetricValue(metric: ScenarioMetricPayload): string {
  if (metric.unit === "seconds") {
    return formatMinutesFromSeconds(metric.value);
  }

  if (metric.unit === "meters") {
    return `${Math.round(metric.value)} m`;
  }

  if (metric.unit === "vehicles") {
    return `${Math.round(metric.value)}`;
  }

  return `${metric.value > 0 ? "+" : ""}${metric.value.toFixed(1)}%`;
}

function formatMinutesFromSeconds(value: number | null): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "No result";
  }

  const minutes = value / 60;

  if (Math.abs(minutes) < 0.05) {
    return "0 min";
  }

  return `${minutes.toFixed(1)} min`;
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
          value={formatMinutesFromSeconds(scenario.headline.averageTravelTimeSeconds)}
          detail={formatChange(scenario.headline.relativeTravelTimeChangePercent)}
          tone={getChangeTone(scenario.headline.relativeTravelTimeChangePercent)}
        />
        <MetricCard
          label="Delay"
          value={formatMinutesFromSeconds(scenario.headline.averageDelaySeconds)}
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

function ScenarioImpactPanel({ scenario }: { scenario: ScenarioSummaryPayload }) {
  const mapSegments = scenario.segmentImpacts.map((impact) => ({
    segmentId: impact.segmentId,
    roadName: impact.roadName,
    latitude: impact.latitude,
    longitude: impact.longitude,
    order: impact.order,
    observation: null,
  }));
  const congestionBySegmentId = Object.fromEntries(
    scenario.segmentImpacts.map((impact) => [impact.segmentId, impact.scenarioLabel]),
  );
  const popupDetailBySegmentId = Object.fromEntries(
    scenario.segmentImpacts.map((impact) => [
      impact.segmentId,
      `${formatCongestionLabel(impact.baselineLabel)} now; ${formatCongestionLabel(
        impact.scenarioLabel,
      )} in this scenario`,
    ]),
  );
  const changedImpacts = scenario.segmentImpacts.filter(
    (impact) => impact.effect !== "unchanged" && impact.effect !== "unknown",
  );
  const listImpacts = changedImpacts.length > 0 ? changedImpacts : scenario.segmentImpacts;

  return (
    <section className="space-y-5 rounded-[2rem] border border-black/10 bg-white/85 p-5 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <StatusPill tone={typeTone[scenario.type]}>{scenario.typeLabel}</StatusPill>
          <h3 className="mt-4 text-2xl font-black text-slate-950">
            Congestion map for: {scenario.name}
          </h3>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
            Choose a scenario to see how each monitored area is expected to
            change. The map color shows the scenario congestion level, not the
            current live level.
          </p>
        </div>
        <StatusPill tone={scenario.status === "ready" ? "green" : "amber"}>
          {scenario.status === "ready" ? "scenario ready" : "run scenario pipeline"}
        </StatusPill>
      </div>

      <CorridorMap
        segments={mapSegments}
        congestionBySegmentId={congestionBySegmentId}
        popupDetailBySegmentId={popupDetailBySegmentId}
        popupLabel="Scenario effect"
      />

      <div>
        <h4 className="text-xl font-black text-slate-950">Area results</h4>
        <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">
          Areas with a changed congestion level are shown first. If nothing
          changes, the list shows all monitored areas.
        </p>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {listImpacts.map((impact) => (
            <article
              key={impact.segmentId}
              className="rounded-3xl border border-black/10 bg-stone-50 p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                    Area {impact.order}
                  </p>
                  <h5 className="mt-1 text-lg font-black text-slate-950">
                    {impact.roadName}
                  </h5>
                </div>
                <StatusPill tone={effectTone[impact.effect]}>{impact.effect}</StatusPill>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                    Current
                  </p>
                  <StatusPill tone={getCongestionTone(impact.baselineLabel)}>
                    {formatCongestionLabel(impact.baselineLabel)}
                  </StatusPill>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                    In scenario
                  </p>
                  <StatusPill tone={getCongestionTone(impact.scenarioLabel)}>
                    {formatCongestionLabel(impact.scenarioLabel)}
                  </StatusPill>
                </div>
              </div>
              <p className="mt-4 text-sm font-semibold leading-6 text-slate-600">
                {impact.note}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
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
          show baseline plus the four traffic situations.
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
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>("baseline");
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

  const selectedScenario =
    payload.scenarios.find((scenario) => scenario.id === selectedScenarioId) ??
    payload.scenarios[0];

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
              Compare normal corridor operation with four believable traffic
              situations using travel time, delay, and queue length.
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
          detail="Baseline plus four traffic situations."
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

      <section className="rounded-[2rem] border border-black/10 bg-white/80 p-5 shadow-sm">
        <h3 className="text-xl font-black text-slate-950">Choose a scenario</h3>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
          The selected scenario controls the map and the area-by-area results
          below.
        </p>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {payload.scenarios.map((scenario) => (
            <button
              key={scenario.id}
              type="button"
              onClick={() => setSelectedScenarioId(scenario.id)}
              className={`rounded-3xl border p-4 text-left transition ${
                selectedScenario.id === scenario.id
                  ? "border-teal-900 bg-teal-950 text-white shadow-lg"
                  : "border-black/10 bg-stone-50 text-slate-950 hover:border-teal-900/40"
              }`}
            >
              <StatusPill tone={typeTone[scenario.type]}>{scenario.typeLabel}</StatusPill>
              <p className="mt-3 text-lg font-black">{scenario.name}</p>
              <p
                className={`mt-2 text-sm font-semibold leading-6 ${
                  selectedScenario.id === scenario.id ? "text-teal-50" : "text-slate-600"
                }`}
              >
                {scenario.summary}
              </p>
            </button>
          ))}
        </div>
      </section>

      <ScenarioImpactPanel scenario={selectedScenario} />

      <section className="grid gap-4 xl:grid-cols-3">
        {payload.scenarios.map((scenario) => (
          <ScenarioCard key={scenario.id} scenario={scenario} />
        ))}
      </section>

      <MetricTable scenarios={payload.scenarios} />
    </div>
  );
}
