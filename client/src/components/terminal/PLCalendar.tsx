import { useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Minus, X, Clock, CheckCircle, XCircle, Share2, Loader2 } from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";
import { useWidgets } from "@/contexts/WidgetContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { DailyReport } from "@/components/share/DailyReport";
import type { Bet } from "@shared/schema";
import { calculateBetProfit } from "@/lib/bet-calculations";
import { getBetDisplayDate, toLocalDateKey } from "@/lib/bet-analysis";

interface PLCalendarProps {
  bets: Bet[];
  currency: "units" | "money";
  unitValue: number;
  onEditBet?: (bet: Bet) => void;
}

interface DayData {
  profit: number;
  bets: Bet[];
  hasPending: boolean;
}

export function PLCalendar({ bets, currency, unitValue, onEditBet }: PLCalendarProps) {
  const { isVisible, hideWidget } = useWidgets();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isCalendarSharing, setIsCalendarSharing] = useState(false);
  const shareCardRef = useRef<HTMLDivElement>(null);

  const multiplier = currency === "money" ? unitValue : 1;
  const sym = currency === "money" ? "\u20AC" : "U";

  const dataByDate = useMemo(() => {
    const map = new Map<string, DayData>();
    bets.forEach(bet => {
      const displayDate = getBetDisplayDate(bet);
      if (!displayDate) return;
      const existing = map.get(displayDate) || { profit: 0, bets: [], hasPending: false };
      existing.bets.push(bet);
      const { profit, isPending } = calculateBetProfit(bet, multiplier);
      if (isPending) {
        existing.hasPending = true;
      } else {
        existing.profit += profit;
      }
      map.set(displayDate, existing);
    });
    return map;
  }, [bets, currency, unitValue, multiplier]);

  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPad = (firstDay.getDay() + 6) % 7;
    const days: { date: Date | null; data: DayData }[] = [];
    for (let i = 0; i < startPad; i++) {
      days.push({ date: null, data: { profit: 0, bets: [], hasPending: false } });
    }
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(year, month, d);
      const dateStr = toLocalDateKey(date);
      const data = dataByDate.get(dateStr) || { profit: 0, bets: [], hasPending: false };
      days.push({ date, data });
    }
    return days;
  }, [currentMonth, dataByDate]);

  const monthlyStats = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const prefix = `${year}-${String(month + 1).padStart(2, "0")}`;
    let totalProfit = 0;
    let totalStake = 0;
    let wins = 0;
    let losses = 0;
    let totalBets = 0;

    bets.forEach(bet => {
      const dateStr = getBetDisplayDate(bet);
      if (!dateStr || !dateStr.startsWith(prefix)) return;
      const { profit, isPending, isSettled, totalStake: settledStake } = calculateBetProfit(bet, multiplier);
      if (isSettled && !isPending) {
        totalProfit += profit;
        totalStake += settledStake;
        totalBets++;
        if (profit > 0) wins++;
        else if (profit < 0) losses++;
      }
    });

    const yield_ = totalStake > 0 ? (totalProfit / totalStake) * 100 : 0;
    return { totalProfit, totalStake, wins, losses, totalBets, yield: yield_ };
  }, [bets, currentMonth, multiplier]);

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const formatProfit = (value: number) => {
    if (currency === "money") {
      return value >= 0 ? `+${value.toFixed(0)}` : value.toFixed(0);
    }
    return value >= 0 ? `+${formatNumber(value, 1)}` : formatNumber(value, 1);
  };

  const formatCalendarCellProfit = (value: number) => {
    if (currency === "money") {
      const rounded = Math.round(value);
      return rounded >= 0 ? `+${rounded}` : `${rounded}`;
    }
    const rounded = Math.round(value * 10) / 10;
    return rounded >= 0 ? `+${formatNumber(rounded, 1)}` : formatNumber(rounded, 1);
  };

  const handleDayClick = (date: Date, data: DayData) => {
    if (data.bets.length > 0) {
      setSelectedDate(date);
      setIsModalOpen(true);
    }
  };

  const handleBetClick = (bet: Bet) => {
    setIsModalOpen(false);
    if (onEditBet) {
      onEditBet(bet);
    }
  };

  const forceDownloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  const handleShareCalendar = async () => {
    if (!shareCardRef.current) return;
    setIsCalendarSharing(true);
    try {
      const canvas = await html2canvas(shareCardRef.current, {
        backgroundColor: null,
        scale: 3,
        useCORS: true,
        logging: false,
        width: shareCardRef.current.offsetWidth,
        height: shareCardRef.current.offsetHeight,
      });

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("toBlob null"))),
          "image/png",
          1.0,
        );
      });

      const filename = `reporte_${monthLabel.replace(/\s+/g, "_")}.png`;
      const file = new File([blob], filename, { type: "image/png" });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: `Reporte Mensual - ${monthLabel}` });
      } else {
        forceDownloadBlob(blob, filename);
      }
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      console.error("Share failed, fallback download:", err);
      try {
        const canvas = await html2canvas(shareCardRef.current!, {
          backgroundColor: null, scale: 3, useCORS: true, logging: false,
          width: shareCardRef.current!.offsetWidth, height: shareCardRef.current!.offsetHeight,
        });
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("null"))), "image/png", 1.0);
        });
        forceDownloadBlob(blob, `reporte_${monthLabel.replace(/\s+/g, "_")}.png`);
      } catch (dlErr) {
        console.error("Download fallback failed:", dlErr);
      }
    } finally {
      setIsCalendarSharing(false);
    }
  };

  const selectedDateStr = selectedDate ? toLocalDateKey(selectedDate) : "";
  const selectedDayData = dataByDate.get(selectedDateStr) || { profit: 0, bets: [], hasPending: false };

  const wonBets = selectedDayData.bets.filter(b => b.status === "won");
  const lostBets = selectedDayData.bets.filter(b => b.status === "lost");
  const pendingBets = selectedDayData.bets.filter(b => b.status === "pending");

  const monthLabel = currentMonth.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  const monthNameUpper = currentMonth.toLocaleDateString("es-ES", { month: "long" }).toUpperCase();
  const yearStr = String(currentMonth.getFullYear());

  if (!isVisible("calendar")) {
    return null;
  }

  const formatBetResult = (bet: Bet) => {
    const { profit, isPending } = calculateBetProfit(bet, multiplier);
    if (isPending) return null;
    return profit >= 0 ? `+${formatNumber(profit, 1)}` : formatNumber(profit, 1);
  };

  const isPositive = monthlyStats.totalProfit >= 0;
  const neonColor = isPositive ? "#4ade80" : "#f87171";
  const neonGlow = isPositive ? "0 0 20px rgba(74,222,128,0.4), 0 0 60px rgba(74,222,128,0.15)" : "0 0 20px rgba(248,113,113,0.4), 0 0 60px rgba(248,113,113,0.15)";

  const weekDayLabels = ["L", "M", "X", "J", "V", "S", "D"];

  const shareCardCalendarDays = calendarDays;

  return (
    <>
      <div
        ref={shareCardRef}
        style={{
          position: "fixed",
          left: "-9999px",
          top: 0,
          zIndex: -1,
          pointerEvents: "none",
          width: "420px",
          background: "linear-gradient(180deg, #0a0a0a 0%, #050505 100%)",
          borderRadius: "20px",
          border: `1px solid ${neonColor}30`,
          padding: "32px 28px 28px",
          fontFamily: "'Inter', 'SF Pro Display', -apple-system, sans-serif",
          boxShadow: `inset 0 1px 0 ${neonColor}15, ${neonGlow}`,
          overflow: "hidden",
        }}
      >
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: "2px",
          background: `linear-gradient(90deg, transparent, ${neonColor}, transparent)`,
          opacity: 0.7,
        }} />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{
              width: "26px", height: "26px", borderRadius: "6px",
              background: `linear-gradient(135deg, ${neonColor}20, ${neonColor}08)`,
              border: `1px solid ${neonColor}30`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ fontSize: "9px", fontWeight: 800, color: neonColor, letterSpacing: "0.5px" }}>OM</span>
            </div>
            <span style={{ fontSize: "11px", fontWeight: 600, color: "#555", letterSpacing: "0.5px" }}>Oddsmark</span>
          </div>
          <span style={{
            fontSize: "9px", fontWeight: 700, color: "#444",
            textTransform: "uppercase", letterSpacing: "2px",
          }}>
            Reporte Mensual
          </span>
        </div>

        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <p style={{
            fontSize: "28px", fontWeight: 800, color: "#f0f0f0",
            letterSpacing: "3px", textTransform: "uppercase", lineHeight: 1.1,
            marginBottom: "4px",
          }}>
            {monthNameUpper}
          </p>
          <p style={{ fontSize: "14px", fontWeight: 500, color: "#555", letterSpacing: "4px" }}>
            {yearStr}
          </p>
        </div>

        <div style={{
          backgroundColor: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: "12px",
          padding: "14px 10px 10px",
          marginBottom: "24px",
        }}>
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "3px", marginBottom: "6px",
          }}>
            {weekDayLabels.map((d) => (
              <div key={d} style={{
                textAlign: "center", fontSize: "9px", color: "#555",
                fontWeight: 600, padding: "2px 0", letterSpacing: "0.5px",
              }}>
                {d}
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "3px" }}>
            {shareCardCalendarDays.map((day, idx) => {
              if (!day.date) {
                return <div key={`e-${idx}`} style={{ aspectRatio: "1", minHeight: "36px" }} />;
              }
              const hasProfit = day.data.profit !== 0;
              const isWin = hasProfit && day.data.profit > 0;
              const isLoss = hasProfit && day.data.profit < 0;
              const hasPending = day.data.hasPending && !hasProfit;
              const isToday = day.date.toDateString() === new Date().toDateString();

              let bgColor = "rgba(255,255,255,0.03)";
              let textColor = "#555";
              let subTextColor = "#444";
              if (isWin) { bgColor = "rgba(74,222,128,0.15)"; textColor = "#4ade80"; subTextColor = "#4ade80"; }
              else if (isLoss) { bgColor = "rgba(248,113,113,0.15)"; textColor = "#f87171"; subTextColor = "#f87171"; }
              else if (hasPending) { bgColor = "rgba(251,191,36,0.12)"; textColor = "#fbbf24"; subTextColor = "#fbbf24"; }

              return (
                <div
                  key={day.date.toISOString()}
                  style={{
                    aspectRatio: "1",
                    minHeight: "36px",
                    borderRadius: "6px",
                    backgroundColor: bgColor,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    border: isToday ? `1px solid ${neonColor}50` : "1px solid transparent",
                    position: "relative",
                  }}
                >
                  <span style={{ fontSize: "11px", fontWeight: 600, color: textColor, lineHeight: 1 }}>
                    {day.date.getDate()}
                  </span>
                  {hasProfit && (
                    <span style={{
                      fontSize: "7px", fontWeight: 700, color: subTextColor, lineHeight: 1,
                      fontFamily: "'SF Mono', 'Fira Code', monospace", marginTop: "2px",
                    }}>
                      {formatProfit(day.data.profit)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{
          background: `linear-gradient(135deg, ${neonColor}08, ${neonColor}15)`,
          border: `1px solid ${neonColor}25`,
          borderRadius: "14px",
          padding: "20px 16px",
          textAlign: "center",
          position: "relative",
        }}>
          <div style={{
            position: "absolute", top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            width: "140px", height: "140px", borderRadius: "50%",
            background: `radial-gradient(circle, ${neonColor}12, transparent 70%)`,
            pointerEvents: "none",
          }} />

          <p style={{
            fontSize: "9px", fontWeight: 700, color: "#555",
            textTransform: "uppercase", letterSpacing: "2px", marginBottom: "8px",
          }}>
            Profit del Mes
          </p>
          <p style={{
            fontSize: "44px", fontWeight: 800,
            fontFamily: "'SF Mono', 'Fira Code', 'JetBrains Mono', monospace",
            color: neonColor,
            lineHeight: 1,
            letterSpacing: "-2px",
            textShadow: `0 0 30px ${neonColor}50, 0 0 60px ${neonColor}20`,
            marginBottom: "12px",
            position: "relative",
          }}>
            {isPositive ? "+" : ""}{formatNumber(monthlyStats.totalProfit)}{sym}
          </p>

          <div style={{
            display: "flex", justifyContent: "center", gap: "20px",
            fontSize: "11px", color: "#666", fontWeight: 500, position: "relative",
          }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
              <span style={{ fontSize: "9px", color: "#444", textTransform: "uppercase", letterSpacing: "1px" }}>Yield</span>
              <span style={{
                fontFamily: "'SF Mono', monospace", fontWeight: 700, color: "#aaa", fontSize: "13px",
              }}>
                {Number.isFinite(monthlyStats.yield) ? `${monthlyStats.yield >= 0 ? "+" : ""}${monthlyStats.yield.toFixed(1)}%` : "—"}
              </span>
            </div>
            <div style={{ width: "1px", backgroundColor: "rgba(255,255,255,0.08)", height: "28px" }} />
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
              <span style={{ fontSize: "9px", color: "#444", textTransform: "uppercase", letterSpacing: "1px" }}>Record</span>
              <span style={{
                fontFamily: "'SF Mono', monospace", fontWeight: 700, fontSize: "13px",
              }}>
                <span style={{ color: "#4ade80" }}>{monthlyStats.wins}W</span>
                <span style={{ color: "#555", margin: "0 3px" }}>/</span>
                <span style={{ color: "#f87171" }}>{monthlyStats.losses}L</span>
              </span>
            </div>
            <div style={{ width: "1px", backgroundColor: "rgba(255,255,255,0.08)", height: "28px" }} />
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
              <span style={{ fontSize: "9px", color: "#444", textTransform: "uppercase", letterSpacing: "1px" }}>Apuestas</span>
              <span style={{
                fontFamily: "'SF Mono', monospace", fontWeight: 700, color: "#aaa", fontSize: "13px",
              }}>
                {monthlyStats.totalBets}
              </span>
            </div>
          </div>
        </div>

        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          marginTop: "16px", paddingTop: "12px",
          borderTop: "1px solid rgba(255,255,255,0.05)",
        }}>
          <span style={{ fontSize: "9px", color: "#333", letterSpacing: "1px" }}>
            oddsmark.app
          </span>
        </div>
      </div>

      <Card className="py-3 relative group" data-testid="card-pl-calendar">
        <Button
          size="icon"
          variant="ghost"
          className="absolute top-1 right-1 h-5 w-5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity z-10"
          onClick={() => hideWidget("calendar")}
          data-testid="button-hide-calendar"
        >
          <Minus className="h-3 w-3" />
        </Button>
        <CardContent className="px-4 py-0">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center justify-between gap-2 sm:justify-end">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Calendario P&L</p>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleShareCalendar}
                disabled={isCalendarSharing}
                data-testid="button-share-calendar"
              >
                {isCalendarSharing
                  ? <Loader2 className="h-3 w-3 animate-spin" />
                  : <Share2 className="h-3 w-3" />
                }
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={prevMonth}
                data-testid="button-prev-month"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-0 flex-1 text-center text-sm font-medium capitalize sm:min-w-24 sm:flex-none">{monthLabel}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={nextMonth}
                data-testid="button-next-month"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-1">
            {weekDayLabels.map((day) => (
              <div key={day} className="py-1 text-center text-[9px] font-medium text-muted-foreground sm:text-[10px]">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, idx) => {
              if (!day.date) {
                return <div key={`empty-${idx}`} className="aspect-square" />;
              }

              const isToday = day.date.toDateString() === new Date().toDateString();
              const hasActivity = day.data.bets.length > 0;
              const hasProfit = day.data.profit !== 0;
              const hasPending = day.data.hasPending;

              return (
                <div
                  key={day.date.toISOString()}
                  onClick={() => handleDayClick(day.date!, day.data)}
                  className={cn(
                    "relative flex min-h-12 cursor-pointer flex-col items-center justify-center rounded-lg px-0.5 py-1 text-[11px] transition-all sm:aspect-square sm:min-h-0 sm:text-[10px]",
                    hasProfit && day.data.profit > 0 && "bg-win/20 text-win",
                    hasProfit && day.data.profit < 0 && "bg-loss/20 text-loss",
                    !hasProfit && hasPending && "bg-amber-500/20 text-amber-500",
                    !hasProfit && !hasPending && "bg-muted/30 text-muted-foreground",
                    isToday && "ring-1 ring-primary",
                    hasActivity && "hover-elevate"
                  )}
                  data-testid={`calendar-day-${day.date.getDate()}`}
                >
                  <span className="font-medium">{day.date.getDate()}</span>
                  {hasProfit && (
                    <span className="max-w-full truncate font-mono text-[9px] leading-none sm:text-[8px]">
                      {formatCalendarCellProfit(day.data.profit)}
                    </span>
                  )}
                  {!hasProfit && hasPending && (
                    <Clock className="h-2 w-2 mt-0.5" />
                  )}
                  {hasActivity && (
                    <div className="absolute top-0.5 right-0.5 w-1 h-1 rounded-full bg-current opacity-60" />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-h-[85dvh] w-[calc(100vw-1rem)] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex flex-col gap-2 sm:flex-row sm:items-center">
              Resumen del día
              <Badge variant="outline" className="font-mono text-xs">
                {selectedDate?.toLocaleDateString("es-ES", {
                  weekday: "short",
                  day: "numeric",
                  month: "short"
                })}
              </Badge>
            </DialogTitle>
            <DialogDescription>
              Apuestas y resultado agregado del día seleccionado.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {wonBets.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-win">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">Ganadas ({wonBets.length})</span>
                </div>
                <div className="space-y-1">
                  {wonBets.map(bet => (
                    <div
                      key={bet.id}
                      onClick={() => handleBetClick(bet)}
                      className="cursor-pointer rounded-md bg-win/10 p-2 hover-elevate flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                      data-testid={`modal-bet-${bet.id}`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{bet.event}</p>
                        <p className="text-xs text-muted-foreground truncate">{Array.isArray(bet.selections) && bet.selections[0] ? String((bet.selections[0] as { selection?: string })?.selection || bet.market) : bet.market}</p>
                      </div>
                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <Badge variant="outline" className="font-mono text-xs">
                          @{formatNumber(bet.odds)}
                        </Badge>
                        <span className="text-win font-mono text-sm font-medium">
                          {formatBetResult(bet)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {lostBets.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-loss">
                  <XCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">Perdidas ({lostBets.length})</span>
                </div>
                <div className="space-y-1">
                  {lostBets.map(bet => (
                    <div
                      key={bet.id}
                      onClick={() => handleBetClick(bet)}
                      className="cursor-pointer rounded-md bg-loss/10 p-2 hover-elevate flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                      data-testid={`modal-bet-${bet.id}`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{bet.event}</p>
                        <p className="text-xs text-muted-foreground truncate">{Array.isArray(bet.selections) && bet.selections[0] ? String((bet.selections[0] as { selection?: string })?.selection || bet.market) : bet.market}</p>
                      </div>
                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <Badge variant="outline" className="font-mono text-xs">
                          @{formatNumber(bet.odds)}
                        </Badge>
                        <span className="text-loss font-mono text-sm font-medium">
                          {formatBetResult(bet)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {pendingBets.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-amber-500">
                  <Clock className="h-4 w-4" />
                  <span className="text-sm font-medium">Pendientes ({pendingBets.length})</span>
                </div>
                <div className="space-y-1">
                  {pendingBets.map(bet => (
                    <div
                      key={bet.id}
                      onClick={() => handleBetClick(bet)}
                      className="cursor-pointer rounded-md bg-amber-500/10 p-2 hover-elevate flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                      data-testid={`modal-bet-${bet.id}`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{bet.event}</p>
                        <p className="text-xs text-muted-foreground truncate">{Array.isArray(bet.selections) && bet.selections[0] ? String((bet.selections[0] as { selection?: string })?.selection || bet.market) : bet.market}</p>
                      </div>
                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <Badge variant="outline" className="font-mono text-xs">
                          @{formatNumber(bet.odds)}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {formatNumber(bet.stake)}U
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedDayData.bets.length === 0 && (
              <p className="text-center text-muted-foreground py-4">
                No hay apuestas para este dia
              </p>
            )}

            {(wonBets.length > 0 || lostBets.length > 0) && (
              <div className="pt-3 border-t">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-col">
                    <span className="text-sm text-muted-foreground">Balance del dia</span>
                    <span className={cn(
                      "font-mono font-bold text-lg",
                      selectedDayData.profit >= 0 ? "text-win" : "text-loss"
                    )}>
                      {formatProfit(selectedDayData.profit)}
                      {currency === "money" ? "\u20AC" : "U"}
                    </span>
                  </div>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => setIsShareOpen(true)}
                    data-testid="button-share-daily-summary"
                  >
                    <Share2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {selectedDate && (wonBets.length > 0 || lostBets.length > 0) && (
        <DailyReport
          bets={bets}
          open={isShareOpen}
          onClose={() => setIsShareOpen(false)}
          currency={currency}
          unitValue={unitValue}
          date={toLocalDateKey(selectedDate)}
        />
      )}
    </>
  );
}
