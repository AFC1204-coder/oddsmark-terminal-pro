import { useContext } from "react";
import { AuthContext } from "@/contexts/auth-context-core";

export function useSupabaseAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useSupabaseAuth must be used within an AuthProvider");
  }
  return context;
}
