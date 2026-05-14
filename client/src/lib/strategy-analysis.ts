import type { Bet, Strategy } from "@shared/schema";
import {
  aggregateAvgOdds,
  aggregateAvgStake,
  aggregateBets,
  aggregateWinRate,
  aggregateYield,
} from "@/lib/bet-math";
import { calculateBetProfit } from "@/lib/bet-calculations";
import {
  getBetAnalysisTimestamp,
  getBetDisplayDate,
  getBetStakeUnits,
  isBetSettled,
} from "@/lib/bet-analysis";

export type StrategyHealthTone = "good" | "warning" | "danger" | "neutral";

export interface StrategyHealthTag {
  label: string;
  tone: StrategyHealthTone;
}

export interface StrategyDecision {
  label: "Seguir" | "Ajustar" | "Pausar" | "Observar";
  tone: StrategyHealthTone;
  reason: string;
}

export interface StrategyDimensionSummary {
  label: string;
  count: number;
  profit: number;
}

export interface StrategyPnlPoint {
  index: number;
  date: string;
  profit: number;
}

export interface StrategyBetSnapshot {
  bet: Bet;
  date: string;
  profit: number;
  stake: number;
  odds: number;
  isSettled: boolean;
  isPending: boolean;
}

export interface StrategyAnalysis {
  strategy: Strategy;
  bets: Bet[];
  settledBets: Bet[];
  pendingBets: Bet[];
  profit: number;
  yieldPct: number;
  winRate: number;
  settledCount: number;
  pendingCount: number;
  averageStake: number;
  averageOdds: number;
  maxDrawdownUnits: number;
  currentLossStreak: number;
  bestBet: StrategyBetSnapshot | null;
  worstBet: StrategyBetSnapshot | null;
  latestBets: StrategyBetSnapshot[];
  pnlCurve: StrategyPnlPoint[];
  healthTags: StrategyHealthTag[];
  sports: StrategyDimensionSummary[];
  leagues: StrategyDimensionSummary[];
  markets: StrategyDimensionSummary[];
  liveCount: number;
  preMatchCount: number;
  decision: StrategyDecision;
}

export interface StrategyRules {
  description: string;
  oddsRange: string;
  baseStake: string;
  timing: "any" | "pre" | "live";
  preferredSportsMarkets: string;
  exposureLimit: string;
  pauseCondition: string;
}

export type StrategyRulesById = Record<string, StrategyRules>;

export const emptyStrategyRules: StrategyRules = {
  description: "",
  oddsRange: "",
  baseStake: "",
  timing: "any",
  preferredSportsMarkets: "",
  exposureLimit: "",
  pauseCondition: "",
};

export function isStrategyRulesById(raw: unknown): raw is StrategyRulesById {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;

  return Object.values(raw).every((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const record = value as Partial<Record<keyof StrategyRules, unknown>>;
    return (
      typeof record.description === "string" &&
      typeof record.oddsRange === "string" &&
      typeof record.baseStake === "string" &&
      (record.timing === "any" || record.timing === "pre" || record.timing === "live") &&
      typeof record.preferredSportsMarkets === "string" &&
      typeof record.exposureLimit === "string" &&
      typeof record.pauseCondition === "string"
    );
  });
}

export function analyzeStrategies(strategies: Strategy[], bets: Bet[]): StrategyAnalysis[] {
  return strategies.map((strategy) => analyzeStrategy(strategy, bets));
}

