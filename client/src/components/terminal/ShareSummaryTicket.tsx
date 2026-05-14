import { useRef, useState } from "react";
import html2canvas from "html2canvas";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";
import type { Bet } from "@shared/schema";
import { calculateBetProfit as calculateCanonicalBetProfit } from "@/lib/bet-calculations";

interface ShareSummaryTicketProps {
  date: Date;
  bets: Bet[];
  profit: number;
  open: boolean;
  onClose: () => void;
  currency: "units" | "money";
  unitValue: number;
}

export function ShareSummaryTicket({ 
  date, 
  bets, 
  profit, 
  open, 
  onClose, 
  currency, 
  unitValue 
}: ShareSummaryTicketProps) {
  const ticketRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const multiplier = currency === "money" ? unitValue : 1;
  const currencySymbol = currency === "money" ? "€" : "U";

  const resolvedBets = bets.filter(b => {
    const result = calculateCanonicalBetProfit(b);
    return result.isSettled && !result.isPending;
  });
  const wonBets = resolvedBets.filter(b => calculateCanonicalBetProfit(b).profit > 0);
  const lostBets = resolvedBets.filter(b => calculateCanonicalBetProfit(b).profit < 0);
  
  const betsWithProfit = resolvedBets.map(bet => ({
    bet,
    profit: calculateCanonicalBetProfit(bet, multiplier).profit
  }));

  const sortedByImpact = [...betsWithProfit].sort((a, b) => 
    Math.abs(b.profit) - Math.abs(a.profit)
  );

  const top5 = sortedByImpact.slice(0, 5);
  const remaining = sortedByImpact.slice(5);
  const remainingProfit = remaining.reduce((sum, item) => sum + item.profit, 0);

  const totalStaked = resolvedBets.reduce((sum, b) => sum + calculateCanonicalBetProfit(b, multiplier).totalStake, 0);
  const roi = totalStaked > 0 ? ((profit / totalStaked) * 100).toFixed(1) : "0.0";

  const dateFormatted = date.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  const handleDownload = async () => {
    if (!ticketRef.current) return;
    
    setIsGenerating(true);
    try {
      const canvas = await html2canvas(ticketRef.current, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
        logging: false,
      });

      const link = document.createElement("a");
      link.download = `daily-report-${date.toISOString().split("T")[0]}-${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (error) {
      console.error("Error generating image:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const sansFont = {
    fontFamily: "'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
  };

  const monoFont = {
    fontFamily: "'JetBrains Mono', 'SF Mono', 'Consolas', monospace",
  };

  const formatProfit = (value: number): string => {
    const fixed = Math.abs(value).toFixed(2);
    return value >= 0 ? `+${fixed}` : `-${fixed}`;
  };

  const truncateText = (text: string, maxLength: number): string => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 1) + "...";
  };

  const isPositive = profit >= 0;
  
  const bgGradient = isPositive 
    ? "radial-gradient(ellipse 120% 80% at 50% 0%, rgba(16, 185, 129, 0.15) 0%, rgba(6, 78, 59, 0.08) 40%, rgba(0, 0, 0, 0) 70%), radial-gradient(ellipse 80% 50% at 80% 80%, rgba(16, 185, 129, 0.08) 0%, transparent 50%), linear-gradient(180deg, #0a0a0a 0%, #050505 100%)"
    : "radial-gradient(ellipse 120% 80% at 50% 0%, rgba(239, 68, 68, 0.12) 0%, rgba(127, 29, 29, 0.06) 40%, rgba(0, 0, 0, 0) 70%), radial-gradient(ellipse 80% 50% at 80% 80%, rgba(239, 68, 68, 0.06) 0%, transparent 50%), linear-gradient(180deg, #0a0a0a 0%, #050505 100%)";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-0 overflow-hidden bg-transparent border-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Compartir resumen del día</DialogTitle>
          <DialogDescription>
            Tarjeta exportable con el resumen diario de apuestas resueltas.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 p-4">
          {/* Outer container with abstract background */}
          <div 
            ref={ticketRef}
            style={{
              background: bgGradient,
              borderRadius: "20px",
              boxSizing: "border-box",
              padding: "16px",
              width: "min(370px, calc(100vw - 32px))",
            }}
          >
            {/* Frosted Glass Card */}
            <div style={{
              background: "rgba(0, 0, 0, 0.55)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              borderRadius: "16px",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
              padding: "24px",
            }}>
              <div style={{ 
                textAlign: "center" as const,
                marginBottom: "8px"
              }}>
                <span style={{
                  fontSize: "11px",
                  fontWeight: 300,
                  letterSpacing: "0.25em",
                  color: "rgba(255, 255, 255, 0.5)",
                  textTransform: "uppercase" as const,
                  ...sansFont
                }}>
                  ODDSMARK
                </span>
              </div>

              {/* Date */}
              <div style={{ 
                textAlign: "center" as const, 
                paddingBottom: "20px",
                borderBottom: "1px solid rgba(255, 255, 255, 0.06)"
              }}>
                <span style={{ 
                  color: "rgba(255, 255, 255, 0.4)", 
                  fontSize: "12px",
                  textTransform: "capitalize" as const,
                  fontWeight: 400,
                  ...sansFont
                }}>
                  {dateFormatted}
                </span>
              </div>

              {/* Hero Balance */}
              <div style={{ 
                textAlign: "center" as const, 
                padding: "28px 0 20px",
              }}>
                <div style={{ 
                  color: "rgba(255, 255, 255, 0.35)", 
                  fontSize: "9px", 
                  marginBottom: "8px",
                  letterSpacing: "0.2em",
                  textTransform: "uppercase" as const,
                  fontWeight: 500,
                  ...sansFont
                }}>
                  BALANCE DEL DÍA
                </div>
                <div style={{
                  fontSize: "clamp(42px, 13vw, 56px)",
                  fontWeight: 700,
                  color: isPositive ? "#34d399" : "#f87171",
                  textShadow: isPositive 
                    ? "0 0 60px rgba(52, 211, 153, 0.4), 0 0 120px rgba(52, 211, 153, 0.2)" 
                    : "0 0 60px rgba(248, 113, 113, 0.4), 0 0 120px rgba(248, 113, 113, 0.2)",
                  lineHeight: 1,
                  letterSpacing: "-0.03em",
                  ...sansFont
                }}>
                  {formatProfit(profit)}{currencySymbol}
                </div>

                {/* Data Pills */}
                <div style={{
                  display: "flex",
                  justifyContent: "center",
                  gap: "12px",
                  marginTop: "18px"
                }}>
                  <div style={{
                    background: "rgba(255, 255, 255, 0.06)",
                    borderRadius: "20px",
                    padding: "6px 14px",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px"
                  }}>
                    <span style={{ fontSize: "11px" }}>🎯</span>
                    <span style={{ 
                      color: "rgba(255, 255, 255, 0.7)", 
                      fontSize: "11px",
                      fontWeight: 500,
                      ...sansFont 
                    }}>
                      Acierto: <span style={{ color: "#fff", ...monoFont }}>{wonBets.length}/{resolvedBets.length}</span>
                    </span>
                  </div>
                  <div style={{
                    background: "rgba(255, 255, 255, 0.06)",
                    borderRadius: "20px",
                    padding: "6px 14px",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px"
                  }}>
                    <span style={{ fontSize: "11px" }}>📈</span>
                    <span style={{ 
                      color: "rgba(255, 255, 255, 0.7)", 
                      fontSize: "11px",
                      fontWeight: 500,
                      ...sansFont 
                    }}>
                      ROI: <span style={{ 
                        color: parseFloat(roi) >= 0 ? "#34d399" : "#f87171", 
                        ...monoFont 
                      }}>{parseFloat(roi) >= 0 ? "+" : ""}{roi}%</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div style={{ 
                height: "1px", 
                background: "rgba(255, 255, 255, 0.06)",
                margin: "4px 0 20px"
              }} />

              {/* Ledger List - Top Movers */}
              <div>
                <div style={{ 
                  color: "rgba(255, 255, 255, 0.3)", 
                  fontSize: "9px", 
                  marginBottom: "14px",
                  letterSpacing: "0.15em",
                  textTransform: "uppercase" as const,
                  fontWeight: 500,
                  ...sansFont
                }}>
                  TOP MOVIMIENTOS
                </div>
                
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {top5.map((item, index) => (
                    <div 
                      key={item.bet.id || index}
                      style={{ 
                        padding: "12px 0",
                        borderBottom: index < top5.length - 1 ? "1px solid rgba(255, 255, 255, 0.04)" : "none"
                      }}
                    >
                      {/* Level 1: Event + Profit */}
                      <div style={{ 
                        display: "flex", 
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "12px",
                        marginBottom: "4px"
                      }}>
                        <span style={{ 
                          color: "rgba(255, 255, 255, 0.9)", 
                          fontSize: "13px",
                          fontWeight: 500,
                          flex: 1,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap" as const,
                          ...monoFont
                        }}>
                          {truncateText(item.bet.event, 20)}
                        </span>
                        <div style={{ 
                          display: "flex",
                          alignItems: "center",
                          gap: "5px",
                          flexShrink: 0,
                        }}>
                          <span style={{ fontSize: "11px" }}>
                            {item.profit >= 0 ? "✅" : "❌"}
                          </span>
                          <span style={{ 
                            color: item.profit >= 0 ? "#34d399" : "rgba(255, 255, 255, 0.5)",
                            fontSize: "14px",
                            fontWeight: 600,
                            ...monoFont
                          }}>
                            {formatProfit(item.profit)}{currencySymbol}
                          </span>
                        </div>
                      </div>
                      
                      {/* Level 2: Market + Odds + Stake */}
                      <div style={{ 
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        fontSize: "10px",
                      }}>
                        <span style={{ 
                          color: "rgba(255, 255, 255, 0.4)",
                          ...monoFont
                        }}>
                          {truncateText(item.bet.market, 16)}
                        </span>
                        <span style={{ color: "rgba(255, 255, 255, 0.2)" }}>•</span>
                        <span style={{ 
                          color: "#fbbf24",
                          fontWeight: 500,
                          ...monoFont
                        }}>
                          @{item.bet.odds.toFixed(2)}
                        </span>
                        <span style={{ color: "rgba(255, 255, 255, 0.2)" }}>•</span>
                        <span style={{ 
                          color: "rgba(255, 255, 255, 0.45)",
                          ...monoFont
                        }}>
                          Stake: {(item.bet.stake * multiplier).toFixed(2)}{currencySymbol}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Remaining bets footer */}
                {remaining.length > 0 && (
                  <div style={{ 
                    marginTop: "12px",
                    paddingTop: "12px",
                    borderTop: "1px dashed rgba(255, 255, 255, 0.08)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}>
                    <span style={{ 
                      color: "rgba(255, 255, 255, 0.3)", 
                      fontSize: "11px",
                      fontStyle: "italic",
                      ...sansFont
                    }}>
                      ...y {remaining.length} apuesta{remaining.length > 1 ? "s" : ""} más
                    </span>
                    <div style={{ 
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                    }}>
                      <span style={{ fontSize: "10px" }}>
                        {remainingProfit >= 0 ? "✅" : "❌"}
                      </span>
                      <span style={{ 
                        color: remainingProfit >= 0 ? "#34d399" : "rgba(255, 255, 255, 0.5)",
                        fontSize: "12px",
                        fontWeight: 500,
                        ...monoFont
                      }}>
                        {formatProfit(remainingProfit)}{currencySymbol}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div style={{ 
                marginTop: "20px",
                paddingTop: "14px",
                borderTop: "1px solid rgba(255, 255, 255, 0.05)",
                textAlign: "center" as const
              }}>
                <span style={{ 
                  color: "rgba(255, 255, 255, 0.2)", 
                  fontSize: "9px", 
                  letterSpacing: "0.1em",
                  fontWeight: 400,
                  ...sansFont 
                }}>
                  oddsmark.app
                </span>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onClose}
              data-testid="button-close-summary-share"
            >
              <X className="h-4 w-4 mr-2" />
              Cerrar
            </Button>
            <Button
              className="flex-1"
              onClick={handleDownload}
              disabled={isGenerating}
              data-testid="button-download-summary"
            >
              <Download className="h-4 w-4 mr-2" />
              {isGenerating ? "Generando..." : "Descargar PNG"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
