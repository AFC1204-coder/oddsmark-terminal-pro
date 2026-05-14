import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useMemo } from "react";
import { Filter, X, FlaskConical, BarChart3, Info } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip, ComposedChart, Line, Area, ReferenceLine } from "recharts";
import type { Bet } from "@shared/schema";
import { aggregateAvgOdds, aggregateBets, aggregateYield, aggregateWinRate } from "@/lib/bet-math";
import { calculateBetProfit } from "@/lib/bet-calculations";
import { maxDrawdownFor } from "@/lib/bankroll-series";
import { SegmentBreakdown } from "./SegmentBreakdown";
import { SegmentComparator } from "./SegmentComparator";
import { PnLHistogram } from "./PnLHistogram";
import { getDimension } from "@/lib/bet-dimensions";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  applyBetAnalysisFilters,
  buildYieldComparisonSeries,
  dateKeyToLocalTimestamp,
  getBetAnalysisTimestamp,
  getBetDisplayDate,
  getBetStakeUnits,
  hasAnyCashout,
  isBetSettled,
} from "@/lib/bet-analysis";

// Referenced by object identity so SegmentBreakdown's internal memo stays
// stable across re-renders of AnalyticsModal.
const leagueKey = getDimension("league").keyOf;
const marketKey = getDimension("market").keyOf;
const bookieKey = getDimension("bookie").keyOf;
const tipsterKey = getDimension("tipster").keyOf;
const betTypeKey = getDimension("betType").keyOf;
const oddsKey = getDimension("odds").keyOf;
const stakeKey = getDimension("stake").keyOf;

interface AnalyticsModalProps {
  open: boolean;
  onClose: () => void;
  bets: Bet[];
  initialCapital?: number;
}

type MetricInfoKey = "zscore" | "turnover" | "clv" | "recovery" | null;

const metricDefinitions: Record<Exclude<MetricInfoKey, null>, { title: string; description: string }> = {
  zscore: {
    title: "Z-Score",
    description: "Mide cuánto se aleja el resultado observado de una distribución esperada. Es más útil con muestras amplias; valores cercanos a 0 indican que la evidencia estadística todavía es limitada."
  },
  turnover: {
    title: "Turnover (rotación)",
    description: "Indica cuántas veces se ha apostado el capital inicial. Ayuda a leer volumen y exposición sin mezclarlo con depósitos o retiradas."
  },
  clv: {
    title: "CLV (Closing Line Value)",
    description: "Compara la cuota tomada con la cuota de cierre del mercado. Un CLV positivo indica que la cuota registrada fue superior a la de cierre en esa muestra."
  },
  recovery: {
    title: "Tiempo de recuperación medio",
    description: "Promedio de días necesarios para volver a superar un máximo histórico anterior después de entrar en drawdown."
  }
};

type ChartPeriod = "1S" | "1M" | "3M" | "YTD" | "ALL";

function formatUnitsCompact(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  if (Math.abs(rounded - Math.round(rounded)) < 0.005) {
    return `${Math.round(rounded)}U`;
  }
  return `${rounded.toFixed(2)}U`;
}

