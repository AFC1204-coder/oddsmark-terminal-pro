import { describe, expect, it } from "vitest";
import type { Bet, Strategy } from "@shared/schema";
import { analyzeStrategy, isStrategyRulesById } from "../strategy-analysis";

function strategy(overrides: Partial<Strategy> = {}): Strategy {
  return {
    id: 1,
    userId: "u1",
    name: "Value prepartido",
    createdAt: new Date(),
    ...overrides,
  } as Strategy;
}

function bet(overrides: Partial<Bet> = {}): Bet {
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
    strategyId: 1,
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

describe("analyzeStrategy", () => {
  it("calculates resolved, pending and core performance metrics for one strategy", () => {
    const out = analyzeStrategy(strategy(), [
      bet({ status: "won", odds: 2, stake: 2, date: "2024-01-01" }), // +2
      bet({ status: "lost", odds: 2, stake: 1, date: "2024-01-02" }), // -1
      bet({ status: "pending", odds: 2, stake: 5, date: "2024-01-03" }),
      bet({ strategyId: 2, status: "won", odds: 10, stake: 10, date: "2024-01-04" }),
    ]);

    expect(out.settledCount).toBe(2);
    expect(out.pendingCount).toBe(1);
    expect(out.profit).toBe(1);
    expect(out.yieldPct).toBeCloseTo(33.33, 1);
    expect(out.winRate).toBe(50);
    expect(out.averageStake).toBe(1.5);
    expect(out.averageOdds).toBe(2);
    expect(out.bestBet?.profit).toBe(2);
    expect(out.worstBet?.profit).toBe(-1);
    expect(out.pnlCurve.map((point) => point.profit)).toEqual([0, 2, 1]);
    expect(out.decision.label).toBe("Observar");
  });

  it("counts drawdown from the opening balance, including early losses", () => {
    const out = analyzeStrategy(strategy(), [
      bet({ status: "lost", odds: 2, stake: 2, date: "2024-01-01" }), // -2
      bet({ status: "won", odds: 2, stake: 1, date: "2024-01-02" }), // +1
    ]);

    expect(out.maxDrawdownUnits).toBe(2);
  });

  it("flags outlier-driven positive yield and negative streaks", () => {
    const out = analyzeStrategy(strategy(), [
      bet({ status: "won", odds: 10, stake: 1, date: "2024-01-01" }), // +9
      bet({ status: "lost", odds: 2, stake: 1, date: "2024-01-02" }),
      bet({ status: "lost", odds: 2, stake: 1, date: "2024-01-03" }),
      bet({ status: "lost", odds: 2, stake: 1, date: "2024-01-04" }),
    ]);

    const labels = out.healthTags.map((tag) => tag.label);
    expect(labels).toContain("Racha negativa");
    expect(labels).toContain("Dependiente de una apuesta");
    expect(labels).toContain("Yield inflado por cuota alta");
    expect(out.decision.label).toBe("Pausar");
  });

  it("suggests following a healthy mature strategy", () => {
    const out = analyzeStrategy(strategy(), Array.from({ length: 8 }, (_, index) =>
      bet({ status: "won", odds: 2, stake: 1, date: `2024-01-${String(index + 1).padStart(2, "0")}` })
    ));

    expect(out.decision.label).toBe("Seguir");
    expect(out.decision.tone).toBe("good");
  });
});

describe("isStrategyRulesById", () => {
  it("accepts the local strategy rules shape", () => {
    expect(isStrategyRulesById({
      "1": {
        description: "Value en favoritos con cierre positivo",
        oddsRange: "1.70 - 2.30",
        baseStake: "1U",
        timing: "pre",
        preferredSportsMarkets: "Fútbol, asiáticos",
        exposureLimit: "4U",
        pauseCondition: "3 pérdidas seguidas",
      },
    })).toBe(true);
  });

  it("rejects stale or malformed local rules", () => {
    expect(isStrategyRulesById({
      "1": {
        description: "Sin timing",
      },
    })).toBe(false);
  });
});
