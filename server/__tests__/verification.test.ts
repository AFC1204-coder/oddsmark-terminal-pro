/**
 * Tests for the verification system — the core value proposition of Oddsmark.
 * These tests ensure that:
 * 1. Profit calculations are consistent and correct
 * 2. Pre-event detection converts local event time to UTC safely
 * 3. Hash generation is deterministic
 * 4. Date validation rejects edge cases safely
 */
import { describe, it, expect } from "vitest";
import crypto from "crypto";
import { createRouteError, parseEventUtc } from "../event-time";

// ─── Inline the functions we're testing (to avoid DB imports) ───

function calcProfit(
  status: string,
  odds: number,
  stake: number,
  isCashout?: boolean,
  cashoutVal?: number | null,
): number {
  if (status === "pending" || status === "void") return 0;
  if (isCashout && cashoutVal != null) return cashoutVal - stake;
  if (status === "won") return stake * (odds - 1);
  if (status === "lost") return -stake;
  return 0;
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  return value == null || value === "" ? null : value;
}

function normalizeHashNumber(value: number): string {
  if (!Number.isFinite(value)) {
    throw createRouteError("Numero de apuesta invalido", 400, "INVALID_BET_NUMBER");
  }
  return value.toFixed(4);
}

function canonicalize(value: unknown): unknown {
  if (value === undefined) return null;
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === "object") {
    const input = value as Record<string, unknown>;
    return Object.keys(input).sort().reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = canonicalize(input[key]);
      return acc;
    }, {});
  }
  return value;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function generateBetVerificationHash(data: {
  userId: string;
  event: string;
  market: string;
  odds: number;
  stake: number;
  sport: string;
  league: string;
  eventDate: string;
  eventTime?: string | null;
  selections?: unknown;
  timestamp: string;
}): string {
  const payload = stableStringify({
    version: 1,
    userId: data.userId,
    event: data.event,
    market: data.market,
    odds: normalizeHashNumber(data.odds),
    stake: normalizeHashNumber(data.stake),
    sport: data.sport,
    league: data.league,
    eventDate: data.eventDate,
    eventTime: normalizeOptionalText(data.eventTime),
    selections: canonicalize(data.selections),
    recordedAt: data.timestamp,
  });
  return crypto.createHash("sha256").update(payload).digest("hex");
}

// ─── Tests ───

describe("calcProfit", () => {
  it("returns 0 for pending bets", () => {
    expect(calcProfit("pending", 2.0, 10)).toBe(0);
  });

  it("returns 0 for void bets", () => {
    expect(calcProfit("void", 2.0, 10)).toBe(0);
  });

  it("calculates won bet profit correctly", () => {
    // 10u at odds 2.0 = 10 * (2.0 - 1) = 10u profit
    expect(calcProfit("won", 2.0, 10)).toBe(10);
    // 5u at odds 3.5 = 5 * (3.5 - 1) = 12.5u profit
    expect(calcProfit("won", 3.5, 5)).toBe(12.5);
    // 1u at odds 1.5 = 1 * 0.5 = 0.5u profit
    expect(calcProfit("won", 1.5, 1)).toBe(0.5);
  });

  it("calculates lost bet correctly", () => {
    expect(calcProfit("lost", 2.0, 10)).toBe(-10);
    expect(calcProfit("lost", 5.0, 3)).toBe(-3);
  });

  it("handles cashout correctly for won bets", () => {
    // Won but cashed out at 15 with 10 stake = +5 profit
    expect(calcProfit("won", 2.0, 10, true, 15)).toBe(5);
  });

  it("handles cashout correctly for lost bets", () => {
    // Lost but cashed out at 3 with 10 stake = -7 loss (not full -10)
    expect(calcProfit("lost", 2.0, 10, true, 3)).toBe(-7);
  });

  it("ignores cashout when cashoutVal is null", () => {
    expect(calcProfit("won", 2.0, 10, true, null)).toBe(10);
  });

  it("ignores cashout when isCashout is false", () => {
    expect(calcProfit("won", 2.0, 10, false, 15)).toBe(10);
  });
});

describe("parseEventUtc", () => {
  it("parses winter Madrid event time into UTC", () => {
    const d = parseEventUtc("2024-12-25", "21:00");
    expect(d.toISOString()).toBe("2024-12-25T20:00:00.000Z");
  });

  it("parses summer Madrid event time into UTC", () => {
    const d = parseEventUtc("2024-06-25", "21:00");
    expect(d.toISOString()).toBe("2024-06-25T19:00:00.000Z");
  });

  it("requires an explicit event time", () => {
    expect(() => parseEventUtc("2024-12-25", null)).toThrow("Hora de evento requerida");
  });

  it("throws for invalid date format", () => {
    expect(() => parseEventUtc("not-a-date", "21:00")).toThrow("Fecha de evento invalida");
  });

  it("throws for partial date", () => {
    expect(() => parseEventUtc("2024-12", "21:00")).toThrow("Fecha de evento invalida");
  });

  it("throws for empty string", () => {
    expect(() => parseEventUtc("", "21:00")).toThrow("Fecha de evento invalida");
  });

  it("throws for invalid calendar dates", () => {
    expect(() => parseEventUtc("2024-02-31", "21:00")).toThrow("Fecha de evento invalida");
  });

  it("throws for invalid hour (25:00)", () => {
    expect(() => parseEventUtc("2024-12-25", "25:00")).toThrow("Hora de evento invalida");
  });

  it("handles midnight correctly", () => {
    const d = parseEventUtc("2024-12-25", "00:00");
    expect(d.toISOString()).toBe("2024-12-24T23:00:00.000Z");
  });
});

