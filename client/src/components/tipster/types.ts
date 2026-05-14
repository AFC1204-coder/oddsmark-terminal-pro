import type { Bet } from "@shared/schema";

// Shared types for the Tipster system
export interface TipsterData {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  avatarInitials: string;
  isVerified: boolean;
  mainSport: string;
  specialties: string[];
  totalBets: number;
  winRate: number;
  yield: number;
  profitUnits: number;
  avgOdds: number;
  currentStreak: number;
  bestStreak: number;
  monthlyProfit: number;
  followers: number;
  telegramUrl: string | null;
  twitterUrl: string | null;
  instagramUrl: string | null;
  youtubeUrl: string | null;
  rank: number;
  verifiedSince: string | null;
  isFollowing: boolean;
  recentForm: ("W" | "L" | "P")[];
  tier: "bronze" | "silver" | "gold" | "platinum" | "diamond";
  // New fields for sparkline & period filtering
  profitHistory: number[]; // cumulative profit per settled bet (for sparkline)
  bets: Bet[]; // raw bets for period filtering
}

export const tierConfig = {
  diamond: { label: "Diamante", color: "text-foreground", bg: "bg-foreground/10", border: "border-foreground/25", glow: "shadow-black/20", gradientFrom: "from-foreground/10", gradientTo: "to-transparent" },
  platinum: { label: "Platino", color: "text-foreground", bg: "bg-foreground/10", border: "border-foreground/20", glow: "shadow-black/20", gradientFrom: "from-foreground/10", gradientTo: "to-transparent" },
  gold: { label: "Oro", color: "text-zinc-200", bg: "bg-foreground/10", border: "border-foreground/20", glow: "shadow-black/20", gradientFrom: "from-foreground/10", gradientTo: "to-transparent" },
  silver: { label: "Plata", color: "text-zinc-300", bg: "bg-foreground/5", border: "border-foreground/20", glow: "shadow-black/20", gradientFrom: "from-foreground/5", gradientTo: "to-transparent" },
  bronze: { label: "Bronce", color: "text-zinc-300", bg: "bg-foreground/5", border: "border-foreground/20", glow: "shadow-black/20", gradientFrom: "from-foreground/5", gradientTo: "to-transparent" },
};

export type TimePeriod = "7d" | "30d" | "90d" | "all";
