export type BetSettlementStatus = "pending" | "won" | "lost" | "void" | string;

export interface SelectionStep {
  event?: string;
  market?: string;
  selection?: string;
  odds?: number;
  line?: number;
  stake?: number;
  status?: "pending" | "won" | "lost" | "void";
  isCashout?: boolean;
  cashoutVal?: number;
}

export interface ProfitInput {
  status: BetSettlementStatus;
  odds: number;
  stake: number;
  betType?: string | null;
  selections?: unknown;
  isCashout?: boolean | null;
  cashoutVal?: number | null;
}

export interface BetProfitResult {
  profit: number;
  isPending: boolean;
  isSettled: boolean;
  totalStake: number;
  effectiveReturn: number;
  weightedOdds: number;
}

export interface EscaleraStats {
  totalStake: number;
  weightedOdds: number;
  profit: number;
  hasPending: boolean;
  effectiveReturn: number;
  isSettled: boolean;
}

export function calcSimpleBetProfit(
  status: BetSettlementStatus,
  odds: number,
  stake: number,
  isCashout?: boolean | null,
  cashoutVal?: number | null,
): number {
  if (status === "pending" || status === "void") return 0;
  if (isCashout && cashoutVal != null) return cashoutVal - stake;
  if (status === "won") return stake * (odds - 1);
  if (status === "lost") return -stake;
  return 0;
}

export function calculateEscaleraStats(
  selections: SelectionStep[],
  multiplier: number = 1,
): EscaleraStats {
  if (!selections || selections.length === 0) {
    return {
      totalStake: 0,
      weightedOdds: 1,
      profit: 0,
      hasPending: true,
      effectiveReturn: 0,
      isSettled: false,
    };
  }

  const totalStake = selections.reduce((sum, selection) => sum + (selection.stake ?? 0), 0);
  const weightedSum = selections.reduce(
    (sum, selection) => sum + (selection.stake ?? 0) * (selection.odds || 1),
    0,
  );
  const weightedOdds = totalStake > 0 ? weightedSum / totalStake : 1;
  const hasCashout = selections.some(
    (selection) => selection.isCashout && selection.cashoutVal !== undefined,
  );
  const hasPending = selections.some(
    (selection) => !selection.status || selection.status === "pending",
  );

  let effectiveReturn = 0;
  for (const selection of selections) {
    if (selection.isCashout && selection.cashoutVal !== undefined) {
      effectiveReturn += selection.cashoutVal;
    } else if (selection.status === "won") {
      effectiveReturn += (selection.stake ?? 0) * (selection.odds || 1);
    } else if (selection.status === "void") {
      effectiveReturn += selection.stake ?? 0;
    }
  }

  const isSettled = !hasPending || hasCashout;
  return {
    totalStake: totalStake * multiplier,
    weightedOdds,
    profit: isSettled ? (effectiveReturn - totalStake) * multiplier : 0,
    hasPending: hasPending && !hasCashout,
    effectiveReturn: effectiveReturn * multiplier,
    isSettled,
  };
}

export function calculateBetProfit(
  bet: ProfitInput,
  multiplier: number = 1,
): BetProfitResult {
  const selections = (bet.selections as SelectionStep[] | null) ?? [];

  if (bet.betType === "escalera" && selections.length > 0) {
    const stats = calculateEscaleraStats(selections, multiplier);
    return {
      profit: stats.profit,
      isPending: stats.hasPending,
      isSettled: stats.isSettled,
      totalStake: stats.totalStake,
      effectiveReturn: stats.effectiveReturn,
      weightedOdds: stats.weightedOdds,
    };
  }

  const isPending = bet.status === "pending";
  const isSettled = bet.status === "won" || bet.status === "lost";
  const profit = calcSimpleBetProfit(
    bet.status,
    bet.odds,
    bet.stake,
    bet.isCashout,
    bet.cashoutVal,
  ) * multiplier;

  return {
    profit,
    isPending,
    isSettled,
    totalStake: isSettled ? bet.stake * multiplier : 0,
    effectiveReturn: isSettled ? (profit + bet.stake * multiplier) : 0,
    weightedOdds: bet.odds,
  };
}
