/**
 * Bankroll time series — single source of truth for the running bankroll,
 * cumulative profit, ROI %, and drawdown % curves rendered by the dashboard
 * chart(s). Split out of StatsSection so the same reducer powers both the
 * filtered (period-aware) curve and the global comparison line.
 */
import type { Bet, Transaction } from "@shared/schema";
import { calculateBetProfit } from "./bet-calculations";
import { dateKeyToLocalTimestamp, getBetDisplayDate, isBetSettled } from "./bet-analysis";

export interface BankrollPoint {
  date: string;
  /** Absolute bankroll in display currency (EUR or units). */
  bankroll: number;
  /** Cumulative profit inside the series in display currency. */
  profit: number;
  /** Cumulative yield inside the series (profit / stake * 100). */
  roiPct: number;
  /**
   * Drawdown from the rolling all-time peak of cumulative profit, as a
   * percent. Always ≤ 0; exactly 0 when the series is at a new peak.
   * Measured on profit (not bankroll) so deposits/withdrawals don't
   * artificially reset the drawdown.
   */
  drawdownPct: number;
  /**
   * Yield % restricted to the last `rollingWindowDays` of events, computed
   * at this point. Only populated when `rollingWindowDays` is set. Unlike
   * `roiPct` (cumulative), this surfaces edge degradation: a falling rolling
   * yield against a rising cumulative yield means the recent form is worse
   * than the overall history.
   */
  rollingRoiPct?: number;
  /** Number of bets contributing to this point (per-bet mode: 0 or 1). */
  betCount?: number;
  /** Stake volume contributing to this point in display currency (EUR or units). */
  stake?: number;
}

/** A flattened event funnelled into the shared reducer. */
interface FlatEvent {
  date: string;
  resultEUR: number;
  stakeEUR: number;
  depositEUR: number;
  withdrawalEUR: number;
  betCount: number;
}

export interface BuildBankrollSeriesOptions {
  /** Bets already filtered to what should appear inside the period. */
  bets: Bet[];
  /** Transactions that happen INSIDE the period. */
  transactions: Transaction[];
  /** Conversion factor from bet "units" to EUR (from user config). */
  unitValue: number;
  /** "money" keeps values in EUR, "units" divides by unitValue. */
  currency: "units" | "money";
  /** Opening bankroll in EUR, already including any pre-period adjustments. */
  openingBankrollEUR: number;
  /** Opening date for the baseline point (day before the first event). */
  openingDate: string;
  /** One point per day vs one point per event. */
  aggregation: "day" | "bet";
  /**
   * Optional pre-period state that seeds the drawdown peak so the curve
   * doesn't claim to be at ATH just because the period starts fresh.
   * Only used by the filtered series; the global line passes zeros.
   */
  seed?: {
    profitEUR: number;
    stakeEUR: number;
    peakProfitEUR: number;
  };
  /**
   * When set, each point also carries `rollingRoiPct` = yield over the last
   * N days of events ending at the point's date. Sliding window is O(n).
   */
  rollingWindowDays?: number;
}

/**
 * Build a bankroll time series from bets and transactions.
 *
 * The function is pure and deterministic given its inputs — no dependency on
 * `Date.now()`, no side effects. Tests can feed fake bets and compare the
 * resulting series byte-for-byte.
 */
export function buildBankrollSeries(opts: BuildBankrollSeriesOptions): BankrollPoint[] {
  const { bets, transactions, unitValue, currency, openingBankrollEUR, openingDate, aggregation, seed, rollingWindowDays } = opts;
  const divider = currency === "money" ? 1 : unitValue;
  const seedProfit = seed?.profitEUR ?? 0;
  const seedStake = seed?.stakeEUR ?? 0;
  const seedPeak = seed?.peakProfitEUR ?? 0;

  const events: FlatEvent[] = aggregation === "bet"
    ? buildPerBetEvents(bets, transactions, unitValue)
    : buildPerDayEvents(bets, transactions, unitValue);

  let runningBankrollEUR = openingBankrollEUR;
  let runningProfitEUR = seedProfit;
  let runningStakeEUR = seedStake;
  let peakProfitEUR = seedPeak;

  // Sliding-window accumulators used only when rollingWindowDays is set.
  // Two-pointer pass over the already-sorted event stream — O(n) total.
  let rollingWindowLeft = 0;
  let rollingProfitEUR = 0;
  let rollingStakeEUR = 0;
  const rollingMs = rollingWindowDays != null ? rollingWindowDays * 86_400_000 : 0;

  const out: BankrollPoint[] = [{
    date: openingDate,
    bankroll: Math.round(runningBankrollEUR / divider),
    profit: 0,
    roiPct: 0,
    drawdownPct: 0,
    ...(rollingWindowDays != null ? { rollingRoiPct: 0 } : {}),
  }];

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    runningBankrollEUR += ev.resultEUR + ev.depositEUR - ev.withdrawalEUR;
    runningProfitEUR += ev.resultEUR;
    runningStakeEUR += ev.stakeEUR;
    if (runningProfitEUR > peakProfitEUR) peakProfitEUR = runningProfitEUR;

    let rollingRoiPct: number | undefined;
    if (rollingWindowDays != null) {
      rollingProfitEUR += ev.resultEUR;
      rollingStakeEUR += ev.stakeEUR;
      const cutoffTs = eventTs(ev.date) - rollingMs;
      while (rollingWindowLeft < i && eventTs(events[rollingWindowLeft].date) < cutoffTs) {
        rollingProfitEUR -= events[rollingWindowLeft].resultEUR;
        rollingStakeEUR -= events[rollingWindowLeft].stakeEUR;
        rollingWindowLeft += 1;
      }
      rollingRoiPct = rollingStakeEUR > 0
        ? Math.round((rollingProfitEUR / rollingStakeEUR) * 1000) / 10
        : 0;
    }

    const periodProfit = runningProfitEUR - seedProfit;
    const periodStake = runningStakeEUR - seedStake;
    out.push({
      date: ev.date,
      bankroll: Math.round(runningBankrollEUR / divider),
      profit: Math.round(periodProfit / divider),
      roiPct: periodStake > 0 ? Math.round((periodProfit / periodStake) * 1000) / 10 : 0,
      drawdownPct: peakProfitEUR > 0
        ? Math.round(((runningProfitEUR - peakProfitEUR) / peakProfitEUR) * 1000) / 10
        : 0,
      ...(rollingRoiPct != null ? { rollingRoiPct } : {}),
      ...(ev.betCount > 0 ? { betCount: ev.betCount } : {}),
      ...(ev.stakeEUR > 0 ? { stake: Math.round((ev.stakeEUR / divider) * 10) / 10 } : {}),
    });
  }
  return out;
}

