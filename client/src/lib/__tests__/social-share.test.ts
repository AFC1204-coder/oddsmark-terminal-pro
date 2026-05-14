import { describe, expect, it } from "vitest";
import type { Bet } from "@shared/schema";
import { generateInstagramCaption, generateTelegramMessage, generateTweetText } from "../social-share";

function bet(overrides: Partial<Bet> = {}): Bet {
  return {
    id: "b1",
    userId: "u1",
    sport: "Fútbol",
    league: "La Liga",
    event: "Madrid vs Barcelona",
    market: "Over 2.5",
    odds: 2,
    stake: 1,
    profit: 0,
    status: "pending",
    date: "2026-05-10",
    time: "21:00",
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
    createdAt: new Date("2026-05-01T10:00:00.000Z"),
    ...overrides,
  } as Bet;
}

describe("social share proof copy", () => {
  it("does not claim pre-event proof for post-event records", () => {
    const tweet = generateTweetText(bet(), 0, "ABCDEF12", "https://oddsmark.app", "U", "post_event");
    const telegram = generateTelegramMessage(
      bet(),
      0,
      "abcdef1234567890abcdef1234567890",
      "https://oddsmark.app",
      "U",
      "post_event",
    );
    const instagram = generateInstagramCaption(bet(), 0, "U", "post_event");

    expect(tweet).toContain("Registro post-evento");
    expect(telegram).toContain("Registro post-evento");
    expect(instagram).toContain("sin prueba previa");
    expect(`${tweet}\n${telegram}\n${instagram}`).not.toContain("verificada pre-evento");
  });

  it("calls out missing public proof instead of omitting trust state", () => {
    const tweet = generateTweetText(bet(), 0, undefined, "https://oddsmark.app", "U", "none");
    const instagram = generateInstagramCaption(bet(), 0, "U", "none");

    expect(tweet).toContain("Sin prueba pública");
    expect(instagram).toContain("Apuesta sin prueba pública");
  });
});
