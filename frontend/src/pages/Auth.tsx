import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSession } from "@/hooks/useSession";

const Auth = () => {
  const { user, loading, refresh } = useSession();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      navigate("/admin", { replace: true });
      }
  }, [loading, user, navigate]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setStatus(null);

    try {
      if (!email.trim() || !password.trim()) {
        setStatus("Email and password are required.");
        return;
      }

      const endpoint = mode === "login" ? "/auth/login" : "/auth/register";
      const body =
        mode === "login"
          ? { email: email.trim().toLowerCase(), password }
          : {
              email: email.trim().toLowerCase(),
              password,
              full_name: fullName.trim() || undefined,
            };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || "Request failed");
      }

      await refresh();
      setStatus(mode === "login" ? "Signed in. Redirecting..." : "Account created. Redirecting...");
      setTimeout(() => navigate("/admin", { replace: true }), 500);
    } catch (error) {
      console.error(error);
      setStatus(error instanceof Error ? error.message : "Unable to complete request.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6 py-16 text-slate-50">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Scope Admin</p>
          <h1 className="mt-2 text-3xl font-semibold">Welcome back</h1>
          <p className="mt-2 text-sm text-slate-400">Sign in to manage deals and documents.</p>
        </div>

        <div className="mt-6 flex rounded-full border border-slate-800 p-1 text-sm">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`flex-1 rounded-full px-3 py-2 ${
              mode === "login" ? "bg-slate-800 text-white" : "text-slate-400"
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => setMode("register")}
            className={`flex-1 rounded-full px-3 py-2 ${
              mode === "register" ? "bg-slate-800 text-white" : "text-slate-400"
            }`}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4 text-sm">
          <label className="flex flex-col gap-1">
            <span className="text-slate-300">Email</span>
            <input
                      type="email"
              className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-slate-100 outline-none focus:border-blue-500"
                      placeholder="you@example.com"
                      value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
            />
          </label>

          {mode === "register" && (
            <label className="flex flex-col gap-1">
              <span className="text-slate-300">Full name</span>
              <input
                      type="text"
                className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-slate-100 outline-none focus:border-blue-500"
                placeholder="Optional"
                      value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                autoComplete="name"
              />
            </label>
          )}

          <label className="flex flex-col gap-1">
            <span className="text-slate-300">Password</span>
            <input
                      type="password"
              className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-slate-100 outline-none focus:border-blue-500"
              placeholder="••••••••"
                      value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
                    />
          </label>

          {status && (
            <div className="rounded border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-300">
              {status}
                  </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50"
          >
            {busy ? "Working..." : mode === "login" ? "Sign in" : "Create account"}
          </button>
                </form>

        <p className="mt-6 text-center text-xs text-slate-500">
          Need a new account? Use the register tab. Accounts are stored in the local Postgres DB.
        </p>
      </div>

      <Link to="/" className="mt-6 text-xs text-slate-400 hover:text-slate-200">
        Back to roadmap
      </Link>
    </div>
  );
};

export default Auth;
