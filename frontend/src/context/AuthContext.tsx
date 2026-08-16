import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import type { Session, User as SupabaseUser } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import api from "../services/api";
import type { DBUser } from "../types";

interface AuthContextType {
  user: SupabaseUser | null;
  dbUser: DBUser | null;
  session: Session | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshDbUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [dbUser, setDbUser] = useState<DBUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Checks whether a User row already exists for this Supabase account.
  // Does NOT create one — that only happens when the onboarding form is submitted.
  const fetchDbUser = useCallback(async (supabaseUser: SupabaseUser) => {
    try {
      const response = await api.get(`/auth/me/${supabaseUser.id}`);
      setDbUser(response.data);
    } catch (err: any) {
      if (err.response?.status === 404) {
        // Not onboarded yet — this is expected for a brand-new sign-in.
        setDbUser(null);
      } else {
        console.error("Failed to fetch user:", err);
        setDbUser(null);
      }
    }
  }, []);

  const refreshDbUser = useCallback(async () => {
    if (user) await fetchDbUser(user);
  }, [user, fetchDbUser]);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchDbUser(session.user);
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchDbUser(session.user);
      } else {
        setDbUser(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchDbUser]);

  const signInWithGoogle = useCallback(async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setDbUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      dbUser,
      session,
      loading,
      signInWithGoogle,
      signOut,
      refreshDbUser,
    }),
    [user, dbUser, session, loading, signInWithGoogle, signOut, refreshDbUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
