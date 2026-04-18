import Link from "next/link";

import { PageShell } from "@/components/page-shell";
import { StatusPill } from "@/components/status-pill";

const mainSteps = [
  {
    title: "Start with the overview",
    body: "Use the overview page to check whether the corridor has fresh readings and whether the general condition is calm, slower than usual, or problematic.",
    href: "/",
    cta: "Open overview",
  },
  {
    title: "Check the live corridor",
    body: "Use the live corridor page to see the monitored locations on the map. Each point follows the fixed Victoria to Sidi Gaber to Raml route.",
    href: "/live",
    cta: "Open live map",
  },
  {
    title: "Use the next 15 minutes page before acting",
    body: "This is the main decision page. It shows the congestion level expected in the next 15-minute window and lists the areas to check first.",
    href: "/predictions",
    cta: "Open next 15 min",
  },
  {
    title: "Use scenarios for planning, not live traffic",
    body: "Scenario results compare what may happen under normal operation, a lane reduction, and a mitigation plan. They are useful for understanding impact, not for live navigation.",
    href: "/scenarios",
    cta: "Open scenarios",
  },
] as const;

const trafficLevels = [
  {
    label: "Low",
    tone: "green" as const,
    body: "Traffic is close to normal for that monitored area.",
  },
  {
    label: "Medium",
    tone: "amber" as const,
    body: "Traffic is noticeably slower than normal. Check this area before relying on the route.",
  },
  {
    label: "High",
    tone: "red" as const,
    body: "Traffic is much slower than normal. Treat this as a problem area.",
  },
] as const;

const trendMeanings = [
  {
    label: "Improving",
    body: "The next 15 minutes are expected to be lighter than the current condition.",
  },
  {
    label: "Stable",
    body: "The next 15 minutes are expected to stay close to the current condition.",
  },
  {
    label: "Worsening",
    body: "The next 15 minutes are expected to be heavier than the current condition.",
  },
  {
    label: "Uncertain",
    body: "There is not enough reliable recent information to make a clear call.",
  },
] as const;

export default function GuidancePage() {
  return (
    <PageShell>
      <div className="space-y-8">
        <section className="rounded-[2rem] border border-black/10 bg-[#1f1a14] p-5 text-white shadow-xl sm:rounded-[2.5rem] sm:p-8">
          <StatusPill tone="green">user guide</StatusPill>
          <h2 className="mt-5 max-w-4xl text-4xl font-black leading-tight tracking-tight sm:text-6xl">
            How to use this app without overthinking it.
          </h2>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-stone-200">
            The app is built to answer one practical question: what is happening
            on the Victoria to Sidi Gaber to Raml corridor, and what should you
            check before using or planning around it?
          </p>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          {mainSteps.map((step, index) => (
            <article
              key={step.title}
              className="rounded-[2rem] border border-black/10 bg-white/85 p-5 shadow-sm sm:p-6"
            >
              <p className="text-sm font-black uppercase tracking-[0.22em] text-teal-900">
                Step {index + 1}
              </p>
              <h3 className="mt-3 text-2xl font-black text-slate-950">{step.title}</h3>
              <p className="mt-4 text-base leading-7 text-slate-700">{step.body}</p>
              <Link
                href={step.href}
                className="mt-5 inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-teal-900"
              >
                {step.cta}
              </Link>
            </article>
          ))}
        </section>

        <section className="rounded-[2rem] border border-black/10 bg-[#fdf8ed] p-5 shadow-sm sm:p-6">
          <h3 className="text-2xl font-black text-slate-950">What the levels mean</h3>
          <p className="mt-3 max-w-3xl text-base leading-7 text-slate-700">
            The app compares current movement with normal movement for the same
            monitored area. That is why &quot;Low&quot; means low congestion, not low
            vehicle speed.
          </p>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {trafficLevels.map((level) => (
              <div key={level.label} className="rounded-3xl bg-white p-4">
                <StatusPill tone={level.tone}>{level.label}</StatusPill>
                <p className="mt-3 text-sm font-semibold leading-6 text-slate-700">
                  {level.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] border border-black/10 bg-white/85 p-5 shadow-sm sm:p-6">
          <h3 className="text-2xl font-black text-slate-950">
            What the change words mean
          </h3>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {trendMeanings.map((trend) => (
              <div key={trend.label} className="rounded-3xl bg-stone-100 p-4">
                <h4 className="text-lg font-black text-slate-950">{trend.label}</h4>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">
                  {trend.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] border border-black/10 bg-teal-950 p-5 text-white shadow-sm sm:p-6">
          <h3 className="text-2xl font-black">Best way to use it daily</h3>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <p className="rounded-3xl bg-white/10 p-4 text-sm font-semibold leading-6 text-teal-50">
              Check the last updated time before trusting any result.
            </p>
            <p className="rounded-3xl bg-white/10 p-4 text-sm font-semibold leading-6 text-teal-50">
              Use the next 15 minutes page first when deciding which areas need
              a closer look.
            </p>
            <p className="rounded-3xl bg-white/10 p-4 text-sm font-semibold leading-6 text-teal-50">
              Use history and scenarios for context, not immediate traffic
              decisions.
            </p>
          </div>
        </section>
      </div>
    </PageShell>
  );
}
