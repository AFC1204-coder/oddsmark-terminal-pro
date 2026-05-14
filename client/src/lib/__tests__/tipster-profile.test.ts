import { describe, expect, it } from "vitest";
import type { Bet } from "@shared/schema";
import {
  calculateXPAndLevel,
  formatSportLabel,
  generateTipstersFromBets,
  getProfileReadiness,
} from "../tipster-profile";

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

describe("tipster profile helpers", () => {
  it("keeps the current user profile visible even with insufficient sample", () => {
    const tipsters = generateTipstersFromBets(
      [makeBet({ status: "pending" })],
      "u1",
      "all",
      { username: "sharp", displayName: "Sharp User", bio: "", avatarUrl: null, telegramUrl: null, twitterUrl: null, instagramUrl: null, youtubeUrl: null, isPublic: true },
    );

    expect(tipsters).toHaveLength(1);
    expect(tipsters[0].id).toBe("u1");
    expect(tipsters[0].displayName).toBe("Sharp User");
    expect(tipsters[0].totalBets).toBe(1);
  });

  it("does not mark local analytical profiles as publicly verified by performance", () => {
    const bets = Array.from({ length: 35 }, (_, index) =>
      makeBet({ id: `won-${index}`, status: "won", odds: 2, stake: 1 }),
    );

    const [profile] = generateTipstersFromBets(
      bets,
      "u1",
      "all",
      { username: "sharp", displayName: "Sharp User", bio: "", avatarUrl: null, telegramUrl: null, twitterUrl: null, instagramUrl: null, youtubeUrl: null, isPublic: true },
    );

    expect(profile.isVerified).toBe(false);
  });

  it("normalizes Spanish sport labels for public profile display", () => {
    expect(formatSportLabel("Futbol")).toBe("Fútbol");
    expect(formatSportLabel("Tenis")).toBe("Tenis");
    expect(formatSportLabel(null)).toBe("Fútbol");
  });

  it("reports readiness and XP from closed bets", () => {
    const bets = [
      makeBet({ status: "won", odds: 2, stake: 2, verified: true }),
      makeBet({ status: "lost", odds: 2, stake: 1 }),
      makeBet({ status: "pending", odds: 3, stake: 1 }),
    ];

    const readiness = getProfileReadiness(bets);
    const level = calculateXPAndLevel(bets);

    expect(readiness.closedBets).toBe(2);
    expect(readiness.verifiedBets).toBe(1);
    expect(readiness.reliability).toBe("baja");
    expect(level.totalXP).toBeGreaterThan(30);
  });
});
