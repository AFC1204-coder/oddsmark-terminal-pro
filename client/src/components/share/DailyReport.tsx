import { useRef, useState, useCallback, useMemo } from "react";
import { toBlob } from "html-to-image";
import QRCode from "react-qr-code";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Share2, X, TrendingUp, TrendingDown } from "lucide-react";
import type { Bet } from "@shared/schema";
import { aggregateBets, aggregateYield } from "@/lib/bet-math";
import { calculateBetProfit } from "@/lib/bet-calculations";
import { isSameDay, parseISO, startOfDay } from "date-fns";

interface DailyReportProps {
  bets: Bet[];
  open: boolean;
  onClose: () => void;
  currency: "units" | "money";
  unitValue: number;
  date?: string;
}

export function DailyReport({ bets, open, onClose, currency, unitValue, date }: DailyReportProps) {
  const ticketRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const multiplier = currency === "money" ? unitValue : 1;
  const currencySymbol = currency === "money" ? "€" : "U";

  const todayStr = date || new Date().toISOString().split("T")[0];
  const appUrl = typeof window !== "undefined" ? window.location.origin : "";

  const parseLocalDate = (dateStr: string): Date | null => {
    if (!dateStr) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [y, m, d] = dateStr.split("-").map(Number);
      return new Date(y, m - 1, d);
    }
    if (/^\d{4}-\d{2}-\d{2}T/.test(dateStr)) {
      return parseISO(dateStr);
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  };

  const targetDate = parseLocalDate(todayStr);

  const todayBets = useMemo(() => {
    if (!targetDate) return [];
    return bets.filter(bet => {
      if (!bet.date) return false;
      const betDate = parseLocalDate(bet.date);
      if (!betDate) return false;
      return isSameDay(startOfDay(betDate), startOfDay(targetDate));
    });
  }, [bets, targetDate]);

  const settledBets = useMemo(() => {
    return todayBets.filter(b => {
      const result = calculateBetProfit(b);
      return result.isSettled && !result.isPending;
    });
  }, [todayBets]);

  const sortedByStake = useMemo(() => {
    return [...settledBets].sort((a, b) => calculateBetProfit(b).totalStake - calculateBetProfit(a).totalStake);
  }, [settledBets]);

  const top5 = sortedByStake.slice(0, 5);
  const remaining = sortedByStake.slice(5);

  const calculateProfit = (bet: Bet): number => {
    return calculateBetProfit(bet, multiplier).profit;
  };

  const stats = useMemo(() => {
    const aggregate = aggregateBets(settledBets);
    const profit = aggregate.profit * multiplier;
    const totalStaked = aggregate.stake * multiplier;
    const roi = aggregateYield(aggregate);

    return { wins: aggregate.wins, total: aggregate.settled, profit, roi, totalStaked };
  }, [settledBets, multiplier]);

  const remainingProfit = remaining.reduce((sum, b) => sum + calculateProfit(b), 0);

  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split("-");
    const months = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
    return `${day} ${months[parseInt(month) - 1]} ${year}`;
  };

  const getSelection = (bet: Bet): string => {
    if (bet.selections && Array.isArray(bet.selections) && bet.selections.length > 0) {
      const sel = bet.selections[0] as { selection?: string; market?: string };
      return sel.selection || sel.market || bet.market;
    }
    return bet.market;
  };

  const formatEventTime = (bet: Bet): string => {
    if (bet.time) {
      return bet.time;
    }
    return "";
  };

  const getLineDisplay = (bet: Bet): string | null => {
    if (bet.selections && Array.isArray(bet.selections) && bet.selections.length > 0) {
      const sel = bet.selections[0] as { line?: number };
      if (sel.line !== null && sel.line !== undefined) {
        return sel.line > 0 ? `+${sel.line}` : `${sel.line}`;
      }
    }
    return null;
  };

  const handleShare = useCallback(async () => {
    if (!ticketRef.current) return;
    
    setIsGenerating(true);
    const fileName = `terminal-share.jpg`;

    try {
      const blob = await toBlob(ticketRef.current, {
        cacheBust: true,
        skipAutoScale: true,
        backgroundColor: "#09090b",
        type: "image/jpeg",
        quality: 0.95,
      });

      if (!blob) throw new Error("Failed to generate image");

      const file = new File([blob], fileName, { 
        type: "image/jpeg", 
        lastModified: Date.now() 
      });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file] });
        } catch (shareErr) {
          if ((shareErr as Error).name !== "AbortError") {
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.download = fileName;
            link.href = url;
            link.click();
            URL.revokeObjectURL(url);
          }
        }
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.download = fileName;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error("Error in handleShare:", error);
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const handleDownload = useCallback(async () => {
    if (!ticketRef.current) return;
    
    setIsGenerating(true);
    try {
      const blob = await toBlob(ticketRef.current, {
        cacheBust: true,
        skipAutoScale: true,
        backgroundColor: "#09090b",
        type: "image/jpeg",
        quality: 0.95,
      });

      if (!blob) throw new Error("Failed to generate image");

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = `terminal-report-${todayStr}.jpg`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading:", error);
    } finally {
      setIsGenerating(false);
    }
  }, [todayStr]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-0 overflow-hidden bg-transparent border-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Informe de Cierre Diario</DialogTitle>
          <DialogDescription>
            Tarjeta exportable con el informe de cierre diario de apuestas.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 p-4">
          <div 
            ref={ticketRef}
            className="bg-zinc-950 rounded-xl overflow-hidden"
            style={{ minWidth: "360px" }}
          >
            <div className="h-1 bg-gradient-to-r from-zinc-800 via-zinc-600 to-zinc-800" />
            
            <div className="p-6">
              <div className="text-center mb-6">
                <span className="text-[9px] uppercase tracking-[0.3em] text-zinc-600 block mb-2">
                  INFORME DE CIERRE DIARIO
                </span>
                <span className="font-mono text-lg font-bold tracking-wider text-zinc-200">
                  {formatDate(todayStr)}
                </span>
              </div>

              <div className="text-center py-8 mb-6 border-y border-zinc-800/50 bg-zinc-900/20">
                <span className="text-[9px] uppercase tracking-[0.2em] text-zinc-600 block mb-3">
                  BALANCE DE SESIÓN
                </span>
                <span 
                  className={`font-mono text-5xl font-bold tracking-tighter leading-none block ${
                    stats.profit >= 0 ? "text-emerald-400" : "text-red-400"
                  }`}
                  style={{
                    textShadow: stats.profit >= 0 
                      ? "0 0 40px rgba(52, 211, 153, 0.25)" 
                      : "0 0 40px rgba(248, 113, 113, 0.25)"
                  }}
                >
                  {stats.profit >= 0 ? "+" : ""}{stats.profit.toFixed(2)}{currencySymbol}
                </span>

                <div className="flex justify-center gap-8 mt-5">
                  <div className="text-center">
                    <span className="text-[8px] uppercase tracking-widest text-zinc-600 block mb-1">
                      ACIERTOS
                    </span>
                    <span className="font-mono text-lg font-bold text-zinc-100">
                      {stats.wins}/{stats.total}
                    </span>
                  </div>
                  <div className="text-center">
                    <span className="text-[8px] uppercase tracking-widest text-zinc-600 block mb-1">
                      ROI DIARIO
                    </span>
                    <span className={`font-mono text-lg font-bold ${
                      stats.roi >= 0 ? "text-emerald-400" : "text-red-400"
                    }`}>
                      {stats.roi >= 0 ? "+" : ""}{stats.roi.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>

              {top5.length > 0 && (
                <div className="mb-4">
                  <span className="text-[8px] uppercase tracking-[0.15em] text-zinc-600 block mb-3">
                    TOP MOVIMIENTOS (POR STAKE)
                  </span>
                  
                  <div className="space-y-0">
                    {top5.map((bet, idx) => {
                      const profit = calculateProfit(bet);
                      const isWin = bet.status === "won";
                      return (
                        <div 
                          key={bet.id || idx}
                          className="flex items-center gap-3 py-2.5 border-b border-zinc-900 last:border-0"
                        >
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                            isWin ? "bg-emerald-500/20" : "bg-red-500/20"
                          }`}>
                            {isWin ? (
                              <TrendingUp className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <TrendingDown className="w-3 h-3 text-red-400" />
                            )}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <p className="text-lg font-bold text-white truncate leading-tight">
                              {getSelection(bet)}
                            </p>
                            <p className="text-[10px] uppercase tracking-wider text-zinc-500 mt-0.5">
                              {bet.market}
                              {getLineDisplay(bet) && (
                                <span className="text-cyan-400 ml-1">• {getLineDisplay(bet)}</span>
                              )}
                              {formatEventTime(bet) && (
                                <span className="text-zinc-600 ml-1">• {formatEventTime(bet)}</span>
                              )}
                            </p>
                            <p className="font-mono text-[10px] text-zinc-600 mt-0.5">
                              @{bet.odds.toFixed(2)} <span className="text-zinc-700">|</span> {(bet.stake * multiplier).toFixed(2)}{currencySymbol}
                            </p>
                          </div>
                          
                          <span className={`font-mono text-[12px] font-bold flex-shrink-0 ${
                            profit >= 0 ? "text-emerald-400" : "text-red-400"
                          }`}>
                            {profit >= 0 ? "+" : ""}{profit.toFixed(2)}{currencySymbol}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {remaining.length > 0 && (
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-dashed border-zinc-800">
                      <span className="text-[10px] text-zinc-500 italic">
                        y {remaining.length} apuesta{remaining.length > 1 ? "s" : ""} más...
                      </span>
                      <span className={`font-mono text-[11px] font-medium ${
                        remainingProfit >= 0 ? "text-emerald-400" : "text-red-400"
                      }`}>
                        {remainingProfit >= 0 ? "+" : ""}{remainingProfit.toFixed(2)}{currencySymbol}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="pt-4 border-t border-zinc-800/50">
                <div className="flex items-end justify-between">
                  <div>
                    <span className="font-mono text-[9px] font-bold tracking-[0.2em] text-zinc-600 block">
                      ODDSMARK
                    </span>
                    <span className="text-[8px] text-zinc-700 tracking-wide">
                      RESUMEN DE RENDIMIENTO
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-zinc-600">
                      Escanear
                    </span>
                    <div className="bg-white p-1.5 rounded">
                      <QRCode
                        value={appUrl || "https://terminal.app"}
                        size={40}
                        bgColor="#ffffff"
                        fgColor="#09090b"
                        level="L"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="flex-1"
              data-testid="button-close-report"
            >
              <X className="h-4 w-4 mr-2" />
              Cerrar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              disabled={isGenerating}
              className="flex-1"
              data-testid="button-download-report"
            >
              <Download className="h-4 w-4 mr-2" />
              PNG
            </Button>
            <Button
              size="sm"
              onClick={handleShare}
              disabled={isGenerating}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              data-testid="button-share-report"
            >
              <Share2 className="h-4 w-4 mr-2" />
              {isGenerating ? "..." : "Compartir"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
