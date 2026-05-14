import { useRef, useState, useCallback, useEffect } from "react";
import { toBlob } from "html-to-image";
import QRCode from "react-qr-code";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Share2, X, ShieldCheck, ShieldAlert, Send, Copy, Check } from "lucide-react";
import type { Bet } from "@shared/schema";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { calculateBetProfit } from "@/lib/bet-calculations";
import { getShortVerificationCode, getTimeDifference } from "@/lib/bet-verification";
import {
  getShareVerificationState,
  type ShareVerificationInput,
  type ShareVerificationState,
} from "@/lib/share-verification";
import {
  generateTweetText, shareToTwitter,
  generateTelegramMessage, sendToTelegram, getTelegramStatus,
  generateInstagramCaption,
} from "@/lib/social-share";

interface Selection {
  event: string;
  market: string;
  selection?: string;
  odds: number;
  line?: number;
  stake?: number;
  status?: "pending" | "won" | "lost" | "void";
  isCashout?: boolean;
  cashoutVal?: number;
}

interface ViralTicketProps {
  bet: Bet;
  open: boolean;
  onClose: () => void;
  currency: "units" | "money";
  unitValue: number;
}

type BetWithVerificationMetadata = Bet & ShareVerificationInput;

type SportKind = "football" | "basketball" | "tennis" | "generic";

interface SportTheme {
  kind: SportKind;
  accent: string;
  accentSoft: string;
  surface: string;
  ball: string;
  background: string;
  backgroundPosition: string;
}

const monthLabels = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
const shareSansFont = "'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif";

function getSportTheme(sport?: string | null): SportTheme {
  const normalized = (sport || "").toLowerCase();
  if (normalized.includes("basket")) {
    return {
      kind: "basketball",
      accent: "#ff8a3d",
      accentSoft: "rgba(255, 138, 61, 0.18)",
      surface: "linear-gradient(180deg, #15110d 0%, #2a170d 52%, #120d09 100%)",
      ball: "linear-gradient(135deg, #9f4d25 0%, #d66f34 48%, #5f2b17 100%)",
      background: "/share/photo-basket.png",
      backgroundPosition: "56% center",
    };
  }
  if (normalized.includes("tenis") || normalized.includes("tennis")) {
    return {
      kind: "tennis",
      accent: "#7cff2b",
      accentSoft: "rgba(124, 255, 43, 0.18)",
      surface: "linear-gradient(180deg, #050807 0%, #101715 55%, #050605 100%)",
      ball: "radial-gradient(circle at 35% 28%, #d9ff72 0%, #85d621 52%, #305b12 100%)",
      background: "/share/photo-tennis.png",
      backgroundPosition: "64% center",
    };
  }
  if (normalized.includes("fut") || normalized.includes("soccer") || normalized.includes("football")) {
    return {
      kind: "football",
      accent: "#7cff2b",
      accentSoft: "rgba(124, 255, 43, 0.16)",
      surface: "linear-gradient(180deg, #050806 0%, #0c1c12 52%, #050605 100%)",
      ball: "radial-gradient(circle at 38% 28%, #f4f4f5 0%, #9ca3af 42%, #111827 78%)",
      background: "/share/photo-football.png",
      backgroundPosition: "70% center",
    };
  }
  return {
    kind: "generic",
    accent: "#7cff2b",
    accentSoft: "rgba(124, 255, 43, 0.16)",
    surface: "linear-gradient(180deg, #070707 0%, #111113 55%, #050505 100%)",
    ball: "radial-gradient(circle at 35% 28%, #f4f4f5 0%, #71717a 50%, #18181b 100%)",
    background: "/share/bg-generic.svg",
    backgroundPosition: "center",
  };
}

function getStatusLabel(status: string | null | undefined, isCashout?: boolean): string {
  if (isCashout) return "CASHOUT";
  if (status === "won") return "GANADA";
  if (status === "lost") return "PERDIDA";
  if (status === "void") return "ANULADA";
  return "PENDIENTE";
}

