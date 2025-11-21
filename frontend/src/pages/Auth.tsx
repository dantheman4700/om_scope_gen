import { Link } from "react-router-dom";

const Auth = () => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6 py-16 text-slate-50">
      <div className="max-w-lg text-center">
        <p className="text-sm uppercase tracking-widest text-slate-400">Authentication</p>
        <h1 className="mt-3 text-3xl font-semibold">Supabase auth retired</h1>
        <p className="mt-4 text-sm leading-relaxed text-slate-300">
          The frontend no longer talks directly to Supabase. Sign-up, login, and session handling
          will return once the FastAPI `/auth` endpoints are production-ready. Until then, use the
          backend CLI or direct database access to manage test users.
        </p>
        <p className="mt-4 text-sm text-slate-400">
          Follow the progress in <code className="rounded bg-slate-900 px-2 py-1 text-xs">docs/om_alignment_report.md</code>.
        </p>
        <Link
          to="/"
          className="mt-8 inline-flex items-center justify-center rounded-full border border-slate-700 px-6 py-2 text-sm font-medium text-slate-100 transition hover:border-slate-400"
        >
          Back to roadmap
        </Link>
      </div>
    </div>
  );
};

export default Auth;
