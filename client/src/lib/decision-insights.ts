import type { Bet, Transaction } from "@shared/schema";
import { calculateBetProfit } from "./bet-calculations";
import {
  aggregateAvgStake,
  aggregateBets,
  aggregateYield,
  aggregateWinRate,
  type BetAggregate,
} from "./bet-math";
import { getBetAnalysisTimestamp, getBetStakeUnits, isBetSettled } from "./bet-analysis";

export interface WalletBreakdown {
  initialCapitalEUR: number;
  depositsEUR: number;
  withdrawalsEUR: number;
  netDepositsEUR: number;
  bettingProfitUnits: number;
  bettingProfitEUR: number;
  realBankrollEUR: number;
}

export interface DrawdownUnits {
  currentDrawdownUnits: number;
  maxDrawdownUnits: number;
}

export interface OutlierImpact {
  fullYieldPct: number;
  yieldWithoutTopPct: number;
  removedCount: number;
}

export interface ProfitConcentration {
  sharePct: number;
  profitUnits: number;
  settledCount: number;
  oddsThreshold: number;
}

export interface StakeAfterLosses {
  baselineAvgStakeUnits: number;
  afterLossAvgStakeUnits: number;
  sample: number;
  lossStreakLength: number;
}

export interface RecentForm {
  aggregate: BetAggregate;
  sample: number;
  yieldPct: number;
  winRatePct: number;
}

export type SegmentField = "league" | "sport" | "marketType" | "bookie";

export interface SegmentConcentration {
  field: SegmentField;
  label: string;
  aggregate: BetAggregate;
  sharePct: number;
}

export interface DecisionFacts {
  wallet: WalletBreakdown;
  periodAggregate: BetAggregate;
  periodYieldPct: number;
  pendingExposureUnits: number;
  pendingCount: number;
  drawdown: DrawdownUnits;
  liveAggregate: BetAggregate;
  preMatchAggregate: BetAggregate;
  outlierImpact: OutlierImpact | null;
  highOddsConcentration: ProfitConcentration | null;
  stakeAfterLosses: StakeAfterLosses | null;
  recentForm: RecentForm | null;
  topLeagueConcentration: SegmentConcentration | null;
  verificationRatePct: number | null;
  verifiedCount: number;
  verificationTotal: number;
}

export function calculateWalletBreakdown(
  bets: Bet[],
  transactions: Transaction[],
  initialCapitalEUR: number,
  unitValue: number,
): WalletBreakdown {
  const safeUnitValue = unitValue > 0 ? unitValue : 1;
  const depositsEUR = transactions
    .filter((transaction) => transaction.type === "deposit")
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const withdrawalsEUR = transactions
    .filter((transaction) => transaction.type === "withdrawal")
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const bettingProfitUnits = aggregateBets(bets).profit;
  const bettingProfitEUR = bettingProfitUnits * safeUnitValue;
  const netDepositsEUR = depositsEUR - withdrawalsEUR;

  return {
    initialCapitalEUR,
    depositsEUR,
    withdrawalsEUR,
    netDepositsEUR,
    bettingProfitUnits,
    bettingProfitEUR,
    realBankrollEUR: initialCapitalEUR + netDepositsEUR + bettingProfitEUR,
  };
}

export function calculateDrawdownUnits(bets: Bet[]): DrawdownUnits {
  const settled = [...bets]
    .filter(isBetSettled)
    .sort((a, b) => getBetAnalysisTimestamp(a) - getBetAnalysisTimestamp(b));

  let runningProfit = 0;
  let peakProfit = 0;
  let maxDrawdownUnits = 0;

  for (const bet of settled) {
    runningProfit += calculateBetProfit(bet, 1).profit;
    if (runningProfit > peakProfit) {
      peakProfit = runningProfit;
    }
    const drawdown = runningProfit - peakProfit;
    if (drawdown < maxDrawdownUnits) {
      maxDrawdownUnits = drawdown;
    }
  }

  return {
    currentDrawdownUnits: runningProfit - peakProfit,
    maxDrawdownUnits,
  };
}

export function calculateOutlierImpact(bets: Bet[], topPct = 0.05): OutlierImpact | null {
  const pairs = bets
    .filter(isBetSettled)
    .map((bet) => {
      const { profit, totalStake } = calculateBetProfit(bet, 1);
      return { profit, stake: totalStake };
    })
    .filter((pair) => pair.stake > 0)
    .sort((a, b) => b.profit - a.profit);

  const removedCount = Math.floor(pairs.length * topPct);
  if (pairs.length === 0 || removedCount === 0) return null;

  const fullProfit = pairs.reduce((sum, pair) => sum + pair.profit, 0);
  const fullStake = pairs.reduce((sum, pair) => sum + pair.stake, 0);
  const kept = pairs.slice(removedCount);
  const keptProfit = kept.reduce((sum, pair) => sum + pair.profit, 0);
  const keptStake = kept.reduce((sum, pair) => sum + pair.stake, 0);

  return {
    fullYieldPct: fullStake > 0 ? (fullProfit / fullStake) * 100 : 0,
    yieldWithoutTopPct: keptStake > 0 ? (keptProfit / keptStake) * 100 : 0,
    removedCount,
  };
}

export function calculateHighOddsConcentration(
  bets: Bet[],
  oddsThreshold = 3.5,
): ProfitConcentration | null {
  const aggregate = aggregateBets(bets);
  if (aggregate.profit <= 0) return null;

  let profitUnits = 0;
  let settledCount = 0;
  for (const bet of bets) {
    if (!isBetSettled(bet)) continue;
    const { profit, weightedOdds } = calculateBetProfit(bet, 1);
    if (weightedOdds <= oddsThreshold) continue;
    profitUnits += profit;
    settledCount += 1;
  }

  if (profitUnits <= 0 || settledCount === 0) return null;

  return {
    sharePct: (profitUnits / aggregate.profit) * 100,
    profitUnits,
    settledCount,
    oddsThreshold,
  };
}

