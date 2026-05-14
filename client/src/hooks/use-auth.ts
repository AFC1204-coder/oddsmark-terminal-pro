import { useSupabaseAuth } from "@/hooks/use-supabase-auth";

export interface AuthUser {
  id: string;
  email: string | undefined;
}

export function useAuth() {
  const { user, loading, signOut } = useSupabaseAuth();

  const mappedUser: AuthUser | null = user
    ? {
        id: user.id,
        email: user.email,
      }
    : null;

  return {
    user: mappedUser,
    isLoading: loading,
    isAuthenticated: !!user,
    logout: signOut,
    isLoggingOut: false,
  };
}
