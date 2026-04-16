import { StatusPill } from "@/components/status-pill";
import { getCongestionTone } from "@/components/traffic/format";

type CongestionStackProps = {
  counts: Record<string, number>;
  total: number;
};

const labels = ["Low", "Medium", "High", "Unknown"];

export function CongestionStack({ counts, total }: CongestionStackProps) {
  const safeTotal = total > 0 ? total : 1;

  return (
    <div className="rounded-[2rem] border border-black/10 bg-white/80 p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-xl font-black text-slate-950">Congestion mix</h3>
        <StatusPill tone={total > 0 ? "green" : "slate"}>{total} observed</StatusPill>
      </div>
      <div className="mt-5 h-4 overflow-hidden rounded-full bg-slate-200">
        <div className="flex h-full">
          {labels.map((label) => {
            const value = counts[label] ?? 0;
            const width = `${(value / safeTotal) * 100}%`;
            const tone = getCongestionTone(label === "Unknown" ? null : label);
            const color =
              tone === "green"
                ? "bg-emerald-700"
                : tone === "amber"
                  ? "bg-amber-500"
                  : tone === "red"
                    ? "bg-red-700"
                    : "bg-slate-500";

            return <div key={label} className={color} style={{ width }} />;
          })}
        </div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        {labels.map((label) => (
          <div key={label} className="rounded-2xl bg-stone-50 p-3">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
              {label}
            </p>
            <p className="mt-1 text-2xl font-black text-slate-950">{counts[label] ?? 0}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