function getStatusColor(status: string | null | undefined, value: number): string {
  if (status === "won") return "#8fd56a";
  if (status === "lost") return "#e46b6b";
  if (status === "void") return "#a1a1aa";
  if (value > 0) return "#fbbf24";
  return "#d4d4d8";
}

function getStatusSymbol(status: string | null | undefined): string | null {
  if (status === "won") return "✓";
  if (status === "lost") return "x";
  if (status === "void") return "=";
  return null;
}

function formatAmount(value: number, symbol: string): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}${symbol}`;
}

function formatShareDate(date?: string | null, time?: string | null): string {
  if (!date) return time || "Sin fecha";
  const [year, month, day] = date.split("-").map((part) => parseInt(part, 10));
  if (!year || !month || !day) return [date, time].filter(Boolean).join(" · ");
  const formatted = `${day} ${monthLabels[month - 1] ?? ""} ${year}`;
  return [formatted, time].filter(Boolean).join(" · ");
}

function splitEventName(event?: string | null): [string, string | null] {
  const fallback = event?.trim() || "Evento sin nombre";
  const parts = fallback.split(/\s+(?:vs\.?|v\.?)\s+/i);
  if (parts.length >= 2) {
    return [parts[0].trim(), parts.slice(1).join(" vs ").trim()];
  }
  return [fallback, null];
}

function getSelectionName(bet: Bet, selections: Selection[]): string {
  if (selections.length > 0 && selections[0].selection) {
    return selections[0].selection;
  }
  return bet.market || "Selección";
}

function getLineDisplay(selections: Selection[]): string | null {
  if (selections.length === 0) return null;
  const line = selections[0].line;
  if (line === null || line === undefined) return null;
  return line > 0 ? `+${line}` : `${line}`;
}

function LogoIcon({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path d="M24 4 43 15v21L24 46 5 36V15L24 4Z" fill="#f8fafc" />
      <path d="M12 18 21 13v24l-9-5V18Z" fill="#09090b" />
      <path d="M26 13 36 19v13l-7 4V23l-3-2v18l-6-3V16l6-3Z" fill="#09090b" />
    </svg>
  );
}

function SportScene({ theme }: { theme: SportTheme }) {
  return (
    <div style={{
      position: "absolute",
      inset: 0,
      background: theme.surface,
      overflow: "hidden",
    }}>
      <img
        src={theme.background}
        alt=""
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: theme.backgroundPosition,
          opacity: 1,
          filter: "saturate(0.98) contrast(1.08) brightness(0.9)",
        }}
      />
      <div style={{
        position: "absolute",
        inset: 0,
        background: `radial-gradient(circle at 78% 18%, ${theme.accentSoft}, transparent 20%), linear-gradient(180deg, rgba(0,0,0,0.22) 0%, rgba(0,0,0,0.18) 38%, rgba(0,0,0,0.72) 78%, rgba(0,0,0,0.98) 100%)`,
      }} />
      <div style={{
        position: "absolute",
        inset: 0,
        boxShadow: "inset 0 0 70px rgba(0,0,0,0.78), inset 0 -110px 80px rgba(0,0,0,0.94)",
      }} />
    </div>
  );
}

export function ViralTicket({ bet, open, onClose, currency, unitValue }: ViralTicketProps) {
  const ticketRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [shareError, setShareError] = useState(false);
  const [verificationState, setVerificationState] = useState<ShareVerificationState>(() => getShareVerificationState({}));

  useEffect(() => {
    if (open && bet) {
      const betWithVerification = bet as BetWithVerificationMetadata;
      setVerificationState(getShareVerificationState({
        verificationHash: betWithVerification.verificationHash,
        verificationRecordedAt: betWithVerification.verificationRecordedAt,
        verificationIsPreEvent: betWithVerification.verificationIsPreEvent,
        createdAt: bet.createdAt,
        baseUrl: typeof window !== "undefined" ? window.location.origin : undefined,
      }));
    } else {
      setVerificationState(getShareVerificationState({}));
    }
  }, [open, bet]);

  const multiplier = currency === "money" ? unitValue : 1;
  const currencySymbol = currency === "money" ? "€" : "U";
  const selections = (bet.selections as Selection[]) || [];
  const isMultiBet = bet.betType === "combinada" || bet.betType === "escalera";
  const isEscalera = bet.betType === "escalera";
  const canonicalResult = calculateBetProfit(bet, multiplier);

  let result = 0;
  let potentialWin = 0;
  let displayOdds = bet.odds;
  let displayStake = bet.stake * multiplier;

  if (isEscalera && selections.length > 0) {
    displayStake = canonicalResult.totalStake;
    displayOdds = canonicalResult.weightedOdds;

    if (canonicalResult.isPending) {
      potentialWin = canonicalResult.totalStake * (canonicalResult.weightedOdds - 1);
    } else {
      result = canonicalResult.profit;
    }
  } else if (bet.status !== "pending") {
    if (bet.isCashout && bet.cashoutVal) {
      displayOdds = bet.cashoutVal / bet.stake;
    }
    result = canonicalResult.profit;
  } else {
    potentialWin = (bet.stake * bet.odds - bet.stake) * multiplier;
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
  const displayValue = resultStatus === "pending" ? potentialWin : result;
  const statusLabel = getStatusLabel(resultStatus, Boolean(bet.isCashout));
  const statusColor = getStatusColor(resultStatus, displayValue);
  const statusSymbol = getStatusSymbol(resultStatus);
  const theme = getSportTheme(bet.sport);
  const accentColor = resultStatus === "pending" ? theme.accent : statusColor;
  const plLabel = bet.isCashout ? "CASHOUT" : resultStatus === "pending" ? "GANANCIA" : "P&L";
  const verification = verificationState.verification;
  const verifyUrl = verificationState.verifyUrl;
  const [eventHome, eventAway] = splitEventName(bet.event);
  const selectionName = getSelectionName(bet, selections);
  const lineDisplay = getLineDisplay(selections);
  const shareDate = formatShareDate(bet.date, bet.time);
  const verificationCode = verificationState.verificationCode;
  const betTypeLabel = isEscalera ? "ESCALERA" : bet.betType === "combinada" ? "COMBINADA" : "PARTIDO";

  const handleShare = useCallback(async () => {
    if (!ticketRef.current) return;

    setIsGenerating(true);
    const fileName = `terminal-share.jpg`;

    try {
      setShareError(false);
      const blob = await toBlob(ticketRef.current, {
        cacheBust: true,
        skipAutoScale: true,
        skipFonts: true,
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
      setShareError(true);
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
        skipFonts: true,
        backgroundColor: "#09090b",
        type: "image/jpeg",
        quality: 0.95,
      });

      if (!blob) throw new Error("Failed to generate image");

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = `terminal-bet-${bet.id}.jpg`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading:", error);
      setShareError(true);
    } finally {
      setIsGenerating(false);
    }
  }, [bet.id]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[96dvh] w-[calc(100vw-1rem)] max-w-[472px] overflow-x-hidden overflow-y-auto border-0 bg-transparent p-0">
        <DialogTitle className="sr-only">Compartir Ticket</DialogTitle>
        <DialogDescription className="sr-only">
          Vista previa exportable de la apuesta con resultado, stake y estado de verificación pública.
        </DialogDescription>

        <div className="flex min-w-0 flex-col gap-3 p-2 sm:gap-4 sm:p-4">
          <div
            ref={ticketRef}
            className="relative mx-auto w-full overflow-hidden rounded-[22px]"
            style={{
              width: "min(430px, calc(100vw - 2rem))",
              maxWidth: "100%",
              minHeight: "948px",
              backgroundColor: "#030303",
              border: "1px solid rgba(255,255,255,0.13)",
              boxShadow: "0 30px 80px rgba(0,0,0,0.72), inset 0 0 0 1px rgba(255,255,255,0.04)",
              fontFamily: shareSansFont,
            }}
          >
            <div style={{ position: "relative", height: 374 }}>
              <SportScene theme={theme} />
              <div style={{
                position: "absolute",
                inset: "30px 28px auto 28px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
              }}>
                <BrandLogo
                  variant="light"
                  className="w-[166px] max-w-[48%] opacity-90"
                  imageClassName="drop-shadow-[0_0_10px_rgba(255,255,255,0.11)]"
                />
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  color: statusColor,
                  fontSize: 13,
                  fontWeight: 900,
                  letterSpacing: "0.03em",
                }}>
                  {statusSymbol && (
                    <span style={{
                      display: "grid",
                      placeItems: "center",
                      width: 19,
                      height: 19,
                      borderRadius: 999,
                      border: `2px solid ${statusColor}`,
                      lineHeight: 1,
                    }}>
                      {statusSymbol}
                    </span>
                  )}
                  {statusLabel}
                </div>
              </div>
            </div>

            <div style={{ padding: "0 28px 24px", marginTop: -28, position: "relative" }}>
              <div style={{
                display: "inline-flex",
                alignItems: "center",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: 999,
                padding: "6px 14px",
                color: "#d4d4d8",
                fontSize: 12,
                letterSpacing: "0.04em",
                background: "rgba(0,0,0,0.42)",
                  backdropFilter: "blur(8px)",
                  boxShadow: "0 10px 26px rgba(0,0,0,0.32)",
              }}>
                {betTypeLabel}
              </div>

              <div style={{ marginTop: 14, paddingBottom: 18, borderBottom: "1px solid rgba(255,255,255,0.13)" }}>
                {isMultiBet && selections.length > 0 ? (
                  <div>
                    <p style={{
                      color: "#f8fafc",
                      fontSize: 30,
                      lineHeight: 1.05,
                      fontWeight: 900,
                      margin: "0 0 8px",
                      letterSpacing: "-0.03em",
                    }}>
                      {isEscalera ? "Escalera" : "Combinada"}
                    </p>
                    <p style={{
                      color: "#a1a1aa",
                      fontSize: 14,
                      margin: "0 0 14px",
                    }}>
                      {selections.length} selecciones · {shareDate}
                    </p>
                    <div style={{ display: "grid", gap: 9 }}>
                      {selections.slice(0, 4).map((sel, idx) => {
                        const selLine = sel.line !== null && sel.line !== undefined
                          ? (sel.line > 0 ? `+${sel.line}` : `${sel.line}`)
                          : null;
                        const stepStake = isEscalera && sel.stake ? `${(sel.stake * multiplier).toFixed(2)}${currencySymbol}` : "";
                        return (
                          <div
                            key={`${sel.event}-${idx}`}
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1fr auto",
                              gap: 10,
                              paddingBottom: idx < Math.min(selections.length, 4) - 1 ? 9 : 0,
                              borderBottom: idx < Math.min(selections.length, 4) - 1 ? "1px solid rgba(255,255,255,0.08)" : "none",
                            }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <p style={{ color: "#f4f4f5", fontSize: 14, fontWeight: 800, margin: 0, lineHeight: 1.2 }}>
                                {sel.selection || sel.market}
                              </p>
                              <p style={{ color: "#71717a", fontSize: 10, margin: "3px 0 0", lineHeight: 1.25 }}>
                                {sel.event}{selLine ? ` · ${selLine}` : ""}{stepStake ? ` · ${stepStake}` : ""}
                              </p>
                            </div>
                            <span style={{ color: accentColor, fontFamily: "'SF Mono', 'JetBrains Mono', monospace", fontSize: 13, fontWeight: 900 }}>
                              @{sel.odds.toFixed(2)}
                            </span>
                          </div>
                        );
                      })}
                      {selections.length > 4 && (
                        <p style={{ color: "#71717a", fontSize: 11, margin: 0 }}>
                          +{selections.length - 4} selecciones más
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div>
                    <h2 style={{
                      color: "#f8fafc",
                      fontSize: eventAway ? 26 : 30,
                      lineHeight: 1.12,
                      fontWeight: 900,
                      margin: 0,
                      letterSpacing: "-0.035em",
                    }}>
                      {eventHome}
                    </h2>
                    {eventAway && (
                      <>
                        <p style={{ color: "#e4e4e7", fontSize: 14, fontWeight: 700, margin: "8px 0 4px" }}>VS</p>
                        <h2 style={{
                          color: "#f8fafc",
                          fontSize: 26,
                          lineHeight: 1.12,
                          fontWeight: 900,
                          margin: 0,
                          letterSpacing: "-0.035em",
                        }}>
                          {eventAway}
                        </h2>
                      </>
                    )}
                    <p style={{ color: "#a1a1aa", fontSize: 14, margin: "12px 0 0" }}>
                      {shareDate}
                    </p>
                  </div>
                )}
              </div>

              <div style={{
                display: "grid",
                gridTemplateColumns: "1.24fr 0.72fr 0.78fr 0.94fr",
                gap: 0,
                padding: "17px 0",
                borderBottom: "1px solid rgba(255,255,255,0.1)",
              }}>
                <div style={{ paddingRight: 10 }}>
                  <span style={{ color: "#a1a1aa", fontSize: 9, fontWeight: 800, letterSpacing: "0.08em" }}>MERCADO</span>
                  <p style={{ color: "#f4f4f5", fontSize: 13, fontWeight: 750, margin: "7px 0 0", lineHeight: 1.24, letterSpacing: "-0.01em" }}>
                    {isMultiBet ? (isEscalera ? "Escalera" : "Combinada") : bet.market || selectionName}
                  </p>
                </div>
                <div style={{ padding: "0 10px", borderLeft: "1px solid rgba(255,255,255,0.08)" }}>
                  <span style={{ color: "#a1a1aa", fontSize: 9, fontWeight: 800, letterSpacing: "0.08em" }}>CUOTA</span>
                  <p style={{ color: "#f8fafc", fontFamily: shareSansFont, fontSize: 16, fontWeight: 780, letterSpacing: "-0.02em", margin: "7px 0 0" }}>
                    {displayOdds.toFixed(2)}
                  </p>
                </div>
                <div style={{ padding: "0 10px", borderLeft: "1px solid rgba(255,255,255,0.08)" }}>
                  <span style={{ color: "#a1a1aa", fontSize: 9, fontWeight: 800, letterSpacing: "0.08em" }}>STAKE</span>
                  <p style={{ color: "#f8fafc", fontFamily: shareSansFont, fontSize: 16, fontWeight: 780, letterSpacing: "-0.02em", margin: "7px 0 0" }}>
                    {displayStake.toFixed(2)}{currencySymbol}
                  </p>
                </div>
                <div style={{ paddingLeft: 10, borderLeft: "1px solid rgba(255,255,255,0.08)" }}>
                  <span style={{ color: "#a1a1aa", fontSize: 9, fontWeight: 800, letterSpacing: "0.08em" }}>{plLabel}</span>
                  <p style={{ color: statusColor, fontFamily: shareSansFont, fontSize: 16, fontWeight: 850, letterSpacing: "-0.025em", margin: "7px 0 0" }}>
                    {formatAmount(displayValue, currencySymbol)}
                  </p>
                </div>
              </div>

              {!isMultiBet && (
                <div style={{ padding: "14px 0 16px", borderBottom: "1px solid rgba(255,255,255,0.13)" }}>
                  <span style={{ color: "#a1a1aa", fontSize: 10, fontWeight: 700 }}>SELECCIÓN</span>
                  <p style={{ color: "#f8fafc", fontSize: 16, fontWeight: 800, margin: "6px 0 0", lineHeight: 1.25 }}>
                    {selectionName}{lineDisplay ? ` ${lineDisplay}` : ""}
                  </p>
                </div>
              )}

              <div style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr auto",
                alignItems: "center",
                gap: 18,
                marginTop: 16,
                padding: "14px 16px",
                border: `1px solid ${statusColor}cc`,
                borderRadius: 10,
                background: `linear-gradient(135deg, ${statusColor}0f, rgba(0,0,0,0.28))`,
                boxShadow: `0 0 18px ${statusColor}10, inset 0 0 0 1px rgba(255,255,255,0.035)`,
              }}>
                <div style={{ opacity: 0.88, transform: "translateY(1px)" }}>
                  <LogoIcon size={34} />
                </div>
                <div>
                  <p style={{ color: "#a1a1aa", fontSize: 10, fontWeight: 800, margin: 0, letterSpacing: "0.08em" }}>
                    ESTADO
                  </p>
                  <p style={{ color: statusColor, fontSize: 22, fontWeight: 900, margin: "4px 0 0", lineHeight: 1, letterSpacing: "-0.025em" }}>
                    {statusLabel}
                  </p>
                </div>
                {statusSymbol && (
                  <div style={{
                    display: "grid",
                    placeItems: "center",
                    width: 42,
                    height: 42,
                    borderRadius: 999,
                    border: `2px solid ${statusColor}`,
                    color: statusColor,
                    fontSize: 24,
                    fontWeight: 900,
                  }}>
                    {statusSymbol}
                  </div>
                )}
              </div>

              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: 18,
                alignItems: "end",
                paddingTop: 16,
              }}>
                <div>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                    paddingBottom: 16,
                    borderBottom: "1px solid rgba(255,255,255,0.13)",
                  }}>
                    <div>
                      <span style={{ color: "#a1a1aa", fontSize: 10, fontWeight: 700 }}>FECHA</span>
                      <p style={{ color: "#d4d4d8", fontSize: 12, margin: "6px 0 0" }}>
                        {formatShareDate(bet.createdAt?.toString().slice(0, 10) || bet.date, bet.createdAt?.toString().slice(11, 16))}
                      </p>
                    </div>
                    <div>
                  <span style={{ color: "#a1a1aa", fontSize: 10, fontWeight: 700 }}>CÓDIGO</span>
                  <p style={{ color: "#f4f4f5", fontFamily: "'SF Mono', monospace", fontSize: 13, margin: "6px 0 0" }}>
                    {verificationCode}
                  </p>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 15 }}>
                    {verification?.isPreEvent ? (
                      <ShieldCheck className="h-4 w-4" style={{ color: "#d4d4d8", filter: "none" }} />
                    ) : (
                      <ShieldAlert className="h-4 w-4" style={{ color: "#a1a1aa", filter: "none" }} />
                    )}
                    <span style={{ color: "#d4d4d8", fontSize: 11, fontWeight: 700, letterSpacing: "0.02em" }}>
                      {verification
                        ? verification.isPreEvent
                          ? `PRUEBA PRE-EVENTO · ${getTimeDifference(verification.timestamp, bet.date, bet.time)}`
                          : "REGISTRO POST-EVENTO · SIN PRUEBA PREVIA"
                        : "SIN PRUEBA PÚBLICA"}
                    </span>
                  </div>
                </div>
                {verification ? (
                  <div style={{
                    width: 72,
                    height: 72,
                    background: "#ffffff",
                    borderRadius: 7,
                    padding: 5,
                    display: "grid",
                    placeItems: "center",
                    boxShadow: "0 0 26px rgba(255,255,255,0.16)",
                  }}>
                    <QRCode
                      value={verifyUrl}
                      size={62}
                      bgColor="#ffffff"
                      fgColor="#09090b"
                      level="L"
                    />
                  </div>
                ) : (
                  <div style={{
                    width: 72,
                    minHeight: 72,
                    border: "1px solid rgba(255,255,255,0.13)",
                    borderRadius: 7,
                    padding: "8px 6px",
                    display: "grid",
                    placeItems: "center",
                    textAlign: "center",
                    color: "#a1a1aa",
                    fontSize: 9,
                    fontWeight: 800,
                    letterSpacing: "0.04em",
                    lineHeight: 1.25,
                    background: "rgba(255,255,255,0.03)",
                  }}>
                    SIN QR
                  </div>
                )}
              </div>

              <div style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: 8,
                color: "#a1a1aa",
                fontSize: 11,
                fontWeight: 700,
                marginTop: 17,
                letterSpacing: "0.03em",
              }}>
                {verification && (
                  <span style={{
                    width: 18,
                    height: 18,
                    border: "1px solid rgba(255,255,255,0.22)",
                    borderRadius: 5,
                    display: "grid",
                    placeItems: "center",
                    color: accentColor,
                  }}>
                    ✓
                  </span>
                )}
                {verification
                  ? verification.isPreEvent
                    ? "PRUEBA PRE-EVENTO EN oddsmark.app"
                    : "REGISTRO POST-EVENTO EN oddsmark.app"
                  : "SIN PRUEBA PÚBLICA EN ODDSMARK.APP"}
              </div>
            </div>
          </div>

          {shareError && (
            <div className="rounded-lg border border-red-500/20 bg-red-950/30 px-3 py-2 text-center">
              <p className="text-xs text-red-400">No se pudo generar la imagen. Prueba hacer captura de pantalla.</p>
            </div>
          )}

          <SocialSharePanel
            bet={bet}
            result={displayValue}
            currencySymbol={currencySymbol}
            verificationState={verificationState}
            onDownload={handleDownload}
            onShare={handleShare}
            onClose={onClose}
            isGenerating={isGenerating}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SocialSharePanel({ bet, result, currencySymbol, verificationState, onDownload, onShare, onClose, isGenerating }: {
  bet: Bet;
  result: number;
  currencySymbol: string;
  verificationState: ShareVerificationState;
  onDownload: () => void;
  onShare: () => void;
  onClose: () => void;
  isGenerating: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [telegramSent, setTelegramSent] = useState(false);
  const [telegramConnected, setTelegramConnected] = useState(false);

  useEffect(() => {
    getTelegramStatus().then(s => setTelegramConnected(s.connected));
  }, []);

  const verificationHash = verificationState.verification?.hash;
  const shortCode = verificationHash ? getShortVerificationCode(verificationHash) : "";
  const appUrl = typeof window !== "undefined" ? window.location.origin : "https://oddsmark.app";
  const verifyLink = shortCode ? `${appUrl}/verify?code=${shortCode}` : "";
  const proofKind = verificationState.proofKind;
  const proofLine = proofKind === "pre_event"
    ? "Apuesta con prueba pública pre-evento"
    : proofKind === "post_event"
      ? "Registro público post-evento, sin prueba previa"
      : "Apuesta sin prueba pública";
  const statusText = bet.isCashout
    ? "Cashout"
    : bet.status === "won"
      ? "Ganada"
      : bet.status === "lost"
        ? "Perdida"
        : bet.status === "void"
          ? "Anulada"
          : "Pendiente";
  const profitText = result !== 0 ? `${result >= 0 ? "+" : ""}${result.toFixed(2)}${currencySymbol}` : "";

  const handleTwitter = () => {
    const text = generateTweetText(bet, result, shortCode, appUrl, currencySymbol, proofKind);
    shareToTwitter(text);
  };

  const handleTelegram = async () => {
    const msg = generateTelegramMessage(bet, result, verificationHash, appUrl, currencySymbol, proofKind);
    const ok = await sendToTelegram(msg);
    if (ok) setTelegramSent(true);
    setTimeout(() => setTelegramSent(false), 3000);
  };

  const handleCopyCaption = async () => {
    const text = generateInstagramCaption(bet, result, currencySymbol, proofKind);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleWhatsApp = () => {
    const text = [
      `${statusText}: ${bet.event}`,
      `${bet.market} @${bet.odds.toFixed(2)}`,
      profitText ? `P&L: ${profitText}` : "",
      "",
      proofLine,
      verifyLink || "oddsmark.app",
    ].filter(Boolean).join("\n");
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  };

  const handleCopyLink = async () => {
    const inlineProfitText = profitText ? ` | ${profitText}` : "";
    const text = `${statusText}: ${bet.event} | ${bet.market} @${bet.odds.toFixed(2)}${inlineProfitText} | ${proofLine}${verifyLink ? ` | ${verifyLink}` : ""}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="rounded-xl border border-zinc-800/90 bg-zinc-950/95 p-2 shadow-2xl shadow-black/40">
      <div className="grid grid-cols-3 gap-1.5">
        <Button variant="outline" size="sm" onClick={onClose} className="h-9 min-w-0 px-2 text-xs">
          <X className="mr-1.5 h-3.5 w-3.5" />
          Cerrar
        </Button>
        <Button variant="outline" size="sm" onClick={onDownload} disabled={isGenerating} className="h-9 min-w-0 px-2 text-xs">
          <Download className="mr-1.5 h-3.5 w-3.5" />
          Imagen
        </Button>
        <Button size="sm" onClick={onShare} disabled={isGenerating} className="h-9 min-w-0 bg-emerald-600 px-2 text-xs hover:bg-emerald-700">
          <Share2 className="mr-1.5 h-3.5 w-3.5" />
          {isGenerating ? "..." : "Compartir"}
        </Button>
      </div>

      <div className="mt-1.5 grid grid-cols-3 gap-1.5">
        <button
          onClick={handleTwitter}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 py-2 transition-colors hover:bg-zinc-700"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-zinc-300" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
          </svg>
          <span className="text-[10px] font-bold text-zinc-300">Twitter</span>
        </button>

        <button
          onClick={handleWhatsApp}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-green-500/20 bg-green-500/10 py-2 transition-colors hover:bg-green-500/20"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-green-400" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          <span className="text-[10px] font-bold text-green-400">WhatsApp</span>
        </button>

        <button
          onClick={handleTelegram}
          disabled={!telegramConnected}
          className={`flex items-center justify-center gap-1.5 rounded-lg border py-2 transition-colors ${
            telegramConnected
              ? telegramSent
                ? "border-emerald-500/30 bg-emerald-500/20 text-emerald-400"
                : "border-sky-500/20 bg-sky-500/10 text-sky-400 hover:bg-sky-500/20"
              : "cursor-not-allowed border-zinc-800 bg-zinc-800/50 text-zinc-600"
          }`}
        >
          <Send className="h-3.5 w-3.5" />
          <span className="text-[10px] font-bold">
            {telegramSent ? "Enviado" : telegramConnected ? "Telegram" : "Sin canal"}
          </span>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <button
          onClick={handleCopyCaption}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-pink-500/20 bg-gradient-to-r from-pink-500/10 to-purple-500/10 py-2 transition-colors hover:from-pink-500/20 hover:to-purple-500/20"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-emerald-400" />
          ) : (
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-pink-400" fill="currentColor">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
            </svg>
          )}
          <span className="text-[10px] font-bold text-pink-400">
            {copied ? "Copiado" : "IG Caption"}
          </span>
        </button>

        <button
          onClick={handleCopyLink}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 py-2 transition-colors hover:bg-zinc-700"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-emerald-400" />
          ) : (
            <Copy className="h-3.5 w-3.5 text-zinc-400" />
          )}
          <span className="text-[10px] font-bold text-zinc-400">
            {copied ? "Copiado" : "Copiar texto"}
          </span>
        </button>
      </div>
    </div>
  );
}
