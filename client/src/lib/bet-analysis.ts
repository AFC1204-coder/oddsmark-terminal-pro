import type { Bet } from "@shared/schema";
import { calculateBetProfit } from "./bet-calculations";

export type BetStatusFilter = "won" | "lost" | "pending" | "void";
export type BetKindFilter = "" | "pre" | "live" | "longterm";
export type CashoutFilter = "" | "cashout_profit" | "cashout_loss" | "no_cashout";

export interface BetAnalysisFilters {
  dateFrom?: string;
  dateTo?: string;
  leagues?: string[];
  statuses?: BetStatusFilter[];
  oddsMin?: string;
  oddsMax?: string;
  stakeMin?: string;
  stakeMax?: string;
  betType?: BetKindFilter;
  cashoutType?: CashoutFilter;
  bookie?: string;
  sport?: string;
  league?: string;
  tipster?: string;
  isLive?: BetKindFilter;
  marketType?: string;
  position?: string;
  formation?: string;
  matchSide?: string;
}

export type YieldComparisonPeriod = "1S" | "1M" | "3M" | "YTD" | "ALL";

export interface YieldComparisonPoint {
  date: string;
  globalYield: number;
  filteredYield: number;
}

export function toLocalDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function getBetDisplayDate(bet: Bet): string {
  let dateStr = "";
  if (bet.isLongTerm && bet.resolutionDate) {
    dateStr = bet.resolutionDate;
  } else if (bet.date) {
    dateStr = bet.date;
  } else if (bet.createdAt) {
    dateStr = new Date(bet.createdAt).toISOString().split("T")[0];
  }
  if (dateStr.includes("T")) return dateStr.split("T")[0];
  return dateStr.substring(0, 10);
}

export function dateKeyToLocalTimestamp(dateStr: string): number {
  if (!dateStr) return 0;
  const [year, month, day] = dateStr.substring(0, 10).split("-").map(Number);
  if (Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)) {
    return new Date(year, month - 1, day).getTime();
  }
  const time = new Date(dateStr).getTime();
  return Number.isNaN(time) ? 0 : time;
}

export function getBetStakeUnits(bet: Bet): number {
  if (bet.betType === "escalera" && Array.isArray(bet.selections)) {
    return bet.selections.reduce((sum, selection) => {
      const stake = typeof selection === "object" && selection !== null && "stake" in selection
        ? Number((selection as { stake?: unknown }).stake)
        : 0;
      return sum + (Number.isFinite(stake) ? stake : 0);
    }, 0);
  }
  return Number.isFinite(bet.stake) ? bet.stake : 0;
}

export function hasAnyCashout(bet: Bet): boolean {
  if (bet.isCashout) return true;
  if (!Array.isArray(bet.selections)) return false;
  return bet.selections.some(selection =>
    typeof selection === "object" &&
    selection !== null &&
    "isCashout" in selection &&
    Boolean((selection as { isCashout?: unknown }).isCashout)
  );
}

export function getCashoutKind(bet: Bet): "none" | "profit" | "loss" | "flat" {
  if (!hasAnyCashout(bet)) return "none";
  const { profit, isPending } = calculateBetProfit(bet, 1);
  if (isPending) return "none";
  if (profit > 0) return "profit";
  if (profit < 0) return "loss";
  return "flat";
}

export function isBetSettled(bet: Bet): boolean {
  const { isSettled, isPending } = calculateBetProfit(bet, 1);
  return isSettled && !isPending;
}

export function getBetAnalysisTimestamp(bet: Bet): number {
  const dateStr = getBetDisplayDate(bet);
  if (!dateStr) return 0;
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)
    ? new Date(year, month - 1, day)
    : new Date(dateStr);
  if (Number.isNaN(date.getTime())) return 0;
  const [hours = 0, minutes = 0] = (bet.time || "00:00").split(":").map(Number);
  date.setHours(hours || 0, minutes || 0, 0, 0);
  return date.getTime();
}

