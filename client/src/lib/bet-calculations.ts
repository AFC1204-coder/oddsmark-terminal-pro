import type { Bet } from "@shared/schema";
import {
  calculateBetProfit as calculateSharedBetProfit,
  calculateEscaleraStats as calculateSharedEscaleraStats,
  type BetProfitResult,
  type EscaleraStats,
  type SelectionStep,
} from "@shared/calc-profit";

export type { BetProfitResult, EscaleraStats, SelectionStep } from "@shared/calc-profit";

export function calculateEscaleraStats(
  selections: SelectionStep[],
  multiplier: number = 1
): EscaleraStats {
  return calculateSharedEscaleraStats(selections, multiplier);
}

export function calculateBetProfit(bet: Bet, multiplier: number = 1): BetProfitResult {
  return calculateSharedBetProfit(bet, multiplier);
}
