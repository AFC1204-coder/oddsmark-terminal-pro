import { useMemo } from "react";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
} from "recharts";
import { Lock } from "lucide-react";
import type { Bet } from "@shared/schema";

interface SkillRadarProps {
  bets: Bet[];
  compactLocked?: boolean;
}

const MIN_BETS_REQUIRED = 5;

function calculateSkillMetrics(bets: Bet[]): { axis: string; value: number }[] {
  const settled = bets.filter(b => b.status === "won" || b.status === "lost");
  const wins = settled.filter(b => b.status === "won").length;
  const total = settled.length;

  const totalProfit = settled.reduce((sum, bet) => {
    if (bet.status === "won") {
      const profit = bet.isCashout && bet.cashoutVal !== null && bet.cashoutVal !== undefined
        ? bet.cashoutVal - bet.stake
        : bet.stake * (bet.odds - 1);
      return sum + profit;
    } else if (bet.status === "lost") {
      const loss = bet.isCashout && bet.cashoutVal !== null && bet.cashoutVal !== undefined
        ? bet.cashoutVal - bet.stake
        : -bet.stake;
      return sum + loss;
    }
    return sum;
  }, 0);

  const totalStaked = settled.reduce((sum, b) => sum + b.stake, 0);
  const yield_ = totalStaked > 0 ? (totalProfit / totalStaked) * 100 : 0;

  const rentabilidad = Math.min(100, Math.max(0, 50 + yield_ * 2));

  const winRate = total > 0 ? (wins / total) * 100 : 0;
  const acierto = Math.min(100, winRate);

  const experiencia = Math.min(100, (bets.length / 100) * 100);

  const avgStake = total > 0 ? totalStaked / total : 0;
  const stakeVariance = settled.reduce((sum, b) => sum + Math.pow(b.stake - avgStake, 2), 0) / Math.max(1, total);
  const stakeStdDev = Math.sqrt(stakeVariance);
  const cv = avgStake > 0 ? (stakeStdDev / avgStake) : 0;
  const disciplina = Math.min(100, Math.max(0, 100 - cv * 50));

  const sortedBets = [...settled].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const recent = sortedBets.slice(0, 10);
  const recentWins = recent.filter(b => b.status === "won").length;
  const momentum = recent.length > 0 ? (recentWins / recent.length) * 100 : 50;

  return [
    { axis: "Rentabilidad", value: Math.round(rentabilidad) },
    { axis: "Acierto", value: Math.round(acierto) },
    { axis: "Muestra", value: Math.round(experiencia) },
    { axis: "Stake", value: Math.round(disciplina) },
    { axis: "Forma", value: Math.round(momentum) },
  ];
}

const placeholderData = [
  { axis: "Rentabilidad", value: 50 },
  { axis: "Acierto", value: 50 },
  { axis: "Muestra", value: 50 },
  { axis: "Stake", value: 50 },
  { axis: "Forma", value: 50 },
];

export function SkillRadar({ bets, compactLocked = false }: SkillRadarProps) {
  const closedBets = useMemo(() => 
    bets.filter(b => b.status === "won" || b.status === "lost" || b.status === "void"), 
    [bets]
  );
  const isUnlocked = closedBets.length >= MIN_BETS_REQUIRED;
  const data = useMemo(() => isUnlocked ? calculateSkillMetrics(bets) : placeholderData, [bets, isUnlocked]);

  if (!isUnlocked && compactLocked) {
    const progress = Math.min(100, (closedBets.length / MIN_BETS_REQUIRED) * 100);
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-md p-4" data-testid="card-skill-radar">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-zinc-300">Perfil operativo</h3>
            <p className="mt-1 text-xs text-zinc-500">
              Calibrando lectura · faltan {Math.max(0, MIN_BETS_REQUIRED - closedBets.length)} apuestas cerradas
            </p>
          </div>
          <div className="rounded-md border border-zinc-700 bg-zinc-800/70 p-2">
            <Lock className="h-4 w-4 text-zinc-400" />
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-800">
          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-2 text-[11px] text-zinc-500">
          {closedBets.length}/{MIN_BETS_REQUIRED} cerradas para activar rentabilidad, stake y forma.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-md p-4 relative" data-testid="card-skill-radar">
      <h3 className="text-sm font-semibold text-zinc-300 mb-3 text-center">Perfil operativo</h3>
      <div className="h-64 relative">
        <div className={isUnlocked ? "" : "blur-sm opacity-40 pointer-events-none"}>
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={data} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
              <PolarGrid stroke="hsl(0 0% 30%)" />
              <PolarAngleAxis 
                dataKey="axis" 
                tick={{ fontSize: 11, fill: "hsl(0 0% 65%)" }}
              />
              <PolarRadiusAxis 
                angle={90} 
                domain={[0, 100]} 
                tick={{ fontSize: 9, fill: "hsl(0 0% 45%)", fontFamily: "monospace" }}
                tickCount={5}
              />
              <Radar
                name="Skills"
                dataKey="value"
                stroke="#10b981"
                fill="#10b981"
                fillOpacity={0.3}
                strokeWidth={2}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        {!isUnlocked && (
          <div 
            className="absolute inset-0 flex flex-col items-center justify-center"
            data-testid="skill-radar-locked"
          >
            <div className="bg-zinc-800/90 backdrop-blur-sm rounded-xl px-4 py-3 text-center border border-zinc-700">
              <Lock className="h-5 w-5 text-zinc-400 mx-auto mb-2" />
              <p className="text-xs text-zinc-300 font-medium">Calibrando lectura</p>
              <p className="text-[10px] text-zinc-500 mt-1">
                {closedBets.length}/{MIN_BETS_REQUIRED} apuestas cerradas
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
