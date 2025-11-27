import { useState, useEffect, createContext, useContext, useCallback } from "react";
import { auth, User, setAuthToken, getAuthToken } from "@/lib/api";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
  hasRole: (role: 'admin' | 'editor' | 'reviewer' | 'buyer') => boolean;
  userRoles: string[];
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signIn: async () => {},
  signUp: async () => {},
  signOut: async () => {},
  hasRole: () => false,
  userRoles: [],
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRoles, setUserRoles] = useState<string[]>([]);

  // Check for existing session on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = getAuthToken();
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const { user } = await auth.getMe();
        setUser(user);
        setUserRoles(user.roles || []);
      } catch (error) {
        // Token invalid/expired, clear it
        console.error('Auth check failed:', error);
        setAuthToken(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { user } = await auth.signIn(email, password);
    setUser(user);
    setUserRoles(user.roles || []);
  }, []);

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    const { user } = await auth.signUp(email, password, fullName);
    setUser(user);
    setUserRoles(user.roles || []);
  }, []);

  const signOut = useCallback(async () => {
    await auth.signOut();
    setUser(null);
    setUserRoles([]);
  }, []);

  const hasRole = useCallback((role: 'admin' | 'editor' | 'reviewer' | 'buyer'): boolean => {
    return userRoles.includes(role);
  }, [userRoles]);

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, hasRole, userRoles }}>
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
