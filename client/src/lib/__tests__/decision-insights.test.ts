import { describe, expect, it } from "vitest";
import type { Bet, Transaction } from "@shared/schema";
import {
  buildDecisionFacts,
  calculateDrawdownUnits,
  calculateHighOddsConcentration,
  calculateOutlierImpact,
  calculateRecentForm,
  calculateSegmentConcentration,
  calculateWalletBreakdown,
} from "../decision-insights";

function makeBet(overrides: Partial<Bet> = {}): Bet {
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
    status: "pending",
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
    createdAt: new Date("2024-01-01T10:00:00Z"),
    ...overrides,
  } as Bet;
}

function transaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: Math.floor(Math.random() * 100000),
    userId: "u1",
    type: "deposit",
    amount: 100,
    date: "2024-01-01",
    note: null,
    createdAt: new Date("2024-01-01T10:00:00Z"),
    ...overrides,
  } as Transaction;
}

describe("decision insight helpers", () => {
  it("separates real bankroll from betting P&L and wallet flows", () => {
    const wallet = calculateWalletBreakdown(
      [
        makeBet({ status: "won", stake: 10, odds: 2 }),
        makeBet({ status: "lost", stake: 4, odds: 2 }),
      ],
      [
        transaction({ type: "deposit", amount: 300 }),
        transaction({ type: "withdrawal", amount: 50 }),
      ],
      1_000,
      10,
    );

    expect(wallet.bettingProfitUnits).toBe(6);
    expect(wallet.bettingProfitEUR).toBe(60);
    expect(wallet.netDepositsEUR).toBe(250);
    expect(wallet.realBankrollEUR).toBe(1_310);
  });

  it("calculates drawdown in betting units, independent from deposits", () => {
    const drawdown = calculateDrawdownUnits([
      makeBet({ status: "won", stake: 10, odds: 2, date: "2024-01-01" }),
      makeBet({ status: "lost", stake: 7, odds: 2, date: "2024-01-02" }),
      makeBet({ status: "won", stake: 2, odds: 2, date: "2024-01-03" }),
    ]);

    expect(drawdown.maxDrawdownUnits).toBe(-7);
    expect(drawdown.currentDrawdownUnits).toBe(-5);
  });

  it("measures yield without the best 5 percent of results", () => {
    const bets = [
      makeBet({ status: "won", stake: 1, odds: 21 }),
      ...Array.from({ length: 19 }, (_, i) =>
        makeBet({ status: "lost", stake: 1, odds: 2, date: `2024-01-${String(i + 2).padStart(2, "0")}` }),
      ),
    ];

    const impact = calculateOutlierImpact(bets);

    expect(impact?.removedCount).toBe(1);
    expect(impact?.fullYieldPct).toBeCloseTo(5, 1);
    expect(impact?.yieldWithoutTopPct).toBeCloseTo(-100, 1);
  });

  it("reports concentration in high odds only when net profit is positive", () => {
    const concentration = calculateHighOddsConcentration([
      makeBet({ status: "won", stake: 2, odds: 5 }),
      makeBet({ status: "lost", stake: 1, odds: 1.8 }),
      makeBet({ status: "won", stake: 1, odds: 2 }),
    ]);

    expect(concentration?.settledCount).toBe(1);
    expect(concentration?.profitUnits).toBe(8);
    expect(concentration?.sharePct).toBeCloseTo(100, 1);
  });

  it("summarizes the most recent settled sample for operational form", () => {
    const form = calculateRecentForm([
      makeBet({ status: "won", stake: 1, odds: 2, date: "2024-01-01" }),
      makeBet({ status: "lost", stake: 1, odds: 2, date: "2024-01-02" }),
      makeBet({ status: "won", stake: 2, odds: 2, date: "2024-01-03" }),
      makeBet({ status: "pending", stake: 10, odds: 2, date: "2024-01-04" }),
    ], 3);

    expect(form?.sample).toBe(3);
    expect(form?.aggregate.profit).toBe(2);
    expect(form?.yieldPct).toBeCloseTo(50, 1);
    expect(form?.winRatePct).toBeCloseTo(66.7, 1);
  });

  it("finds the league segment that dominates period profit", () => {
    const segment = calculateSegmentConcentration([
      makeBet({ status: "won", stake: 2, odds: 3, league: "NBA" }),
      makeBet({ status: "won", stake: 1, odds: 2, league: "NBA" }),
      makeBet({ status: "lost", stake: 1, odds: 2, league: "La Liga" }),
      makeBet({ status: "lost", stake: 1, odds: 2, league: "La Liga" }),
    ]);

    expect(segment?.label).toBe("NBA");
    expect(segment?.aggregate.settled).toBe(2);
    expect(segment?.aggregate.profit).toBe(5);
  });

  it("builds period facts without allowing deposits to change yield", () => {
    const facts = buildDecisionFacts(
      [
        makeBet({ status: "won", stake: 10, odds: 2, verified: true }),
        makeBet({ status: "pending", stake: 4, odds: 3, isLive: true }),
      ],
      [
        makeBet({ status: "won", stake: 10, odds: 2, verified: true }),
        makeBet({ status: "lost", stake: 5, odds: 2, verified: false }),
      ],
      [transaction({ type: "deposit", amount: 500 })],
      100,
      10,
    );

    expect(facts.wallet.realBankrollEUR).toBe(650);
    expect(facts.periodYieldPct).toBeCloseTo(100, 1);
    expect(facts.pendingExposureUnits).toBe(4);
    expect(facts.pendingCount).toBe(1);
    expect(facts.preMatchAggregate.settled).toBe(1);
    expect(facts.verificationRatePct).toBeCloseTo(50, 1);
    expect(facts.verifiedCount).toBe(1);
    expect(facts.verificationTotal).toBe(2);
  });
});
