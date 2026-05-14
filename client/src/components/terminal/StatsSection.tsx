import { useMemo, useState, useCallback, Component, type ReactNode } from "react";
import {
  aggregateAvgOdds,
  aggregateAvgStake,
  aggregateBets,
  aggregateWinRate,
  aggregateYield,
} from "@/lib/bet-math";
import { calculateBetProfit } from "@/lib/bet-calculations";
import { buildBankrollSeries, maxDrawdownFor, type BankrollPoint } from "@/lib/bankroll-series";
import { getBetAnalysisTimestamp, getBetDisplayDate } from "@/lib/bet-analysis";
import { buildDecisionFacts } from "@/lib/decision-insights";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Minus, BarChart3, ChevronUp, AlertTriangle, Wallet, Filter, Share2, MoreHorizontal, Info, Maximize2, Minimize2 } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Brush, Line, ComposedChart, ReferenceLine, CartesianGrid } from "recharts";
import { useWidgets, type WidgetId } from "@/contexts/WidgetContext";
import { cn } from "@/lib/utils";
import type { Bet, UserConfig, Transaction } from "@shared/schema";
import { TrendShareCard } from "@/components/share/TrendShareCard";
import { getChartSharePeriodLabel } from "@/lib/chart-share-period";
import { isSameDay, isWithinInterval, subDays, subMonths, subYears, startOfYear, startOfDay } from "date-fns";
import { useLocalState } from "@/hooks/use-local-state";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

class ChartErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Chart Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
          <AlertTriangle className="h-4 w-4 mr-2" />
          No se pudo cargar la gráfica
        </div>
      );
    }
    return this.props.children;
  }
}

type TimePeriod = "1D" | "1W" | "1M" | "3M" | "6M" | "1Y" | "ALL";
type WidgetPeriod = "1D" | "1S" | "1M" | "All";
type ChartMode = "banca" | "rendimiento" | "roi" | "roi-rolling" | "drawdown";

const parseLocalDate = (dateStr: string): Date | null => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
};

const toIsoDate = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function InfoHint({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-5 w-5 rounded-full text-muted-foreground hover:text-foreground"
          aria-label={label}
        >
          <Info className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 text-xs leading-relaxed">
        {children}
      </PopoverContent>
    </Popover>
  );
}

/**
 * Opening anchor date for a chart: the day BEFORE the earliest candidate,
 * or today if no candidates exist. The chart's first point sits here so the
 * baseline value lines up on the real timeline instead of a synthetic label.
 */
const resolveOpeningDate = (candidateDates: Array<string | null | undefined>): string => {
  const earliest = candidateDates
    .filter((d): d is string => !!d)
    .sort()[0];
  if (!earliest) return toIsoDate(new Date());
  const parsed = parseLocalDate(earliest);
  if (!parsed) return earliest;
  return toIsoDate(subDays(parsed, 1));
};

const formatShortDate = (date: string): string => {
  const d = parseLocalDate(date);
  if (!d) return date;
  const formatted = d.toLocaleDateString("es-ES", { day: "numeric", month: "short" }).replace(".", "");
  return formatted.replace(/(\s)(\w)/, (_, space, letter) => space + letter.toUpperCase());
};

const formatDateByPeriod = (date: string, period: TimePeriod): string => {
  const d = parseLocalDate(date);
  if (!d) return date;
  
  switch (period) {
    case "1D":
      return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
    case "1W":
    case "1M":
      return formatShortDate(date);
    case "3M":
    case "6M":
    case "1Y":
    case "ALL":
    default:
      return formatShortDate(date);
  }
};

interface StatsSectionProps {
  bets: Bet[];
  allBets?: Bet[];
  config: UserConfig | null;
  currency: "units" | "money";
  onCurrencyToggle: () => void;
  onOpenAddWidget: () => void;
  transactions?: Transaction[];
  onOpenTransaction?: () => void;
  onOpenWallet?: () => void;
  onOpenFilter?: () => void;
  onOpenNewBet?: () => void;
  isFiltered?: boolean;
  /**
   * ISO date (YYYY-MM-DD) of the earliest bet with `verified = true`.
   * When provided and visible inside the current period, the chart draws
   * a dashed vertical line at that point labelled "verificadas" so the
   * user can tell at a glance which part of their equity curve is backed
   * by cryptographic verification and which predates it.
   */
  firstVerifiedDate?: string | null;
}

interface WidgetWrapperProps {
  id: WidgetId;
  children: React.ReactNode;
  className?: string;
  testId?: string;
  hasCollapsibleControls?: boolean;
}

function WidgetWrapper({ id, children, className, testId, hasCollapsibleControls = false }: WidgetWrapperProps) {
  const { hideWidget, isVisible, isCollapsed, toggleCollapse } = useWidgets();

  if (!isVisible(id)) {
    return null;
  }

  const collapsed = isCollapsed(id);

  return (
    <Card className={cn("py-1.5 relative group h-full flex flex-col overflow-hidden", className)} data-testid={testId}>
      <div className="absolute top-1 right-1 flex gap-0.5 z-10">
        {hasCollapsibleControls && (
          <Button
            size="icon"
            variant="ghost"
            className="h-5 w-5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              toggleCollapse(id);
            }}
            data-testid={`button-collapse-${id}`}
          >
            <ChevronUp className={`h-3 w-3 transition-transform ${collapsed ? "rotate-180" : ""}`} />
          </Button>
        )}
        <Button
          size="icon"
          variant="ghost"
          className="h-5 w-5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            hideWidget(id);
          }}
          data-testid={`button-hide-${id}`}
        >
          <Minus className="h-3 w-3" />
        </Button>
      </div>
      <CardContent className="px-2.5 py-0 flex-1 flex flex-col">
        {children}
      </CardContent>
    </Card>
  );
}

const widgetPeriods: WidgetPeriod[] = ["1D", "1S", "1M", "All"];

