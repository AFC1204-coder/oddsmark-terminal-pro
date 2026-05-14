import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

function getProjectRef(url: string): string {
  try {
    return new URL(url).hostname.split(".")[0] || "local";
  } catch {
    return "local";
  }
}

function getKeyFingerprint(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

const authStoragePrefix = "terminal-pro-supabase";
const authStorageKey = `${authStoragePrefix}-${getProjectRef(supabaseUrl || "http://localhost")}-${getKeyFingerprint(supabaseAnonKey || "preview")}`;

if (typeof window !== "undefined") {
  const currentFingerprint = `${supabaseUrl || "missing"}:${getKeyFingerprint(supabaseAnonKey || "preview")}`;
  const previousFingerprint = window.localStorage.getItem(`${authStoragePrefix}-fingerprint`);
  if (previousFingerprint && previousFingerprint !== currentFingerprint) {
    Object.keys(window.localStorage)
      .filter((key) => key.startsWith(authStoragePrefix))
      .forEach((key) => window.localStorage.removeItem(key));
  }
  window.localStorage.setItem(`${authStoragePrefix}-fingerprint`, currentFingerprint);
}

export const isSupabaseConfigured = hasSupabaseConfig;

export const supabase = createClient(
  hasSupabaseConfig ? supabaseUrl : "http://127.0.0.1:54321",
  hasSupabaseConfig ? supabaseAnonKey : "preview-disabled",
  {
    auth: {
      storageKey: authStorageKey,
    },
  },
);
