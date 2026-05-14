import { ShieldCheck, TrendingUp, Target, Activity } from "lucide-react";
import type { TipsterData } from "./types";
import { ProfitSparkline } from "./ProfitSparkline";

interface TipsterOfTheMonthProps {
  tipster: TipsterData;
  onClick: () => void;
}

export function TipsterOfTheMonth({ tipster, onClick }: TipsterOfTheMonthProps) {
  const monthName = new Date().toLocaleDateString("es-ES", { month: "long" });

  return (
    <button
      onClick={onClick}
      className="surface-panel w-full rounded-lg p-4 text-left transition-all hover:border-primary/25 active:scale-[0.99]"
    >
      <div className="flex items-center gap-1.5 mb-3">
        <ShieldCheck className="w-4 h-4 text-primary" />
        <span className="text-[10px] font-medium text-muted-foreground">
          Perfil destacado - {monthName}
        </span>
      </div>

      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className="w-12 h-12 rounded-lg bg-muted border border-border/70 flex items-center justify-center shrink-0">
          <span className="font-bold text-lg text-foreground">{tipster.avatarInitials}</span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white truncate">{tipster.displayName}</p>
          <div className="flex items-center gap-3 mt-1">
            <span className="flex items-center gap-1 text-[10px] text-zinc-400">
              <TrendingUp className="w-3 h-3 text-emerald-400" />
              <span className="font-bold text-emerald-400">
                {tipster.monthlyProfit >= 0 ? "+" : ""}{tipster.monthlyProfit.toFixed(2)}u
              </span>
            </span>
            <span className="flex items-center gap-1 text-[10px] text-zinc-400">
              <Target className="w-3 h-3" />
              {tipster.winRate.toFixed(0)}%
            </span>
            <span className="flex items-center gap-1 text-[10px] text-zinc-400">
              <Activity className="w-3 h-3 text-muted-foreground" />
              {tipster.currentStreak}
            </span>
          </div>
        </div>

        {/* Sparkline */}
        <ProfitSparkline data={tipster.profitHistory} width={72} height={28} />
      </div>
    </button>
  );
}
