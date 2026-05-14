import { useRef, useState, useCallback, useMemo } from "react";
import { toBlob } from "html-to-image";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Share2, X } from "lucide-react";
import type { Bet } from "@shared/schema";
import { aggregateBets, aggregateYield } from "@/lib/bet-math";

interface DailyTicketProps {
  bets: Bet[];
  open: boolean;
  onClose: () => void;
  currency: "units" | "money";
  unitValue: number;
  date?: string;
}

export function DailyTicket({ bets, open, onClose, currency, unitValue, date }: DailyTicketProps) {
  const ticketRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const multiplier = currency === "money" ? unitValue : 1;
  const currencySymbol = currency === "money" ? "€" : "U";

  const today = date || new Date().toISOString().split("T")[0];

  const todayBets = useMemo(() => {
    return bets.filter(bet => bet.date === today);
  }, [bets, today]);

  const stats = useMemo(() => {
    const aggregate = aggregateBets(todayBets);

    return {
      wins: aggregate.wins,
      losses: aggregate.losses,
      total: aggregate.settled,
      profit: aggregate.profit * multiplier,
      roi: aggregateYield(aggregate),
    };
  }, [todayBets, multiplier]);

  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split("-");
    const months = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
    return `${day} ${months[parseInt(month) - 1]} ${year}`;
  };

  const handleShare = useCallback(async () => {
    if (!ticketRef.current) return;
    
    setIsGenerating(true);
    try {
      const blob = await toBlob(ticketRef.current, {
        backgroundColor: "#09090b",
        pixelRatio: 2,
        quality: 1,
      });

      if (!blob) {
        throw new Error("Failed to generate image");
      }

      const fileName = `terminal-daily-${today}-${Date.now()}.png`;
      const file = new File([blob], fileName, { type: "image/png" });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "Resumen diario Oddsmark",
          text: `Resumen del ${formatDate(today)}: ${stats.profit >= 0 ? "+" : ""}${stats.profit.toFixed(2)}${currencySymbol}`,
        });
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.download = fileName;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        console.error("Error sharing:", error);
      }
    } finally {
      setIsGenerating(false);
    }
  }, [today, stats.profit, currencySymbol]);

  const handleDownload = useCallback(async () => {
    if (!ticketRef.current) return;
    
    setIsGenerating(true);
    try {
      const blob = await toBlob(ticketRef.current, {
        backgroundColor: "#09090b",
        pixelRatio: 2,
        quality: 1,
      });

      if (!blob) {
        throw new Error("Failed to generate image");
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = `terminal-daily-${today}-${Date.now()}.png`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading:", error);
    } finally {
      setIsGenerating(false);
    }
  }, [today]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-0 overflow-hidden bg-transparent border-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Resumen Diario</DialogTitle>
          <DialogDescription>
            Tarjeta exportable con el resumen diario de apuestas.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 p-4">
          <div 
            ref={ticketRef}
            className="bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden"
            style={{ width: "100%" }}
          >
            <div className="h-1 bg-gradient-to-r from-zinc-800 via-zinc-600 to-zinc-800" />
            
            <div className="p-6">
              <div className="text-center mb-2">
                <span className="text-[10px] uppercase tracking-[0.3em] text-zinc-600 block mb-3">
                  INFORME DE CIERRE DIARIO
                </span>
                <span className="font-mono text-lg font-bold tracking-wider text-zinc-300">
                  {formatDate(today)}
                </span>
              </div>

              <div className="text-center py-10 my-6 border-y border-zinc-800">
                <span className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-3">
                  BALANCE DE SESIÓN
                </span>
                <span className={`font-mono text-6xl font-bold tracking-tighter leading-none ${
                  stats.profit >= 0 ? "text-emerald-500" : "text-red-500"
                }`} style={{
                  textShadow: stats.profit >= 0 
                    ? "0 0 40px rgba(16, 185, 129, 0.3)" 
                    : "0 0 40px rgba(239, 68, 68, 0.3)"
                }}>
                  {stats.profit >= 0 ? "+" : ""}{stats.profit.toFixed(2)}{currencySymbol}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="text-center">
                  <span className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-2">
                    ACIERTO
                  </span>
                  <p className="font-mono text-2xl font-bold text-zinc-100">
                    {stats.wins}/{stats.total}
                  </p>
                  <p className="font-mono text-[11px] text-zinc-500 mt-1">
                    {stats.total > 0 ? ((stats.wins / stats.total) * 100).toFixed(0) : 0}%
                  </p>
                </div>
                <div className="text-center">
                  <span className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-2">
                    ROI DIARIO
                  </span>
                  <p className={`font-mono text-2xl font-bold ${
                    stats.roi >= 0 ? "text-emerald-400" : "text-red-400"
                  }`}>
                    {stats.roi >= 0 ? "+" : ""}{stats.roi.toFixed(1)}%
                  </p>
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-zinc-800 flex justify-center">
                <span className="font-mono text-[11px] font-bold tracking-[0.25em] text-zinc-600">
                  ODDSMARK
                </span>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="flex-1"
              data-testid="button-close-daily"
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
              data-testid="button-download-daily"
            >
              <Download className="h-4 w-4 mr-2" />
              PNG
            </Button>
            <Button
              size="sm"
              onClick={handleShare}
              disabled={isGenerating}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              data-testid="button-share-daily"
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
