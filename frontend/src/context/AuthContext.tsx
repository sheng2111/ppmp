import { createContext, useContext, useEffect, useState } from "react";
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

  const syncUser = async (supabaseUser: SupabaseUser) => {
    try {
      const response = await api.post("/auth/register", {
        supabase_uid: supabaseUser.id,
        full_name: supabaseUser.user_metadata?.full_name || supabaseUser.email,
        email: supabaseUser.email,
      });
      setDbUser(response.data);
    } catch (err) {
      console.error("Failed to sync user:", err);
    }
  };

  const refreshDbUser = async () => {
    if (user) await syncUser(user);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) syncUser(session.user);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) await syncUser(session.user);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setDbUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        dbUser,
        session,
        loading,
        signInWithGoogle,
        signOut,
        refreshDbUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
