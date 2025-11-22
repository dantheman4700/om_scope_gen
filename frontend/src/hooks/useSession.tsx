import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type SessionUser = {
  id: string;
  email: string;
  full_name?: string;
  role: string;
};

type SessionState = {
  user: SessionUser | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const SessionContext = createContext<SessionState | undefined>(undefined);

export const SessionProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/auth/me", { credentials: "include" });
      if (!response.ok) {
        setUser(null);
        return;
      }
      const data = (await response.json()) as SessionUser;
      setUser(data);
    } catch (err) {
      console.error(err);
      setError("Unable to load session");
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({
      user,
      loading,
      error,
      refresh,
    }),
    [user, loading, error, refresh],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
};

export const useSession = (): SessionState => {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession must be used within SessionProvider");
  }
  return ctx;
};