describe("pre-event detection", () => {
  it("bet created before event is pre-event", () => {
    const now = new Date("2024-12-25T10:00:00Z");
    const eventUtc = parseEventUtc("2024-12-25", "21:00");
    expect(now < eventUtc).toBe(true);
  });

  it("bet created after event is post-event", () => {
    const now = new Date("2024-12-25T21:00:00Z");
    const eventUtc = parseEventUtc("2024-12-25", "21:00");
    expect(now < eventUtc).toBe(false);
  });

  it("bet created exactly at event time is post-event", () => {
    const now = new Date("2024-12-25T20:00:00Z");
    const eventUtc = parseEventUtc("2024-12-25", "21:00");
    expect(now < eventUtc).toBe(false);
  });

  it("invalid date is rejected before pre-event comparison", () => {
    expect(() => parseEventUtc("garbage", "21:00")).toThrow("Fecha de evento invalida");
  });
});

describe("generateBetVerificationHash", () => {
  const baseBet = {
    userId: "user123",
    event: "Real Madrid vs Barcelona",
    market: "1X2 - Local",
    odds: 2.1,
    stake: 5,
    sport: "Fútbol",
    league: "La Liga",
    eventDate: "2024-12-25",
    eventTime: "21:00",
    selections: null,
    timestamp: "2024-12-25T10:00:00.000Z",
  };

  it("produces a 64-char hex string", () => {
    const hash = generateBetVerificationHash(baseBet);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("is deterministic — same input = same hash", () => {
    const hash1 = generateBetVerificationHash(baseBet);
    const hash2 = generateBetVerificationHash(baseBet);
    expect(hash1).toBe(hash2);
  });

  it("changes when odds change", () => {
    const hash1 = generateBetVerificationHash(baseBet);
    const hash2 = generateBetVerificationHash({ ...baseBet, odds: 2.2 });
    expect(hash1).not.toBe(hash2);
  });

  it("changes when stake changes", () => {
    const hash1 = generateBetVerificationHash(baseBet);
    const hash2 = generateBetVerificationHash({ ...baseBet, stake: 10 });
    expect(hash1).not.toBe(hash2);
  });

  it("changes when timestamp changes (edit detection)", () => {
    const hash1 = generateBetVerificationHash(baseBet);
    const hash2 = generateBetVerificationHash({ ...baseBet, timestamp: "2024-12-25T15:00:00.000Z" });
    expect(hash1).not.toBe(hash2);
  });

  it("changes when event time changes", () => {
    const hash1 = generateBetVerificationHash(baseBet);
    const hash2 = generateBetVerificationHash({ ...baseBet, eventTime: "22:00" });
    expect(hash1).not.toBe(hash2);
  });

  it("changes when event changes", () => {
    const hash1 = generateBetVerificationHash(baseBet);
    const hash2 = generateBetVerificationHash({ ...baseBet, event: "Atletico vs Sevilla" });
    expect(hash1).not.toBe(hash2);
  });

  it("handles selections correctly", () => {
    const hash1 = generateBetVerificationHash(baseBet);
    const hash2 = generateBetVerificationHash({
      ...baseBet,
      selections: [{ event: "Leg 1", odds: 1.5 }],
    });
    expect(hash1).not.toBe(hash2);
  });

  it("null selections and undefined selections produce same hash", () => {
    const hash1 = generateBetVerificationHash({ ...baseBet, selections: null });
    const hash2 = generateBetVerificationHash({ ...baseBet, selections: undefined });
    expect(hash1).toBe(hash2);
  });

  it("null eventTime and undefined eventTime produce same hash", () => {
    const hash1 = generateBetVerificationHash({ ...baseBet, eventTime: null });
    const hash2 = generateBetVerificationHash({ ...baseBet, eventTime: undefined });
    expect(hash1).toBe(hash2);
  });

  it("is stable when selection object keys arrive in different order", () => {
    const hash1 = generateBetVerificationHash({
      ...baseBet,
      selections: [{ event: "Leg 1", odds: 1.5, meta: { b: 2, a: 1 } }],
    });
    const hash2 = generateBetVerificationHash({
      ...baseBet,
      selections: [{ meta: { a: 1, b: 2 }, odds: 1.5, event: "Leg 1" }],
    });
    expect(hash1).toBe(hash2);
  });
});
