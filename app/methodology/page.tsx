import { PageShell } from "@/components/page-shell";
import { StatusPill } from "@/components/status-pill";

const sections = [
  {
    title: "Corridor scope",
    body: "The app focuses only on the Victoria to Sidi Gaber to Raml corridor. Every map, reading, prediction, and scenario stays inside that fixed route.",
  },
  {
    title: "Traffic readings",
    body: "The app collects repeated speed readings for fixed monitored areas. These readings are saved over time so current conditions and historical patterns can be compared.",
  },
  {
    title: "Next 15 minutes",
    body: "Predictions compare the current congestion level with the level expected in the next 15-minute window. Low means traffic is close to normal movement, medium means noticeable slowing, and high means a problem area.",
  },
  {
    title: "Scenario comparison",
    body: "Scenario tests compare normal operation, a lane reduction, and a mitigation plan. The key outputs are trip time, delay, queue length, and percent change against the baseline.",
  },
  {
    title: "Limitations",
    body: "Early results are useful for guidance, but they become stronger after more days are collected. The app should not be treated as a guarantee of exact traffic behavior.",
  },
];

export default function MethodologyPage() {
  return (
    <PageShell>
      <div className="space-y-8">
        <section className="rounded-[2rem] border border-black/10 bg-[#201a14] p-5 text-white shadow-xl sm:rounded-[2.5rem] sm:p-8">
          <StatusPill tone="amber">how it works</StatusPill>
          <h2 className="mt-5 max-w-3xl text-4xl font-black leading-tight tracking-tight sm:text-6xl">
            How the corridor results are produced.
          </h2>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-stone-200">
            A plain-language explanation of the route, readings, predictions,
            scenario tests, and limits of the app.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          {sections.map((section) => (
            <article
              key={section.title}
              className="rounded-[2rem] border border-black/10 bg-white/85 p-5 shadow-sm"
            >
              <h3 className="text-2xl font-black text-slate-950">{section.title}</h3>
              <p className="mt-4 text-base leading-7 text-slate-700">{section.body}</p>
            </article>
          ))}
        </section>

        <section className="rounded-[2rem] border border-black/10 bg-[#fdf8ed] p-5 shadow-sm">
          <h3 className="text-2xl font-black text-slate-950">How to judge results</h3>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-3xl bg-emerald-50 p-4">
              <StatusPill tone="green">clear</StatusPill>
              <p className="mt-3 text-sm font-semibold leading-6 text-slate-700">
                Most monitored areas are low congestion or improving.
              </p>
            </div>
            <div className="rounded-3xl bg-amber-50 p-4">
              <StatusPill tone="amber">watch</StatusPill>
              <p className="mt-3 text-sm font-semibold leading-6 text-slate-700">
                Some areas are slower, less certain, or expected to worsen.
              </p>
            </div>
            <div className="rounded-3xl bg-red-50 p-4">
              <StatusPill tone="red">attention</StatusPill>
              <p className="mt-3 text-sm font-semibold leading-6 text-slate-700">
                Heavy congestion or large scenario delays should be treated as a
                problem area.
              </p>
            </div>
          </div>
        </section>
      </div>
    </PageShell>
  );
}
