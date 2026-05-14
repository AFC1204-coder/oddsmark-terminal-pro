import { describe, expect, it } from "vitest";
import type { Bet } from "@shared/schema";
import { getBetSearchText, matchesBetSearch } from "../bet-search";

function makeBet(overrides: Partial<Bet> = {}): Bet {
  return {
    id: "bet-1",
    userId: "u1",
    sport: "Fútbol",
    league: "La Liga",
    event: "Real Madrid vs Betis",
    market: "Más de 2.5 goles",
    odds: 1.9,
    stake: 1,
    profit: 0,
    status: "pending",
    date: "2026-05-02",
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
    createdAt: new Date("2026-05-02T10:00:00Z"),
    ...overrides,
  } as Bet;
}

describe("bet search", () => {
  it("matches core bet fields without case sensitivity", () => {
    const bet = makeBet({ tipster: "Sharp Club" });

    expect(matchesBetSearch(bet, "betis")).toBe(true);
    expect(matchesBetSearch(bet, "SHARP")).toBe(true);
    expect(matchesBetSearch(bet, "tenis")).toBe(false);
  });

  it("normalizes legacy array tags without crashing the dashboard search", () => {
    const bet = makeBet({
      tags: ["test", "health", "check"] as unknown as Bet["tags"],
    });

    expect(getBetSearchText(bet)).toContain("health");
    expect(matchesBetSearch(bet, "check")).toBe(true);
  });
});
