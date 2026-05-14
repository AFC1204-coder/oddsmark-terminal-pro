import { describe, it, expect } from "vitest";
import { buildBankrollSeries, maxDrawdownFor } from "../bankroll-series";
import type { Bet, Transaction } from "@shared/schema";

function bet(overrides: Partial<Bet>): Bet {
  return {
    id: Math.random().toString(36).slice(2),
    userId: "u1",
    sport: "Fútbol",
    league: "La Liga",
    event: "A vs B",
    market: "1X2",
    odds: 2,
    stake: 1,
    profit: 0,
    status: "won",
    date: "2024-01-01",
    time: null,
    bookie: null,
    tipster: null,
    betType: "simple",
    selections: null,
    isLive: false,
    isCashout: false,
    cashoutVal: null,
    currentCashout: null,
    isValue: false,
    isParlay: false,
    comment: null,
    strategyId: null,
    position: null,
    formation: null,
    player: null,
    isSubstitute: null,
    tactic: null,
    tags: null,
    marketType: null,
    matchSide: null,
    imageUrl: null,
    verified: false,
    closingOdds: null,
    isLongTerm: false,
    resolutionDate: null,
    deletedAt: null,
    createdAt: new Date(),
    ...overrides,
  } as Bet;
}

function txn(date: string, type: "deposit" | "withdrawal", amount: number): Transaction {
  return {
    id: Math.random().toString(36).slice(2),
    userId: "u1",
    type,
    amount,
    date,
    note: null,
    createdAt: new Date(),
  } as Transaction;
}

const baseOpts = {
  unitValue: 1,
  currency: "money" as const,
  openingBankrollEUR: 100,
  openingDate: "2023-12-31",
  aggregation: "day" as const,
};

