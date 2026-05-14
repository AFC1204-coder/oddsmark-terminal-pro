import { applyBetAnalysisFilters } from "@/lib/bet-analysis";
import type { Bet } from "@shared/schema";

export interface BetFilters {
  dateFrom: string;
  dateTo: string;
  leagues: string[];
  statuses: Array<"won" | "lost" | "pending" | "void">;
  oddsMin: string;
  oddsMax: string;
  stakeMin: string;
  stakeMax: string;
  betType: "" | "pre" | "live" | "longterm";
  cashoutType: "" | "cashout_profit" | "cashout_loss" | "no_cashout";
}

export const defaultFilters: BetFilters = {
  dateFrom: "",
  dateTo: "",
  leagues: [],
  statuses: [],
  oddsMin: "",
  oddsMax: "",
  stakeMin: "",
  stakeMax: "",
  betType: "",
  cashoutType: "",
};

export function hasActiveFilters(filters: BetFilters): boolean {
  return (
    filters.dateFrom !== "" ||
    filters.dateTo !== "" ||
    filters.leagues.length > 0 ||
    filters.statuses.length > 0 ||
    filters.oddsMin !== "" ||
    filters.oddsMax !== "" ||
    filters.stakeMin !== "" ||
    filters.stakeMax !== "" ||
    filters.betType !== "" ||
    filters.cashoutType !== ""
  );
}

export function applyFilters(bets: Bet[], filters: BetFilters): Bet[] {
  return applyBetAnalysisFilters(bets, filters);
}