function filterBetsByWidgetPeriod(bets: Bet[], period: WidgetPeriod): Bet[] {
  if (period === "All") return bets;
  
  const now = new Date();
  const todayStart = startOfDay(now);
  
  // Rolling windows por días completos (incluye el día actual)
  // 1S = últimos 7 días: hoy + 6 días anteriores
  // 1M = últimos 30 días: hoy + 29 días anteriores
  const weekStart = startOfDay(subDays(todayStart, 6));  // 6 días atrás + hoy = 7 días
  const monthStart = startOfDay(subDays(todayStart, 29)); // 29 días atrás + hoy = 30 días
  
  return bets.filter(b => {
    const dateStr = getBetDisplayDate(b);
    if (!dateStr) return false;
    const betDate = parseLocalDate(dateStr);
    if (!betDate) return false;
    const betDayStart = startOfDay(betDate);
    
    // Excluir fechas futuras
    if (betDayStart > todayStart) return false;
    
    switch (period) {
      case "1D": 
        return isSameDay(betDayStart, todayStart);
      case "1S": 
        // Ventana móvil: desde hace 7 días hasta hoy (inclusive ambos extremos)
        return betDayStart >= weekStart && betDayStart <= todayStart;
      case "1M": 
        // Ventana móvil: desde hace 30 días hasta hoy (inclusive ambos extremos)
        return betDayStart >= monthStart && betDayStart <= todayStart;
      default: 
        return true;
    }
  });
}

interface MiniTabsProps {
  value: WidgetPeriod;
  onChange: (period: WidgetPeriod) => void;
  widgetId: string;
  hidden?: boolean;
}

function MiniTabs({ value, onChange, widgetId, hidden }: MiniTabsProps) {
  if (hidden) return null;
  return (
    <div className="flex gap-0.5 mt-0.5">
      {widgetPeriods.map((period) => (
        <button
          key={period}
          className={cn(
            "px-1.5 py-0.5 text-[9px] font-mono rounded transition-colors",
            value === period 
              ? "bg-muted text-foreground" 
              : "text-muted-foreground hover:text-foreground"
          )}
          onClick={(e) => {
            e.stopPropagation();
            onChange(period);
          }}
          data-testid={`button-${widgetId}-${period}`}
        >
          {period}
        </button>
      ))}
    </div>
  );
}

interface ChartTooltipPayload {
  name?: string;
  value?: number | string;
  payload?: Partial<BankrollPoint> & {
    globalBankroll?: number | null;
    globalProfit?: number | null;
  };
}

function ChartTooltipContent({
  active,
  label,
  payload,
  chartMode,
  rollingWindowDays,
  currency,
  isPercentMode,
}: {
  active?: boolean;
  label?: string | number;
  payload?: ChartTooltipPayload[];
  chartMode: ChartMode;
  rollingWindowDays: number;
  currency: "units" | "money";
  isPercentMode: boolean;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const mainEntry = payload.find((entry) => entry.name !== "globalBankroll" && entry.name !== "globalProfit") ?? payload[0];
  const point = mainEntry.payload;
  const metricLabel =
    chartMode === "banca" ? "Banca"
    : chartMode === "rendimiento" ? "P&L"
    : chartMode === "roi" ? "Yield"
    : chartMode === "roi-rolling" ? `Yield ${rollingWindowDays}d`
    : "Drawdown";
  const suffix = isPercentMode ? "%" : (currency === "money" ? "€" : "U");
  const metricValue = Number(mainEntry.value ?? 0);
  const betCount = point?.betCount ?? 0;
  const stake = point?.stake ?? 0;
  const globalEntry = payload.find((entry) => entry.name === "globalProfit" || entry.name === "globalBankroll");

  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg">
      <p className="mb-1 font-medium text-muted-foreground">
        {formatShortDate(String(label ?? ""))}
      </p>
      <p>
        {metricLabel}: <span className="font-mono font-semibold">{metricValue}{suffix}</span>
      </p>
      {betCount > 0 && (
        <p className="mt-1">
          Apuestas: <span className="font-mono font-semibold">{betCount}</span>
        </p>
      )}
      {stake > 0 && (
        <p>
          Volumen:{" "}
          <span className="font-mono font-semibold">
            {stake.toFixed(stake % 1 === 0 ? 0 : 1)}
            {currency === "money" ? "€" : "U"}
          </span>
        </p>
      )}
      {globalEntry && typeof globalEntry.value === "number" && (
        <p className="mt-1 text-muted-foreground">
          Global: <span className="font-mono">{globalEntry.value}{currency === "money" ? "€" : "U"}</span>
        </p>
      )}
    </div>
  );
}

