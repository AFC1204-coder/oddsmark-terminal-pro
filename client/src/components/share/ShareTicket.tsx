import { useRef, useState, useCallback } from "react";
import { toBlob } from "html-to-image";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Share2, X } from "lucide-react";
import type { Bet } from "@shared/schema";

interface Selection {
  event: string;
  market: string;
  odds: number;
  line?: number;
  stake?: number;
  status?: "pending" | "won" | "lost" | "void";
  isCashout?: boolean;
  cashoutVal?: number;
}

interface ShareTicketProps {
  bet: Bet;
  open: boolean;
  onClose: () => void;
  currency: "units" | "money";
  unitValue: number;
}

export function ShareTicket({ bet, open, onClose, currency, unitValue }: ShareTicketProps) {
  const ticketRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const multiplier = currency === "money" ? unitValue : 1;
  const currencySymbol = currency === "money" ? "€" : "U";
  const selections = (bet.selections as Selection[]) || [];
  const isMultiBet = bet.betType === "combinada" || bet.betType === "escalera";

  let result = 0;
  if (bet.status !== "pending") {
    if (bet.isCashout && bet.cashoutVal) {
      result = (bet.cashoutVal - bet.stake) * multiplier;
    } else if (bet.status === "won") {
      result = ((bet.stake * bet.odds) - bet.stake) * multiplier;
    } else if (bet.status === "lost") {
      result = -bet.stake * multiplier;
    }
  }

  const getResultStatus = () => {
    if (bet.isCashout) {
      if (bet.cashoutVal && bet.cashoutVal > bet.stake) return "won";
      if (bet.cashoutVal && bet.cashoutVal < bet.stake) return "lost";
      return bet.status;
    }
    return bet.status;
  };

  const resultStatus = getResultStatus();
  const shortId = `#${String(bet.id).slice(-6).padStart(6, "0")}`;
  const betDate = bet.date;

  const getBetTypeLabel = () => {
    switch (bet.betType) {
      case "simple": return "SIMPLE";
      case "combinada": return "COMBINADA";
      case "sistema": return "SISTEMA";
      case "escalera": return "ESCALERA";
      default: return "SIMPLE";
    }
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

      const fileName = `terminal-${bet.id}-${Date.now()}.png`;
      const file = new File([blob], fileName, { type: "image/png" });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "Ticket Oddsmark",
          text: `Apuesta ${resultStatus === "won" ? "ganada" : resultStatus === "lost" ? "perdida" : "pendiente"}: ${result >= 0 ? "+" : ""}${result.toFixed(2)}${currencySymbol}`,
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
  }, [bet.id, result, resultStatus, currencySymbol]);

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
      link.download = `terminal-${bet.id}-${Date.now()}.png`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading:", error);
    } finally {
      setIsGenerating(false);
    }
  }, [bet.id]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-0 overflow-hidden bg-transparent border-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Compartir Ticket</DialogTitle>
          <DialogDescription>
            Tarjeta exportable con los datos principales de la apuesta seleccionada.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 p-4">
          <div 
            ref={ticketRef}
            className="bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden"
            style={{ width: "100%" }}
          >
            <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-500" />
            
            <div className="p-6">
              <div className="flex justify-between items-center mb-6 pb-4 border-b border-zinc-800">
                <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-medium">
                  TICKET ODDSMARK
                </span>
                <span className="font-mono text-[11px] text-zinc-600">
                  {shortId}
                </span>
              </div>

              {isMultiBet && selections.length > 0 ? (
                <div className="mb-5">
                  {selections.map((sel, idx) => (
                    <div 
                      key={idx} 
                      className={`py-3 ${idx < selections.length - 1 ? "border-b border-zinc-900" : ""}`}
                    >
                      <p className="font-mono text-[13px] font-medium text-zinc-100 leading-snug mb-1">
                        {sel.event}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[12px] text-zinc-500">
                          {sel.market}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[14px] font-bold text-amber-400">
                            @{sel.odds.toFixed(2)}
                          </span>
                          {sel.status && sel.status !== "pending" && (
                            <span className={`font-mono text-[9px] font-semibold ${
                              sel.status === "won" ? "text-emerald-500" : 
                              sel.status === "lost" ? "text-red-500" : "text-zinc-500"
                            }`}>
                              {sel.status === "won" ? "GANA" : sel.status === "lost" ? "PIERDE" : sel.status === "void" ? "ANUL." : "PEND."}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mb-5">
                  <p className="font-mono text-[15px] font-medium text-zinc-100 leading-snug mb-2">
                    {bet.event}
                  </p>
                  <p className="text-[13px] text-zinc-500 mb-3">
                    {bet.market}
                  </p>
                </div>
              )}

              <div className="text-center py-6 my-4 border-y border-zinc-800">
                <span className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-2">
                  {bet.isCashout ? "CASHOUT" : resultStatus === "pending" ? "GANANCIA POT." : "P&L"}
                </span>
                <span className={`font-mono text-5xl font-bold tracking-tighter leading-none ${
                  resultStatus === "pending" ? "text-zinc-100" :
                  result >= 0 ? "text-emerald-500" : "text-red-500"
                }`}>
                  {result >= 0 ? "+" : ""}{resultStatus === "pending" 
                    ? ((bet.stake * bet.odds - bet.stake) * multiplier).toFixed(2) 
                    : result.toFixed(2)}{currencySymbol}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-1">
                    CUOTA
                  </span>
                  <p className="font-mono text-xl font-bold text-amber-400">
                    @{bet.odds.toFixed(2)}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-1">
                    STAKE
                  </span>
                  <p className="font-mono text-xl font-bold text-zinc-100">
                    {(bet.stake * multiplier).toFixed(2)}{currencySymbol}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-1">
                    TIPO
                  </span>
                  <p className="font-mono text-[12px] font-medium text-zinc-400">
                    {getBetTypeLabel()}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-1">
                    FECHA
                  </span>
                  <p className="font-mono text-[12px] font-medium text-zinc-400">
                    {betDate}
                  </p>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-zinc-800 flex justify-center">
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
              data-testid="button-close-share"
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
              data-testid="button-download-ticket"
            >
              <Download className="h-4 w-4 mr-2" />
              PNG
            </Button>
            <Button
              size="sm"
              onClick={handleShare}
              disabled={isGenerating}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              data-testid="button-share-ticket"
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