function CompactFilterSelect({
  label,
  value,
  options,
  onChange,
  testId,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  testId: string;
}) {
  if (options.length === 0) return null;

  return (
    <div className="min-w-0 space-y-1">
      <label className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</label>
      <Select value={value || "__all"} onValueChange={(next) => onChange(next === "__all" ? "" : next)}>
        <SelectTrigger className="h-8 w-full text-xs" data-testid={testId}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all" className="text-xs">Todos</SelectItem>
          {options.map(option => (
            <SelectItem key={option} value={option} className="text-xs">
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function AnalyticsModal({ open, onClose, bets, initialCapital = 0 }: AnalyticsModalProps) {
  const isMobile = useIsMobile();
  const [infoModal, setInfoModal] = useState<MetricInfoKey>(null);
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>("ALL");
  const [filters, setFilters] = useState({
    bookie: "",
    sport: "",
    league: "",
    tipster: "",
    isLive: "" as "" | "pre" | "live" | "longterm",
    marketType: "",
    position: "",
    formation: "",
    matchSide: "",
    statuses: [] as Array<"won" | "lost" | "pending" | "void">,
    cashoutType: "" as "" | "no_cashout" | "cashout_profit" | "cashout_loss",
    oddsMin: "",
    oddsMax: "",
    stakeMin: "",
    stakeMax: "",
  });

  const uniqueValues = useMemo(() => ({
    bookies: Array.from(new Set(bets.map(b => b.bookie).filter((b): b is string => Boolean(b)))),
    sports: Array.from(new Set(bets.map(b => b.sport).filter((s): s is string => Boolean(s)))),
    leagues: Array.from(new Set(bets.map(b => b.league).filter((l): l is string => Boolean(l)))),
    tipsters: Array.from(new Set(bets.map(b => b.tipster).filter((t): t is string => Boolean(t)))),
    marketTypes: Array.from(new Set(bets.map(b => b.marketType).filter((m): m is string => Boolean(m)))),
    positions: Array.from(new Set(bets.map(b => b.position).filter((p): p is string => Boolean(p)))),
    formations: Array.from(new Set(bets.map(b => b.formation).filter((f): f is string => Boolean(f)))),
    matchSides: Array.from(new Set(bets.map(b => b.matchSide).filter((s): s is string => Boolean(s)))),
  }), [bets]);

  const filteredBets = useMemo(() => {
    return applyBetAnalysisFilters(bets, filters);
  }, [bets, filters]);

  const stats = useMemo(() => {
    // Delegate counts/profit/stake to the SSOT — aggregateBets excludes void
    // from `settled` so the winrate denominator matches SegmentBreakdown and
    // the server-side /api/stats. Previously this block counted void as
    // settled, inflating the denominator and deflating the winrate.
    const agg = aggregateBets(filteredBets);
    const yieldPct = aggregateYield(agg);
    const winRate = aggregateWinRate(agg);
    const avgOdds = aggregateAvgOdds(agg);
    const profit = agg.profit;
    const wins = agg.wins;
    const settled = { length: agg.settled };

    return { profit, yieldPct, winRate, avgOdds, total: settled.length, wins };
  }, [filteredBets]);

  const isFiltered = useMemo(() => {
    return !!(
      filters.bookie || 
      filters.sport || 
      filters.league || 
      filters.tipster || 
      filters.isLive || 
      filters.marketType || 
      filters.position || 
      filters.formation || 
      filters.matchSide ||
      filters.statuses.length > 0 ||
      filters.cashoutType ||
      filters.oddsMin ||
      filters.oddsMax ||
      filters.stakeMin ||
      filters.stakeMax
    );
  }, [filters]);

  const filterLabel = useMemo(() => {
    const parts: string[] = [];
    
    if (filters.bookie) parts.push(filters.bookie);
    if (filters.sport) parts.push(filters.sport);
    if (filters.league) parts.push(filters.league);
    if (filters.tipster) parts.push(filters.tipster);
    if (filters.marketType) parts.push(filters.marketType);
    if (filters.position) parts.push(filters.position);
    if (filters.formation) parts.push(filters.formation);
    if (filters.matchSide) parts.push(filters.matchSide);
    
    if (filters.isLive === "pre") parts.push("Pre-evento");
    if (filters.isLive === "live") parts.push("Live");
    if (filters.isLive === "longterm") parts.push("Largo plazo");
    
    if (filters.cashoutType === "no_cashout") parts.push("Sin Cashout");
    if (filters.cashoutType === "cashout_profit") parts.push("Cashout +");
    if (filters.cashoutType === "cashout_loss") parts.push("Cashout -");
    
    if (filters.oddsMin || filters.oddsMax) {
      const min = filters.oddsMin || "1.00";
      const max = filters.oddsMax || "∞";
      parts.push(`@${min}-${max}`);
    }
    
    if (filters.stakeMin || filters.stakeMax) {
      const min = filters.stakeMin || "0";
      const max = filters.stakeMax || "∞";
      parts.push(`${min}U-${max}U`);
    }
    
    if (filters.statuses.length > 0) {
      const statusLabels: Record<string, string> = { won: "Ganadas", lost: "Perdidas", pending: "Pendientes", void: "Nulas" };
      parts.push(filters.statuses.map(s => statusLabels[s] || s).join("/"));
    }
    
    if (parts.length === 0) return "Total";
    if (parts.length <= 3) return parts.join(" • ");
    return `${parts.slice(0, 2).join(" • ")} + ${parts.length - 2} más`;
  }, [filters]);

  const comparisonChartData = useMemo(() => {
    return buildYieldComparisonSeries(bets, filteredBets, chartPeriod);
  }, [bets, filteredBets, chartPeriod]);

  const strategyHealth = useMemo(() => {
    const settled = filteredBets.filter(isBetSettled);
    if (settled.length === 0) return null;

    let totalWon = 0;
    let totalLost = 0;
    let wins = 0;
    let totalOdds = 0;
    const dailyProfits: { date: string; profit: number }[] = [];

    settled.forEach(bet => {
      const { profit, weightedOdds } = calculateBetProfit(bet);
      totalOdds += weightedOdds;
      if (profit > 0) wins++;

      if (profit > 0) totalWon += profit;
      else totalLost += Math.abs(profit);

      dailyProfits.push({ date: getBetDisplayDate(bet), profit });
    });

    const profitFactor = totalLost > 0 ? totalWon / totalLost : totalWon > 0 ? Infinity : 0;
    const strikeRate = (wins / settled.length) * 100;
    const avgOdds = totalOdds / settled.length;

    // maxRecoveryDays still walks the daily series (unique to this memo).
    // Max DD is sourced from maxDrawdownFor so all three UI surfaces
    // (StatsSection widget, this modal, A/B comparator) agree.
    const sortedByDate = [...dailyProfits].sort((a, b) => dateKeyToLocalTimestamp(a.date) - dateKeyToLocalTimestamp(b.date));
    let runningBalance = 0;
    let peak = 0;
    let underwaterStart: Date | null = null;
    let maxRecoveryDays = 0;

    sortedByDate.forEach(({ date, profit }) => {
      runningBalance += profit;
      if (runningBalance > peak) {
        peak = runningBalance;
        if (underwaterStart) {
          const recoveryDays = Math.floor((dateKeyToLocalTimestamp(date) - underwaterStart.getTime()) / (1000 * 60 * 60 * 24));
          if (recoveryDays > maxRecoveryDays) maxRecoveryDays = recoveryDays;
          underwaterStart = null;
        }
      } else if (!underwaterStart && peak - runningBalance > 0) {
        underwaterStart = new Date(dateKeyToLocalTimestamp(date));
      }
    });

    if (underwaterStart !== null) {
      const ongoingRecovery = Math.floor((new Date().getTime() - (underwaterStart as Date).getTime()) / (1000 * 60 * 60 * 24));
      if (ongoingRecovery > maxRecoveryDays) maxRecoveryDays = ongoingRecovery;
    }

    const maxDrawdownPct = maxDrawdownFor(filteredBets);

    return { profitFactor, maxDrawdownPct, maxRecoveryDays, strikeRate, avgOdds };
  }, [filteredBets]);

  const records = useMemo(() => {
    let maxWin = 0;
    let maxWinEvent = "-";
    let maxLoss = 0;
    let maxLossEvent = "-";

    filteredBets.forEach(bet => {
      if (!isBetSettled(bet)) return;
      const { profit } = calculateBetProfit(bet);

      if (profit > maxWin) {
        maxWin = profit;
        maxWinEvent = bet.event;
      }
      if (profit < maxLoss) {
        maxLoss = profit;
        maxLossEvent = bet.event;
      }
    });

    return { maxWin, maxWinEvent, maxLoss, maxLossEvent };
  }, [filteredBets]);

  const distributions = useMemo(() => {
    const sportDist: Record<string, number> = {};
    const statusDist = { won: 0, lost: 0, pending: 0 };
    const cashoutDist = { normal: 0, cashout: 0 };

    filteredBets.forEach(bet => {
      const stake = getBetStakeUnits(bet);
      sportDist[bet.sport] = (sportDist[bet.sport] || 0) + stake;
      if (bet.status in statusDist) {
        statusDist[bet.status as keyof typeof statusDist] += stake;
      }
      if (isBetSettled(bet)) {
        if (hasAnyCashout(bet)) cashoutDist.cashout++;
        else cashoutDist.normal++;
      }
    });

    const totalSportStake = Object.values(sportDist).reduce((a, b) => a + b, 0);
    const sportPcts = Object.entries(sportDist).map(([sport, stake]) => ({
      sport,
      pct: totalSportStake > 0 ? (stake / totalSportStake) * 100 : 0,
    })).sort((a, b) => b.pct - a.pct);

    return { sportPcts, statusDist, cashoutDist };
  }, [filteredBets]);

  const statusDistribution = useMemo(() => {
    const totalStake = Object.values(distributions.statusDist).reduce((sum, value) => sum + value, 0);
    const rows = [
      { key: "won", label: "Ganadas", value: distributions.statusDist.won, color: "text-win", bar: "bg-win", dot: "bg-win" },
      { key: "lost", label: "Perdidas", value: distributions.statusDist.lost, color: "text-loss", bar: "bg-loss", dot: "bg-loss" },
      { key: "pending", label: "Pendientes", value: distributions.statusDist.pending, color: "text-pending", bar: "bg-pending", dot: "bg-pending" },
    ] as const;

    return rows.map((row) => ({
      ...row,
      pct: totalStake > 0 ? (row.value / totalStake) * 100 : 0,
      formatted: formatUnitsCompact(row.value),
    }));
  }, [distributions.statusDist]);

  const advancedMetrics = useMemo(() => {
    // Exclude void from "settled" — a void bet contributed neither stake
    // nor profit, so it shouldn't bloat turnover/z-score denominators.
    const settled = filteredBets.filter(isBetSettled);
    if (settled.length === 0) return null;

    let totalStake = 0;
    let totalProfit = 0;
    const profits: number[] = [];

    settled.forEach(bet => {
      const { profit, totalStake: settledStake } = calculateBetProfit(bet);
      totalStake += settledStake;
      totalProfit += profit;
      profits.push(profit);
    });

    const currentBankroll = initialCapital + totalProfit;
    const turnover = currentBankroll > 0 ? totalStake / currentBankroll : (totalStake > 0 ? totalStake : 0);

    const betsWithCLV = settled.filter(b => b.closingOdds && b.closingOdds > 0);
    let clvPct = 0;
    if (betsWithCLV.length > 0) {
      const clvSum = betsWithCLV.reduce((sum, b) => {
        return sum + ((b.odds / b.closingOdds!) - 1);
      }, 0);
      clvPct = (clvSum / betsWithCLV.length) * 100;
    }

    const mean = profits.reduce((a, b) => a + b, 0) / profits.length;
    const stdDev = Math.sqrt(profits.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / profits.length);
    const zScore = stdDev > 0 ? (totalProfit / stdDev) / Math.sqrt(settled.length) : 0;

    let runningTotal = 0;
    let maxDrawdown = 0;
    let peak = 0;
    let inDrawdown = false;
    let drawdownStartDate: Date | null = null;
    const recoveryTimes: number[] = [];

    const sortedBets = [...settled].sort((a, b) => getBetAnalysisTimestamp(a) - getBetAnalysisTimestamp(b));
    sortedBets.forEach((bet) => {
      const { profit } = calculateBetProfit(bet);
      runningTotal += profit;
      
      if (runningTotal > peak) {
        if (inDrawdown && drawdownStartDate) {
          const recoveryDays = (getBetAnalysisTimestamp(bet) - drawdownStartDate.getTime()) / (1000 * 60 * 60 * 24);
          if (recoveryDays > 0) recoveryTimes.push(recoveryDays);
        }
        peak = runningTotal;
        inDrawdown = false;
        drawdownStartDate = null;
      }
      
      const drawdown = peak - runningTotal;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
        if (!inDrawdown) {
          inDrawdown = true;
          drawdownStartDate = new Date(getBetAnalysisTimestamp(bet));
        }
      }
    });

    const avgRecoveryTime = recoveryTimes.length > 0 
      ? recoveryTimes.reduce((a, b) => a + b, 0) / recoveryTimes.length 
      : 0;

    return { turnover, clvPct, zScore, avgRecoveryTime, betsWithCLV: betsWithCLV.length };
  }, [filteredBets, initialCapital]);

  const temporalData = useMemo(() => {
    const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    const byDay: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    const byHour: Record<number, number> = {};
    for (let i = 0; i < 24; i++) byHour[i] = 0;

    const settled = filteredBets.filter(isBetSettled);
    settled.forEach(bet => {
      const { profit } = calculateBetProfit(bet);
      const timestamp = getBetAnalysisTimestamp(bet);
      if (timestamp === 0) return;
      const betDate = new Date(timestamp);
      const dayOfWeek = betDate.getDay();
      byDay[dayOfWeek] += profit;

      if (bet.time) {
        const hour = parseInt(bet.time.split(":")[0], 10);
        if (!isNaN(hour) && hour >= 0 && hour < 24) {
          byHour[hour] += profit;
        }
      }
    });

    const dayData = Object.entries(byDay).map(([day, profit]) => ({
      name: dayNames[parseInt(day)],
      profit: Math.round(profit * 100) / 100,
      dayIndex: parseInt(day),
    }));
    const reorderedDayData = [...dayData.slice(1), dayData[0]];

    const hourData = Object.entries(byHour)
      .filter(([_, profit]) => profit !== 0)
      .map(([hour, profit]) => ({
        name: `${hour.padStart(2, "0")}h`,
        profit: Math.round(profit * 100) / 100,
        hour: parseInt(hour),
      }));

    const bestDay = reorderedDayData.reduce((best, curr) => curr.profit > best.profit ? curr : best, reorderedDayData[0]);
    const worstDay = reorderedDayData.reduce((worst, curr) => curr.profit < worst.profit ? curr : worst, reorderedDayData[0]);

    const hoursWithData = hourData.filter(h => h.profit !== 0);
    const bestHour = hoursWithData.length > 0 
      ? hoursWithData.reduce((best, curr) => curr.profit > best.profit ? curr : best, hoursWithData[0])
      : null;
    const worstHour = hoursWithData.length > 0 
      ? hoursWithData.reduce((worst, curr) => curr.profit < worst.profit ? curr : worst, hoursWithData[0])
      : null;

    return { dayData: reorderedDayData, hourData, bestDay, worstDay, bestHour, worstHour };
  }, [filteredBets]);

  const clearFilters = () => {
    setFilters({ bookie: "", sport: "", league: "", tipster: "", isLive: "", marketType: "", position: "", formation: "", matchSide: "", statuses: [], cashoutType: "", oddsMin: "", oddsMax: "", stakeMin: "", stakeMax: "" });
  };

  const hasFilters = Object.entries(filters).some(([key, v]) => {
    if (key === "statuses") return (v as string[]).length > 0;
    return v !== "";
  });
  const activeFilterCount = Object.entries(filters).filter(([key, v]) => {
    if (key === "statuses") return (v as string[]).length > 0;
    return v !== "";
  }).length;

  const toggleFilter = (key: keyof typeof filters, value: string) => {
    setFilters(f => ({ ...f, [key]: f[key] === value ? "" : value }));
  };

  const toggleStatus = (status: "won" | "lost" | "pending" | "void") => {
    setFilters(f => ({
      ...f,
      statuses: f.statuses.includes(status)
        ? f.statuses.filter(s => s !== status)
        : [...f.statuses, status]
    }));
  };

  const hasAdvancedFilters = uniqueValues.positions.length > 0 || 
    uniqueValues.formations.length > 0 || 
    uniqueValues.matchSides.length > 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[calc(100vw-0.5rem)] max-h-[94dvh] max-w-lg overflow-y-auto p-3 sm:w-[calc(100vw-1rem)] sm:max-w-2xl sm:p-6 lg:max-w-4xl">
        <DialogHeader className="pb-1">
	          <DialogTitle className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              Analítica
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {activeFilterCount} filtros
                </Badge>
              )}
            </div>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="w-full sm:w-auto" data-testid="button-clear-filters">
                <X className="h-3 w-3 mr-1" />
                Limpiar
              </Button>
            )}
	          </DialogTitle>
	          <DialogDescription className="sr-only">
	            Revisa métricas, segmentos, tendencias y comparativas del historial filtrado.
	          </DialogDescription>
        </DialogHeader>

        <Accordion type="multiple" className="w-full" defaultValue={["filters-basic"]}>
          <AccordionItem value="filters-basic">
            <AccordionTrigger className="text-sm py-2">
              <div className="flex items-center gap-2">
                <Filter className="h-3.5 w-3.5" />
                Filtros básicos
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3 pt-2">
                {hasFilters && (
                  <div className="rounded-lg border border-border bg-muted/25 px-2.5 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Filtro activo</p>
                    <p className="mt-0.5 truncate text-xs font-medium">{filterLabel}</p>
                  </div>
                )}

                <div className="rounded-lg border border-border/80 bg-card/40 p-2.5">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
                    <CompactFilterSelect
                      label="Deporte"
                      value={filters.sport}
                      options={uniqueValues.sports}
                      onChange={(value) => setFilters(f => ({ ...f, sport: value }))}
                      testId="select-filter-sport"
                    />
                    <CompactFilterSelect
                      label="Liga"
                      value={filters.league}
                      options={uniqueValues.leagues}
                      onChange={(value) => setFilters(f => ({ ...f, league: value }))}
                      testId="select-filter-league"
                    />
                    <CompactFilterSelect
                      label="Casa"
                      value={filters.bookie}
                      options={uniqueValues.bookies}
                      onChange={(value) => setFilters(f => ({ ...f, bookie: value }))}
                      testId="select-filter-bookie"
                    />
                    <CompactFilterSelect
                      label="Tipster"
                      value={filters.tipster}
                      options={uniqueValues.tipsters}
                      onChange={(value) => setFilters(f => ({ ...f, tipster: value }))}
                      testId="select-filter-tipster"
                    />
                    <CompactFilterSelect
                      label="Mercado"
                      value={filters.marketType}
                      options={uniqueValues.marketTypes}
                      onChange={(value) => setFilters(f => ({ ...f, marketType: value }))}
                      testId="select-filter-market"
                    />
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="rounded-lg border border-border/80 bg-card/40 p-2">
                    <p className="mb-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">Tipo</p>
                    <div className="grid grid-cols-3 gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant={filters.isLive === "pre" ? "default" : "outline"}
                        className="h-8 px-1.5 text-[10px]"
                        onClick={() => toggleFilter("isLive", "pre")}
                        data-testid="chip-pre"
                      >
                        Pre
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={filters.isLive === "live" ? "default" : "outline"}
                        className={`h-8 px-1.5 text-[10px] ${filters.isLive === "live" ? "bg-orange-500 border-orange-500" : ""}`}
                        onClick={() => toggleFilter("isLive", "live")}
                        data-testid="chip-live"
                      >
                        Live
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={filters.isLive === "longterm" ? "default" : "outline"}
                        className={`h-8 px-1.5 text-[10px] ${filters.isLive === "longterm" ? "bg-primary border-primary" : ""}`}
                        onClick={() => toggleFilter("isLive", "longterm")}
                        data-testid="chip-longterm"
                      >
                        Largo
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border/80 bg-card/40 p-2">
                    <p className="mb-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">Estado</p>
                    <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
                      <Button
                        type="button"
                        size="sm"
                        variant={filters.statuses.includes("won") ? "default" : "outline"}
                        className={`h-8 px-1 text-[10px] ${filters.statuses.includes("won") ? "bg-win text-win-foreground" : ""}`}
                        onClick={() => toggleStatus("won")}
                        data-testid="chip-status-won"
                      >
                        {isMobile ? "Ganadas" : "G"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={filters.statuses.includes("lost") ? "default" : "outline"}
                        className={`h-8 px-1 text-[10px] ${filters.statuses.includes("lost") ? "bg-loss text-loss-foreground" : ""}`}
                        onClick={() => toggleStatus("lost")}
                        data-testid="chip-status-lost"
                      >
                        {isMobile ? "Perdidas" : "P"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={filters.statuses.includes("pending") ? "default" : "outline"}
                        className={`h-8 px-1 text-[10px] ${filters.statuses.includes("pending") ? "bg-pending text-pending-foreground" : ""}`}
                        onClick={() => toggleStatus("pending")}
                        data-testid="chip-status-pending"
                      >
                        {isMobile ? "Pendientes" : "Pend."}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={filters.statuses.includes("void") ? "default" : "outline"}
                        className={`h-8 px-1 text-[10px] ${filters.statuses.includes("void") ? "bg-muted" : ""}`}
                        onClick={() => toggleStatus("void")}
                        data-testid="chip-status-void"
                      >
                        Nula
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border/80 bg-card/40 p-2">
                    <p className="mb-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">Cashout</p>
                    <div className="grid grid-cols-3 gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant={filters.cashoutType === "no_cashout" ? "default" : "outline"}
                        className={`h-8 px-1.5 text-[10px] ${filters.cashoutType === "no_cashout" ? "bg-muted" : ""}`}
                        onClick={() => setFilters(f => ({ ...f, cashoutType: f.cashoutType === "no_cashout" ? "" : "no_cashout" }))}
                        data-testid="chip-cashout-none"
                      >
                        {isMobile ? "Sin cashout" : "No"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={filters.cashoutType === "cashout_profit" ? "default" : "outline"}
                        className={`h-8 px-1.5 text-[10px] ${filters.cashoutType === "cashout_profit" ? "bg-win text-win-foreground" : ""}`}
                        onClick={() => setFilters(f => ({ ...f, cashoutType: f.cashoutType === "cashout_profit" ? "" : "cashout_profit" }))}
                        data-testid="chip-cashout-profit"
                      >
                        {isMobile ? "Profit" : "+"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={filters.cashoutType === "cashout_loss" ? "default" : "outline"}
                        className={`h-8 px-1.5 text-[10px] ${filters.cashoutType === "cashout_loss" ? "bg-loss text-loss-foreground" : ""}`}
                        onClick={() => setFilters(f => ({ ...f, cashoutType: f.cashoutType === "cashout_loss" ? "" : "cashout_loss" }))}
                        data-testid="chip-cashout-loss"
                      >
                        {isMobile ? "Loss" : "-"}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-lg border border-border/80 bg-card/40 p-2">
                    <p className="mb-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">Cuota</p>
                    <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      min="1"
                      placeholder="Min (ej: 1.50)"
                      value={filters.oddsMin}
                      onChange={(e) => setFilters(f => ({ ...f, oddsMin: e.target.value }))}
                      className="text-xs font-mono h-8"
                      data-testid="input-analytics-odds-min"
                    />
                    <Input
                      type="number"
                      step="0.01"
                      min="1"
                      placeholder="Max (ej: 2.50)"
                      value={filters.oddsMax}
                      onChange={(e) => setFilters(f => ({ ...f, oddsMax: e.target.value }))}
                      className="text-xs font-mono h-8"
                      data-testid="input-analytics-odds-max"
                    />
                  </div>
                  </div>

                  <div className="rounded-lg border border-border/80 bg-card/40 p-2">
                    <p className="mb-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">Stake (U)</p>
                    <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="number"
                      step="0.5"
                      min="0"
                      placeholder="Min (ej: 1U)"
                      value={filters.stakeMin}
                      onChange={(e) => setFilters(f => ({ ...f, stakeMin: e.target.value }))}
                      className="text-xs font-mono h-8"
                      data-testid="input-analytics-stake-min"
                    />
                    <Input
                      type="number"
                      step="0.5"
                      min="0"
                      placeholder="Max (ej: 5U)"
                      value={filters.stakeMax}
                      onChange={(e) => setFilters(f => ({ ...f, stakeMax: e.target.value }))}
                      className="text-xs font-mono h-8"
                      data-testid="input-analytics-stake-max"
                    />
                  </div>
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="filters-advanced">
            <AccordionTrigger className="text-sm py-2">
              <div className="flex items-center gap-2">
                <Filter className="h-3.5 w-3.5" />
                Filtros avanzados (fútbol)
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3 pt-2">
                {uniqueValues.positions.length > 0 ? (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">Posicion</p>
                    <div className="flex flex-wrap gap-1.5">
                      {uniqueValues.positions.map(p => (
                        <Badge
                          key={p}
                          variant={filters.position === p ? "secondary" : "outline"}
                          className="cursor-pointer text-xs"
                          onClick={() => toggleFilter("position", p)}
                          data-testid={`chip-position-${p}`}
                        >
                          {p}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">Posicion</p>
                    <p className="text-xs text-muted-foreground/50 italic">Sin datos</p>
                  </div>
                )}
                {uniqueValues.formations.length > 0 ? (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">Formacion</p>
                    <div className="flex flex-wrap gap-1.5">
                      {uniqueValues.formations.map(f => (
                        <Badge
                          key={f}
                          variant={filters.formation === f ? "secondary" : "outline"}
                          className="cursor-pointer text-xs"
                          onClick={() => toggleFilter("formation", f)}
                          data-testid={`chip-formation-${f}`}
                        >
                          {f}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">Formacion</p>
                    <p className="text-xs text-muted-foreground/50 italic">Sin datos</p>
                  </div>
                )}
                {uniqueValues.matchSides.length > 0 ? (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">Lado del Partido</p>
                    <div className="flex flex-wrap gap-1.5">
                      {uniqueValues.matchSides.map(s => (
                        <Badge
                          key={s}
                          variant={filters.matchSide === s ? "secondary" : "outline"}
                          className="cursor-pointer text-xs"
                          onClick={() => toggleFilter("matchSide", s)}
                          data-testid={`chip-matchSide-${s}`}
                        >
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">Lado del Partido</p>
                    <p className="text-xs text-muted-foreground/50 italic">Sin datos</p>
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {hasFilters && (
          <p className="text-xs text-muted-foreground">
            Mostrando {filteredBets.length} de {bets.length} apuestas
          </p>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mt-2">
          <Card className="py-3">
            <CardContent className="px-4 py-0">
              <p className="text-xs text-muted-foreground">P&L</p>
              <p className={`text-xl font-mono font-semibold ${stats.profit >= 0 ? "text-win" : "text-loss"}`}>
                {stats.profit >= 0 ? "+" : ""}{stats.profit.toFixed(2)}U
              </p>
            </CardContent>
          </Card>

          <Card className="py-3">
            <CardContent className="px-4 py-0">
              <p className="text-xs text-muted-foreground">Yield</p>
              <p className={`text-xl font-mono font-semibold ${stats.yieldPct >= 0 ? "text-win" : "text-loss"}`}>
                {stats.yieldPct >= 0 ? "+" : ""}{stats.yieldPct.toFixed(1)}%
              </p>
            </CardContent>
          </Card>

          <Card className="py-3">
            <CardContent className="px-4 py-0">
              <p className="text-xs text-muted-foreground">Acierto</p>
              <p className="text-xl font-mono font-semibold">
                {stats.winRate.toFixed(0)}%
              </p>
            </CardContent>
          </Card>

          <Card className="py-3">
            <CardContent className="px-4 py-0">
              <p className="text-xs text-muted-foreground">Balance</p>
              <p className="text-xl font-mono font-semibold">
                <span className="text-win">{stats.wins}</span>
                <span className="text-muted-foreground mx-1">/</span>
                <span className="text-loss">{stats.total - stats.wins}</span>
              </p>
            </CardContent>
          </Card>
        </div>

        {isFiltered && comparisonChartData.length >= 2 && (
          <Card className="mt-4 py-3 overflow-hidden" data-testid="card-comparison-chart">
            <CardContent className="px-4 py-0">
              <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                  Comparativa Yield % (Global vs Filtro)
                </p>
                <div className="flex gap-1 overflow-x-auto scrollbar-hide max-w-full">
                  {(["1S", "1M", "3M", "YTD", "ALL"] as ChartPeriod[]).map((period) => (
                    <Button
                      key={period}
                      size="sm"
                      variant={chartPeriod === period ? "default" : "ghost"}
                      className="h-6 px-2 text-xs font-mono"
                      onClick={() => setChartPeriod(period)}
                      data-testid={`button-period-${period.toLowerCase()}`}
                    >
                      {period}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="h-48 sm:h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={comparisonChartData} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
                    <defs>
                      <linearGradient id="filteredGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} 
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                      tickFormatter={(value) => {
                        const d = new Date(value);
                        return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" });
                      }}
                    />
                    <YAxis 
                      tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} 
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `${v.toFixed(0)}%`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(0 0% 12%)",
                        border: "none",
                        borderRadius: "8px",
                        color: "hsl(0 0% 98%)",
                        fontSize: "12px",
                        fontFamily: "JetBrains Mono",
                      }}
                      formatter={(value: number, name: string) => [
                        `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`,
                        name === "Yield global" ? "Yield global" : `Yield ${filterLabel}`
                      ]}
                      labelStyle={{ color: "hsl(0 0% 65%)" }}
                    />
                    <ReferenceLine
                      y={0}
                      stroke="hsl(0 0% 40%)"
                      strokeDasharray="4 4"
                      strokeWidth={1}
                    />
                    <Line
                      type="monotone"
                      dataKey="globalYield"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={false}
                      name="Yield global"
                    />
                    <Line
                      type="monotone"
                      dataKey="filteredYield"
                      stroke="#06b6d4"
                      strokeWidth={3}
                      dot={false}
                      name={`Yield ${filterLabel}`}
                      style={{ filter: 'drop-shadow(0 0 6px rgba(6,182,212,0.5))' }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 flex flex-col gap-2 text-xs sm:flex-row sm:flex-wrap sm:justify-center sm:gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-[#10b981] rounded-full"></span>
                  <span className="text-muted-foreground">Yield global</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-[#06b6d4] rounded-full"></span>
                  <span className="text-muted-foreground truncate max-w-48">Yield {filterLabel}</span>
                </div>
              </div>

              {strategyHealth && (
                <div className="mt-4 pt-3 border-t border-border">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-2">
                    Lectura del filtro
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    <div className="text-center p-2 bg-muted/30 rounded-md">
                      <p className={`text-lg font-mono font-semibold ${strategyHealth.profitFactor >= 1 ? "text-win" : "text-loss"}`}>
                        {strategyHealth.profitFactor === Infinity ? "∞" : strategyHealth.profitFactor.toFixed(2)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Profit factor</p>
                    </div>
                    <div className="text-center p-2 bg-muted/30 rounded-md">
                      <p className="text-lg font-mono font-semibold text-loss">
                        {strategyHealth.maxDrawdownPct.toFixed(1)}%
                      </p>
                      <p className="text-[10px] text-muted-foreground">DD máx.</p>
                    </div>
                    <div className="text-center p-2 bg-muted/30 rounded-md">
                      <p className="text-lg font-mono font-semibold text-amber-500">
                        {strategyHealth.maxRecoveryDays}d
                      </p>
                      <p className="text-[10px] text-muted-foreground">Recuperación máx.</p>
                    </div>
                    <div className="text-center p-2 bg-muted/30 rounded-md">
                      <p className="text-lg font-mono font-semibold">
                        {strategyHealth.strikeRate.toFixed(0)}%
                      </p>
                      <p className="text-[10px] text-muted-foreground">Acierto</p>
                    </div>
                    <div className="text-center p-2 bg-muted/30 rounded-md">
                      <p className="text-lg font-mono font-semibold text-cyan-500">
                        {strategyHealth.avgOdds.toFixed(2)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Cuota media</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="mt-4 space-y-4">
          <div>
            <h3 className="text-sm font-medium mb-2">Distribución por Deporte</h3>
            <div className="space-y-2">
              {distributions.sportPcts.slice(0, 5).map(({ sport, pct }) => (
                <div key={sport} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-16 truncate">{sport}</span>
                  <Progress value={pct} className="flex-1 h-2" />
                  <span className="text-xs font-mono w-10 text-right">{pct.toFixed(0)}%</span>
                </div>
              ))}
              {distributions.sportPcts.length === 0 && (
                <p className="text-xs text-muted-foreground">Sin datos</p>
              )}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-end justify-between gap-3">
              <h3 className="text-sm font-medium">Distribución por estado</h3>
              <span className="text-[10px] text-muted-foreground">Stake total</span>
            </div>
            <div className="surface-subtle space-y-2 rounded-lg p-3">
              {statusDistribution.map((row) => (
                <div key={row.key} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${row.dot}`} />
                      <span className="truncate text-xs font-medium text-foreground">{row.label}</span>
                    </div>
                    <div className="flex shrink-0 items-baseline gap-2">
                      <span className={`font-mono text-sm font-semibold tabular-nums ${row.color}`}>{row.formatted}</span>
                      <span className="w-10 text-right font-mono text-[10px] text-muted-foreground">{row.pct.toFixed(0)}%</span>
                    </div>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className={`h-full rounded-full ${row.bar}`} style={{ width: `${Math.max(0, Math.min(100, row.pct))}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2">Tipo de Cierre</h3>
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-foreground"></span>
                <span className="text-muted-foreground">Normal:</span>
                <span className="font-mono">{distributions.cashoutDist.normal}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cashout"></span>
                <span className="text-muted-foreground">Cashout:</span>
                <span className="font-mono">{distributions.cashoutDist.cashout}</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2">Resultados extremos</h3>

            <Card className="py-3 mb-2">
              <CardContent className="px-4 py-0">
                <div className="flex justify-between items-center gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Mayor resultado positivo</p>
                    <p className="text-sm truncate">{records.maxWinEvent}</p>
                  </div>
                  <p className="text-win font-mono font-semibold flex-shrink-0">
                    +{records.maxWin.toFixed(2)}U
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="py-3">
              <CardContent className="px-4 py-0">
                <div className="flex justify-between items-center gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Mayor resultado negativo</p>
                    <p className="text-sm truncate">{records.maxLossEvent}</p>
                  </div>
                  <p className="text-loss font-mono font-semibold flex-shrink-0">
                    {records.maxLoss.toFixed(2)}U
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Lazy: Radix Accordion mounts children only while the panel is open. */}
        <Accordion type="multiple" className="w-full mt-4">
          <AccordionItem value="distribution">
            <AccordionTrigger className="text-sm py-2">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-3.5 w-3.5" />
                Distribución de resultados
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="pt-2">
                <PnLHistogram bets={filteredBets} testId="pnl-histogram" />
              </div>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="comparator">
            <AccordionTrigger className="text-sm py-2">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-3.5 w-3.5" />
                Comparador A/B
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="pt-2">
                <SegmentComparator bets={filteredBets} testId="segment-comparator" />
              </div>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="segments">
            <AccordionTrigger className="text-sm py-2">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-3.5 w-3.5" />
                Segmentación ({filteredBets.length} apuestas)
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-6 pt-2">
                <SegmentBreakdown bets={filteredBets} title="Por Liga" keyOf={leagueKey} testId="segment-league" />
                <SegmentBreakdown bets={filteredBets} title="Por Mercado" keyOf={marketKey} testId="segment-market" />
                <SegmentBreakdown bets={filteredBets} title="Por Casa de Apuestas" keyOf={bookieKey} testId="segment-bookie" />
                <SegmentBreakdown bets={filteredBets} title="Por Tipster" keyOf={tipsterKey} testId="segment-tipster" />
                <SegmentBreakdown bets={filteredBets} title="Por Tipo de Apuesta" keyOf={betTypeKey} topN={5} testId="segment-bet-type" />
                <SegmentBreakdown
                  bets={filteredBets}
                  title="Por Rango de Cuota"
                  keyOf={oddsKey}
                  topN={6}
                  defaultMetric="yield"
                  allowedMetrics={["yield", "winrate", "count"]}
                  testId="segment-odds"
                />
                <SegmentBreakdown
                  bets={filteredBets}
                  title="Por Tamaño de Stake"
                  keyOf={stakeKey}
                  topN={6}
                  defaultMetric="yield"
                  allowedMetrics={["yield", "winrate", "count"]}
                  testId="segment-stake"
                />
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <Accordion type="single" collapsible className="w-full mt-4">
          <AccordionItem value="metrics-lab">
            <AccordionTrigger className="text-sm py-2">
              <div className="flex items-center gap-2">
                <FlaskConical className="h-3.5 w-3.5" />
                Metrics Lab
              </div>
            </AccordionTrigger>
            <AccordionContent>
              {advancedMetrics ? (
                <div className="space-y-4 pt-2">
                  <div className="grid grid-cols-2 gap-3">
                    <Card className="py-3">
                      <CardContent className="px-4 py-0">
                        <div className="flex items-center gap-1">
                          <p className="text-xs text-muted-foreground">Turnover</p>
                          <button
                            type="button"
                            onClick={() => setInfoModal("turnover")}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                            data-testid="button-info-turnover"
                          >
                            <Info className="h-3 w-3" />
                          </button>
                        </div>
                        <p className="text-lg font-mono font-semibold">
                          {advancedMetrics.turnover.toFixed(1)}x
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="py-3">
                      <CardContent className="px-4 py-0">
                        <div className="flex items-center gap-1">
                          <p className="text-xs text-muted-foreground">Z-Score</p>
                          <button
                            type="button"
                            onClick={() => setInfoModal("zscore")}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                            data-testid="button-info-zscore"
                          >
                            <Info className="h-3 w-3" />
                          </button>
                        </div>
                        <p className={`text-lg font-mono font-semibold ${advancedMetrics.zScore >= 0 ? "text-win" : "text-loss"}`}>
                          {advancedMetrics.zScore >= 0 ? "+" : ""}{advancedMetrics.zScore.toFixed(2)}
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="py-3">
                      <CardContent className="px-4 py-0">
                        <div className="flex items-center gap-1">
                          <p className="text-xs text-muted-foreground">CLV Medio</p>
                          <button
                            type="button"
                            onClick={() => setInfoModal("clv")}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                            data-testid="button-info-clv"
                          >
                            <Info className="h-3 w-3" />
                          </button>
                        </div>
                        <p className={`text-lg font-mono font-semibold ${advancedMetrics.clvPct >= 0 ? "text-win" : "text-loss"}`}>
                          {advancedMetrics.clvPct >= 0 ? "+" : ""}{advancedMetrics.clvPct.toFixed(1)}%
                        </p>
                        <p className="text-xs text-muted-foreground">{advancedMetrics.betsWithCLV} apuestas</p>
                      </CardContent>
                    </Card>
                    <Card className="py-3">
                      <CardContent className="px-4 py-0">
                        <div className="flex items-center gap-1">
                          <p className="text-xs text-muted-foreground">Tiempo Recup.</p>
                          <button
                            type="button"
                            onClick={() => setInfoModal("recovery")}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                            data-testid="button-info-recovery"
                          >
                            <Info className="h-3 w-3" />
                          </button>
                        </div>
                        <p className="text-lg font-mono font-semibold">
                          {advancedMetrics.avgRecoveryTime > 0 ? `${advancedMetrics.avgRecoveryTime.toFixed(0)}d` : "-"}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Card className="py-3">
                      <CardContent className="px-4 py-0">
                        <p className="text-xs text-muted-foreground">Mayor P&L temporal</p>
                        <p className="text-sm font-semibold text-win">
                          {temporalData.bestDay.name} ({temporalData.bestDay.profit >= 0 ? "+" : ""}{temporalData.bestDay.profit.toFixed(1)}U)
                        </p>
                        {temporalData.bestHour && (
                          <p className="text-xs text-muted-foreground">
                            {temporalData.bestHour.name} ({temporalData.bestHour.profit >= 0 ? "+" : ""}{temporalData.bestHour.profit.toFixed(1)}U)
                          </p>
                        )}
                      </CardContent>
                    </Card>
                    <Card className="py-3">
                      <CardContent className="px-4 py-0">
                        <p className="text-xs text-muted-foreground">Menor P&L temporal</p>
                        <p className="text-sm font-semibold text-loss">
                          {temporalData.worstDay.name} ({temporalData.worstDay.profit >= 0 ? "+" : ""}{temporalData.worstDay.profit.toFixed(1)}U)
                        </p>
                        {temporalData.worstHour && (
                          <p className="text-xs text-muted-foreground">
                            {temporalData.worstHour.name} ({temporalData.worstHour.profit >= 0 ? "+" : ""}{temporalData.worstHour.profit.toFixed(1)}U)
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <BarChart3 className="h-3.5 w-3.5" />
                      P&L por día
                    </h4>
                    <div className="h-32">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={temporalData.dayData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                          <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "6px" }}
                            labelStyle={{ color: "hsl(var(--foreground))" }}
                            formatter={(value: number) => [`${value >= 0 ? "+" : ""}${value.toFixed(2)}U`, "P&L"]}
                          />
                          <Bar dataKey="profit" radius={[4, 4, 0, 0]}>
                            {temporalData.dayData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.profit >= 0 ? "hsl(var(--win))" : "hsl(var(--loss))"} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {temporalData.hourData.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                        <BarChart3 className="h-3.5 w-3.5" />
                        P&L por hora
                      </h4>
                      <div className="h-32">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={temporalData.hourData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                            <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                            <Tooltip 
                              contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "6px" }}
                              labelStyle={{ color: "hsl(var(--foreground))" }}
                              formatter={(value: number) => [`${value >= 0 ? "+" : ""}${value.toFixed(2)}U`, "P&L"]}
                            />
                            <Bar dataKey="profit" radius={[4, 4, 0, 0]}>
                              {temporalData.hourData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.profit >= 0 ? "hsl(var(--win))" : "hsl(var(--loss))"} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Sin datos suficientes para calcular métricas avanzadas
                </p>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </DialogContent>

      <Dialog open={infoModal !== null} onOpenChange={() => setInfoModal(null)}>
        <DialogContent className="max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="h-4 w-4" />
              {infoModal && metricDefinitions[infoModal].title}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {infoModal && metricDefinitions[infoModal].description}
          </p>
          <Button 
            onClick={() => setInfoModal(null)} 
            className="w-full mt-2"
            data-testid="button-close-info-modal"
          >
            Cerrar
          </Button>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