export function StatsSection({
  bets,
  allBets,
  config,
  currency,
  onCurrencyToggle,
  onOpenAddWidget,
  transactions = [],
  onOpenTransaction,
  onOpenWallet,
  onOpenFilter,
  onOpenNewBet,
  isFiltered = false,
  firstVerifiedDate = null,
}: StatsSectionProps) {
  const { isVisible, hiddenWidgets, hideWidget, isCollapsed } = useWidgets();
  const unitValue = config?.unitValue || 10;
  // Chart preferences persist to localStorage so a power user who configures
  // a period, mode or aggregation once doesn't have to reset it every reload.
  const isChartMode = (v: unknown): v is ChartMode =>
    v === "banca" || v === "rendimiento" || v === "roi" || v === "roi-rolling" || v === "drawdown";
  const isTimePeriod = (v: unknown): v is TimePeriod =>
    v === "1D" || v === "1W" || v === "1M" || v === "3M" || v === "6M" || v === "1Y" || v === "ALL";
  const isAggregation = (v: unknown): v is "day" | "bet" => v === "day" || v === "bet";
  const isRollingWindow = (v: unknown): v is 30 | 60 | 90 => v === 30 || v === 60 || v === 90;

  const [timePeriod, setTimePeriod] = useLocalState<TimePeriod>("tp-chart-period", "ALL", isTimePeriod);
  const [chartMode, setChartMode] = useLocalState<ChartMode>("tp-chart-mode", "banca", isChartMode);
  const [chartAggregation, setChartAggregation] = useLocalState<"day" | "bet">("tp-chart-aggregation", "day", isAggregation);
  const [rollingWindowDays, setRollingWindowDays] = useLocalState<30 | 60 | 90>("tp-chart-rolling-window", 30, isRollingWindow);

  const [profitPeriod, setProfitPeriod] = useState<WidgetPeriod>("All");
  const [yieldPeriod, setYieldPeriod] = useState<WidgetPeriod>("All");
  const [winratePeriod, setWinratePeriod] = useState<WidgetPeriod>("All");
  const [recordPeriod, setRecordPeriod] = useState<WidgetPeriod>("All");
  const [streakPeriod, setStreakPeriod] = useState<WidgetPeriod>("All");
  const [avgExpPeriod, setAvgExpPeriod] = useState<WidgetPeriod>("All");
  const [isChartShareOpen, setIsChartShareOpen] = useState(false);
  const [isChartExpanded, setIsChartExpanded] = useState(false);

  const timePeriods: TimePeriod[] = ["1D", "1W", "1M", "3M", "6M", "1Y", "ALL"];
  const chartModeOptions = [
    { id: "banca", label: "Banca", testId: "button-chart-banca" },
    { id: "rendimiento", label: "P&L", testId: "button-chart-rendimiento" },
    { id: "roi", label: "Yield", testId: "button-chart-roi" },
    { id: "drawdown", label: "DD", testId: "button-chart-drawdown" },
  ] as const;

  const filterByPeriod = useCallback((date: string, excludeFuture = true) => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const betDate = parseLocalDate(date);
    if (!betDate) return false;
    const betDayStart = new Date(betDate.getFullYear(), betDate.getMonth(), betDate.getDate());
    const diffMs = todayStart.getTime() - betDayStart.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    
    if (diffDays < 0 && excludeFuture) return "future" as const;
    
    if (timePeriod === "ALL") return true;
    
    switch (timePeriod) {
      case "1D": return diffDays <= 0;
      case "1W": return diffDays <= 6;
      case "1M": return diffDays <= 29;
      case "3M": return diffDays <= 89;
      case "6M": return diffDays <= 179;
      case "1Y": return diffDays <= 364;
      default: return true;
    }
  }, [timePeriod]);

  const stats = useMemo(() => {
    const agg = aggregateBets(bets);
    return {
      profit: agg.profit,
      yield_: aggregateYield(agg),
      avgOdds: aggregateAvgOdds(agg),
      avgStake: aggregateAvgStake(agg),
      wins: agg.wins,
      losses: agg.losses,
      winRate: aggregateWinRate(agg),
      total: agg.settled,
    };
  }, [bets]);

  // Helper para obtener timestamp de una apuesta (usado en riskStats y calcStreakForPeriod)
  const getBetTimestamp = (bet: Bet): number => {
    return getBetAnalysisTimestamp(bet);
  };

  const riskStats = useMemo(() => {
    const settledBets = bets.filter(b => b.status === "won" || b.status === "lost");
    
    if (settledBets.length === 0) {
      return { currentStreak: 0, streakType: null, maxDrawdownPct: 0 };
    }
    
    // Ordenar por fecha DESCENDENTE (más reciente primero)
    const sortedBetsDesc = [...settledBets].sort((a, b) => {
      return getBetTimestamp(b) - getBetTimestamp(a);
    });
    
    // Calcular racha desde la más reciente (índice 0)
    const firstStatus = sortedBetsDesc[0].status as "won" | "lost";
    let currentStreak = 1;
    
    for (let i = 1; i < sortedBetsDesc.length; i++) {
      if (sortedBetsDesc[i].status === firstStatus) {
        currentStreak++;
      } else {
        break;
      }
    }

    // Max drawdown as a non-positive % from the rolling peak — computed via
    // the same helper the A/B comparator uses, so both views report the same
    // number for the same bet set. Returns 0 when there are no settled bets.
    const maxDrawdownPct = maxDrawdownFor(bets);

    return {
      currentStreak,
      streakType: firstStatus,
      maxDrawdownPct,
    };
  }, [bets]);

  const calcStatsForPeriod = (period: WidgetPeriod) => {
    const filtered = filterBetsByWidgetPeriod(bets, period);
    const agg = aggregateBets(filtered);
    return {
      profit: agg.profit,
      yield_: aggregateYield(agg),
      wins: agg.wins,
      losses: agg.losses,
      winRate: aggregateWinRate(agg),
      total: agg.settled,
    };
  };

  const calcStreakForPeriod = (period: WidgetPeriod) => {
    const filtered = filterBetsByWidgetPeriod(bets, period);
    
    // Filtrar solo apuestas resueltas (won/lost) e ignorar void/pending
    const settledBets = filtered.filter(b => b.status === "won" || b.status === "lost");
    
    if (settledBets.length === 0) {
      return { currentStreak: 0, streakType: null, streakValue: 0 };
    }
    
    // Ordenar por fecha DESCENDENTE (más reciente primero, índice 0)
    // Usa el helper getBetTimestamp definido arriba
    const sortedBets = [...settledBets].sort((a, b) => {
      return getBetTimestamp(b) - getBetTimestamp(a);
    });

    // Empezar desde índice 0 (la apuesta más reciente)
    const firstStatus = sortedBets[0].status as "won" | "lost";
    let currentStreak = 1;
    
    // Contar consecutivas desde la más reciente
    for (let i = 1; i < sortedBets.length; i++) {
      if (sortedBets[i].status === firstStatus) {
        currentStreak++;
      } else {
        break;
      }
    }

    // Valor con signo: positivo para victorias, negativo para derrotas
    const streakValue = firstStatus === "won" ? currentStreak : -currentStreak;

    return { currentStreak, streakType: firstStatus, streakValue };
  };

  const profitStats = useMemo(() => calcStatsForPeriod(profitPeriod), [bets, profitPeriod]);
  const yieldStats = useMemo(() => calcStatsForPeriod(yieldPeriod), [bets, yieldPeriod]);
  const winrateStats = useMemo(() => calcStatsForPeriod(winratePeriod), [bets, winratePeriod]);
  const recordStats = useMemo(() => calcStatsForPeriod(recordPeriod), [bets, recordPeriod]);
  const streakStats = useMemo(() => calcStreakForPeriod(streakPeriod), [bets, streakPeriod]);

  const chartPeriodLabel = useMemo(() => {
    return getChartSharePeriodLabel(timePeriod);
  }, [timePeriod]);

  const chartDescription = useMemo(() => {
    switch (chartMode) {
      case "banca":
        return isFiltered
          ? "Vista filtrada: banca base + movimientos de wallet + P&L de la muestra."
          : "Banca real: capital inicial + depósitos/retiros + P&L.";
      case "rendimiento":
        return "P&L acumulado del periodo; no incluye movimientos de wallet.";
      case "roi":
        return "Yield acumulado: P&L dividido entre stake resuelto.";
      case "roi-rolling":
        return `Yield de los últimos ${rollingWindowDays} días con apuestas resueltas.`;
      case "drawdown":
        return "Caída desde el pico de P&L; depósitos y retiros no lo resetean.";
      default:
        return "";
    }
  }, [chartMode, isFiltered, rollingWindowDays]);

  const chartPeriodStats = useMemo(() => {
    const now = new Date();
    const today = startOfDay(now);
    
    const filtered = bets.filter(bet => {
      const dateStr = getBetDisplayDate(bet);
      if (!dateStr) return false;
      const betDate = parseLocalDate(dateStr);
      if (!betDate) return false;
      const betDayStart = startOfDay(betDate);
      
      if (betDayStart > today) return false;
      if (timePeriod === "ALL") return true;
      
      switch (timePeriod) {
        case "1D": 
          return isSameDay(betDayStart, today);
        case "1W": 
          return isWithinInterval(betDayStart, { start: subDays(today, 6), end: today });
        case "1M": 
          return isWithinInterval(betDayStart, { start: subDays(today, 29), end: today });
        case "3M": 
          return isWithinInterval(betDayStart, { start: subMonths(today, 3), end: today });
        case "6M": 
          return isWithinInterval(betDayStart, { start: subMonths(today, 6), end: today });
        case "1Y": 
          return isWithinInterval(betDayStart, { start: subYears(today, 1), end: today });
        default: 
          return true;
      }
    });

    const agg = aggregateBets(filtered);
    return {
      profit: agg.profit,
      yield: aggregateYield(agg),
      winRate: aggregateWinRate(agg),
      wins: agg.wins,
      losses: agg.losses,
      total: agg.settled,
    };
  }, [bets, timePeriod]);

  const exposure = useMemo(() => {
    const pendingBets = bets.filter(b => b.status === "pending");
    return pendingBets.reduce((sum, b) => sum + b.stake, 0);
  }, [bets]);

  const avgExposure = useMemo(() => {
    const filtered = filterBetsByWidgetPeriod(bets, avgExpPeriod);
    if (filtered.length === 0) return 0;
    const totalStake = filtered.reduce((sum, b) => sum + b.stake, 0);
    return totalStake / filtered.length;
  }, [bets, avgExpPeriod]);

  const totalDeposits = useMemo(() => {
    return transactions.filter(t => t.type === "deposit").reduce((sum, t) => sum + t.amount, 0);
  }, [transactions]);

  const totalWithdrawals = useMemo(() => {
    return transactions.filter(t => t.type === "withdrawal").reduce((sum, t) => sum + t.amount, 0);
  }, [transactions]);

  const currentBankroll = useMemo(() => {
    const initialCapitalEUR = config?.initialCapital ?? 0;
    const bankrollBets = allBets || bets;
    // NaN-safe: parseLocalDate returns null for empty/invalid strings, which
    // we coerce to 0 so malformed bets sink to the oldest position instead of
    // producing NaN comparisons (which break sort stability in V8).
    const sortedBets = [...bankrollBets]
      .filter(b => b.status !== "pending")
      .sort((a, b) => {
        const ta = parseLocalDate(getBetDisplayDate(a))?.getTime() ?? 0;
        const tb = parseLocalDate(getBetDisplayDate(b))?.getTime() ?? 0;
        return ta - tb;
      });

    let profitFromBetsEUR = 0;
    sortedBets.forEach((bet) => {
      profitFromBetsEUR += calculateBetProfit(bet, unitValue).profit;
    });
    
    const bankrollEUR = initialCapitalEUR + totalDeposits - totalWithdrawals + profitFromBetsEUR;
    return currency === "money" ? bankrollEUR : bankrollEUR / unitValue;
  }, [bets, allBets, config, currency, unitValue, totalDeposits, totalWithdrawals]);

  // Drawdown is measured on cumulative profit (not bankroll) so the value is
  // currency-agnostic. At a new peak it is exactly 0.
  const chartData = useMemo<BankrollPoint[]>(() => {
    const initialCapitalEUR = config?.initialCapital ?? 0;
    const chartBets = isFiltered ? bets : (chartMode === "banca" ? (allBets || bets) : bets);

    // Split bets into (before period) / (inside period) and roll pre-period
    // results into the opening bankroll + drawdown seed so the curve starts
    // from a coherent peak instead of reseting at period boundary.
    let openingBankrollEUR = initialCapitalEUR;
    let seedProfitEUR = 0;
    let seedStakeEUR = 0;
    let seedPeakProfitEUR = 0;
    const inPeriodBets: Bet[] = [];

    // NaN-safe: parseLocalDate returns null for empty/invalid strings, which
    // we coerce to 0 so malformed bets sink to the oldest position instead of
    // producing NaN comparisons (which break sort stability in V8).
    const sortedBets = [...chartBets]
      .filter(b => b.status !== "pending")
      .sort((a, b) => {
        const ta = parseLocalDate(getBetDisplayDate(a))?.getTime() ?? 0;
        const tb = parseLocalDate(getBetDisplayDate(b))?.getTime() ?? 0;
        return ta - tb;
      });

    for (const bet of sortedBets) {
      const periodResult = filterByPeriod(getBetDisplayDate(bet));
      if (periodResult === "future") continue;
      if (periodResult === true) {
        inPeriodBets.push(bet);
      } else {
        const result = calculateBetProfit(bet, unitValue);
        const resultEUR = result.profit;
        openingBankrollEUR += resultEUR;
        seedProfitEUR += resultEUR;
        seedStakeEUR += result.totalStake;
        if (seedProfitEUR > seedPeakProfitEUR) seedPeakProfitEUR = seedProfitEUR;
      }
    }

    for (const txn of transactions) {
      if (filterByPeriod(txn.date) !== false) continue;
      if (txn.type === "deposit") openingBankrollEUR += txn.amount;
      else if (txn.type === "withdrawal") openingBankrollEUR -= txn.amount;
    }

    const inPeriodTxns = transactions.filter(t => filterByPeriod(t.date) === true);
    const firstBetDate = inPeriodBets.length > 0 ? getBetDisplayDate(inPeriodBets[0]) : null;
    const firstTxnDate = inPeriodTxns.reduce<string | null>(
      (min, t) => (!min || t.date < min ? t.date : min),
      null,
    );
    const openingDate = resolveOpeningDate([firstBetDate, firstTxnDate]);

    return buildBankrollSeries({
      bets: inPeriodBets,
      transactions: inPeriodTxns,
      unitValue,
      currency,
      openingBankrollEUR,
      openingDate,
      aggregation: chartAggregation,
      seed: {
        profitEUR: seedProfitEUR,
        stakeEUR: seedStakeEUR,
        peakProfitEUR: seedPeakProfitEUR,
      },
      // Compute the rolling series only when the user actually looks at it —
      // cheap but pointless work otherwise.
      rollingWindowDays: chartMode === "roi-rolling" ? rollingWindowDays : undefined,
    });
  }, [bets, allBets, config, unitValue, currency, filterByPeriod, transactions, chartAggregation, chartMode, rollingWindowDays, isFiltered]);

  const sanitizedChartData = useMemo(() => {
    if (!chartData || !Array.isArray(chartData)) return [];
    return chartData.filter((point) => {
      if (!point) return false;
      if (!point.date) return false;
      if (new Date(point.date).toString() === "Invalid Date") return false;
      if (Number.isNaN(point.bankroll) || Number.isNaN(point.profit)) return false;
      return true;
    });
  }, [chartData]);

  const chartDataKey: "bankroll" | "profit" | "roiPct" | "rollingRoiPct" | "drawdownPct" =
    chartMode === "banca" ? "bankroll"
    : chartMode === "rendimiento" ? "profit"
    : chartMode === "roi" ? "roiPct"
    : chartMode === "roi-rolling" ? "rollingRoiPct"
    : "drawdownPct";
  const isPercentMode = chartMode === "roi" || chartMode === "roi-rolling" || chartMode === "drawdown";
  const showGlobalOverlay = isFiltered && !isPercentMode && chartMode !== "banca";

  const globalStats = useMemo(() => {
    const betsToUse = allBets || bets;
    const agg = aggregateBets(betsToUse);
    return {
      profit: agg.profit,
      yield_: aggregateYield(agg),
      wins: agg.wins,
      losses: agg.losses,
      winRate: aggregateWinRate(agg),
      total: agg.settled,
    };
  }, [allBets, bets]);

  const globalChartData = useMemo(() => {
    if (!isFiltered || !allBets) return null;

    // Global line has no period filter — feed every bet and transaction to
    // the same reducer the filtered curve uses, then project the result into
    // the {globalBankroll, globalProfit} shape the merge step expects.
    const settledBets = allBets.filter(b => b.status !== "pending");
    const firstBetDate = settledBets.length > 0
      ? [...settledBets]
          .map(getBetDisplayDate)
          .sort()[0]
      : null;
    const firstTxnDate = transactions.reduce<string | null>(
      (min, t) => (!min || t.date < min ? t.date : min),
      null,
    );
    const openingDate = resolveOpeningDate([firstBetDate, firstTxnDate]);

    const series = buildBankrollSeries({
      bets: settledBets,
      transactions,
      unitValue,
      currency,
      openingBankrollEUR: config?.initialCapital ?? 0,
      openingDate,
      aggregation: "day",
    });
    return series.map(p => ({
      date: p.date,
      globalBankroll: p.bankroll,
      globalProfit: p.profit,
    }));
  }, [allBets, config, unitValue, currency, transactions, isFiltered]);

  const mergedChartData = useMemo(() => {
    if (!isFiltered || !globalChartData) return sanitizedChartData;
    
    const allDates = new Set<string>();
    sanitizedChartData.forEach(p => allDates.add(p.date));
    globalChartData.forEach(p => allDates.add(p.date));
    
    const sortedDates = Array.from(allDates).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    
    let lastFilteredBankroll: number | null = null;
    let lastFilteredProfit: number | null = null;
    let lastGlobalBankroll: number | null = null;
    let lastGlobalProfit: number | null = null;
    
    const merged = sortedDates.map(date => {
      const filteredPoint = sanitizedChartData.find(p => p.date === date);
      const globalPoint = globalChartData.find(g => g.date === date);
      
      if (filteredPoint) {
        lastFilteredBankroll = filteredPoint.bankroll;
        lastFilteredProfit = filteredPoint.profit;
      }
      if (globalPoint) {
        lastGlobalBankroll = globalPoint.globalBankroll;
        lastGlobalProfit = globalPoint.globalProfit;
      }
      
      return {
        date,
        bankroll: filteredPoint?.bankroll ?? lastFilteredBankroll,
        profit: filteredPoint?.profit ?? lastFilteredProfit,
        roiPct: filteredPoint?.roiPct,
        rollingRoiPct: filteredPoint?.rollingRoiPct,
        drawdownPct: filteredPoint?.drawdownPct,
        betCount: filteredPoint?.betCount,
        stake: filteredPoint?.stake,
        globalBankroll: globalPoint?.globalBankroll ?? lastGlobalBankroll,
        globalProfit: globalPoint?.globalProfit ?? lastGlobalProfit,
      };
    });
    
    return merged;
  }, [sanitizedChartData, globalChartData, isFiltered]);
  
  const isChartPositive = useMemo(() => {
    if (sanitizedChartData.length < 2) return true;
    // Drawdown is always ≤ 0 — render red regardless of direction so the user
    // reads it as "loss from peak" rather than "improvement over baseline".
    if (chartMode === "drawdown") return false;
    // ROI (both cumulative and rolling) is signed: green when the most recent
    // value is above zero, red below.
    if (chartMode === "roi" || chartMode === "roi-rolling") {
      const key = chartMode === "roi" ? "roiPct" : "rollingRoiPct";
      return (sanitizedChartData[sanitizedChartData.length - 1][key] ?? 0) >= 0;
    }
    const first = sanitizedChartData[0][chartDataKey] as number;
    const last = sanitizedChartData[sanitizedChartData.length - 1][chartDataKey] as number;
    return last >= first;
  }, [sanitizedChartData, chartDataKey, chartMode]);

  const chartColor = isChartPositive ? "hsl(var(--foreground))" : "hsl(var(--loss))";
  const showChartBrush = isChartExpanded && sanitizedChartData.length > 5;

  const formatValue = (units: number) => {
    if (currency === "money") {
      return `${(units * unitValue).toFixed(0)}€`;
    }
    return `${units.toFixed(2)}U`;
  };

  const getAdaptiveTextSize = (value: string) => {
    if (value.length > 10) return "text-base";
    if (value.length > 6) return "text-lg";
    return "text-xl";
  };
  
  const formatBankroll = (value: number) => {
    const safeValue = Number.isFinite(value) ? value : 0;
    if (currency === "money") {
      return `${safeValue.toFixed(0)}€`;
    }
    return `${safeValue.toFixed(2)}U`;
  };

  const formatEUR = (amountEUR: number) => {
    const safeValue = Number.isFinite(amountEUR) ? amountEUR : 0;
    if (currency === "money") {
      return `${safeValue.toFixed(0)}€`;
    }
    return `${(safeValue / unitValue).toFixed(2)}U`;
  };

  const formatSignedValue = (units: number) => {
    const value = Number.isFinite(units) ? units : 0;
    return `${value >= 0 ? "+" : ""}${formatValue(value)}`;
  };

  const decisionFacts = useMemo(() => {
    return buildDecisionFacts(
      bets,
      allBets || bets,
      transactions,
      config?.initialCapital ?? 0,
      unitValue,
    );
  }, [bets, allBets, transactions, config, unitValue]);

  const profitColor = stats.profit >= 0 ? "text-win" : "text-loss";

  const initialCapitalEUR = config?.initialCapital ?? 0;
  const targetBankrollEUR = config?.targetBankroll ?? 0;
  const safeCurrentBankroll = Number.isFinite(currentBankroll) ? currentBankroll : 0;
  const currentBankrollEUR = currency === "money" ? safeCurrentBankroll : safeCurrentBankroll * unitValue;
  const rawProgress = targetBankrollEUR > 0 && Number.isFinite(currentBankrollEUR)
    ? (currentBankrollEUR / targetBankrollEUR) * 100
    : 0;
  const progressPercent = Number.isFinite(rawProgress) ? Math.min(100, Math.max(0, rawProgress)) : 0;
  const targetDisplay = currency === "money" ? targetBankrollEUR : (unitValue > 0 ? targetBankrollEUR / unitValue : 0);
  const totalBetCount = allBets?.length ?? bets.length;
  const periodScopeLabel = isFiltered
    ? `Periodo filtrado · ${bets.length} de ${totalBetCount} apuestas`
    : `Periodo completo · ${bets.length} apuestas`;
  const referenceLineDivider = currency === "money" ? 1 : Math.max(unitValue, 1);
  const referenceLineValue = chartMode === "banca"
    ? Math.round(initialCapitalEUR / referenceLineDivider)
    : 0;
  const chartValues = sanitizedChartData
    .map((point) => point[chartDataKey])
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const chartMin = chartValues.length > 0 ? Math.min(...chartValues) : 0;
  const chartMax = chartValues.length > 0 ? Math.max(...chartValues) : 0;
  const referenceThreshold = isPercentMode
    ? 1
    : Math.max(1, Math.abs(referenceLineValue) * 0.02);
  const showAdaptiveReferenceLine = chartMode === "banca"
    ? initialCapitalEUR > 0 && chartMin < referenceLineValue - referenceThreshold
    : chartMode === "drawdown"
      ? chartMin <= -referenceThreshold
      : chartMin < -referenceThreshold && chartMax > referenceThreshold;

  return (
    <div className="app-container app-section py-3 sm:py-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(19rem,22rem)_minmax(0,1fr)] lg:items-stretch">
        <Card className="surface-panel h-full overflow-hidden rounded-lg py-0" data-testid="card-bankroll-summary">
          <CardContent className="relative p-3 sm:p-4">
            <div className="absolute inset-x-0 top-0 h-px bg-foreground/20" />
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
                  <span className="grid h-6 w-6 place-items-center rounded-md border border-foreground/20 bg-foreground/5 text-foreground">
                    <Wallet className="h-3.5 w-3.5" />
                  </span>
                  <p className="mono-section-title">Banca real</p>
                  <InfoHint label="Qué significa banca real">
                    Capital disponible tras movimientos de wallet y resultado histórico de apuestas.
                  </InfoHint>
                </div>
                <p className="mt-2 font-mono text-3xl font-black leading-none sm:text-4xl" data-testid="text-decision-bankroll">
                  {formatEUR(decisionFacts.wallet.realBankrollEUR)}
                </p>
              </div>

              <div className="grid shrink-0 grid-cols-3 gap-1">
                {onOpenWallet && (
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 rounded-full border-border/70 bg-card/70 hover:bg-muted/70"
                    onClick={onOpenWallet}
                    data-testid="button-decision-wallet"
                    title="Abrir wallet"
                  >
                    <Wallet className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onCurrencyToggle}
                  className="h-8 w-8 rounded-full border-border/70 bg-card/70 px-0 font-mono text-xs hover:bg-muted/70"
                  data-testid="button-currency-toggle"
                  title="Cambiar unidad"
                >
                  {currency === "units" ? "U" : "€"}
                </Button>
                {onOpenNewBet && (
                  <Button
                    size="icon"
                    className="h-8 w-8 rounded-full bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 lg:hidden"
                    onClick={onOpenNewBet}
                    data-testid="button-decision-new-bet"
                    title="Añadir apuesta"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            <section className="bankroll-kpi-strip mt-3 grid grid-cols-3" aria-label="Resumen de banca">
              <div className="bankroll-kpi-cell">
                <p className="bankroll-kpi-label">P&L apuestas</p>
                <p className={`bankroll-kpi-value ${decisionFacts.wallet.bettingProfitUnits >= 0 ? "text-win" : "text-loss"}`}>
                  {formatSignedValue(decisionFacts.wallet.bettingProfitUnits)}
                </p>
                <span
                  className="bankroll-kpi-rule"
                  data-tone={decisionFacts.wallet.bettingProfitUnits >= 0 ? "win" : "loss"}
                />
              </div>
              <div className="bankroll-kpi-cell">
                <p className="bankroll-kpi-label">Exposición</p>
                <p className="bankroll-kpi-value text-foreground">
                  {formatValue(decisionFacts.pendingExposureUnits)}
                </p>
                <span className="bankroll-kpi-rule" />
              </div>
              <div className="bankroll-kpi-cell">
                <p className="bankroll-kpi-label">Depósitos netos</p>
                <p className={`bankroll-kpi-value ${decisionFacts.wallet.netDepositsEUR >= 0 ? "text-foreground" : "text-loss"}`}>
                  {decisionFacts.wallet.netDepositsEUR >= 0 ? "+" : ""}{formatEUR(decisionFacts.wallet.netDepositsEUR)}
                </p>
                <span
                  className="bankroll-kpi-rule"
                  data-tone={decisionFacts.wallet.netDepositsEUR < 0 ? "loss" : undefined}
                />
              </div>
            </section>
          </CardContent>
        </Card>

      <Card className="surface-panel relative min-w-0 overflow-hidden rounded-lg py-0" data-testid="card-bankroll-chart">
          <CardContent className="p-3 sm:p-4">
            {isFiltered && (
              <div
                className="surface-subtle mb-3 rounded-lg px-3 py-2"
                data-testid="card-period-summary"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="mono-section-title">Periodo filtrado</p>
                    <p className="truncate text-xs font-medium">{periodScopeLabel}</p>
                  </div>
                  <Badge variant="default" className="h-5 text-[10px]">
                    Filtro activo
                  </Badge>
                </div>

                <section className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4" aria-label="KPIs del periodo">
                  <div className="min-w-0" data-testid="card-decision-profit">
                    <p className="truncate text-[9px] uppercase text-muted-foreground">Resultado</p>
                    <p className={`font-mono text-sm font-bold ${decisionFacts.periodAggregate.profit >= 0 ? "text-win" : "text-loss"}`}>
                      {formatSignedValue(decisionFacts.periodAggregate.profit)}
                    </p>
                  </div>
                  <div className="min-w-0" data-testid="card-decision-yield">
                    <p className="truncate text-[9px] uppercase text-muted-foreground">Yield</p>
                    <p className={`font-mono text-sm font-bold ${decisionFacts.periodYieldPct >= 0 ? "text-win" : "text-loss"}`}>
                      {decisionFacts.periodYieldPct >= 0 ? "+" : ""}{decisionFacts.periodYieldPct.toFixed(1)}%
                    </p>
                  </div>
                  <div className="min-w-0" data-testid="card-decision-settled">
                    <p className="truncate text-[9px] uppercase text-muted-foreground">Res.</p>
                    <p className="font-mono text-sm font-bold">{decisionFacts.periodAggregate.settled}</p>
                  </div>
                  <div className="min-w-0" data-testid="card-decision-drawdown">
                    <p className="truncate text-[9px] uppercase text-muted-foreground">DD</p>
                    <p className={`font-mono text-sm font-bold ${decisionFacts.drawdown.currentDrawdownUnits < 0 ? "text-loss" : "text-foreground"}`}>
                      {formatValue(decisionFacts.drawdown.currentDrawdownUnits)}
                    </p>
                  </div>
                </section>
              </div>
            )}
            <div className="mb-3 flex flex-col gap-2">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <p className="mono-section-title">Evolución y riesgo</p>
                  <div className="mt-1 flex items-center gap-1.5">
                    <p className="text-sm font-semibold text-foreground">
                      {chartMode === "banca" ? "Banca real"
                        : chartMode === "rendimiento" ? "P&L apuestas"
                        : chartMode === "roi" ? "Yield acumulado"
                        : chartMode === "roi-rolling" ? `Yield rodante ${rollingWindowDays}d`
                        : "Drawdown vs pico"}
                    </p>
                    <InfoHint label="Información de la gráfica">
                      {chartDescription}
                    </InfoHint>
                  </div>
                </div>
                <div
                  className="scrollbar-hide flex max-w-full items-center gap-1 overflow-x-auto pb-1"
                  style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                >
                  {timePeriods.map((period) => (
                    <Button
                      key={period}
                      variant={timePeriod === period ? "default" : "ghost"}
                      size="sm"
                      className={`h-6 min-w-8 rounded-full border px-2 text-[10px] whitespace-nowrap ${
                        timePeriod === period ? "font-semibold" : "text-muted-foreground"
                      }`}
                      onClick={() => setTimePeriod(period)}
                      data-testid={`button-period-${period}`}
                    >
                      {period}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="inline-grid w-full max-w-[18rem] grid-cols-4 gap-0.5 rounded-full border border-border/60 bg-foreground/[0.03] p-0.5 sm:w-auto sm:min-w-64">
                  {chartModeOptions.map((m) => (
                    <Button
                      key={m.id}
                      variant={chartMode === m.id ? "default" : "ghost"}
                      size="sm"
                      className={`h-6 min-w-0 rounded-full px-1.5 text-[9.5px] ${
                        chartMode === m.id ? "font-bold shadow-sm" : "text-muted-foreground font-normal"
                      }`}
                      onClick={() => setChartMode(m.id)}
                      data-testid={m.testId}
                    >
                      {m.label}
                    </Button>
                  ))}
                </div>
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant={isChartExpanded ? "secondary" : "ghost"}
                    size="icon"
                    className="h-8 w-8 text-muted-foreground"
                    onClick={() => setIsChartExpanded(v => !v)}
                    data-testid="button-chart-zoom"
                    title={isChartExpanded ? "Reducir gráfica" : "Ampliar gráfica"}
                    aria-label={isChartExpanded ? "Reducir gráfica" : "Ampliar gráfica"}
                  >
                    {isChartExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                  </Button>
                  {onOpenFilter && (
                    <Button
                      variant={isFiltered ? "secondary" : "ghost"}
                      size="icon"
                      className={cn(
                        "h-8 w-8",
                        isFiltered ? "font-semibold text-foreground" : "text-muted-foreground",
                      )}
                      onClick={onOpenFilter}
                      data-testid="button-chart-filter"
                      title="Filtrar gráfica e historial"
                    >
                      <Filter className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground"
                        data-testid="button-chart-options"
                        title="Opciones de gráfica"
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuLabel className="text-xs">Opciones</DropdownMenuLabel>
                      <DropdownMenuRadioGroup
                        value={chartAggregation}
                        onValueChange={(value) => {
                          if (isAggregation(value)) setChartAggregation(value);
                        }}
                      >
                        <DropdownMenuRadioItem value="day" data-testid="button-chart-aggregation-day">
                          Punto por día
                        </DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="bet" data-testid="button-chart-aggregation-bet">
                          Punto por apuesta
                        </DropdownMenuRadioItem>
                      </DropdownMenuRadioGroup>
                      <DropdownMenuSeparator />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-full justify-start px-2 text-xs"
                        onClick={() => setIsChartShareOpen(true)}
                        disabled={sanitizedChartData.length < 2}
                        data-testid="button-share-chart"
                      >
                        <Share2 className="h-3.5 w-3.5" />
                        Compartir gráfica
                      </Button>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
            <ChartErrorBoundary>
              {sanitizedChartData.length < 2 ? (
                <div className="h-48 flex items-center justify-center text-muted-foreground text-sm" data-testid="chart-empty-state">
                  <BarChart3 className="h-4 w-4 mr-2 opacity-50" />
                  No hay datos suficientes para mostrar la gráfica
                </div>
              ) : (
                <div
                  className={cn(
                    isChartExpanded ? "h-[22rem] sm:h-[28rem]" : "h-64 sm:h-72",
                  )}
                  style={{ touchAction: "pan-y pinch-zoom" }}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={showGlobalOverlay ? mergedChartData : sanitizedChartData}
                      margin={{ top: 8, right: 10, left: 0, bottom: 12 }}
                    >
                      <defs>
                        <linearGradient id="bankrollGradientPositive" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--foreground))" stopOpacity={0.18} />
                          <stop offset="100%" stopColor="hsl(var(--foreground))" stopOpacity={0.03} />
                        </linearGradient>
                        <linearGradient id="bankrollGradientNegative" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--loss))" stopOpacity={0.32} />
                          <stop offset="100%" stopColor="hsl(var(--loss))" stopOpacity={0.04} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        vertical={false}
                        stroke="hsl(var(--border))"
                        strokeDasharray="2 8"
                        strokeOpacity={0.42}
                      />
                      <XAxis 
                        dataKey="date" 
                        tick={{
                          fill: "hsl(var(--muted-foreground))",
                          fontFamily: "var(--font-sans)",
                          fontSize: 10,
                          fontWeight: 600,
                        }}
                        tickLine={false}
                        axisLine={{ stroke: "hsl(var(--muted-foreground))", strokeOpacity: 0.34 }}
                        interval="preserveStartEnd"
                        minTickGap={42}
                        tickMargin={8}
                        tickFormatter={(value) => formatDateByPeriod(value, timePeriod)}
                      />
                      <YAxis
                        width={38}
                        tick={{
                          fill: "hsl(var(--muted-foreground))",
                          fontFamily: "var(--font-sans)",
                          fontSize: 10,
                          fontWeight: 600,
                        }}
                        tickLine={false}
                        axisLine={{ stroke: "hsl(var(--muted-foreground))", strokeOpacity: 0.34 }}
                        tickCount={3}
                        tickMargin={8}
                        domain={[
                          (dataMin: number) => Math.floor(dataMin - Math.max(Math.abs(dataMin) * 0.05, isPercentMode ? 0.5 : 1)),
                          (dataMax: number) => Math.ceil(dataMax + Math.max(Math.abs(dataMax) * 0.05, isPercentMode ? 0.5 : 1)),
                        ]}
                        tickFormatter={(v) =>
                          isPercentMode ? `${v}%` : `${v}${currency === "money" ? "€" : "u"}`
                        }
                      />
                      <Tooltip
                        content={(props) => (
                          <ChartTooltipContent
                            active={props.active}
                            label={props.label}
                            payload={props.payload as ChartTooltipPayload[] | undefined}
                            chartMode={chartMode}
                            rollingWindowDays={rollingWindowDays}
                            currency={currency}
                            isPercentMode={isPercentMode}
                          />
                        )}
                      />
                      {/* Adaptive reference: only shown when the curve needs a meaningful baseline. */}
                      {showAdaptiveReferenceLine && (
                        <ReferenceLine
                          y={referenceLineValue}
                          stroke="hsl(var(--muted-foreground))"
                          strokeDasharray="3 3"
                          strokeOpacity={0.42}
                          ifOverflow="extendDomain"
                        />
                      )}
                      {/* Vertical marker where cryptographically verified bets begin.
                          Hidden in percent modes — it's a historical event, not a value. */}
                      {firstVerifiedDate && !isPercentMode && sanitizedChartData.some(p => p.date >= firstVerifiedDate) && (
                        <ReferenceLine
                          x={firstVerifiedDate}
                          stroke="hsl(var(--foreground))"
                          strokeDasharray="4 4"
                          strokeOpacity={0.55}
                          label={{
                            value: "✓ verificadas",
                            position: "top",
                            fontSize: 9,
                            fill: "hsl(var(--foreground))",
                            fontFamily: "var(--font-sans)",
                          }}
                        />
                      )}
                      {/* Global overlay only in absolute modes — doesn't make sense for % modes. */}
                      {showGlobalOverlay && (
                        <Line
                          type="monotone"
                          dataKey="globalProfit"
                          stroke="#06b6d4"
                          strokeWidth={2}
                          strokeDasharray="6 4"
                          dot={false}
                          name="globalProfit"
                          connectNulls
                        />
                      )}
                      <Area
                        type="monotone"
                        dataKey={chartDataKey}
                        stroke={chartColor}
                        strokeWidth={2}
                        fill={isChartPositive ? "url(#bankrollGradientPositive)" : "url(#bankrollGradientNegative)"}
                      />
                      {showChartBrush && (
                        <Brush 
                          dataKey="date" 
                          height={22}
                          stroke="hsl(var(--border))"
                          fill="hsl(var(--muted))"
                          tickFormatter={(value) => formatDateByPeriod(value, timePeriod)}
                        />
                      )}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
            </ChartErrorBoundary>
          </CardContent>
        </Card>
      </div>

      <TrendShareCard
        open={isChartShareOpen}
        onClose={() => setIsChartShareOpen(false)}
        data={sanitizedChartData.map(d => ({
          date: d.date,
          // The share card only renders absolute bankroll or profit — % modes
          // (yield / drawdown) fall back to the profit series for the image.
          value: chartMode === "banca" ? d.bankroll : d.profit,
          bankroll: d.bankroll,
          profit: d.profit,
        }))}
        periodLabel={chartPeriodLabel}
        timePeriod={timePeriod}
        periodStats={chartPeriodStats}
        currency={currency}
        unitValue={unitValue}
        chartMode={chartMode === "banca" ? "banca" : "rendimiento"}
      />
    </div>
  );
}
