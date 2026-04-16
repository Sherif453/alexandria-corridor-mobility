type MetricCardProps = {
  label: string;
  value: string;
  detail?: string;
  tone?: "default" | "green" | "amber" | "red";
};

const toneClasses = {
  default: "from-white/90 to-stone-100/90",
  green: "from-emerald-50 to-teal-100",
  amber: "from-amber-50 to-orange-100",
  red: "from-red-50 to-rose-100",
};

export function MetricCard({ label, value, detail, tone = "default" }: MetricCardProps) {
  return (
    <div className={`rounded-3xl border border-black/10 bg-gradient-to-br p-5 shadow-sm ${toneClasses[tone]}`}>
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-600">{label}</p>
      <p className="mt-3 text-3xl font-black tracking-tight text-slate-950">{value}</p>
      {detail ? <p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p> : null}
    </div>
  );
}
