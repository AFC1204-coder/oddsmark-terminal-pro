import { describe, it, expect } from "vitest";
import {
  aggregateBets,
  aggregateYield,
  aggregateWinRate,
  emptyAggregate,
  perBetResults,
  trimmedResults,
} from "../bet-math";
import type { Bet } from "@shared/schema";

// Minimal bet factory — fills only the fields aggregateBets reads.
function makeBet(overrides: Partial<Bet> = {}): Bet {
  return {
    id: Math.random().toString(36).slice(2),
    userId: "u1",
    sport: "Fútbol",
    league: "La Liga",
    event: "A vs B",
    market: "1X2",
    odds: 2.0,
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
    createdAt: new Date(),
    ...overrides,
  } as Bet;
}

describe("aggregateBets", () => {
  it("empty input returns empty aggregate", () => {
    expect(aggregateBets([])).toEqual(emptyAggregate());
  });

  it("counts total even for pending and void, but excludes them from settled", () => {
    const agg = aggregateBets([
      makeBet({ status: "pending", stake: 5 }),
      makeBet({ status: "void", stake: 5 }),
      makeBet({ status: "won", odds: 2, stake: 10 }),
    ]);
    expect(agg.total).toBe(3);
    expect(agg.settled).toBe(1);
    expect(agg.stake).toBe(10);
    expect(agg.profit).toBe(10); // 10 × (2-1)
    expect(agg.wins).toBe(1);
    expect(agg.losses).toBe(0);
  });

  it("computes yield and winrate via the helpers", () => {
    const agg = aggregateBets([
      makeBet({ status: "won", odds: 2, stake: 10 }),  // +10
      makeBet({ status: "lost", odds: 3, stake: 10 }), // -10
      makeBet({ status: "won", odds: 3, stake: 10 }),  // +20
    ]);
    expect(agg.profit).toBe(20);
    expect(agg.stake).toBe(30);
    expect(aggregateYield(agg)).toBeCloseTo(66.666, 1);
    expect(aggregateWinRate(agg)).toBeCloseTo(66.666, 1);
  });

  it("handles cashout bets", () => {
    const agg = aggregateBets([
      makeBet({ status: "won", odds: 2, stake: 10, isCashout: true, cashoutVal: 15 }),
    ]);
    expect(agg.profit).toBe(5); // cashout 15 - stake 10
    expect(agg.wins).toBe(1);
  });

  it("escalera: partial (any leg pending and no cashout) counts only toward total", () => {
    const bet = makeBet({
      betType: "escalera",
      stake: 3,
      selections: [
        { stake: 1, odds: 2, status: "won" },
        { stake: 1, odds: 2, status: "pending" },
        { stake: 1, odds: 2, status: "pending" },
      ] as any,
    });
    const agg = aggregateBets([bet]);
    expect(agg.total).toBe(1);
    expect(agg.settled).toBe(0);
    expect(agg.profit).toBe(0);
    expect(agg.stake).toBe(0);
  });

  it("void bets count as total but not stake or settled", () => {
    const agg = aggregateBets([
      makeBet({ status: "void", stake: 100 }),
      makeBet({ status: "won", odds: 2, stake: 10 }),
    ]);
    expect(agg.total).toBe(2);
    expect(agg.settled).toBe(1);
    expect(agg.stake).toBe(10); // void stake excluded
    expect(agg.profit).toBe(10);
  });

  it("escalera: fully resolved uses summed leg stakes and weighted profit", () => {
    const bet = makeBet({
      betType: "escalera",
      stake: 99, // top-level stake is ignored for escaleras
      selections: [
        { stake: 1, odds: 2, status: "won" },  // return 2
        { stake: 1, odds: 2, status: "won" },  // return 2
        { stake: 1, odds: 2, status: "lost" }, // return 0
      ] as any,
    });
    const agg = aggregateBets([bet]);
    expect(agg.settled).toBe(1);
    expect(agg.stake).toBe(3); // sum of leg stakes
    expect(agg.profit).toBe(1); // return 4 - stake 3
    expect(agg.wins).toBe(1);
  });

  it("escalera: void legs are refunded (bookmaker standard)", () => {
    // 3 legs × 1U stake. Leg 1 wins at 2.0 (+1U), leg 2 voids (refunded),
    // leg 3 loses (-1U). Net: +1 -1 = 0U profit, NOT -1U.
    const bet = makeBet({
      betType: "escalera",
      selections: [
        { stake: 1, odds: 2, status: "won" },
        { stake: 1, odds: 2, status: "void" },
        { stake: 1, odds: 2, status: "lost" },
      ] as any,
    });
    const agg = aggregateBets([bet]);
    expect(agg.settled).toBe(1);
    expect(agg.profit).toBe(0);
  });
});

describe("perBetResults", () => {
  it("returns one profit per settled bet, in insertion order", () => {
    const out = perBetResults([
      makeBet({ status: "won", odds: 2, stake: 10 }),
      makeBet({ status: "lost", odds: 2, stake: 5 }),
      makeBet({ status: "pending", stake: 10 }),
      makeBet({ status: "void", stake: 10 }),
      makeBet({ status: "won", odds: 3, stake: 1 }),
    ]);
    expect(out).toEqual([10, -5, 2]);
  });

  it("skips partial escaleras (treated as pending)", () => {
    const bet = makeBet({
      betType: "escalera",
      selections: [
        { stake: 1, odds: 2, status: "won" },
        { stake: 1, odds: 2, status: "pending" },
      ] as any,
    });
    expect(perBetResults([bet])).toEqual([]);
  });
});

describe("trimmedResults", () => {
  it("0% trim returns everything untouched", () => {
    const { trimmed, droppedLow, droppedHigh } = trimmedResults([-5, -1, 0, 2, 10], 0);
    expect(trimmed).toEqual([-5, -1, 0, 2, 10]);
    expect(droppedLow).toBe(0);
    expect(droppedHigh).toBe(0);
  });

  it("5% trim on 20 items drops 1 from each tail", () => {
    const values = Array.from({ length: 20 }, (_, i) => i); // 0..19
    const { trimmed, droppedLow, droppedHigh } = trimmedResults(values, 0.05);
    expect(droppedLow).toBe(1);
    expect(droppedHigh).toBe(1);
    expect(trimmed[0]).toBe(1);
    expect(trimmed[trimmed.length - 1]).toBe(18);
  });

  it("empty input is a no-op", () => {
    expect(trimmedResults([], 0.1)).toEqual({ trimmed: [], droppedLow: 0, droppedHigh: 0 });
  });

  it("sorts before trimming — order of input doesn't matter", () => {
    const { trimmed } = trimmedResults([100, -100, 0, 5, -5, 2, 3], 0.15);
    // length 7, floor(7*0.15) = 1 dropped each side
    // sorted: [-100, -5, 0, 2, 3, 5, 100] → kept [-5, 0, 2, 3, 5]
    expect(trimmed).toEqual([-5, 0, 2, 3, 5]);
  });
});