// ────────────────────────────────────────────────────────────────────────────
// Event producers
// ────────────────────────────────────────────────────────────────────────────

function betToEvent(bet: Bet, unitValue: number): Omit<FlatEvent, "date"> {
  const result = calculateBetProfit(bet, unitValue);
  return {
    resultEUR: result.profit,
    stakeEUR: result.totalStake,
    depositEUR: 0,
    withdrawalEUR: 0,
    betCount: 1,
  };
}

/** NaN-safe timestamp: empty/invalid → 0 so malformed bets don't break sort. */
function eventTs(dateStr: string): number {
  return dateKeyToLocalTimestamp(dateStr);
}

function buildPerBetEvents(bets: Bet[], transactions: Transaction[], unitValue: number): FlatEvent[] {
  const events: FlatEvent[] = [];
  for (const bet of bets) {
    if (!isBetSettled(bet)) continue;
    events.push({ date: getBetDisplayDate(bet), ...betToEvent(bet, unitValue) });
  }
  for (const txn of transactions) {
    events.push({
      date: txn.date,
      resultEUR: 0,
      stakeEUR: 0,
      depositEUR: txn.type === "deposit" ? txn.amount : 0,
      withdrawalEUR: txn.type === "withdrawal" ? txn.amount : 0,
      betCount: 0,
    });
  }
  events.sort((a, b) => eventTs(a.date) - eventTs(b.date));
  return events;
}

/** Max drawdown (non-positive %) across a bet set; 0 if no settled bets.
 *  Convenience wrapper over buildBankrollSeries — callers that already have
 *  a BankrollPoint[] should scan `drawdownPct` directly instead. */
export function maxDrawdownFor(bets: Bet[]): number {
  const settled = bets.filter(isBetSettled);
  if (settled.length === 0) return 0;
  const sorted = [...settled].sort((a, b) => getBetDisplayDate(a).localeCompare(getBetDisplayDate(b)));
  const series = buildBankrollSeries({
    bets: sorted,
    transactions: [],
    unitValue: 1,
    currency: "money",
    openingBankrollEUR: 0,
    openingDate: getBetDisplayDate(sorted[0]) || "",
    aggregation: "bet",
  });
  return series.reduce((m, p) => Math.min(m, p.drawdownPct), 0);
}

function buildPerDayEvents(bets: Bet[], transactions: Transaction[], unitValue: number): FlatEvent[] {
  const byDate = new Map<string, FlatEvent>();
  const getOrInit = (date: string): FlatEvent => {
    let e = byDate.get(date);
    if (!e) {
      e = { date, resultEUR: 0, stakeEUR: 0, depositEUR: 0, withdrawalEUR: 0, betCount: 0 };
      byDate.set(date, e);
    }
    return e;
  };
  for (const bet of bets) {
    if (!isBetSettled(bet)) continue;
    const e = getOrInit(getBetDisplayDate(bet));
    const partial = betToEvent(bet, unitValue);
    e.resultEUR += partial.resultEUR;
    e.stakeEUR += partial.stakeEUR;
    e.betCount += 1;
  }
  for (const txn of transactions) {
    const e = getOrInit(txn.date);
    if (txn.type === "deposit") e.depositEUR += txn.amount;
    else if (txn.type === "withdrawal") e.withdrawalEUR += txn.amount;
  }
  return Array.from(byDate.values()).sort((a, b) => eventTs(a.date) - eventTs(b.date));
}
