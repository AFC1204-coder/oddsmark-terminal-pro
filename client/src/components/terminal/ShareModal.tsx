import { useRef, useState } from "react";
import html2canvas from "html2canvas";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Share2, X, Loader2 } from "lucide-react";
import type { Bet } from "@shared/schema";
import { formatNumber } from "@/lib/utils";

interface Selection {
  event: string;
  market: string;
  odds: number;
  stake?: number;
  status?: "pending" | "won" | "lost" | "void";
  isCashout?: boolean;
  cashoutVal?: number;
}

interface ShareModalProps {
  bet: Bet | null;
  open: boolean;
  onClose: () => void;
  currency: "units" | "money";
  unitValue: number;
}

export function ShareModal({ bet, open, onClose, currency, unitValue }: ShareModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  if (!bet) return null;

  const multiplier = currency === "money" ? unitValue : 1;
  const sym = currency === "money" ? "€" : "U";
  const selections = (bet.selections as Selection[]) || [];
  const isEscalera = bet.betType === "escalera";
  const isCombinada = bet.betType === "combinada";
  const isMulti = isEscalera || isCombinada;

  let result = 0;
  let effectiveStatus = bet.status;

  if (isEscalera && selections.length > 0) {
    const hasPending = selections.some(s => !s.status || s.status === "pending");
    const hasAnyCashout = selections.some(s => s.isCashout);

    if (hasPending && !hasAnyCashout) {
      result = 0;
      effectiveStatus = "pending";
    } else {
      const totalStake = selections.reduce((s, sel) => s + (sel.stake ?? 0), 0) * multiplier;
      const totalReturn = selections.reduce((s, sel) => {
        if (sel.isCashout && sel.cashoutVal !== undefined) return s + sel.cashoutVal;
        if (sel.status === "won") return s + (sel.stake ?? 0) * (sel.odds || 1);
        return s;
      }, 0) * multiplier;
      result = totalReturn - totalStake;
      effectiveStatus = result > 0 ? "won" : result < 0 ? "lost" : "void";
    }
  } else if (bet.status !== "pending") {
    if (bet.isCashout && bet.cashoutVal) {
      result = (bet.cashoutVal - bet.stake) * multiplier;
    } else if (bet.status === "won") {
      result = ((bet.stake * bet.odds) - bet.stake) * multiplier;
    } else if (bet.status === "lost") {
      result = -bet.stake * multiplier;
    }
  }

  const isWin = result >= 0 && effectiveStatus !== "pending";
  const isLoss = result < 0;
  const winHex = "#4ade80";
  const lossHex = "#ef4444";
  const accentColor = isWin ? winHex : isLoss ? lossHex : "#a3a3a3";

  const totalStakeDisplay = isEscalera && selections.length > 0
    ? selections.reduce((s, sel) => s + (sel.stake ?? 0), 0)
    : bet.stake;

  const forceDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  const renderCanvas = async (): Promise<HTMLCanvasElement> => {
    if (!cardRef.current) throw new Error("Card ref not available");
    return html2canvas(cardRef.current, {
      backgroundColor: null,
      scale: 3,
      useCORS: true,
      logging: false,
      width: cardRef.current.offsetWidth,
      height: cardRef.current.offsetHeight,
    });
  };

  const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("toBlob returned null"))),
        type,
        quality,
      );
    });
  };

  const handleDownload = async () => {
    setIsGenerating(true);
    try {
      const canvas = await renderCanvas();
      const blob = await canvasToBlob(canvas, "image/png", 1.0);
      forceDownload(blob, `ticket_${bet.id}.png`);
    } catch (err) {
      console.error("Error downloading image:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleShare = async () => {
    setIsGenerating(true);
    try {
      const canvas = await renderCanvas();
      const blob = await canvasToBlob(canvas, "image/png", 1.0);
      const filename = `ticket_${bet.id}.png`;
      const file = new File([blob], filename, { type: "image/png" });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "Mi Apuesta",
        });
      } else {
        forceDownload(blob, filename);
      }
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      console.error("Share failed, falling back to download:", err);
      try {
        const canvas = await renderCanvas();
        const blob = await canvasToBlob(canvas, "image/png", 1.0);
        forceDownload(blob, `ticket_${bet.id}.png`);
      } catch (downloadErr) {
        console.error("Download fallback also failed:", downloadErr);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-sm p-0 gap-0 bg-background border-border">
        <DialogHeader className="p-4 border-b border-border">
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="text-sm font-semibold">Vista Previa</DialogTitle>
            <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-share">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <DialogDescription className="sr-only">
            Previsualiza la tarjeta de apuesta antes de compartirla o descargarla.
          </DialogDescription>
        </DialogHeader>

        <div className="p-4">
          <div
            ref={cardRef}
            style={{
              width: "100%",
              maxWidth: "340px",
              background: "linear-gradient(170deg, #1c1c1e 0%, #111113 50%, #0c0c0e 100%)",
              borderRadius: "16px",
              padding: "28px 24px 24px",
              fontFamily: "'Inter', 'SF Pro Display', -apple-system, sans-serif",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: "3px",
                background: `linear-gradient(90deg, ${accentColor}00, ${accentColor}, ${accentColor}00)`,
                opacity: 0.6,
              }}
            />

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "7px",
                  background: "linear-gradient(135deg, #2a2a2e, #1a1a1e)",
                  border: "1px solid #333",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
	                  <span style={{ fontSize: "10px", fontWeight: 800, color: "#a0a0a0", letterSpacing: "0.5px" }}>OM</span>
                </div>
                <span style={{ fontSize: "12px", fontWeight: 600, color: "#707070", letterSpacing: "0.5px" }}>
	                  Oddsmark
                </span>
              </div>
              {isMulti && (
                <span style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  color: isEscalera ? "#f59e0b" : "#3b82f6",
                  backgroundColor: isEscalera ? "rgba(245,158,11,0.12)" : "rgba(59,130,246,0.12)",
                  padding: "3px 8px",
                  borderRadius: "6px",
                  letterSpacing: "0.5px",
                  textTransform: "uppercase",
                }}>
                  {isEscalera ? `Escalera (${selections.length})` : `Combinada (${selections.length})`}
                </span>
              )}
            </div>

            <div style={{ marginBottom: "20px" }}>
              {bet.league && (
                <p style={{
                  fontSize: "10px",
                  color: "#555",
                  textTransform: "uppercase",
                  letterSpacing: "1.5px",
                  fontWeight: 600,
                  marginBottom: "6px",
                }}>
                  {bet.league}
                </p>
              )}
              <h2 style={{
                fontSize: "16px",
                fontWeight: 700,
                color: "#f0f0f0",
                lineHeight: "1.35",
                marginBottom: "4px",
              }}>
                {bet.event}
              </h2>
              {!isMulti && bet.market && (
                <p style={{
                  fontSize: "13px",
                  color: "#888",
                  fontWeight: 500,
                }}>
                  {bet.market}
                </p>
              )}
            </div>

            {isMulti && selections.length > 0 && (
              <div style={{
                marginBottom: "20px",
                padding: "12px",
                borderRadius: "10px",
                backgroundColor: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}>
                {selections.map((sel, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "6px 0",
                      borderBottom: idx < selections.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {isEscalera && (
                        <span style={{ fontSize: "10px", color: "#f59e0b", fontWeight: 700, marginRight: "6px" }}>
                          #{idx + 1}
                        </span>
                      )}
                      <span style={{
                        fontSize: "12px",
                        color: "#ccc",
                        fontWeight: 500,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}>
                        {sel.event || sel.market || "—"}
                      </span>
                    </div>
                    <span style={{
                      fontSize: "12px",
                      color: "#888",
                      fontFamily: "'SF Mono', 'Fira Code', monospace",
                      fontWeight: 600,
                      marginLeft: "8px",
                      flexShrink: 0,
                    }}>
                      @{formatNumber(sel.odds)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div style={{
              padding: "20px 16px",
              borderRadius: "12px",
              background: `linear-gradient(135deg, ${accentColor}08, ${accentColor}15)`,
              border: `1px solid ${accentColor}20`,
              textAlign: "center",
              position: "relative",
            }}>
              {effectiveStatus !== "pending" && (
                <div style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  width: "120px",
                  height: "120px",
                  borderRadius: "50%",
                  background: `radial-gradient(circle, ${accentColor}15, transparent 70%)`,
                  pointerEvents: "none",
                }} />
              )}

              <p style={{
                fontSize: effectiveStatus === "pending" ? "28px" : "40px",
                fontWeight: 800,
                fontFamily: "'SF Mono', 'Fira Code', 'JetBrains Mono', monospace",
                color: effectiveStatus === "pending" ? "#888" : accentColor,
                lineHeight: 1,
                marginBottom: "8px",
                letterSpacing: "-1px",
                textShadow: effectiveStatus !== "pending" ? `0 0 30px ${accentColor}40` : "none",
                position: "relative",
              }}>
                {effectiveStatus === "pending"
                  ? "PENDIENTE"
                  : `${result >= 0 ? "+" : ""}${formatNumber(result)}${sym}`
                }
              </p>

              <div style={{
                display: "flex",
                justifyContent: "center",
                gap: "16px",
                fontSize: "11px",
                color: "#666",
                fontWeight: 500,
                position: "relative",
              }}>
                <span>
                  Cuota: <span style={{ color: "#aaa", fontFamily: "'SF Mono', monospace", fontWeight: 600 }}>
                    @{isMulti
                      ? selections.map(s => formatNumber(s.odds)).join(" | ")
                      : formatNumber(bet.odds)
                    }
                  </span>
                </span>
                <span style={{ color: "#333" }}>|</span>
                <span>
                  Stake: <span style={{ color: "#aaa", fontFamily: "'SF Mono', monospace", fontWeight: 600 }}>
                    {formatNumber(totalStakeDisplay * (currency === "money" ? unitValue : 1))}{sym}
                  </span>
                </span>
              </div>
            </div>

            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginTop: "16px",
              paddingTop: "12px",
              borderTop: "1px solid rgba(255,255,255,0.05)",
            }}>
              <span style={{
                fontSize: "10px",
                color: "#444",
                letterSpacing: "0.5px",
              }}>
                oddsmark.app
              </span>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-border flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleDownload}
            disabled={isGenerating}
            data-testid="button-download-share"
          >
            {isGenerating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            Descargar PNG
          </Button>
          <Button
            className="flex-1"
            onClick={handleShare}
            disabled={isGenerating}
            data-testid="button-share-story"
          >
            {isGenerating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Share2 className="h-4 w-4 mr-2" />}
            Compartir
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
