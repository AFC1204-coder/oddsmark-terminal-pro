import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, TrendingUp, Trophy, Target, Zap } from "lucide-react";
import type { Bet } from "@shared/schema";
import { aggregateBets } from "@/lib/bet-math";
import { calculateBetProfit } from "@/lib/bet-calculations";

interface SmartBannersProps {
  bets: Bet[];
}

interface BannerData {
  id: string;
  icon: React.ReactNode;
  text: string;
  subtext: string;
}

export function SmartBanners({ bets }: SmartBannersProps) {
  const banners = useMemo(() => {
    const result: BannerData[] = [];
    const settled = bets.filter(b => {
      const betResult = calculateBetProfit(b);
      return betResult.isSettled && !betResult.isPending;
    });
    if (settled.length < 3) return result;

    const sorted = [...settled].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Current win streak
    let streak = 0;
    for (const bet of sorted) {
      if (calculateBetProfit(bet).profit > 0) streak++;
      else break;
    }

    if (streak >= 3) {
      result.push({
        id: "streak",
        icon: <Flame className="w-4 h-4" />,
        text: `Racha de ${streak} victorias seguidas`,
        subtext: streak >= 7 ? "Increíble. Estás en una fase fuerte" : streak >= 5 ? "Gran racha, sigue así" : "Buena racha",
      });
    }

    // Weekly performance
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekBets = settled.filter(b => new Date(b.date) >= weekAgo);
    if (weekBets.length >= 3) {
      const weekProfit = aggregateBets(weekBets).profit;
      if (weekProfit > 0) {
        result.push({
          id: "weekly",
          icon: <TrendingUp className="w-4 h-4" />,
          text: `+${weekProfit.toFixed(2)}u esta semana`,
          subtext: `${weekBets.length} apuestas resueltas en 7 días`,
        });
      }
    }

    // Milestone
    const milestones = [500, 250, 100, 50];
    for (const m of milestones) {
      if (bets.length >= m && bets.length < m + 5) {
        result.push({
          id: "milestone",
          icon: <Trophy className="w-4 h-4" />,
          text: `${m} apuestas registradas`,
          subtext: "Hito alcanzado",
        });
        break;
      }
    }

    // Accuracy trend (improving)
    if (sorted.length >= 20) {
      const recent10 = sorted.slice(0, 10);
      const prev10 = sorted.slice(10, 20);
      const recentWR = recent10.filter(b => calculateBetProfit(b).profit > 0).length / recent10.length;
      const prevWR = prev10.filter(b => calculateBetProfit(b).profit > 0).length / prev10.length;
      if (recentWR > prevWR + 0.15 && recentWR > 0.5) {
        result.push({
          id: "winrate-up",
          icon: <Target className="w-4 h-4" />,
          text: `Acierto subiendo: ${(recentWR * 100).toFixed(0)}%`,
          subtext: `+${((recentWR - prevWR) * 100).toFixed(0)}% vs las 10 anteriores`,
        });
      }
    }

    return result.slice(0, 2); // Max 2 banners
  }, [bets]);

  if (banners.length === 0) return null;

  return (
    <div className="app-container app-section mb-2 space-y-2 pt-2">
      <AnimatePresence>
        {banners.map((banner, i) => (
          <motion.div
            key={banner.id}
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: "auto", marginBottom: 8 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.3, delay: i * 0.1 }}
          >
            <div className="surface-panel flex items-center gap-3 rounded-lg px-3 py-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/70 bg-foreground/5 text-foreground">
                {banner.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate text-xs font-bold text-foreground">{banner.text}</p>
                <p className="truncate text-[10px] text-muted-foreground">{banner.subtext}</p>
              </div>
              <Zap className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
