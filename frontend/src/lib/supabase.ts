const STORAGE_KEY = "ppmp_auth_session";

interface MockUser {
  id: string;
  email: string;
  app_metadata: Record<string, unknown>;
  user_metadata: Record<string, unknown>;
  aud: string;
  created_at: string;
}

interface MockSession {
  user: MockUser;
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: "bearer";
}

function getStoredSession(): MockSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function storeSession(session: MockSession | null) {
  if (session) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

type AuthChangeCallback = (event: string, session: MockSession | null) => void;

const authChangeCallbacks: AuthChangeCallback[] = [];

function notifyCallbacks(event: string, session: MockSession | null) {
  authChangeCallbacks.forEach((cb) => cb(event, session));
}

function makeSession(email: string): MockSession {
  return {
    user: {
      id: email,
      email,
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: new Date().toISOString(),
    },
    access_token: "mock-token",
    refresh_token: "mock-refresh",
    expires_in: 3600,
    token_type: "bearer" as const,
  };
}

export const supabase = {
  auth: {
    async getSession(): Promise<{ data: { session: MockSession | null }; error: null }> {
      return { data: { session: getStoredSession() }, error: null };
    },

    async signInWithPassword({
      email,
      password,
    }: {
      email: string;
      password: string;
    }): Promise<{ data: { session: MockSession | null }; error: { message: string } | null }> {
      if (!email || !password) {
        return { data: { session: null }, error: { message: "Email and password required" } };
      }
      const session = makeSession(email);
      storeSession(session);
      notifyCallbacks("SIGNED_IN", session);
      return { data: { session }, error: null };
    },

    async signInWithOAuth({
      provider: _provider,
      options: _options,
    }: {
      provider: string;
      options?: { redirectTo?: string };
    }): Promise<{ data: { url: string }; error: { message: string } | null }> {
      console.warn("OAuth sign-in is not available without a Supabase project.");
      return { data: { url: "" }, error: null };
    },

    async signOut(): Promise<{ data: Record<string, never>; error: { message: string } | null }> {
      storeSession(null);
      notifyCallbacks("SIGNED_OUT", null);
      return { data: {}, error: null };
    },

    async updateUser({
      password: _password,
    }: {
      password?: string;
    }): Promise<{ data: { user: MockUser | null }; error: { message: string } | null }> {
      return { data: { user: getStoredSession()?.user ?? null }, error: null };
    },

    async resetPasswordForEmail(
      _email: string,
      _options?: { redirectTo?: string },
    ): Promise<{ data: Record<string, unknown>; error: { message: string } | null }> {
      console.warn("Password reset is not available without a Supabase project.");
      return { data: {}, error: null };
    },

    onAuthStateChange(callback: AuthChangeCallback) {
      authChangeCallbacks.push(callback);
      const session = getStoredSession();
      setTimeout(() => {
        callback(session ? "INITIAL_SESSION" : "SIGNED_OUT", session);
      }, 0);
      return {
        data: {
          subscription: {
            unsubscribe() {
              const idx = authChangeCallbacks.indexOf(callback);
              if (idx >= 0) authChangeCallbacks.splice(idx, 1);
            },
          },
        },
      };
    },
  },
};
