import type { Bet } from "@shared/schema";
import type { TipsterData, TimePeriod } from "@/components/tipster/types";
import { aggregateAvgOdds, aggregateBets, aggregateWinRate, aggregateYield } from "@/lib/bet-math";
import { calculateBetProfit } from "@/lib/bet-calculations";

export interface LevelInfo {
  level: number;
  currentXP: number;
  xpForNextLevel: number;
  totalXP: number;
  title: string;
}

export interface TipsterProfileDraft {
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  telegramUrl: string | null;
  twitterUrl: string | null;
  instagramUrl: string | null;
  youtubeUrl: string | null;
  isPublic: boolean;
}

export interface ServerTipsterProfile {
  username: string | null;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  telegramUrl: string | null;
  twitterUrl: string | null;
  instagramUrl: string | null;
  youtubeUrl: string | null;
  isPublic: boolean | null;
}

export interface ProfileReadiness {
  closedBets: number;
  verifiedBets: number;
  minClosedBets: number;
  recommendedBets: number;
  reliability: "baja" | "media" | "alta";
  statusLabel: string;
  missingForSkills: number;
  missingForPublicStrength: number;
}

const MIN_CLOSED_BETS_FOR_SKILLS = 5;
const RECOMMENDED_BETS_FOR_PUBLIC_STRENGTH = 25;

export function formatSportLabel(sport: string | null | undefined): string {
  const trimmed = sport?.trim();
  if (!trimmed) return "Fútbol";
  if (trimmed.toLowerCase() === "futbol") return "Fútbol";
  return trimmed;
}

export function normalizeTipsterProfile(profile: ServerTipsterProfile | TipsterProfileDraft | null): TipsterProfileDraft | null {
  if (!profile) return null;
  return {
    username: profile.username || "",
    displayName: profile.displayName || "",
    bio: profile.bio || "",
    avatarUrl: profile.avatarUrl || null,
    telegramUrl: profile.telegramUrl || null,
    twitterUrl: profile.twitterUrl || null,
    instagramUrl: profile.instagramUrl || null,
    youtubeUrl: profile.youtubeUrl || null,
    isPublic: profile.isPublic ?? true,
  };
}

export function calculateXPAndLevel(bets: Bet[]): LevelInfo {
  let totalXP = bets.length * 10;
  const settledBets = getSettledBets(bets);

  const unitsWon = settledBets.reduce((sum, bet) => sum + Math.max(0, calculateBetProfit(bet).profit), 0);
  totalXP += unitsWon * 50;

  const currentStreak = calculateCurrentWinStreak(settledBets);
  if (currentStreak >= 3) {
    totalXP += currentStreak * 25;
  }

  const levelThresholds = [0, 500, 1200, 2500, 4500, 7500, 12000, 18000, 26000, 36000, 50000];
  let level = 1;
  for (let i = levelThresholds.length - 1; i >= 0; i -= 1) {
    if (totalXP >= levelThresholds[i]) {
      level = i + 1;
      break;
    }
  }

  const currentLevelXP = levelThresholds[level - 1] || 0;
  const nextLevelXP = levelThresholds[level] || levelThresholds[level - 1] + 10000;
  const titles = ["Novato", "Aprendiz", "Amateur", "Competente", "Experto", "Maestro", "Veterano", "Elite", "Leyenda", "Titan", "Inmortal"];

  return {
    level,
    currentXP: totalXP - currentLevelXP,
    xpForNextLevel: nextLevelXP - currentLevelXP,
    totalXP,
    title: titles[Math.min(level - 1, titles.length - 1)],
  };
}

export function getProfileReadiness(bets: Bet[]): ProfileReadiness {
  const closedBets = bets.filter(b => b.status === "won" || b.status === "lost" || b.status === "void").length;
  const verifiedBets = bets.filter(b => b.verified).length;
  const reliability: ProfileReadiness["reliability"] =
    closedBets >= 50 ? "alta" : closedBets >= RECOMMENDED_BETS_FOR_PUBLIC_STRENGTH ? "media" : "baja";
  const statusLabel =
    closedBets < MIN_CLOSED_BETS_FOR_SKILLS
      ? "Perfil en calibración"
      : closedBets < RECOMMENDED_BETS_FOR_PUBLIC_STRENGTH
        ? "Muestra inicial"
        : "Perfil publicable";

  return {
    closedBets,
    verifiedBets,
    minClosedBets: MIN_CLOSED_BETS_FOR_SKILLS,
    recommendedBets: RECOMMENDED_BETS_FOR_PUBLIC_STRENGTH,
    reliability,
    statusLabel,
    missingForSkills: Math.max(0, MIN_CLOSED_BETS_FOR_SKILLS - closedBets),
    missingForPublicStrength: Math.max(0, RECOMMENDED_BETS_FOR_PUBLIC_STRENGTH - closedBets),
  };
}

export function getTierFromStats(yieldPct: number, totalBets: number, winRate: number): TipsterData["tier"] {
  if (yieldPct > 12 && totalBets > 500 && winRate > 58) return "diamond";
  if (yieldPct > 8 && totalBets > 300 && winRate > 55) return "platinum";
  if (yieldPct > 5 && totalBets > 150 && winRate > 52) return "gold";
  if (yieldPct > 2 && totalBets > 50 && winRate > 48) return "silver";
  return "bronze";
}