export function applyBetAnalysisFilters(bets: Bet[], filters: BetAnalysisFilters): Bet[] {
  return bets.filter((bet) => {
    const displayDate = getBetDisplayDate(bet);
    const stake = getBetStakeUnits(bet);

    if (filters.dateFrom && (!displayDate || displayDate < filters.dateFrom)) return false;
    if (filters.dateTo && (!displayDate || displayDate > filters.dateTo)) return false;
    if (filters.leagues?.length && !filters.leagues.includes(bet.league)) return false;
    if (filters.league && bet.league !== filters.league) return false;
    if (filters.bookie && bet.bookie !== filters.bookie) return false;
    if (filters.sport && bet.sport !== filters.sport) return false;
    if (filters.tipster && bet.tipster !== filters.tipster) return false;
    if (filters.marketType && bet.marketType !== filters.marketType) return false;
    if (filters.position && bet.position !== filters.position) return false;
    if (filters.formation && bet.formation !== filters.formation) return false;
    if (filters.matchSide && bet.matchSide !== filters.matchSide) return false;

    if (filters.statuses?.length) {
      const status = bet.status as BetStatusFilter;
      if (!filters.statuses.includes(status)) return false;
    }

    if (filters.oddsMin) {
      const min = parseFloat(filters.oddsMin);
      if (!Number.isNaN(min) && bet.odds < min) return false;
    }
    if (filters.oddsMax) {
      const max = parseFloat(filters.oddsMax);
      if (!Number.isNaN(max) && bet.odds > max) return false;
    }
    if (filters.stakeMin) {
      const min = parseFloat(filters.stakeMin);
      if (!Number.isNaN(min) && stake < min) return false;
    }
    if (filters.stakeMax) {
      const max = parseFloat(filters.stakeMax);
      if (!Number.isNaN(max) && stake > max) return false;
    }

    const kind = filters.betType || filters.isLive || "";
    if (kind) {
      const isLive = bet.isLive === true;
      const isLongTerm = bet.isLongTerm === true || bet.betType === "longterm";
      if (kind === "pre" && (isLive || isLongTerm)) return false;
      if (kind === "live" && !isLive) return false;
      if (kind === "longterm" && !isLongTerm) return false;
    }

    if (filters.cashoutType) {
      const cashoutKind = getCashoutKind(bet);
      if (filters.cashoutType === "no_cashout" && cashoutKind !== "none") return false;
      if (filters.cashoutType === "cashout_profit" && cashoutKind !== "profit") return false;
      if (filters.cashoutType === "cashout_loss" && cashoutKind !== "loss") return false;
    }

    return true;
  });
}

function isDateInsideYieldPeriod(date: string, period: YieldComparisonPeriod, now: Date): boolean {
  const ts = dateKeyToLocalTimestamp(date);
  if (ts === 0) return false;
  if (period === "ALL") return true;

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diffDays = (today - ts) / 86_400_000;
  if (diffDays < 0) return false;
  if (period === "1S") return diffDays <= 7;
  if (period === "1M") return diffDays <= 30;
  if (period === "3M") return diffDays <= 90;
  if (period === "YTD") return ts >= new Date(now.getFullYear(), 0, 1).getTime();
  return true;
}

function cumulativeYieldByDate(bets: Bet[]): Map<string, number> {
  const settled = [...bets]
    .filter(isBetSettled)
    .sort((a, b) => getBetAnalysisTimestamp(a) - getBetAnalysisTimestamp(b));

  const threshold = Math.min(10, Math.max(1, Math.floor(settled.length * 0.2)));
  let runningProfit = 0;
  let runningStake = 0;
  let count = 0;
  const byDate = new Map<string, number>();

  for (const bet of settled) {
    const { profit, totalStake } = calculateBetProfit(bet, 1);
    runningProfit += profit;
    runningStake += totalStake;
    count++;

    const date = getBetDisplayDate(bet);
    if (date && count >= threshold && runningStake > 0) {
      byDate.set(date, (runningProfit / runningStake) * 100);
    }
  }

  return byDate;
}

export function buildYieldComparisonSeries(
  globalBets: Bet[],
  filteredBets: Bet[],
  period: YieldComparisonPeriod,
  now: Date = new Date(),
): YieldComparisonPoint[] {
  const globalData = cumulativeYieldByDate(globalBets);
  const filteredData = cumulativeYieldByDate(filteredBets);
  const dates = new Set([...Array.from(globalData.keys()), ...Array.from(filteredData.keys())]);
  const sortedDates = Array.from(dates)
    .filter(date => isDateInsideYieldPeriod(date, period, now))
    .sort((a, b) => dateKeyToLocalTimestamp(a) - dateKeyToLocalTimestamp(b));

  let lastGlobal = 0;
  let lastFiltered = 0;
  return sortedDates.map((date) => {
    const globalYield = globalData.get(date);
    const filteredYield = filteredData.get(date);
    if (globalYield !== undefined) lastGlobal = globalYield;
    if (filteredYield !== undefined) lastFiltered = filteredYield;
    return { date, globalYield: lastGlobal, filteredYield: lastFiltered };
  });
}