export function analyzeStrategy(strategy: Strategy, bets: Bet[]): StrategyAnalysis {
  const strategyBets = bets.filter((bet) => bet.strategyId === strategy.id);
  const settledBets = strategyBets.filter(isBetSettled);
  const pendingBets = strategyBets.filter((bet) => {
    if (bet.status === "void") return false;
    const result = calculateBetProfit(bet, 1);
    return result.isPending || !result.isSettled;
  });
  const aggregate = aggregateBets(strategyBets);
  const snapshots = strategyBets.map(toSnapshot);
  const settledSnapshots = snapshots.filter((snapshot) => snapshot.isSettled);
  const sortedSettled = [...settledSnapshots].sort((a, b) => getBetAnalysisTimestamp(a.bet) - getBetAnalysisTimestamp(b.bet));
  const profit = aggregate.profit;
  const averageStake = aggregateAvgStake(aggregate);
  const averageOdds = aggregateAvgOdds(aggregate);
  const bestBet = maxBy(settledSnapshots, (snapshot) => snapshot.profit);
  const worstBet = minBy(settledSnapshots, (snapshot) => snapshot.profit);

  const baseAnalysis: Omit<StrategyAnalysis, "healthTags" | "decision"> = {
    strategy,
    bets: strategyBets,
    settledBets,
    pendingBets,
    profit,
    yieldPct: aggregateYield(aggregate),
    winRate: aggregateWinRate(aggregate),
    settledCount: aggregate.settled,
    pendingCount: pendingBets.length,
    averageStake,
    averageOdds,
    maxDrawdownUnits: calculateMaxDrawdownUnits(sortedSettled),
    currentLossStreak: calculateCurrentLossStreak(sortedSettled),
    bestBet,
    worstBet,
    latestBets: [...snapshots]
      .sort((a, b) => getBetAnalysisTimestamp(b.bet) - getBetAnalysisTimestamp(a.bet))
      .slice(0, 6),
    pnlCurve: buildPnlCurve(sortedSettled),
    sports: summarizeDimension(strategyBets, (bet) => bet.sport || "Sin deporte"),
    leagues: summarizeDimension(strategyBets, (bet) => bet.league || "Sin liga"),
    markets: summarizeDimension(strategyBets, (bet) => bet.marketType || bet.market || "Sin mercado"),
    liveCount: strategyBets.filter((bet) => bet.isLive).length,
    preMatchCount: strategyBets.filter((bet) => !bet.isLive && !bet.isLongTerm).length,
  };

  const healthTags = buildStrategyHealthTags(baseAnalysis);

  return {
    ...baseAnalysis,
    healthTags,
    decision: buildStrategyDecision(baseAnalysis, healthTags),
  };
}

function toSnapshot(bet: Bet): StrategyBetSnapshot {
  const result = calculateBetProfit(bet, 1);
  return {
    bet,
    date: getBetDisplayDate(bet),
    profit: result.profit,
    stake: getBetStakeUnits(bet),
    odds: result.weightedOdds,
    isSettled: result.isSettled && !result.isPending,
    isPending: result.isPending || !result.isSettled,
  };
}

function buildPnlCurve(settledSnapshots: StrategyBetSnapshot[]): StrategyPnlPoint[] {
  const points: StrategyPnlPoint[] = [{ index: 0, date: "", profit: 0 }];
  let runningProfit = 0;
  settledSnapshots.forEach((snapshot, index) => {
    runningProfit += snapshot.profit;
    points.push({
      index: index + 1,
      date: snapshot.date,
      profit: roundTo(runningProfit, 2),
    });
  });
  return points;
}

function calculateMaxDrawdownUnits(settledSnapshots: StrategyBetSnapshot[]): number {
  let runningProfit = 0;
  let peak = 0;
  let maxDrawdown = 0;

  for (const snapshot of settledSnapshots) {
    runningProfit += snapshot.profit;
    if (runningProfit > peak) peak = runningProfit;
    maxDrawdown = Math.max(maxDrawdown, peak - runningProfit);
  }

  return roundTo(maxDrawdown, 2);
}

function calculateCurrentLossStreak(settledSnapshots: StrategyBetSnapshot[]): number {
  let streak = 0;
  for (const snapshot of [...settledSnapshots].reverse()) {
    if (snapshot.profit < 0) streak += 1;
    else break;
  }
  return streak;
}

function summarizeDimension(bets: Bet[], keyOf: (bet: Bet) => string): StrategyDimensionSummary[] {
  const byLabel = new Map<string, StrategyDimensionSummary>();

  for (const bet of bets) {
    const label = keyOf(bet).trim() || "Sin dato";
    const result = calculateBetProfit(bet, 1);
    const current = byLabel.get(label) ?? { label, count: 0, profit: 0 };
    current.count += 1;
    if (result.isSettled && !result.isPending) current.profit += result.profit;
    byLabel.set(label, current);
  }

  return Array.from(byLabel.values())
    .sort((a, b) => b.count - a.count || b.profit - a.profit || a.label.localeCompare(b.label))
    .slice(0, 3)
    .map((item) => ({ ...item, profit: roundTo(item.profit, 2) }));
}

