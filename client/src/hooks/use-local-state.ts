import { useState, useCallback, useEffect } from "react";

/**
 * useState + localStorage persistence. The stored value survives reloads,
 * tab switches and navigations, which matters for chart preferences a power
 * user tweaks once and expects to stick.
 *
 * SSR-safe: reads from localStorage lazily inside the initializer, so no
 * access to `window` happens during server rendering.
 *
 * Schema mismatch is handled by falling back to the default — e.g. if a
 * previous version saved `"banca" | "rendimiento"` and a new version adds
 * `"roi"`, the caller passes a type-guard via `isValid` to reject stale
 * values instead of crashing on unexpected strings.
 */
export function useLocalState<T>(
  key: string,
  defaultValue: T,
  isValid?: (raw: unknown) => raw is T,
): [T, (value: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return defaultValue;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return defaultValue;
      const parsed = JSON.parse(raw);
      if (isValid && !isValid(parsed)) return defaultValue;
      return parsed as T;
    } catch {
      return defaultValue;
    }
  });

  // Persist on change. Wrapped in try/catch because localStorage can throw
  // (Safari private mode, quota exceeded, blocked storage).
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore
    }
  }, [key, value]);

  const set = useCallback((next: T | ((prev: T) => T)) => {
    setValue(next);
  }, []);

  return [value, set];
}