export function calculateStakeAfterLosses(
  bets: Bet[],
  lossStreakLength = 2,
): StakeAfterLosses | null {
  const settled = [...bets]
    .filter(isBetSettled)
    .sort((a, b) => getBetAnalysisTimestamp(a) - getBetAnalysisTimestamp(b));

  if (settled.length === 0) return null;

  const aggregate = aggregateBets(settled);
  const baselineAvgStakeUnits = aggregateAvgStake(aggregate);
  let currentLossStreak = 0;
  const afterLossStakes: number[] = [];

  for (const bet of settled) {
    if (currentLossStreak >= lossStreakLength) {
      afterLossStakes.push(getBetStakeUnits(bet));
    }

    const { profit } = calculateBetProfit(bet, 1);
    currentLossStreak = profit < 0 ? currentLossStreak + 1 : 0;
  }

  if (afterLossStakes.length < 3 || baselineAvgStakeUnits <= 0) return null;

  const afterLossAvgStakeUnits = afterLossStakes.reduce((sum, stake) => sum + stake, 0) / afterLossStakes.length;

  return {
    baselineAvgStakeUnits,
    afterLossAvgStakeUnits,
    sample: afterLossStakes.length,
    lossStreakLength,
  };
}

export function calculateRecentForm(bets: Bet[], sampleSize = 8): RecentForm | null {
  const recentSettled = [...bets]
    .filter(isBetSettled)
    .sort((a, b) => getBetAnalysisTimestamp(a) - getBetAnalysisTimestamp(b))
    .slice(-sampleSize);

  if (recentSettled.length < 3) return null;

  const aggregate = aggregateBets(recentSettled);
  return {
    aggregate,
    sample: recentSettled.length,
    yieldPct: aggregateYield(aggregate),
    winRatePct: aggregateWinRate(aggregate),
  };
}

function getSegmentLabel(bet: Bet, field: SegmentField): string {
  const value = bet[field];
  if (typeof value === "string" && value.trim()) return value.trim();
  return "Sin segmentar";
}

export function calculateSegmentConcentration(
  bets: Bet[],
  field: SegmentField = "league",
  minSettled = 2,
): SegmentConcentration | null {
  const settled = bets.filter(isBetSettled);
  if (settled.length < minSettled) return null;

  const periodAggregate = aggregateBets(settled);
  const groups = new Map<string, Bet[]>();

  for (const bet of settled) {
    const label = getSegmentLabel(bet, field);
    const current = groups.get(label) ?? [];
    current.push(bet);
    groups.set(label, current);
  }

  const candidates = Array.from(groups.entries())
    .map(([label, groupBets]) => ({
      label,
      aggregate: aggregateBets(groupBets),
    }))
    .filter((candidate) => candidate.aggregate.settled >= minSettled && Math.abs(candidate.aggregate.profit) >= 0.5);

  if (candidates.length === 0) return null;

  const netDirection = periodAggregate.profit >= 0 ? 1 : -1;
  const sameDirection = candidates
    .filter((candidate) => candidate.aggregate.profit * netDirection > 0)
    .sort((a, b) => Math.abs(b.aggregate.profit) - Math.abs(a.aggregate.profit));
  const ranked = sameDirection.length > 0
    ? sameDirection
    : candidates.sort((a, b) => Math.abs(b.aggregate.profit) - Math.abs(a.aggregate.profit));
  const best = ranked[0];

  const denominator = Math.max(Math.abs(periodAggregate.profit), 0.01);
  return {
    field,
    label: best.label,
    aggregate: best.aggregate,
    sharePct: (Math.abs(best.aggregate.profit) / denominator) * 100,
  };
}

export function buildDecisionFacts(
  periodBets: Bet[],
  allBets: Bet[],
  transactions: Transaction[],
  initialCapitalEUR: number,
  unitValue: number,
): DecisionFacts {
  const periodAggregate = aggregateBets(periodBets);
  const pendingBets = periodBets.filter((bet) => bet.status !== "void" && !isBetSettled(bet));
  const pendingExposureUnits = pendingBets
    .reduce((sum, bet) => sum + getBetStakeUnits(bet), 0);
  const verifiedCount = allBets.filter((bet) => bet.verified).length;

  return {
    wallet: calculateWalletBreakdown(allBets, transactions, initialCapitalEUR, unitValue),
    periodAggregate,
    periodYieldPct: aggregateYield(periodAggregate),
    pendingExposureUnits,
    pendingCount: pendingBets.length,
    drawdown: calculateDrawdownUnits(periodBets),
    liveAggregate: aggregateBets(periodBets.filter((bet) => bet.isLive === true)),
    preMatchAggregate: aggregateBets(periodBets.filter((bet) => bet.isLive !== true && bet.isLongTerm !== true)),
    outlierImpact: calculateOutlierImpact(periodBets),
    highOddsConcentration: calculateHighOddsConcentration(periodBets),
    stakeAfterLosses: calculateStakeAfterLosses(periodBets),
    recentForm: calculateRecentForm(periodBets),
    topLeagueConcentration: calculateSegmentConcentration(periodBets, "league"),
    verificationRatePct: allBets.length > 0 ? (verifiedCount / allBets.length) * 100 : null,
    verifiedCount,
    verificationTotal: allBets.length,
  };
}
