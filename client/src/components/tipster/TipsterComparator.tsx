import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, ShieldCheck, TrendingUp, Target, Flame, Award, BarChart3, Calendar } from "lucide-react";
import type { TipsterData } from "./types";
import { tierConfig } from "./types";
import { ProfitSparkline } from "./ProfitSparkline";

interface TipsterComparatorProps {
  tipsters: TipsterData[];
  open: boolean;
  onClose: () => void;
  onRemove: (id: string) => void;
}

function getStatColor(value: number, allValues: number[], higherIsBetter: boolean): string {
  const best = higherIsBetter ? Math.max(...allValues) : Math.min(...allValues);
  if (value === best) return "text-emerald-400";
  return "text-zinc-300";
}

export function TipsterComparator({ tipsters, open, onClose, onRemove }: TipsterComparatorProps) {
  if (tipsters.length === 0) return null;

  const stats: { key: string; label: string; icon: React.ReactNode; getValue: (t: TipsterData) => string; getRaw: (t: TipsterData) => number; higherIsBetter: boolean }[] = [
    { key: "yield", label: "Yield", icon: <TrendingUp className="w-3 h-3 text-emerald-400" />, getValue: t => `${t.yield >= 0 ? "+" : ""}${t.yield.toFixed(2)}%`, getRaw: t => t.yield, higherIsBetter: true },
    { key: "winRate", label: "Acierto", icon: <Target className="w-3 h-3 text-blue-400" />, getValue: t => `${t.winRate.toFixed(1)}%`, getRaw: t => t.winRate, higherIsBetter: true },
    { key: "profit", label: "P&L", icon: <Award className="w-3 h-3 text-amber-400" />, getValue: t => `${t.profitUnits >= 0 ? "+" : ""}${t.profitUnits.toFixed(2)}u`, getRaw: t => t.profitUnits, higherIsBetter: true },
    { key: "avgOdds", label: "Cuota Media", icon: <BarChart3 className="w-3 h-3 text-violet-400" />, getValue: t => `@${t.avgOdds.toFixed(2)}`, getRaw: t => t.avgOdds, higherIsBetter: false },
    { key: "streak", label: "Racha", icon: <Flame className="w-3 h-3 text-orange-400" />, getValue: t => `${t.currentStreak}`, getRaw: t => t.currentStreak, higherIsBetter: true },
    { key: "bets", label: "Apuestas", icon: <Calendar className="w-3 h-3 text-cyan-400" />, getValue: t => `${t.totalBets}`, getRaw: t => t.totalBets, higherIsBetter: true },
    { key: "monthly", label: "Mes actual", icon: <TrendingUp className="w-3 h-3 text-emerald-400" />, getValue: t => `${t.monthlyProfit >= 0 ? "+" : ""}${t.monthlyProfit.toFixed(2)}u`, getRaw: t => t.monthlyProfit, higherIsBetter: true },
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg p-0 overflow-hidden bg-zinc-950 border-zinc-800 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="sr-only">
          <DialogTitle>Comparar tipsters</DialogTitle>
          <DialogDescription>
            Comparativa de métricas entre tipsters seleccionados.
          </DialogDescription>
        </DialogHeader>

        <div className="p-4 border-b border-zinc-800">
          <h2 className="text-sm font-bold text-white">Comparar Tipsters</h2>
          <p className="text-[10px] text-zinc-500 mt-0.5">Las mejores stats de cada fila se resaltan en verde</p>
        </div>

        {/* Tipster Headers */}
        <div className="px-4 pt-3">
          <div className={`grid gap-2`} style={{ gridTemplateColumns: `100px repeat(${tipsters.length}, 1fr)` }}>
            <div /> {/* empty label column */}
            {tipsters.map(t => {
              const tier = tierConfig[t.tier];
              return (
                <div key={t.id} className="text-center relative">
                  <button
                    onClick={() => onRemove(t.id)}
                    className="absolute -top-1 -right-1 w-4 h-4 bg-zinc-800 rounded-full flex items-center justify-center hover:bg-red-500/30 z-10"
                  >
                    <X className="w-2.5 h-2.5 text-zinc-400" />
                  </button>
                  <div className={`w-10 h-10 mx-auto rounded-full ${tier.bg} flex items-center justify-center mb-1`}>
                    <span className={`font-bold text-xs ${tier.color}`}>{t.avatarInitials}</span>
                  </div>
                  <p className="text-[11px] font-bold text-white truncate">{t.displayName}</p>
                  <div className="flex items-center justify-center gap-1 mt-0.5">
                    <span className={`text-[8px] font-bold ${tier.color}`}>{tier.label.toUpperCase()}</span>
                    {t.isVerified && <ShieldCheck className="w-2.5 h-2.5 text-emerald-400" />}
                  </div>
                  <div className="mt-1">
                    <ProfitSparkline data={t.profitHistory} width={56} height={20} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Stats Rows */}
        <div className="px-4 py-3 space-y-1">
          {stats.map(stat => {
            const rawValues = tipsters.map(t => stat.getRaw(t));
            return (
              <div
                key={stat.key}
                className={`grid gap-2 py-2 border-b border-zinc-800/50`}
                style={{ gridTemplateColumns: `100px repeat(${tipsters.length}, 1fr)` }}
              >
                <div className="flex items-center gap-1.5">
                  {stat.icon}
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider">{stat.label}</span>
                </div>
                {tipsters.map(t => {
                  const color = getStatColor(stat.getRaw(t), rawValues, stat.higherIsBetter);
                  return (
                    <div key={t.id} className="text-center">
                      <span className={`text-sm font-black font-mono ${color}`}>
                        {stat.getValue(t)}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Recent Form */}
        <div className="px-4 pb-4">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Forma reciente</p>
          <div className={`grid gap-2`} style={{ gridTemplateColumns: `100px repeat(${tipsters.length}, 1fr)` }}>
            <div />
            {tipsters.map(t => (
              <div key={t.id} className="flex gap-0.5 justify-center">
                {t.recentForm.slice(0, 6).map((r, i) => (
                  <span
                    key={i}
                    className={`w-5 h-5 rounded-sm text-[9px] font-bold flex items-center justify-center ${
                      r === "W" ? "bg-emerald-500/20 text-emerald-400" :
                      r === "L" ? "bg-red-500/20 text-red-400" :
                      "bg-zinc-800 text-zinc-500"
                    }`}
                  >
                    {r}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