function buildStrategyHealthTags(analysis: Omit<StrategyAnalysis, "healthTags" | "decision">): StrategyHealthTag[] {
  const tags: StrategyHealthTag[] = [];
  const nonVoidCount = analysis.bets.filter((bet) => bet.status !== "void").length;
  const pendingRatio = nonVoidCount > 0 ? analysis.pendingCount / nonVoidCount : 0;

  if (analysis.settledCount < 8) {
    tags.push({ label: "Muestra pequeña", tone: "warning" });
  }

  if (analysis.currentLossStreak >= 3) {
    tags.push({ label: "Racha negativa", tone: "danger" });
  }

  if (analysis.pendingCount >= 3 && pendingRatio >= 0.35) {
    tags.push({ label: "Pendientes altos", tone: "warning" });
  }

  if (analysis.maxDrawdownUnits >= Math.max(3, analysis.averageStake * 3)) {
    tags.push({ label: "Drawdown elevado", tone: "danger" });
  }

  const bestProfit = analysis.bestBet?.profit ?? 0;
  if (analysis.profit > 0 && analysis.settledCount >= 3 && bestProfit / analysis.profit >= 0.55) {
    tags.push({ label: "Dependiente de una apuesta", tone: "warning" });
  }

  if (analysis.averageStake >= 3) {
    tags.push({ label: "Stake medio alto", tone: "warning" });
  }

  if (isYieldInflatedByHighOdds(analysis)) {
    tags.push({ label: "Yield inflado por cuota alta", tone: "warning" });
  }

  if (
    analysis.settledCount >= 8 &&
    analysis.profit > 0 &&
    analysis.yieldPct >= 5 &&
    analysis.currentLossStreak === 0 &&
    !tags.some((tag) => tag.tone === "danger")
  ) {
    tags.unshift({ label: "En forma", tone: "good" });
  }

  if (tags.length === 0) {
    tags.push({ label: "Seguimiento neutro", tone: "neutral" });
  }

  return tags;
}

function buildStrategyDecision(
  analysis: Omit<StrategyAnalysis, "healthTags" | "decision">,
  tags: StrategyHealthTag[],
): StrategyDecision {
  if (analysis.settledCount === 0) {
    return {
      label: "Observar",
      tone: "neutral",
      reason: "Aún no hay apuestas resueltas para decidir.",
    };
  }

  if (tags.some((tag) => tag.tone === "danger")) {
    return {
      label: "Pausar",
      tone: "danger",
      reason: "Hay señales de riesgo: revisa drawdown, racha o dependencia antes de seguir.",
    };
  }

  const warningsBeyondSample = tags.some((tag) => tag.tone === "warning" && tag.label !== "Muestra pequeña");
  if (warningsBeyondSample) {
    return {
      label: "Ajustar",
      tone: "warning",
      reason: "La estrategia funciona con reservas: reduce exposición o acota mercados.",
    };
  }

  if (analysis.settledCount < 8) {
    return {
      label: "Observar",
      tone: "neutral",
      reason: "La muestra todavía es corta; acumula más apuestas antes de escalar stake.",
    };
  }

  if (analysis.profit > 0 && analysis.yieldPct >= 5) {
    return {
      label: "Seguir",
      tone: "good",
      reason: "P&L y yield acompañan sin señales críticas.",
    };
  }

  return {
    label: "Ajustar",
    tone: "warning",
    reason: "No hay ventaja clara; revisa reglas, cuotas o stake base.",
  };
}

function isYieldInflatedByHighOdds(analysis: Omit<StrategyAnalysis, "healthTags" | "decision">): boolean {
  if (analysis.profit <= 0 || analysis.settledCount < 3) return false;

  const highOddsWins = analysis.settledBets
    .map(toSnapshot)
    .filter((snapshot) => snapshot.profit > 0 && snapshot.odds >= 3.5);
  if (highOddsWins.length === 0) return false;

  const highOddsProfit = highOddsWins.reduce((sum, snapshot) => sum + snapshot.profit, 0);
  return highOddsProfit / analysis.profit >= 0.6 || (analysis.bestBet?.odds ?? 0) >= 4;
}

function maxBy<T>(items: T[], score: (item: T) => number): T | null {
  if (items.length === 0) return null;
  return items.reduce((best, item) => score(item) > score(best) ? item : best);
}

function minBy<T>(items: T[], score: (item: T) => number): T | null {
  if (items.length === 0) return null;
  return items.reduce((worst, item) => score(item) < score(worst) ? item : worst);
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
