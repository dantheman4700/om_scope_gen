import { useState, useEffect, createContext, useContext } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  hasRole: (role: 'admin' | 'editor' | 'reviewer' | 'buyer') => boolean;
  userRoles: string[];
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
  hasRole: () => false,
  userRoles: [],
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRoles, setUserRoles] = useState<string[]>([]);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch and cache user roles when user changes
  useEffect(() => {
    if (user) {
      supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .then(({ data, error }) => {
          if (!error && data) {
            setUserRoles(data.map(r => r.role));
          }
        });
    } else {
      setUserRoles([]);
    }
  }, [user]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setUserRoles([]);
  };

  const hasRole = (role: 'admin' | 'editor' | 'reviewer' | 'buyer'): boolean => {
    return userRoles.includes(role);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut, hasRole, userRoles }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
