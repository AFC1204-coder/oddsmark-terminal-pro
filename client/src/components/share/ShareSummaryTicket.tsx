/**
 * ShareSummaryTicket - Weekly/Monthly P&L summary card for social media sharing.
 * Designed to be viral: shows stats that make tipsters look credible.
 */
import { useRef, useState, useCallback, useEffect } from "react";
import { toBlob } from "html-to-image";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Share2, X } from "lucide-react";
import type { Bet } from "@shared/schema";
import { aggregateAvgOdds, aggregateBets, aggregateWinRate, aggregateYield } from "@/lib/bet-math";
import { calculateBetProfit } from "@/lib/bet-calculations";
import { BrandLogo } from "@/components/brand/BrandLogo";

type Period = "week" | "month";
const shareSansFont = "'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif";

interface ShareSummaryTicketProps {
  bets: Bet[];
  open: boolean;
  onClose: () => void;
  currency: "units" | "money";
  unitValue: number;
  displayName?: string;
}

function getPeriodBets(bets: Bet[], period: Period): Bet[] {
  const now = new Date();
  return bets.filter(b => {
    const d = new Date(b.date);
    if (period === "week") {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return d >= weekAgo;
    }
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
}

export function ShareSummaryTicket({ bets, open, onClose, currency, unitValue, displayName }: ShareSummaryTicketProps) {
  const ticketRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [period, setPeriod] = useState<Period>("week");

  const multiplier = currency === "money" ? unitValue : 1;
  const sym = currency === "money" ? "€" : "U";

  const periodBets = getPeriodBets(bets, period);
  const aggregate = aggregateBets(periodBets);
  const settled = periodBets.filter(b => {
    const result = calculateBetProfit(b);
    return result.isSettled && !result.isPending;
  });
  const wins = aggregate.wins;
  const losses = aggregate.losses;
  const winRate = aggregateWinRate(aggregate);
  const totalProfit = aggregate.profit;
  const yieldPct = aggregateYield(aggregate);
  const avgOdds = aggregateAvgOdds(aggregate);

  // Best bet
  const bestBet = settled.length > 0
    ? settled.reduce((best, b) => calculateBetProfit(b).profit > calculateBetProfit(best).profit ? b : best, settled[0])
    : null;

  // Current streak
  const sorted = [...settled].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  let streak = 0;
  for (const bet of sorted) {
    if (calculateBetProfit(bet).profit > 0) streak++;
    else break;
  }

  // Daily P&L for mini chart
  const dailyPnL = new Map<string, number>();
  settled.forEach(b => {
    const d = b.date;
    dailyPnL.set(d, (dailyPnL.get(d) || 0) + calculateBetProfit(b).profit);
  });
  const dailyEntries = Array.from(dailyPnL.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  let cumulative = 0;
  const chartData = dailyEntries.map(([, pnl]) => {
    cumulative += pnl;
    return cumulative;
  });

  const periodLabel = period === "week" ? "Semanal" : "Mensual";
  const periodRange = period === "week"
    ? `${new Date(Date.now() - 7 * 86400000).toLocaleDateString("es-ES", { day: "numeric", month: "short" })} - ${new Date().toLocaleDateString("es-ES", { day: "numeric", month: "short" })}`
    : new Date().toLocaleDateString("es-ES", { month: "long", year: "numeric" });

  const handleAction = useCallback(async (mode: "share" | "download") => {
    if (!ticketRef.current) return;
    setIsGenerating(true);
    try {
      const blob = await toBlob(ticketRef.current, {
        cacheBust: true,
        skipAutoScale: true,
        skipFonts: true,
        backgroundColor: "#09090b",
        type: "image/jpeg",
        quality: 0.95,
      });
      if (!blob) throw new Error("Failed to generate image");

      const fileName = `oddsmark-summary-${period}.jpg`;

      if (mode === "share" && navigator.share) {
        const file = new File([blob], fileName, { type: "image/jpeg", lastModified: Date.now() });
        if (navigator.canShare?.({ files: [file] })) {
          try {
            await navigator.share({ files: [file] });
          } catch (e) {
            if ((e as Error).name !== "AbortError") downloadBlob(blob, fileName);
          }
        } else {
          downloadBlob(blob, fileName);
        }
      } else {
        downloadBlob(blob, fileName);
      }
    } catch (error) {
      console.error("Error generating summary:", error);
    } finally {
      setIsGenerating(false);
    }
  }, [period]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm p-0 overflow-hidden bg-transparent border-0 max-h-[95vh] overflow-y-auto">
        <DialogHeader className="sr-only">
          <DialogTitle>Resumen {periodLabel}</DialogTitle>
          <DialogDescription>
            Tarjeta exportable con el resumen de rendimiento semanal o mensual.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 p-4">
          {/* Period toggle */}
          <div className="flex gap-1 self-center">
            {(["week", "month"] as Period[]).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  period === p
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "bg-zinc-800 text-zinc-500 border border-zinc-700"
                }`}
              >
                {p === "week" ? "Semana" : "Mes"}
              </button>
            ))}
          </div>

          {/* The ticket image */}
          <div
            ref={ticketRef}
            className="rounded-xl overflow-hidden"
            style={{ backgroundColor: "#09090b" }}
          >
            {/* Accent line */}
            <div className={`h-1 ${totalProfit >= 0 ? "bg-emerald-500" : "bg-red-500"}`} />

            <div className="p-5">
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-[10px] text-zinc-500 mb-0.5">Resumen {periodLabel.toLowerCase()}</p>
                  <p className="text-base font-bold text-white">
                    {displayName || "Mi Rendimiento"}
                  </p>
                  <p className="text-[10px] text-zinc-600 font-mono mt-0.5">{periodRange}</p>
                </div>
                <BrandLogo
                  variant="light"
                  className="w-24 opacity-90"
                  imageClassName="drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]"
                />
              </div>

              {/* Hero P&L — this is the main number, biggest weight */}
              <div className="mb-4 text-center py-3">
                <p
                  className={`text-4xl font-black tracking-[-0.03em] ${
                  totalProfit >= 0 ? "text-emerald-400" : "text-red-400"
                }`}
                  style={{ fontFamily: shareSansFont }}
                >
                  {totalProfit >= 0 ? "+" : ""}{(totalProfit * multiplier).toFixed(2)}{sym}
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                  Yield {yieldPct >= 0 ? "+" : ""}{yieldPct.toFixed(1)}%
                </p>
              </div>

              {/* Mini chart */}
              {chartData.length > 1 && (
                <div className="mb-4">
                  <MiniChart data={chartData} positive={totalProfit >= 0} />
                </div>
              )}

              {/* Stats — two rows, different visual weight */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 mb-4 px-1">
                <div className="flex items-baseline justify-between">
                  <span className="text-[10px] text-zinc-500">Acierto</span>
                  <span className="text-sm font-semibold tracking-[-0.01em] text-white">{winRate.toFixed(0)}%</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-[10px] text-zinc-500">Apuestas</span>
                  <span className="text-sm font-semibold tracking-[-0.01em] text-white">{wins}G {losses}P</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-[10px] text-zinc-500">Cuota media</span>
                  <span className="text-sm font-semibold tracking-[-0.01em] text-zinc-300">@{avgOdds.toFixed(2)}</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-[10px] text-zinc-500">Racha</span>
                  <span className="text-sm font-semibold tracking-[-0.01em] text-zinc-300">{streak > 0 ? `+${streak}` : streak}</span>
                </div>
              </div>

              {/* Best bet */}
              {bestBet && calculateBetProfit(bestBet).profit > 0 && (
                <div className="border-l-2 border-amber-500/60 pl-3 mb-4">
                  <p className="text-[9px] text-zinc-600 mb-0.5">Mejor apuesta</p>
                  <p className="text-xs text-white truncate">{bestBet.event}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-zinc-500">{bestBet.market}</span>
                    <span className="text-[10px] font-semibold tracking-[-0.01em] text-zinc-400">@{bestBet.odds.toFixed(2)}</span>
                    <span className="ml-auto text-[10px] font-bold tracking-[-0.01em] text-emerald-400">
                      +{(calculateBetProfit(bestBet).profit * multiplier).toFixed(2)}{sym}
                    </span>
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-zinc-800/60">
                <p className="text-[9px] text-zinc-600">
                  Resumen Oddsmark
                </p>
                <p className="text-[9px] text-zinc-600 font-mono">
                  oddsmark.app
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose} className="flex-1 h-9">
              <X className="h-3.5 w-3.5 mr-1.5" />
              Cerrar
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleAction("download")} disabled={isGenerating} className="flex-1 h-9">
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Imagen
            </Button>
            <Button size="sm" onClick={() => handleAction("share")} disabled={isGenerating} className="flex-1 h-9 bg-emerald-600 hover:bg-emerald-700">
              <Share2 className="h-3.5 w-3.5 mr-1.5" />
              {isGenerating ? "..." : "Compartir"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Mini Chart (SVG) ─── */
function MiniChart({ data, positive }: { data: number[]; positive: boolean }) {
  const w = 300, h = 48, pad = 4;
  let min = data[0], max = data[0];
  for (let i = 1; i < data.length; i++) {
    if (data[i] < min) min = data[i];
    if (data[i] > max) max = data[i];
  }
  const range = max - min || 1;
  const iw = w - pad * 2, ih = h - pad * 2;

  const points = data.map((val, i) => {
    const x = pad + (i / (data.length - 1)) * iw;
    const y = pad + ih - ((val - min) / range) * ih;
    return `${x},${y}`;
  }).join(" ");

  const stroke = positive ? "#34d399" : "#f87171";
  const fill = positive ? "rgba(52,211,153,0.08)" : "rgba(248,113,113,0.08)";
  const first = points.split(" ")[0];
  const last = points.split(" ").pop()!;
  const areaPath = `M ${first} L ${points.replace(/ /g, " L ")} L ${last.split(",")[0]},${h - pad} L ${first.split(",")[0]},${h - pad} Z`;

  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="rounded-lg">
      <path d={areaPath} fill={fill} />
      <polyline points={points} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ─── Helper ─── */
function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = fileName;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}
