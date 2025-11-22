const milestones = [
  {
    title: "Backend surface",
    status: "done",
    detail: "FastAPI now mounts auth, project, file, run, artifact, and system routers.",
  },
  {
    title: "Document ingestion jobs",
    status: "next",
    detail: "Move PPTX/XLSX/CSV processing into the worker + expose polling endpoints.",
  },
  {
    title: "Listings + access workflows",
    status: "todo",
    detail: "Model listings, access requests, and NDA gating directly in Postgres.",
  },
];

const Index = () => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex max-w-3xl flex-col gap-10 px-6 py-16">
        <header>
          <p className="text-sm uppercase tracking-widest text-slate-400">Scope Doc Generator</p>
          <h1 className="mt-3 text-4xl font-semibold leading-tight">
            Frontend rebuild in progress
            </h1>
          <p className="mt-4 text-slate-300">
            The Supabase-era marketplace UI has been removed so we can align every page with the new
            FastAPI backend. Track status in <code className="rounded bg-slate-900 px-2 py-1 text-xs">docs/om_alignment_report.md</code>.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-white">Milestones</h2>
          <p className="mt-1 text-sm text-slate-400">
            What&apos;s shipped, what&apos;s next, and what still needs definition.
          </p>
          <div className="mt-6 space-y-4">
            {milestones.map((item) => (
              <div
                key={item.title}
                className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-white">{item.title}</h3>
                  <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                    {item.status}
                  </span>
        </div>
                <p className="mt-2 text-sm text-slate-300">{item.detail}</p>
          </div>
            ))}
          </div>
      </section>

        <section className="rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-900/20 to-slate-900/50 p-6">
          <h2 className="text-xl font-semibold text-white">Why the reset?</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-200">
            Every previous page depended on Supabase tables, storage, and functions we are replacing.
            Rather than keep broken UI around, we&apos;re rebuilding each feature on the new FastAPI
            contracts once they exist. This keeps expectations clear for anyone opening the repo.
          </p>
          <p className="mt-4 text-sm text-slate-300">
            When a backend capability lands, the matching frontend surface will return with shared
            types, react-query hooks, and server-driven RBAC. Until then, this landing page is the
            single source of truth.
              </p>
      </section>
        </div>
    </div>
  );
};

export default Index;
