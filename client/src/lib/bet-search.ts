import type { Bet } from "@shared/schema";

const SEARCH_FIELDS = [
  "event",
  "market",
  "sport",
  "league",
  "tipster",
  "position",
  "marketType",
  "formation",
  "matchSide",
  "tags",
  "bookie",
  "comment",
  "player",
  "tactic",
] as const;

function normalizeSearchValue(value: unknown): string {
  if (value == null) return "";
  if (Array.isArray(value)) {
    return value.map(normalizeSearchValue).filter(Boolean).join(" ");
  }
  if (value instanceof Date) return value.toISOString().toLowerCase();
  if (typeof value === "object") return "";

  return String(value).toLowerCase();
}

export function getBetSearchText(bet: Bet): string {
  const source = bet as unknown as Record<string, unknown>;

  return SEARCH_FIELDS
    .map((field) => normalizeSearchValue(source[field]))
    .filter(Boolean)
    .join(" ");
}

export function matchesBetSearch(bet: Bet, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  return getBetSearchText(bet).includes(normalizedQuery);
}
