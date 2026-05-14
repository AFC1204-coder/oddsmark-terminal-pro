import { apiRequest } from "@/lib/queryClient";
import type { Bet as SchemaBet } from "@shared/schema";

export interface BetSelection {
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

export interface BetInput {
  userId?: string;
  date: string;
  sport?: string;
  league?: string;
  event: string;
  market: string;
  odds: number;
  stake: number;
  status?: string;
  time?: string | null;
  bookie?: string | null;
  tipster?: string | null;
  betType?: string;
  selections?: unknown;
  isLive?: boolean;
  isCashout?: boolean;
  cashoutVal?: number | null;
  currentCashout?: number | null;
  isValue?: boolean;
  isParlay?: boolean;
  comment?: string | null;
  strategyId?: number | null;
  position?: string | null;
  formation?: string | null;
  player?: string | null;
  isSubstitute?: boolean;
  tactic?: string | null;
  tags?: string | null;
  marketType?: string | null;
  matchSide?: string | null;
  imageUrl?: string | null;
  verified?: boolean;
  closingOdds?: number | null;
  isLongTerm?: boolean;
  resolutionDate?: string | null;
}

export const betService = {
  async createBet(betData: BetInput): Promise<SchemaBet> {
    const res = await apiRequest("POST", "/api/bets", betData);
    return await res.json();
  },

  async getBets(): Promise<SchemaBet[]> {
    const res = await apiRequest("GET", "/api/bets?all=true");
    return await res.json();
  },

  async getBetsPaginated(limit = 50, offset = 0): Promise<{
    bets: SchemaBet[];
    total: number;
    hasMore: boolean;
  }> {
    const res = await apiRequest("GET", `/api/bets?limit=${limit}&offset=${offset}`);
    return await res.json();
  },

  async updateBet(id: number | string, updates: Partial<BetInput>): Promise<SchemaBet> {
    const res = await apiRequest("PATCH", `/api/bets/${id}`, updates);
    return await res.json();
  },

  async deleteBet(id: number | string): Promise<void> {
    await apiRequest("DELETE", `/api/bets/${id}`, undefined, {
      headers: { "X-Confirm-Action": "soft-delete-bet" },
    });
  },

  async getBetById(id: number | string): Promise<SchemaBet | null> {
    try {
      const res = await apiRequest("GET", `/api/bets/${id}`);
      return await res.json();
    } catch {
      return null;
    }
  },
};
