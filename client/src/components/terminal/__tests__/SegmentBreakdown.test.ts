/**
 * Unit tests for the pure bucket helpers exported from SegmentBreakdown.
 * The visual component is exercised manually; these are the deterministic
 * building blocks a future refactor might silently break.
 */
import { describe, it, expect } from "vitest";
import { oddsBucket, stakeBucket, betTypeLabel } from "../SegmentBreakdown";
import type { Bet } from "@shared/schema";

describe("oddsBucket", () => {
  it("rejects non-finite / impossible odds", () => {
    expect(oddsBucket(NaN)).toBeNull();
    expect(oddsBucket(0)).toBeNull();
    expect(oddsBucket(1)).toBeNull(); // odds of 1 means certain → not a bet
    expect(oddsBucket(-2)).toBeNull();
  });

  it("places typical favourite and long-shot odds in distinct buckets", () => {
    expect(oddsBucket(1.2)).toBe("1.01 – 1.50");
    expect(oddsBucket(1.75)).toBe("1.50 – 2.00");
    expect(oddsBucket(2.1)).toBe("2.00 – 2.50");
    expect(oddsBucket(3.2)).toBe("2.50 – 3.50");
    expect(oddsBucket(4.5)).toBe("3.50 – 5.00");
    expect(oddsBucket(10)).toBe("5.00+");
  });

  it("uses half-open intervals: exact boundaries fall into the upper bucket", () => {
    expect(oddsBucket(1.5)).toBe("1.50 – 2.00");
    expect(oddsBucket(2.0)).toBe("2.00 – 2.50");
    expect(oddsBucket(5.0)).toBe("5.00+");
  });
});

describe("stakeBucket", () => {
  it("rejects invalid stakes", () => {
    expect(stakeBucket(NaN)).toBeNull();
    expect(stakeBucket(0)).toBeNull();
    expect(stakeBucket(-1)).toBeNull();
  });

  it("bucketises typical staking plans", () => {
    expect(stakeBucket(0.25)).toBe("< 0.5 U");
    expect(stakeBucket(0.75)).toBe("0.5 – 1 U");
    expect(stakeBucket(1.5)).toBe("1 – 2 U");
    expect(stakeBucket(2.5)).toBe("2 – 3 U");
    expect(stakeBucket(4)).toBe("3 – 5 U");
    expect(stakeBucket(10)).toBe("5+ U");
  });
});

describe("betTypeLabel", () => {
  const base: Partial<Bet> = {
    isLongTerm: false,
    isLive: false,
  };

  it("long-term bets take priority over live flag", () => {
    expect(betTypeLabel({ ...base, isLongTerm: true, isLive: true } as Bet)).toBe("Largo plazo");
  });

  it("live bets are tagged as live when not long-term", () => {
    expect(betTypeLabel({ ...base, isLive: true } as Bet)).toBe("En vivo");
  });

  it("defaults to pre-match", () => {
    expect(betTypeLabel(base as Bet)).toBe("Pre-match");
  });
});
