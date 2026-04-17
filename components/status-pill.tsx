type StatusPillProps = {
  children: React.ReactNode;
  tone?: "green" | "amber" | "red" | "slate";
};

const toneClasses = {
  green: "border-emerald-700/20 bg-emerald-100 text-emerald-950",
  amber: "border-amber-700/20 bg-amber-100 text-amber-950",
  red: "border-red-800/20 bg-red-100 text-red-950",
  slate: "border-slate-700/20 bg-slate-100 text-slate-950",
};

export function StatusPill({ children, tone = "slate" }: StatusPillProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] ${toneClasses[tone]}`}
    >
      {children}
    </span>
  );
}
