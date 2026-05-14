import { describe, expect, it } from "vitest";
import type { Bet } from "@shared/schema";
import {
  applyBetAnalysisFilters,
  buildYieldComparisonSeries,
  getBetDisplayDate,
  getBetStakeUnits,
  getCashoutKind,
  toLocalDateKey,
} from "../bet-analysis";

function makeBet(overrides: Partial<Bet> = {}): Bet {
  return {
    id: Math.random().toString(36).slice(2),
    userId: "u1",
    sport: "Futbol",
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

describe("bet-analysis helpers", () => {
  it("uses resolutionDate as the display date for long-term bets", () => {
    const bet = makeBet({ isLongTerm: true, date: "2024-01-01", resolutionDate: "2024-03-10" });
    expect(getBetDisplayDate(bet)).toBe("2024-03-10");
  });

  it("formats Date objects with the local calendar day", () => {
    expect(toLocalDateKey(new Date(2024, 2, 10))).toBe("2024-03-10");
  });

  it("uses summed leg stake for escaleras", () => {
    const bet = makeBet({
      betType: "escalera",
      stake: 99,
      selections: [
        { stake: 1, odds: 2, status: "won" },
        { stake: 2, odds: 2, status: "lost" },
      ] as any,
    });
    expect(getBetStakeUnits(bet)).toBe(3);
  });

  it("classifies cashout by canonical profit", () => {
    expect(getCashoutKind(makeBet({ status: "won", stake: 10, isCashout: true, cashoutVal: 15 }))).toBe("profit");
    expect(getCashoutKind(makeBet({ status: "lost", stake: 10, isCashout: true, cashoutVal: 7 }))).toBe("loss");
  });

  it("filters long-term bets by display date and escaleras by effective stake", () => {
    const longTerm = makeBet({ isLongTerm: true, date: "2024-01-01", resolutionDate: "2024-03-10", status: "won" });
    const escalera = makeBet({
      betType: "escalera",
      status: "won",
      stake: 1,
      selections: [
        { stake: 2, odds: 2, status: "won" },
        { stake: 2, odds: 2, status: "won" },
      ] as any,
    });
    expect(applyBetAnalysisFilters([longTerm], { dateFrom: "2024-03-01", dateTo: "2024-03-31" })).toEqual([longTerm]);
    expect(applyBetAnalysisFilters([escalera], { stakeMin: "3" })).toEqual([escalera]);
  });

  it("builds yield comparison series using display dates", () => {
    const globalA = makeBet({ status: "won", stake: 10, odds: 2, date: "2024-01-01" });
    const globalB = makeBet({ status: "lost", stake: 10, odds: 2, date: "2024-01-02" });
    const filteredLongTerm = makeBet({
      status: "lost",
      stake: 10,
      odds: 2,
      isLongTerm: true,
      date: "2024-01-01",
      resolutionDate: "2024-03-10",
    });

    const out = buildYieldComparisonSeries(
      [globalA, globalB, filteredLongTerm],
      [filteredLongTerm],
      "ALL",
      new Date(2024, 2, 15),
    );

    expect(out.map(p => p.date)).toEqual(["2024-01-01", "2024-01-02", "2024-03-10"]);
    expect(out[0].globalYield).toBeCloseTo(100, 1);
    expect(out[1].globalYield).toBeCloseTo(0, 1);
    expect(out[2].filteredYield).toBeCloseTo(-100, 1);
  });

  it("filters yield comparison by period", () => {
    const oldBet = makeBet({ status: "won", stake: 10, odds: 2, date: "2024-01-01" });
    const recentBet = makeBet({ status: "won", stake: 10, odds: 2, date: "2024-03-12" });

    const out = buildYieldComparisonSeries(
      [oldBet, recentBet],
      [recentBet],
      "1S",
      new Date(2024, 2, 15),
    );

    expect(out.map(p => p.date)).toEqual(["2024-03-12"]);
  });
});
