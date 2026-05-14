import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { toBlob } from "html-to-image";
import QRCode from "react-qr-code";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { Share2, TrendingDown, TrendingUp } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand/BrandLogo";
import {
  formatChartShareDate,
  getChartSharePeriodBadge,
  getChartSharePeriodLabel,
  getChartSharePeriodRange,
  type ChartShareTimePeriod,
} from "@/lib/chart-share-period";

interface ChartDataPoint {
  date: string;
  value: number;
  bankroll?: number;
  profit?: number;
}

interface PeriodStats {
  profit: number;
  yield: number;
  winRate: number;
  wins?: number;
  losses?: number;
  total?: number;
}

interface TrendShareCardProps {
  open: boolean;
  onClose: () => void;
  data: ChartDataPoint[];
  periodLabel: string;
  timePeriod?: ChartShareTimePeriod;
  periodStats: PeriodStats;
  currency: "units" | "money";
  unitValue: number;
  chartMode?: "banca" | "rendimiento";
}

const shareSansFont = "'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif";

function formatSignedAmount(value: number, symbol: string): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}${symbol}`;
}

function formatPercent(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function formatTrendDate(date: string): string {
  return formatChartShareDate(date);
}

export function TrendShareCard({
  open,
  onClose,
  data,
  periodLabel,
  timePeriod,
  periodStats,
  currency,
  unitValue,
  chartMode = "rendimiento",
}: TrendShareCardProps) {
  const ticketRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (!open || typeof document === "undefined") return;

    const previousBodyOverflowX = document.body.style.overflowX;
    const previousDocumentOverflowX = document.documentElement.style.overflowX;

    document.body.style.overflowX = "hidden";
    document.documentElement.style.overflowX = "hidden";

    return () => {
      document.body.style.overflowX = previousBodyOverflowX;
      document.documentElement.style.overflowX = previousDocumentOverflowX;
    };
  }, [open]);

  const multiplier = currency === "money" ? unitValue : 1;
  const currencySymbol = currency === "money" ? "€" : "U";
  const appUrl = typeof window !== "undefined" ? window.location.origin : "https://oddsmark.app";
  const today = new Date().toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const chartData = useMemo(() => data.map((point) => ({
    date: point.date,
    value: chartMode === "banca"
      ? (point.bankroll ?? point.value) * multiplier
      : (point.profit ?? point.value) * multiplier,
  })), [chartMode, data, multiplier]);

  const values = chartData.map((point) => point.value);
  const minValue = values.length > 0 ? Math.min(...values) : 0;
  const maxValue = values.length > 0 ? Math.max(...values) : 0;
  const range = Math.max(maxValue - minValue, 1);
  const yDomain: [number, number] = [
    Math.floor(minValue - range * 0.16),
    Math.ceil(maxValue + range * 0.16),
  ];
  const firstDate = chartData[0]?.date;
  const lastDate = chartData[chartData.length - 1]?.date;
  const resolvedTimePeriod = timePeriod ?? "ALL";
  const resolvedPeriodLabel = periodLabel || getChartSharePeriodLabel(resolvedTimePeriod);
  const periodBadge = getChartSharePeriodBadge(resolvedTimePeriod);
  const dateRangeLabel = getChartSharePeriodRange(resolvedTimePeriod, {
    firstDataDate: firstDate,
    lastDataDate: lastDate,
  });

  const displayProfit = periodStats.profit * multiplier;
  const isPositive = displayProfit >= 0;
  const accentColor = isPositive ? "#8fd56a" : "#e46b6b";
  const accentSoft = isPositive ? "rgba(143, 213, 106, 0.18)" : "rgba(228, 107, 107, 0.18)";
  const trendLabel = chartMode === "banca" ? "BANCA" : "P&L";
  const totalLabel = periodStats.total != null ? `${periodStats.total} apuestas` : "Resumen";
  const recordLabel = periodStats.wins !== undefined && periodStats.losses !== undefined
    ? `${periodStats.wins}G / ${periodStats.losses}P`
    : totalLabel;
  const gradientId = isPositive ? "trendShareAreaPositive" : "trendShareAreaNegative";

  const handleShare = useCallback(async () => {
    if (!ticketRef.current) return;

    setIsGenerating(true);
    const fileName = `terminal-chart-share.jpg`;

    try {
      await new Promise((resolve) => setTimeout(resolve, 250));

      const blob = await toBlob(ticketRef.current, {
        cacheBust: true,
        skipAutoScale: true,
        skipFonts: true,
        backgroundColor: "#030303",
        type: "image/jpeg",
        quality: 0.95,
        pixelRatio: 1,
      });

      if (!blob) throw new Error("Failed to generate image");

      const file = new File([blob], fileName, {
        type: "image/jpeg",
        lastModified: Date.now(),
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

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-h-[96dvh] max-w-[500px] overflow-x-hidden overflow-y-auto border-0 bg-transparent p-0">
        <DialogTitle className="sr-only">Compartir gráfica</DialogTitle>
        <DialogDescription className="sr-only">
          Vista previa exportable de la evolución de banca o P&L según la temporalidad seleccionada.
        </DialogDescription>

        <div className="flex flex-col gap-3 p-2 sm:p-4">
          <div
            ref={ticketRef}
            className="relative mx-auto w-full overflow-hidden rounded-[22px]"
            style={{
              width: "408px",
              maxWidth: "100%",
              minHeight: "628px",
              background: "linear-gradient(180deg, #050505 0%, #090a09 45%, #030303 100%)",
              border: "1px solid rgba(255,255,255,0.13)",
              boxShadow: "0 30px 80px rgba(0,0,0,0.72), inset 0 0 0 1px rgba(255,255,255,0.04)",
              color: "#f8fafc",
              fontFamily: shareSansFont,
              padding: "24px",
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundImage: [
                  "linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px)",
                  "linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)",
                  "linear-gradient(180deg, rgba(143,213,106,0.09) 0%, transparent 24%, rgba(0,0,0,0.72) 100%)",
                ].join(", "),
                backgroundSize: "100% 44px, 44px 100%, 100% 100%",
                opacity: 0.5,
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                boxShadow: "inset 0 0 70px rgba(0,0,0,0.78), inset 0 -110px 80px rgba(0,0,0,0.92)",
              }}
            />

            <div style={{ position: "relative" }}>
              <div style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 16,
              }}>
                <BrandLogo
                  variant="light"
                  className="w-[160px] max-w-[52%] opacity-90"
                  imageClassName="drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]"
                />
                <div style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  color: accentColor,
                  fontSize: 13,
                  fontWeight: 900,
                  letterSpacing: "0.02em",
                }}>
                  {isPositive ? (
                    <TrendingUp size={17} strokeWidth={2.4} />
                  ) : (
                    <TrendingDown size={17} strokeWidth={2.4} />
                  )}
                  {formatSignedAmount(displayProfit, currencySymbol)}
                </div>
              </div>

              <div style={{ marginTop: 32 }}>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}>
                  <p style={{
                    margin: 0,
                    color: "#a1a1aa",
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: "0.1em",
                  }}>
                    EVOLUCIÓN {trendLabel}
                  </p>
                  <span style={{
                    border: "1px solid rgba(255,255,255,0.16)",
                    borderRadius: 999,
                    color: "#d4d4d8",
                    fontSize: 9,
                    fontWeight: 900,
                    letterSpacing: "0.08em",
                    padding: "3px 7px",
                  }}>
                    {periodBadge}
                  </span>
                </div>
                <h2 style={{
                  margin: "8px 0 0",
                  color: "#f8fafc",
                  fontSize: 29,
                  lineHeight: 1.04,
                  fontWeight: 900,
                  letterSpacing: "-0.03em",
                }}>
                  {resolvedPeriodLabel}
                </h2>
                <p style={{
                  margin: "8px 0 0",
                  color: "#a1a1aa",
                  fontSize: 14,
                  lineHeight: 1.35,
                }}>
                  {dateRangeLabel} · {totalLabel}
                </p>
              </div>

              <div style={{
                height: 204,
                marginTop: 20,
                padding: "8px 0 0",
                borderTop: "1px solid rgba(255,255,255,0.11)",
                borderBottom: "1px solid rgba(255,255,255,0.11)",
              }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 16, right: 4, left: 0, bottom: 12 }}>
                    <defs>
                      <linearGradient id="trendShareAreaPositive" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#8fd56a" stopOpacity={0.42} />
                        <stop offset="100%" stopColor="#8fd56a" stopOpacity={0.04} />
                      </linearGradient>
                      <linearGradient id="trendShareAreaNegative" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#e46b6b" stopOpacity={0.42} />
                        <stop offset="100%" stopColor="#e46b6b" stopOpacity={0.04} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      vertical={false}
                      stroke="rgba(255,255,255,0.1)"
                      strokeDasharray="2 8"
                    />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: "#a1a1aa", fontSize: 10, fontWeight: 700, fontFamily: shareSansFont }}
                      tickFormatter={formatTrendDate}
                      interval="preserveStartEnd"
                      tickLine={false}
                      axisLine={{ stroke: "rgba(255,255,255,0.16)" }}
                      minTickGap={34}
                    />
                    <YAxis hide domain={yDomain} />
                    <ReferenceLine
                      y={chartMode === "banca" ? minValue : 0}
                      stroke="rgba(255,255,255,0.34)"
                      strokeDasharray="4 4"
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke={accentColor}
                      strokeWidth={3}
                      fill={`url(#${gradientId})`}
                      dot={false}
                      activeDot={false}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 0,
                padding: "14px 0",
                borderBottom: "1px solid rgba(255,255,255,0.11)",
              }}>
                <div style={{ paddingRight: 12 }}>
                  <span style={{ color: "#a1a1aa", fontSize: 9, fontWeight: 800, letterSpacing: "0.08em" }}>
                    P&L
                  </span>
                  <p style={{
                    color: accentColor,
                    fontSize: 19,
                    fontWeight: 900,
                    margin: "7px 0 0",
                    letterSpacing: "-0.03em",
                  }}>
                    {formatSignedAmount(displayProfit, currencySymbol)}
                  </p>
                </div>
                <div style={{ padding: "0 12px", borderLeft: "1px solid rgba(255,255,255,0.09)" }}>
                  <span style={{ color: "#a1a1aa", fontSize: 9, fontWeight: 800, letterSpacing: "0.08em" }}>
                    YIELD
                  </span>
                  <p style={{
                    color: periodStats.yield >= 0 ? "#8fd56a" : "#e46b6b",
                    fontSize: 19,
                    fontWeight: 900,
                    margin: "7px 0 0",
                    letterSpacing: "-0.03em",
                  }}>
                    {formatPercent(periodStats.yield)}
                  </p>
                </div>
                <div style={{ paddingLeft: 12, borderLeft: "1px solid rgba(255,255,255,0.09)" }}>
                  <span style={{ color: "#a1a1aa", fontSize: 9, fontWeight: 800, letterSpacing: "0.08em" }}>
                    ACIERTO
                  </span>
                  <p style={{
                    color: "#f8fafc",
                    fontSize: 19,
                    fontWeight: 900,
                    margin: "7px 0 0",
                    letterSpacing: "-0.03em",
                  }}>
                    {periodStats.winRate.toFixed(0)}%
                  </p>
                </div>
              </div>

              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: 18,
                alignItems: "end",
                paddingTop: 14,
              }}>
                <div>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 14,
                  }}>
                    <div>
                      <span style={{ color: "#a1a1aa", fontSize: 10, fontWeight: 800, letterSpacing: "0.07em" }}>
                        REGISTRO
                      </span>
                      <p style={{ color: "#f4f4f5", fontSize: 14, fontWeight: 800, margin: "7px 0 0" }}>
                        {recordLabel}
                      </p>
                    </div>
                    <div>
                      <span style={{ color: "#a1a1aa", fontSize: 10, fontWeight: 800, letterSpacing: "0.07em" }}>
                        FECHA
                      </span>
                      <p style={{ color: "#d4d4d8", fontSize: 13, fontWeight: 700, margin: "7px 0 0" }}>
                        {today.toUpperCase()}
                      </p>
                    </div>
                  </div>
                  <div style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    marginTop: 14,
                    padding: "9px 12px",
                    border: `1px solid ${accentColor}88`,
                    borderRadius: 10,
                    color: accentColor,
                    background: `linear-gradient(135deg, ${accentSoft}, rgba(0,0,0,0.24))`,
                    fontSize: 12,
                    fontWeight: 900,
                    letterSpacing: "0.03em",
                  }}>
                    {isPositive ? "EN POSITIVO" : "EN NEGATIVO"}
                  </div>
                </div>

                <div style={{
                  width: 74,
                  height: 74,
                  background: "#ffffff",
                  borderRadius: 7,
                  padding: 6,
                  display: "grid",
                  placeItems: "center",
                  boxShadow: "0 0 26px rgba(255,255,255,0.15)",
                }}>
                  <QRCode
                    value={appUrl}
                    size={62}
                    bgColor="#ffffff"
                    fgColor="#09090b"
                    level="L"
                  />
                </div>
              </div>

              <div style={{
                display: "flex",
                justifyContent: "center",
                color: "#a1a1aa",
                fontSize: 11,
                fontWeight: 750,
                marginTop: 16,
                letterSpacing: "0.03em",
              }}>
                EVOLUCIÓN ODDSMARK · TERMINALPRO.APP
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="flex-1"
              data-testid="button-close-trend-share"
            >
              Cerrar
            </Button>
            <Button
              size="sm"
              onClick={handleShare}
              disabled={isGenerating}
              className="flex-1 gap-1.5"
              data-testid="button-share-trend"
            >
              {isGenerating ? (
                "Generando..."
              ) : (
                <>
                  <Share2 className="h-3.5 w-3.5" />
                  Compartir
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
