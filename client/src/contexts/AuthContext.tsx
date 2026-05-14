import { useEffect, useState, useCallback, type ReactNode } from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { User, Session } from "@supabase/supabase-js";
import { AuthContext } from "@/contexts/auth-context-core";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      setError("Supabase no está configurado en este preview");
      return;
    }

    let isMounted = true;
    const loadingTimeout = window.setTimeout(() => {
      if (!isMounted) return;
      setError("No se pudo cargar la sesión. Revisa tu conexión e inténtalo de nuevo.");
      setLoading(false);
    }, 10000);

    // Register the listener FIRST to avoid race conditions.
    // Supabase docs recommend this order: subscribe, then getSession.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;
        window.clearTimeout(loadingTimeout);
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        setError(null);

        if (event === "TOKEN_REFRESHED") {
          // Token was silently refreshed — session is still valid
          console.debug("[auth] Token refreshed");
        }

        if (event === "SIGNED_OUT") {
          setUser(null);
          setSession(null);
        }
      }
    );

    // Then get the initial session
    supabase.auth.getSession().then(({ data: { session }, error: err }) => {
      if (!isMounted) return;
      window.clearTimeout(loadingTimeout);
      if (err) {
        console.error("[auth] Failed to get session:", err);
        setError("Error al cargar la sesión");
        setLoading(false);
        return;
      }
      // Only set if the listener hasn't already set it
      setSession(prev => prev ?? session);
      setUser(prev => prev ?? session?.user ?? null);
      setLoading(false);
    }).catch((err) => {
      if (!isMounted) return;
      window.clearTimeout(loadingTimeout);
      console.error("[auth] Failed to get session:", err);
      setError("Error al cargar la sesión");
      setLoading(false);
    });

    // Proactive refresh: check token expiry every 4 minutes
    // Supabase auto-refreshes, but this ensures we catch edge cases
    const refreshInterval = setInterval(async () => {
      const { data: { session: current } } = await supabase.auth.getSession();
      if (current) {
        const expiresAt = current.expires_at ?? 0;
        const nowSecs = Math.floor(Date.now() / 1000);
        // If token expires within 5 minutes, force refresh
        if (expiresAt - nowSecs < 300) {
          const { error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError) {
            console.error("[auth] Proactive refresh failed:", refreshError);
          }
        }
      }
    }, 4 * 60 * 1000); // every 4 minutes

    return () => {
      isMounted = false;
      window.clearTimeout(loadingTimeout);
      subscription.unsubscribe();
      clearInterval(refreshInterval);
    };
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    setError(null);
    if (!isSupabaseConfigured) {
      return { error: new Error("Supabase no está configurado en este preview") };
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? new Error(error.message) : null };
  }, []);

  const signInWithMagicLink = useCallback(async (email: string) => {
    setError(null);
    if (!isSupabaseConfigured) {
      return { error: new Error("Supabase no está configurado en este preview") };
    }
    const emailRedirectTo = window.location.origin;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo,
        shouldCreateUser: false,
      },
    });
    return { error: error ? new Error(error.message) : null };
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    setError(null);
    if (!isSupabaseConfigured) {
      return { error: new Error("Supabase no está configurado en este preview") };
    }
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });
    return { error: error ? new Error(error.message) : null };
  }, []);

  const signOut = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    await supabase.auth.signOut();
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setError(null);
    if (!isSupabaseConfigured) {
      return { error: new Error("Supabase no está configurado en este preview") };
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });
    return { error: error ? new Error(error.message) : null };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        error,
        isConfigured: isSupabaseConfigured,
        signInWithEmail,
        signInWithMagicLink,
        signUp,
        signOut,
        signInWithGoogle,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
