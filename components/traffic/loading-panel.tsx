type LoadingPanelProps = {
  title: string;
  message: string;
};

export function LoadingPanel({ title, message }: LoadingPanelProps) {
  return (
    <section className="rounded-[2rem] border border-black/10 bg-white/80 p-8 shadow-sm backdrop-blur">
      <p className="text-xs font-black uppercase tracking-[0.25em] text-teal-900">
        {title}
      </p>
      <p className="mt-3 text-lg text-slate-700">{message}</p>
    </section>
  );
}
