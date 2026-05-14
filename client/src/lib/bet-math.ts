/**
 * Betting math utilities: EV, implied probability, CLV, Kelly, aggregation.
 */
import type { Bet } from "@shared/schema";
import { calculateBetProfit } from "./bet-calculations";
import { calcSimpleBetProfit } from "@shared/calc-profit";

/**
 * Calculate profit/loss for a bet. This is the SINGLE SOURCE OF TRUTH
 * for profit calculation — all other code should use this function.
 */
export function calcBetProfit(
  status: string,
  odds: number,
  stake: number,
  isCashout?: boolean | null,
  cashoutVal?: number | null,
): number {
  return calcSimpleBetProfit(status, odds, stake, isCashout, cashoutVal);
}

/** Convert decimal odds to implied probability (%) */
export function impliedProbability(odds: number): number {
  if (odds <= 1) return 100;
  return (1 / odds) * 100;
}

/** Calculate Expected Value given odds and your estimated probability (0-1) */
export function expectedValue(odds: number, estimatedProb: number, stake: number): number {
  return (estimatedProb * (odds - 1) * stake) - ((1 - estimatedProb) * stake);
}

/** EV as percentage of stake */
export function evPercentage(odds: number, estimatedProb: number): number {
  return (estimatedProb * odds - 1) * 100;
}

/** Closing Line Value: how much better your odds were vs closing */
export function closingLineValue(entryOdds: number, closingOdds: number): number {
  if (!closingOdds || closingOdds <= 1) return 0;
  const entryProb = 1 / entryOdds;
  const closingProb = 1 / closingOdds;
  return ((closingProb - entryProb) / entryProb) * 100;
}

/** Kelly Criterion: optimal fraction of bankroll to bet */
export function kellyCriterion(odds: number, estimatedProb: number): number {
  const b = odds - 1;
  const q = 1 - estimatedProb;
  const kelly = (b * estimatedProb - q) / b;
  return Math.max(0, kelly) * 100; // percentage
}

/** Format probability nicely */
export function formatProb(odds: number): string {
  const p = impliedProbability(odds);
  return `${p.toFixed(1)}%`;
}

/**
 * Aggregate a list of bets into the standard per-segment statistics used
 * across the app (breakdowns, stat cards, widgets).
 *
 * Conventions:
 *  - Pending and void bets count toward `total` but NOT toward `settled`,
 *    `stake`, `wins` or `losses` — a void bet is as if it never happened.
 *  - Escalera (multi-leg) bets are resolved via calculateBetProfit, which
 *    only reports them as settled when every leg is resolved OR any leg
 *    was cashed out. Partial escaleras stay pending.
 *  - Profit and stake are reported in bet "units" (same scale as bet.stake);
 *    convert to EUR at the call site if needed.
 */
export interface BetAggregate {
  total: number;
  settled: number;
  wins: number;
  losses: number;
  profit: number;
  stake: number;
  oddsSum: number;
}

export function emptyAggregate(): BetAggregate {
  return { total: 0, settled: 0, wins: 0, losses: 0, profit: 0, stake: 0, oddsSum: 0 };
}

export function aggregateBets(bets: Bet[]): BetAggregate {
  const agg = emptyAggregate();
  for (const bet of bets) {
    agg.total += 1;
    if (bet.status === "void") continue;
    const { profit, isPending, isSettled, totalStake, weightedOdds } = calculateBetProfit(bet, 1);
    if (isPending || !isSettled) continue;
    agg.settled += 1;
    agg.profit += profit;
    agg.stake += totalStake;
    agg.oddsSum += weightedOdds;
    if (profit > 0) agg.wins += 1;
    else if (profit < 0) agg.losses += 1;
  }
  return agg;
}

/** Cumulative yield: profit / staked, in percent. 0 when no stake. */
export const aggregateYield = (a: BetAggregate): number =>
  a.stake > 0 ? (a.profit / a.stake) * 100 : 0;

/** Win rate over resolved bets (excludes void), in percent. */
export const aggregateWinRate = (a: BetAggregate): number =>
  a.settled > 0 ? (a.wins / a.settled) * 100 : 0;

/** Average odds over settled bets, with weighted odds for escaleras. */
export const aggregateAvgOdds = (a: BetAggregate): number =>
  a.settled > 0 ? a.oddsSum / a.settled : 0;

/** Average settled stake. */
export const aggregateAvgStake = (a: BetAggregate): number =>
  a.settled > 0 ? a.stake / a.settled : 0;

/**
 * Per-bet result distribution. Each settled bet contributes a single profit
 * value (in units, same scale as bet.stake). Void and pending are ignored.
 * Escalera bets contribute their aggregated leg profit, not per-leg.
 *
 * Used by the P&L histogram to reveal outlier-driven edges: if removing the
 * top 5% of results turns a positive yield into a losing one, the "edge" is
 * a handful of lucky parlays, not a repeatable pattern.
 */
export function perBetResults(bets: Bet[]): number[] {
  const out: number[] = [];
  for (const bet of bets) {
    if (bet.status === "void") continue;
    const { profit, isPending } = calculateBetProfit(bet, 1);
    if (isPending) continue;
    out.push(profit);
  }
  return out;
}

/**
 * Trim the extreme `pct` percent from both tails of a numeric array and
 * return the remaining values plus the counts that were dropped. 0.05 = 5%.
 * Used by the histogram "quitar outliers" toggle.
 */
export function trimmedResults(
  values: number[],
  pct: number,
): { trimmed: number[]; droppedLow: number; droppedHigh: number } {
  if (values.length === 0 || pct <= 0) {
    return { trimmed: values.slice(), droppedLow: 0, droppedHigh: 0 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const droppedLow = Math.floor(sorted.length * pct);
  const droppedHigh = Math.floor(sorted.length * pct);
  const trimmed = sorted.slice(droppedLow, sorted.length - droppedHigh);
  return { trimmed, droppedLow, droppedHigh };
}
