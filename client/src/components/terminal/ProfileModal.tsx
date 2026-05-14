import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from "recharts";
import type { Bet } from "@shared/schema";
import { aggregateBets, aggregateWinRate, aggregateYield } from "@/lib/bet-math";
import { calculateBetProfit } from "@/lib/bet-calculations";

interface ProfileModalProps {
  open: boolean;
  onClose: () => void;
  bets: Bet[];
}

function calculateProfile(bets: Bet[]) {
  let oddsSum = 0;
  let maxOdds = 0;
  let liveBets = 0;
  let parlayBets = 0;
  const settledBets: Bet[] = [];

  bets.forEach(bet => {
    if (bet.isLive) liveBets++;
    if (bet.isParlay) parlayBets++;
    if (bet.odds > maxOdds) maxOdds = bet.odds;

    const result = calculateBetProfit(bet);
    if (result.isSettled && !result.isPending) {
      settledBets.push(bet);
      oddsSum += result.weightedOdds;
    }
  });

  const aggregate = aggregateBets(settledBets);
  const profit = aggregate.profit;
  const yieldPct = aggregateYield(aggregate);
  const wins = aggregate.wins;
  const total = aggregate.settled;
  const xp = bets.length * 10;
  const nextXp = Math.ceil((xp + 1) / 500) * 500;
  const level = Math.floor(xp / 500) + 1;

  let rank = "Rookie";
  if (yieldPct > 0) rank = "Sharp";
  if (yieldPct > 5) rank = "Pro";
  if (yieldPct > 10) rank = "Whale";

  const avgOdds = total > 0 ? oddsSum / total : 0;
  const accuracy = aggregateWinRate(aggregate);

  const rentabilidad = Math.min(100, Math.max(0, (yieldPct + 20) * 2.5));
  const precision = accuracy;
  const experiencia = Math.min(100, bets.length * 2);
  const riesgo = Math.min(100, (avgOdds - 1) * 25 + (parlayBets / Math.max(1, bets.length)) * 50);
  const actividad = Math.min(100, (bets.length / 30) * 100);

  return {
    rank,
    level,
    xp,
    nextXp,
    yieldPct,
    profit,
    wins,
    total,
    avgOdds,
    accuracy,
    isPositive: profit >= 0,
    radarData: [
      { axis: "Rentabilidad", value: Math.round(rentabilidad), fullMark: 100 },
      { axis: "Precision", value: Math.round(precision), fullMark: 100 },
      { axis: "Experiencia", value: Math.round(experiencia), fullMark: 100 },
      { axis: "Riesgo", value: Math.round(riesgo), fullMark: 100 },
      { axis: "Actividad", value: Math.round(actividad), fullMark: 100 },
    ],
  };
}

export function ProfileModal({ open, onClose, bets }: ProfileModalProps) {
  const profile = calculateProfile(bets);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <DialogTitle>Perfil</DialogTitle>
            <DialogDescription className="sr-only">
              Resumen de nivel, rendimiento, estilo y actividad del usuario.
            </DialogDescription>
          </div>
          <DialogClose asChild>
            <Button variant="ghost" size="icon" data-testid="button-close-profile">
              <X className="h-4 w-4" />
            </Button>
          </DialogClose>
        </DialogHeader>

        <div className="space-y-4">
          <Card className="py-4">
            <CardContent className="px-4 py-0 text-center">
              <p className="text-3xl font-semibold mb-1">{profile.rank}</p>
              <p className="text-sm text-muted-foreground">Nivel {profile.level}</p>
              <div className="mt-3">
                <Progress value={(profile.xp % 500) / 5} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1 font-mono">
                  {profile.xp} / {profile.nextXp} XP
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="py-4">
            <CardContent className="px-4 py-0">
              <p className="text-xs text-muted-foreground uppercase tracking-wide text-center mb-2">Estadisticas</p>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={profile.radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                    <PolarGrid stroke="hsl(0 0% 25%)" />
                    <PolarAngleAxis 
                      dataKey="axis" 
                      tick={{ fontSize: 11, fill: "hsl(0 0% 65%)" }}
                    />
                    <PolarRadiusAxis 
                      angle={90} 
                      domain={[0, 100]} 
                      tick={{ fontSize: 9, fill: "hsl(0 0% 45%)", fontFamily: "JetBrains Mono" }}
                      tickCount={5}
                    />
                    <Radar
                      name="Stats"
                      dataKey="value"
                      stroke="hsl(142 71% 45%)"
                      fill="hsl(142 71% 45%)"
                      fillOpacity={0.3}
                      strokeWidth={2}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-3 gap-2 text-center">
            <Card className="py-2">
              <CardContent className="px-2 py-0">
                <p className={`text-lg font-mono font-semibold ${profile.isPositive ? "text-win" : "text-loss"}`}>
                  {profile.profit >= 0 ? "+" : ""}{profile.profit.toFixed(1)}U
                </p>
                <p className="text-[0.65rem] text-muted-foreground">Profit</p>
              </CardContent>
            </Card>
            <Card className="py-2">
              <CardContent className="px-2 py-0">
                <p className={`text-lg font-mono font-semibold ${profile.yieldPct >= 0 ? "text-win" : "text-loss"}`}>
                  {profile.yieldPct >= 0 ? "+" : ""}{profile.yieldPct.toFixed(1)}%
                </p>
                <p className="text-[0.65rem] text-muted-foreground">Yield</p>
              </CardContent>
            </Card>
            <Card className="py-2">
              <CardContent className="px-2 py-0">
                <p className="text-lg font-mono font-semibold">
                  {profile.accuracy.toFixed(0)}%
                </p>
                <p className="text-[0.65rem] text-muted-foreground">Acierto</p>
              </CardContent>
            </Card>
          </div>

          <Card className="py-3">
            <CardContent className="px-4 py-0 text-center">
              <p className="text-xs text-muted-foreground mb-1">Apuestas Totales</p>
              <p className="text-2xl font-mono font-semibold">{bets.length}</p>
              <p className="text-xs text-muted-foreground font-mono">
                <span className="text-win">{profile.wins}W</span>
                <span className="mx-1">-</span>
                <span className="text-loss">{profile.total - profile.wins}L</span>
              </p>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
