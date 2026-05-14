import { useRef, useState } from "react";
import html2canvas from "html2canvas";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";
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

  const handleDownload = async () => {
    if (!ticketRef.current) return;
    
    setIsGenerating(true);
    try {
      const canvas = await html2canvas(ticketRef.current, {
        backgroundColor: "#09090b",
        scale: 2,
        useCORS: true,
        logging: false,
      });

      const link = document.createElement("a");
      link.download = `terminal-${bet.id}-${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (error) {
      console.error("Error generating image:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const labelStyle: React.CSSProperties = {
    fontFamily: "system-ui, -apple-system, sans-serif",
    fontSize: "10px",
    fontWeight: 500,
    color: "#71717a",
    textTransform: "uppercase",
    letterSpacing: "0.15em",
  };

  const monoStyle: React.CSSProperties = {
    fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
  };

  const valueStyle: React.CSSProperties = {
    ...monoStyle,
    fontSize: "16px",
    fontWeight: 600,
    color: "#fafafa",
  };

  const getBetTypeLabel = () => {
    switch (bet.betType) {
      case "simple": return "SIMPLE";
      case "combinada": return "COMBINADA";
      case "sistema": return "SISTEMA";
      case "escalera": return "ESCALERA";
      default: return "SIMPLE";
    }
  };

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
            style={{
              background: "#09090b",
              border: "1px solid #27272a",
              borderRadius: "8px",
              padding: "24px",
              width: "100%",
            }}
          >
            <div style={{ 
              display: "flex", 
              justifyContent: "space-between", 
              alignItems: "center",
              marginBottom: "20px",
              paddingBottom: "16px",
              borderBottom: "1px solid #27272a",
            }}>
              <span style={{
                ...labelStyle,
                fontSize: "11px",
                letterSpacing: "0.2em",
              }}>
                TICKET ODDSMARK
              </span>
              <span style={{
                ...monoStyle,
                fontSize: "11px",
                color: "#52525b",
              }}>
                {shortId}
              </span>
            </div>

            {isMultiBet && selections.length > 0 ? (
              <div style={{ marginBottom: "20px" }}>
                {selections.map((sel, idx) => (
                  <div 
                    key={idx} 
                    style={{ 
                      padding: "12px 0",
                      borderBottom: idx < selections.length - 1 ? "1px solid #18181b" : "none",
                    }}
                  >
                    <p style={{ 
                      ...monoStyle,
                      color: "#fafafa", 
                      fontSize: "13px", 
                      fontWeight: 500, 
                      marginBottom: "4px", 
                      lineHeight: 1.4,
                    }}>
                      {sel.event}
                    </p>
                    <div style={{ 
                      display: "flex", 
                      alignItems: "center", 
                      justifyContent: "space-between",
                      marginTop: "6px",
                    }}>
                      <span style={{ 
                        color: "#71717a", 
                        fontSize: "12px",
                      }}>
                        {sel.market}
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ 
                          ...monoStyle,
                          color: "#fbbf24", 
                          fontSize: "14px", 
                          fontWeight: 700, 
                        }}>
                          @{sel.odds.toFixed(2)}
                        </span>
                        {sel.status && sel.status !== "pending" && (
                          <span style={{
                            ...monoStyle,
                            fontSize: "9px",
                            fontWeight: 600,
                            color: sel.status === "won" ? "#10b981" : sel.status === "lost" ? "#ef4444" : "#71717a",
                          }}>
                            {sel.status === "won" ? "GANA" : sel.status === "lost" ? "PIERDE" : sel.status === "void" ? "ANUL." : "PEND."}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ marginBottom: "20px" }}>
                <p style={{ 
                  ...monoStyle,
                  color: "#fafafa", 
                  fontSize: "15px", 
                  fontWeight: 500, 
                  marginBottom: "6px", 
                  lineHeight: 1.4,
                }}>
                  {bet.event}
                </p>
                <p style={{ 
                  color: "#71717a", 
                  fontSize: "13px", 
                  marginBottom: "12px",
                }}>
                  {bet.market}
                </p>
              </div>
            )}

            {resultStatus !== "pending" && (
              <div style={{ 
                textAlign: "center",
                padding: "24px 0",
                marginBottom: "20px",
                borderTop: "1px solid #27272a",
                borderBottom: "1px solid #27272a",
              }}>
                <span style={{
                  ...labelStyle,
                  display: "block",
                  marginBottom: "8px",
                }}>
                  {bet.isCashout ? "CASHOUT" : "P&L"}
                </span>
                <span style={{
                  ...monoStyle,
                  fontSize: "48px",
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                  color: result >= 0 ? "#10b981" : "#ef4444",
                  lineHeight: 1,
                }}>
                  {result >= 0 ? "+" : ""}{result.toFixed(2)}{currencySymbol}
                </span>
              </div>
            )}

            {resultStatus === "pending" && (
              <div style={{ 
                textAlign: "center",
                padding: "24px 0",
                marginBottom: "20px",
                borderTop: "1px solid #27272a",
                borderBottom: "1px solid #27272a",
              }}>
                <span style={{
                  ...labelStyle,
                  display: "block",
                  marginBottom: "8px",
                }}>
                  GANANCIA POTENCIAL
                </span>
                <span style={{
                  ...monoStyle,
                  fontSize: "48px",
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                  color: "#fafafa",
                  lineHeight: 1,
                }}>
                  +{((bet.stake * bet.odds - bet.stake) * multiplier).toFixed(2)}{currencySymbol}
                </span>
              </div>
            )}

            <div style={{ 
              display: "grid", 
              gridTemplateColumns: "1fr 1fr",
              gap: "16px",
            }}>
              <div>
                <span style={labelStyle}>CUOTA</span>
                <p style={{ 
                  ...monoStyle,
                  fontSize: "20px", 
                  fontWeight: 700, 
                  color: "#fbbf24",
                  marginTop: "4px",
                }}>
                  @{bet.odds.toFixed(2)}
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={labelStyle}>STAKE</span>
                <p style={{ 
                  ...valueStyle,
                  fontSize: "20px",
                  fontWeight: 700,
                  marginTop: "4px",
                }}>
                  {(bet.stake * multiplier).toFixed(2)}{currencySymbol}
                </p>
              </div>
              <div>
                <span style={labelStyle}>TIPO</span>
                <p style={{ 
                  ...monoStyle,
                  fontSize: "12px",
                  fontWeight: 500,
                  color: "#a1a1aa",
                  marginTop: "4px",
                }}>
                  {getBetTypeLabel()}
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={labelStyle}>FECHA</span>
                <p style={{ 
                  ...monoStyle,
                  fontSize: "12px",
                  fontWeight: 500,
                  color: "#a1a1aa",
                  marginTop: "4px",
                }}>
                  {betDate}
                </p>
              </div>
            </div>

            <div style={{ 
              marginTop: "20px",
              paddingTop: "16px",
              borderTop: "1px solid #27272a",
              display: "flex",
              justifyContent: "center",
            }}>
              <span style={{
                ...monoStyle,
                fontSize: "12px",
                fontWeight: 700,
                letterSpacing: "0.2em",
                color: "#52525b",
              }}>
                ODDSMARK
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onClose}
              data-testid="button-close-share"
            >
              <X className="h-4 w-4 mr-2" />
              Cerrar
            </Button>
            <Button
              className="flex-1"
              onClick={handleDownload}
              disabled={isGenerating}
              data-testid="button-download-ticket"
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
