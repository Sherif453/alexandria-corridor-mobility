import Link from "next/link";

type PageShellProps = {
  children: React.ReactNode;
};

const navigation = [
  { href: "/", label: "Overview" },
  { href: "/live", label: "Live corridor" },
  { href: "/history", label: "History" },
  { href: "/predictions", label: "Next 15 min" },
  { href: "/scenarios", label: "Scenarios" },
  { href: "/insights", label: "Guidance" },
  { href: "/methodology", label: "Method" },
];

export function PageShell({ children }: PageShellProps) {
  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 rounded-[1.5rem] border border-black/10 bg-white/75 p-4 shadow-sm backdrop-blur sm:mb-8 sm:rounded-[2rem]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <Link href="/" className="group">
              <p className="text-xs font-black uppercase tracking-[0.28em] text-teal-900">
                Alexandria Corridor
              </p>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                Mobility Intelligence
              </h1>
            </Link>
            <nav className="grid w-full grid-cols-2 gap-2 sm:grid-cols-3 lg:w-auto lg:flex lg:flex-wrap">
              {navigation.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-full border border-black/10 bg-stone-50 px-3 py-3 text-center text-xs font-bold text-slate-800 transition hover:border-teal-900/30 hover:bg-teal-900 hover:text-white sm:text-sm lg:px-4"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        {children}
      </div>
    </main>
  );
}