describe("buildBankrollSeries", () => {
  it("emits a baseline point when there are no events", () => {
    const out = buildBankrollSeries({ ...baseOpts, bets: [], transactions: [] });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ date: "2023-12-31", bankroll: 100, profit: 0, roiPct: 0, drawdownPct: 0 });
  });

  it("per-day: collapses same-day bets into one point", () => {
    const out = buildBankrollSeries({
      ...baseOpts,
      bets: [
        bet({ status: "won", odds: 2, stake: 10, date: "2024-01-01" }), // +10
        bet({ status: "lost", odds: 2, stake: 5, date: "2024-01-01" }), // -5
      ],
      transactions: [],
    });
    // baseline + one day
    expect(out).toHaveLength(2);
    expect(out[1]).toMatchObject({ date: "2024-01-01", bankroll: 105, profit: 5, betCount: 2, stake: 15 });
  });

  it("per-bet: emits one point per bet in chronological order", () => {
    const out = buildBankrollSeries({
      ...baseOpts,
      aggregation: "bet",
      bets: [
        bet({ status: "won", odds: 2, stake: 10, date: "2024-01-01" }),
        bet({ status: "won", odds: 2, stake: 10, date: "2024-01-02" }),
      ],
      transactions: [],
    });
    expect(out).toHaveLength(3); // baseline + 2 bets
    expect(out.map(p => p.bankroll)).toEqual([100, 110, 120]);
  });

  it("ROI % is cumulative profit over cumulative stake inside the period", () => {
    const out = buildBankrollSeries({
      ...baseOpts,
      bets: [
        bet({ status: "won", odds: 2, stake: 10, date: "2024-01-01" }), // +10 / 10 staked
        bet({ status: "lost", odds: 2, stake: 10, date: "2024-01-02" }),// -10 / 20 staked
        bet({ status: "won", odds: 3, stake: 10, date: "2024-01-03" }), // +20 / 30 staked
      ],
      transactions: [],
    });
    const last = out[out.length - 1];
    // (+10 -10 +20) / 30 = 66.66%
    expect(last.roiPct).toBeCloseTo(66.7, 1);
  });

  it("drawdown is zero at a new peak and negative below it", () => {
    const out = buildBankrollSeries({
      ...baseOpts,
      bets: [
        bet({ status: "won", odds: 2, stake: 10, date: "2024-01-01" }),  // profit 10, peak 10 → dd 0
        bet({ status: "lost", odds: 2, stake: 5, date: "2024-01-02" }), // profit 5, peak 10 → dd -50%
        bet({ status: "won", odds: 2, stake: 20, date: "2024-01-03" }), // profit 25, new peak → dd 0
      ],
      transactions: [],
    });
    expect(out[1].drawdownPct).toBe(0);
    expect(out[2].drawdownPct).toBeCloseTo(-50, 1);
    expect(out[3].drawdownPct).toBe(0);
  });

  it("deposits affect bankroll but not profit or ROI", () => {
    const out = buildBankrollSeries({
      ...baseOpts,
      bets: [bet({ status: "won", odds: 2, stake: 10, date: "2024-01-01" })],
      transactions: [txn("2024-01-02", "deposit", 50)],
    });
    const last = out[out.length - 1];
    expect(last.bankroll).toBe(160); // 100 + 10 profit + 50 deposit
    expect(last.profit).toBe(10);
    // ROI still 100% — deposit doesn't pollute yield.
    expect(last.roiPct).toBeCloseTo(100, 1);
  });

  it("seed: pre-period peak prevents the in-period curve from lying about drawdown", () => {
    // A tipster had profit 100 before the period (peak 100), then the period
    // starts with a losing streak. Even though the in-period profit curve
    // starts at 0, the drawdown should reflect distance from 100, not from 0.
    const out = buildBankrollSeries({
      ...baseOpts,
      openingBankrollEUR: 200, // 100 initial + 100 pre-period
      bets: [bet({ status: "lost", odds: 2, stake: 20, date: "2024-01-01" })],
      transactions: [],
      seed: { profitEUR: 100, stakeEUR: 100, peakProfitEUR: 100 },
    });
    // Running profit: 100 → 80, peak 100 → dd -20%
    expect(out[out.length - 1].drawdownPct).toBeCloseTo(-20, 1);
  });

  it("currency=units divides bankroll/profit by unitValue", () => {
    const out = buildBankrollSeries({
      ...baseOpts,
      currency: "units",
      unitValue: 10,
      openingBankrollEUR: 1000,
      // stake 1U × (odds 2 - 1) × unitValue 10 = +10 EUR profit = +1 U
      bets: [bet({ status: "won", odds: 2, stake: 1, date: "2024-01-01" })],
      transactions: [],
    });
    expect(out[0].bankroll).toBe(100); // 1000 EUR / 10 U = 100 U opening
    expect(out[1].bankroll).toBe(101);
    expect(out[1].profit).toBe(1);
    expect(out[1].stake).toBe(1);
  });

  it("rolling ROI: tracks yield inside a sliding window, not cumulative", () => {
    // All four bets staked 10. Day 1 wins +20, Day 50 loses -10, Day 60 loses
    // -10, Day 70 loses -10. Cumulative yield: (-10)/40 = -25%. Rolling 30d
    // at day 70 includes days 50, 60, 70 (30 > 20 days back): (-30)/30 = -100%.
    const out = buildBankrollSeries({
      ...baseOpts,
      bets: [
        bet({ status: "won", odds: 3, stake: 10, date: "2024-01-01" }),
        bet({ status: "lost", odds: 2, stake: 10, date: "2024-02-19" }),
        bet({ status: "lost", odds: 2, stake: 10, date: "2024-02-29" }),
        bet({ status: "lost", odds: 2, stake: 10, date: "2024-03-10" }),
      ],
      transactions: [],
      rollingWindowDays: 30,
    });
    const last = out[out.length - 1];
    expect(last.roiPct).toBeCloseTo(-25, 1);
    expect(last.rollingRoiPct).toBeCloseTo(-100, 1);
  });

  it("rolling ROI: early points include only what's already happened", () => {
    const out = buildBankrollSeries({
      ...baseOpts,
      bets: [
        bet({ status: "won", odds: 2, stake: 10, date: "2024-01-01" }),
        bet({ status: "won", odds: 2, stake: 10, date: "2024-01-15" }),
      ],
      transactions: [],
      rollingWindowDays: 30,
    });
    expect(out[0].rollingRoiPct).toBe(0);
    expect(out[1].rollingRoiPct).toBeCloseTo(100, 1); // only bet 1 in window
    expect(out[2].rollingRoiPct).toBeCloseTo(100, 1); // both bets in window
  });

  it("rolling ROI: field is absent when rollingWindowDays is not set", () => {
    const out = buildBankrollSeries({
      ...baseOpts,
      bets: [bet({ status: "won", odds: 2, stake: 10, date: "2024-01-01" })],
      transactions: [],
    });
    expect(out[1].rollingRoiPct).toBeUndefined();
  });

  it("maxDrawdownFor returns 0 when no settled bets exist", () => {
    expect(maxDrawdownFor([])).toBe(0);
    expect(maxDrawdownFor([bet({ status: "pending" })])).toBe(0);
  });

  it("maxDrawdownFor captures the worst trough even if the curve recovers", () => {
    // Peak at 20 (after two wins), trough at 5 after a loss → dd = -75%,
    // then another win pushes back to 15 (recovery, but max stays -75%).
    const dd = maxDrawdownFor([
      bet({ status: "won", odds: 2, stake: 10, date: "2024-01-01" }), // profit 10, peak 10
      bet({ status: "won", odds: 2, stake: 10, date: "2024-01-02" }), // profit 20, peak 20
      bet({ status: "lost", odds: 2, stake: 15, date: "2024-01-03" }),// profit 5, dd -75%
      bet({ status: "won", odds: 2, stake: 10, date: "2024-01-04" }), // profit 15, dd -25%
    ]);
    expect(dd).toBeCloseTo(-75, 1);
  });

  it("maxDrawdownFor is 0 for a strictly winning sequence", () => {
    const dd = maxDrawdownFor([
      bet({ status: "won", odds: 2, stake: 10, date: "2024-01-01" }),
      bet({ status: "won", odds: 2, stake: 10, date: "2024-01-02" }),
      bet({ status: "won", odds: 2, stake: 10, date: "2024-01-03" }),
    ]);
    expect(dd).toBe(0);
  });

  it("pending bets are ignored on both paths", () => {
    const out = buildBankrollSeries({
      ...baseOpts,
      bets: [bet({ status: "pending", stake: 10, date: "2024-01-01" })],
      transactions: [],
    });
    expect(out).toHaveLength(1); // baseline only
  });

  it("void bets do not create bankroll points or resolved stake", () => {
    const out = buildBankrollSeries({
      ...baseOpts,
      bets: [bet({ status: "void", stake: 10, date: "2024-01-01" })],
      transactions: [],
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ bankroll: 100, profit: 0, roiPct: 0 });
  });
});
