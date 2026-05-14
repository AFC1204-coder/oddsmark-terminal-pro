import { describe, expect, it } from "vitest";
import { hasVerificationCoreChanges, sameVerificationSelections } from "@shared/verification-core";

describe("verification core comparison", () => {
  const selections = [{
    event: "Madrid vs Barcelona",
    market: "Over 2.5",
    odds: 2,
    line: 2.5,
    stake: 1,
    sport: "Fútbol",
    league: "La Liga",
    status: "pending",
    isCashout: false,
  }];

  it("ignores settlement-only selection changes", () => {
    expect(sameVerificationSelections(selections, [{
      ...selections[0],
      status: "won",
      isCashout: true,
      cashoutVal: 1.2,
    }])).toBe(true);
  });

  it("detects selection content edits that should regenerate a proof", () => {
    expect(sameVerificationSelections(selections, [{
      ...selections[0],
      market: "Under 2.5",
    }])).toBe(false);
  });

  it("detects scalar proof-relevant edits", () => {
    expect(hasVerificationCoreChanges(
      { event: "A vs B", market: "1X2", odds: 2, stake: 1, selections },
      { status: "won", selections: [{ ...selections[0], status: "won" }] },
    )).toBe(false);

    expect(hasVerificationCoreChanges(
      { event: "A vs B", market: "1X2", odds: 2, stake: 1, selections },
      { odds: 2.1 },
    )).toBe(true);
  });
});