export function filterBetsByPeriod(bets: Bet[], period: TimePeriod): Bet[] {
  if (period === "all") return bets;
  const now = new Date();
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return bets.filter(b => new Date(b.date) >= cutoff);
}

export function computeProfitHistory(settledBets: Bet[]): number[] {
  const sorted = [...settledBets].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  let cumulative = 0;
  return sorted.map(bet => {
    cumulative += calculateBetProfit(bet).profit;
    return Math.round(cumulative * 100) / 100;
  });
}

export function generateTipstersFromBets(
  allBets: Bet[],
  currentUserId: string,
  period: TimePeriod,
  savedProfile: TipsterProfileDraft | null,
): TipsterData[] {
  if (!Array.isArray(allBets)) return [];
  const tipsterMap = new Map<string, Bet[]>();
  tipsterMap.set("__self__", allBets);
  allBets.forEach(bet => {
    if (bet.tipster) {
      const existing = tipsterMap.get(bet.tipster) || [];
      existing.push(bet);
      tipsterMap.set(bet.tipster, existing);
    }
  });

  const tipsters: TipsterData[] = [];

  tipsterMap.forEach((rawBets, key) => {
    const isSelf = key === "__self__";
    const tipsterBets = filterBetsByPeriod(rawBets, period);
    const settled = getSettledBets(tipsterBets);
    if (!isSelf && settled.length < 3) return;

    const aggregate = aggregateBets(settled);
    const winRate = aggregateWinRate(aggregate);
    const totalProfit = aggregate.profit;
    const yieldPct = aggregateYield(aggregate);
    const avgOdds = aggregateAvgOdds(aggregate);

    const sorted = [...settled].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const currentStreak = calculateCurrentWinStreak(sorted);
    const bestStreak = calculateBestWinStreak(sorted);
    const recentForm = sorted.slice(0, 10).map(b =>
      calculateBetProfit(b).profit > 0 ? "W" as const : calculateBetProfit(b).profit < 0 ? "L" as const : "P" as const
    );

    const now = new Date();
    const thisMonth = settled.filter(b => {
      const d = new Date(b.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const monthlyProfit = aggregateBets(thisMonth).profit;

    const sportCounts = new Map<string, number>();
    tipsterBets.forEach((b) => {
      const sport = formatSportLabel(b.sport);
      sportCounts.set(sport, (sportCounts.get(sport) || 0) + 1);
    });
    const mainSport = Array.from(sportCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "Fútbol";
    const displayName = isSelf ? (savedProfile?.displayName || "Tu Perfil") : key;
    const initials = displayName.slice(0, 2).toUpperCase();
    const tier = getTierFromStats(yieldPct, tipsterBets.length, winRate);
    const profitHistory = computeProfitHistory(settled);

    tipsters.push({
      id: isSelf ? currentUserId : key,
      username: isSelf ? (savedProfile?.username || "") : key,
      displayName,
      bio: isSelf ? (savedProfile?.bio || "") : `Tipster especializado en ${mainSport}`,
      avatarUrl: isSelf ? (savedProfile?.avatarUrl || null) : null,
      avatarInitials: initials,
      // Local profiles are analytical previews. Public verification must come
      // from persisted pre-event hashes/snapshots, not from performance.
      isVerified: false,
      mainSport,
      specialties: Array.from(sportCounts.keys()).slice(0, 3),
      totalBets: tipsterBets.length,
      winRate: Math.round(winRate * 10) / 10,
      yield: Math.round(yieldPct * 100) / 100,
      profitUnits: Math.round(totalProfit * 100) / 100,
      avgOdds: Math.round(avgOdds * 100) / 100,
      currentStreak,
      bestStreak,
      monthlyProfit: Math.round(monthlyProfit * 100) / 100,
      followers: 0,
      telegramUrl: isSelf ? (savedProfile?.telegramUrl || null) : null,
      twitterUrl: isSelf ? (savedProfile?.twitterUrl || null) : null,
      instagramUrl: isSelf ? (savedProfile?.instagramUrl || null) : null,
      youtubeUrl: isSelf ? (savedProfile?.youtubeUrl || null) : null,
      rank: 0,
      verifiedSince: null,
      isFollowing: false,
      recentForm,
      tier,
      profitHistory,
      bets: tipsterBets,
    });
  });

  tipsters.sort((a, b) => {
    if (a.id === currentUserId) return -1;
    if (b.id === currentUserId) return 1;
    return b.yield - a.yield;
  });
  tipsters.forEach((t, i) => { t.rank = i + 1; });
  return tipsters;
}

function getSettledBets(bets: Bet[]): Bet[] {
  return bets.filter(b => {
    const result = calculateBetProfit(b);
    return result.isSettled && !result.isPending;
  });
}

function calculateCurrentWinStreak(sortedSettledBets: Bet[]): number {
  const sorted = [...sortedSettledBets].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  let currentStreak = 0;
  for (const bet of sorted) {
    if (calculateBetProfit(bet).profit > 0) currentStreak += 1;
    else break;
  }
  return currentStreak;
}

function calculateBestWinStreak(sortedSettledBets: Bet[]): number {
  let bestStreak = 0;
  let tempStreak = 0;
  for (const bet of [...sortedSettledBets].reverse()) {
    if (calculateBetProfit(bet).profit > 0) {
      tempStreak += 1;
      if (tempStreak > bestStreak) bestStreak = tempStreak;
    } else {
      tempStreak = 0;
    }
  }
  return bestStreak;
}
