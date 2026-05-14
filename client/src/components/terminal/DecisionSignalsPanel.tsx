import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  Flame,
  Gauge,
  Info,
  Landmark,
  LineChart,
  ShieldCheck,
  Target,
  TrendingDown,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { buildDecisionFacts } from "@/lib/decision-insights";
import { cn } from "@/lib/utils";
import type { Bet, Transaction, UserConfig } from "@shared/schema";

interface DecisionSignalsPanelProps {
  bets: Bet[];
  allBets?: Bet[];
  config: UserConfig | null;
  currency: "units" | "money";
  transactions: Transaction[];
}

type SignalTone = "good" | "warning" | "risk" | "neutral" | "info";

interface DecisionSignal {
  id: string;
  title: string;
  metric: string;
  detail: string;
  tone: SignalTone;
  icon: LucideIcon;
  priority: number;
}

const toneStyles: Record<SignalTone, { icon: string; metric: string; rail: string; background: string }> = {
  good: {
    icon: "text-win",
    metric: "text-win",
    rail: "bg-win",
    background: "bg-win/[0.04]",
  },
  warning: {
    icon: "text-pending",
    metric: "text-pending",
    rail: "bg-pending",
    background: "bg-pending/[0.045]",
  },
  risk: {
    icon: "text-loss",
    metric: "text-loss",
    rail: "bg-loss",
    background: "bg-loss/[0.045]",
  },
  neutral: {
    icon: "text-muted-foreground",
    metric: "text-foreground",
    rail: "bg-muted-foreground",
    background: "bg-foreground/[0.035]",
  },
  info: {
    icon: "text-foreground",
    metric: "text-foreground",
    rail: "bg-foreground",
    background: "bg-foreground/[0.04]",
  },
};

const pluralize = (count: number, singular: string, plural = `${singular}s`) =>
  `${count} ${count === 1 ? singular : plural}`;

export function DecisionSignalsPanel({
  bets,
  allBets,
  config,
  currency,
  transactions,
}: DecisionSignalsPanelProps) {
  const unitValue = config?.unitValue || 10;

  const formatValue = (units: number) => {
    if (currency === "money") {
      return `${(units * unitValue).toFixed(0)}€`;
    }
    return `${units.toFixed(2)}U`;
  };

  const formatSignedValue = (units: number) => {
    const value = Number.isFinite(units) ? units : 0;
    return `${value >= 0 ? "+" : ""}${formatValue(value)}`;
  };

  const formatPct = (value: number) => {
    const safeValue = Number.isFinite(value) ? value : 0;
    return `${safeValue >= 0 ? "+" : ""}${safeValue.toFixed(1)}%`;
  };

  const aggregateYieldPct = (profit: number, stake: number) =>
    stake > 0 ? (profit / stake) * 100 : 0;

  const decisionFacts = useMemo(() => {
    return buildDecisionFacts(
      bets,
      allBets || bets,
      transactions,
      config?.initialCapital ?? 0,
      unitValue,
    );
  }, [bets, allBets, transactions, config, unitValue]);

  const decisionSignals = useMemo(() => {
    const signals: DecisionSignal[] = [];
    const period = decisionFacts.periodAggregate;
    const averageStake = period.settled > 0 ? period.stake / period.settled : 0;

    if (decisionFacts.highOddsConcentration) {
      const concentration = decisionFacts.highOddsConcentration;
      const contribution = formatSignedValue(concentration.profitUnits);
      const shareCopy = concentration.sharePct >= 105
        ? "sostienen el resultado y compensan pérdidas del resto"
        : `aportan el ${concentration.sharePct.toFixed(0)}% del resultado neto`;
      const shareVerb = concentration.settledCount === 1
        ? shareCopy.replace("sostienen", "sostiene").replace("compensan", "compensa").replace("aportan", "aporta")
        : shareCopy;
      signals.push({
        id: "high-odds-concentration",
        title: "Aporte destacado en cuota alta",
        metric: contribution,
        detail: `${pluralize(concentration.settledCount, "apuesta")} con cuota superior a ${concentration.oddsThreshold.toFixed(2)} ${shareVerb}. Buena captura, aunque conviene validarla con más muestra.`,
        tone: concentration.sharePct >= 105 ? "warning" : "info",
        icon: Flame,
        priority: concentration.sharePct >= 105 ? 96 : 82,
      });
    }

    if (decisionFacts.outlierImpact) {
      const outlier = decisionFacts.outlierImpact;
      const flipsNegative = outlier.fullYieldPct >= 0 && outlier.yieldWithoutTopPct < 0;
      signals.push({
        id: "outlier-impact",
        title: flipsNegative ? "Edge todavía por confirmar" : "Mejores tickets aportan valor",
        metric: `${formatPct(outlier.yieldWithoutTopPct)} sin top`,
        detail: `La muestra gana con sus mejores tickets; quitando ${pluralize(outlier.removedCount, "resultado top", "resultados top")}, el Yield pasa de ${formatPct(outlier.fullYieldPct)} a ${formatPct(outlier.yieldWithoutTopPct)}. Seguimos, pero sin sobredimensionar stake.`,
        tone: flipsNegative ? "risk" : "warning",
        icon: TrendingDown,
        priority: flipsNegative ? 94 : 78,
      });
    }

    if (decisionFacts.recentForm) {
      const recent = decisionFacts.recentForm;
      signals.push({
        id: "recent-form",
        title: recent.aggregate.profit >= 0 ? "Forma reciente favorable" : "Forma reciente a recomponer",
        metric: formatSignedValue(recent.aggregate.profit),
        detail: `Últimas ${recent.sample} resueltas: Yield ${formatPct(recent.yieldPct)} y acierto ${recent.winRatePct.toFixed(0)}%. Úsalo como pulso corto, no como conclusión definitiva.`,
        tone: recent.aggregate.profit > 0 ? "good" : recent.aggregate.profit < 0 ? "warning" : "neutral",
        icon: LineChart,
        priority: 76,
      });
    }

    if (decisionFacts.liveAggregate.settled >= 3) {
      const liveYield = aggregateYieldPct(decisionFacts.liveAggregate.profit, decisionFacts.liveAggregate.stake);
      const preMatchYield = aggregateYieldPct(decisionFacts.preMatchAggregate.profit, decisionFacts.preMatchAggregate.stake);
      signals.push({
        id: "live-performance",
        title: decisionFacts.liveAggregate.profit >= 0 ? "Live suma a favor" : "Live pide ajuste fino",
        metric: formatSignedValue(decisionFacts.liveAggregate.profit),
        detail: `${pluralize(decisionFacts.liveAggregate.settled, "apuesta")} live con Yield ${formatPct(liveYield)}; pre-match está en ${formatPct(preMatchYield)}. Si mantiene muestra, puede ser ventaja operativa.`,
        tone: decisionFacts.liveAggregate.profit >= 0 ? "good" : "warning",
        icon: Zap,
        priority: 74,
      });
    }

    if (decisionFacts.pendingExposureUnits > 0) {
      const exposureTone: SignalTone = averageStake > 0 && decisionFacts.pendingExposureUnits > averageStake * 4 ? "warning" : "neutral";
      signals.push({
        id: "pending-exposure",
        title: "Margen pendiente abierto",
        metric: formatValue(decisionFacts.pendingExposureUnits),
        detail: `${pluralize(decisionFacts.pendingCount, "pendiente")} puede mejorar o recortar la curva. La lectura actual es buena base, pero se confirma tras settlement.`,
        tone: exposureTone,
        icon: Gauge,
        priority: exposureTone === "warning" ? 72 : 58,
      });
    }

    if (decisionFacts.drawdown.maxDrawdownUnits < 0) {
      const drawdownMagnitude = Math.abs(decisionFacts.drawdown.maxDrawdownUnits);
      const drawdownTone: SignalTone = averageStake > 0 && drawdownMagnitude > averageStake * 3 ? "risk" : "warning";
      signals.push({
        id: "drawdown",
        title: "Riesgo visible y controlable",
        metric: formatSignedValue(decisionFacts.drawdown.maxDrawdownUnits),
        detail: `Máximo drawdown de la muestra. Es una referencia útil para mantener stake disciplinado antes de acelerar.`,
        tone: drawdownTone,
        icon: AlertTriangle,
        priority: drawdownTone === "risk" ? 88 : 68,
      });
    }

    if (decisionFacts.stakeAfterLosses) {
      const stake = decisionFacts.stakeAfterLosses;
      const ratio = stake.baselineAvgStakeUnits > 0
        ? stake.afterLossAvgStakeUnits / stake.baselineAvgStakeUnits
        : 1;
      signals.push({
        id: "stake-after-losses",
        title: ratio > 1.15 ? "Stake más agresivo tras pérdidas" : "Stake tras pérdidas bien contenido",
        metric: `${stake.afterLossAvgStakeUnits.toFixed(1)}U`,
        detail: `Tras ${stake.lossStreakLength} pérdidas seguidas, la media queda frente a ${stake.baselineAvgStakeUnits.toFixed(1)}U habitual en ${pluralize(stake.sample, "caso")}. Buen punto para ajustar rutina, no para castigar el sistema.`,
        tone: ratio > 1.15 ? "warning" : "good",
        icon: Target,
        priority: ratio > 1.15 ? 86 : 62,
      });
    }

    if (decisionFacts.verificationRatePct != null) {
      const rate = decisionFacts.verificationRatePct;
      signals.push({
        id: "verification-coverage",
        title: rate >= 70 ? "Cobertura verificable sólida" : "Verificación por reforzar",
        metric: `${rate.toFixed(0)}%`,
        detail: `${decisionFacts.verifiedCount}/${decisionFacts.verificationTotal} apuestas tienen hash real. La base existe; el siguiente salto es subir cobertura y marcar el resto como sin prueba pública.`,
        tone: rate >= 70 ? "good" : "warning",
        icon: rate >= 70 ? ShieldCheck : BadgeCheck,
        priority: rate >= 70 ? 66 : 84,
      });
    }

    if (decisionFacts.topLeagueConcentration) {
      const segment = decisionFacts.topLeagueConcentration;
      signals.push({
        id: "top-league",
        title: segment.aggregate.profit >= 0 ? "Liga con mejor tracción" : "Liga a revisar con calma",
        metric: segment.label,
        detail: `${formatSignedValue(segment.aggregate.profit)} en ${pluralize(segment.aggregate.settled, "resuelta")}. Puede merecer más foco si la muestra crece; si resta, baja exposición antes de pausar del todo.`,
        tone: segment.aggregate.profit >= 0 ? "info" : "warning",
        icon: Activity,
        priority: Math.min(80, 52 + Math.round(Math.min(segment.sharePct, 100) / 4)),
      });
    }

    if (signals.length === 0) {
      signals.push({
        id: "no-patterns",
        title: "Muestra estable",
        metric: "Sin alerta",
        detail: "No aparecen concentraciones, outliers o cambios de stake relevantes en la muestra actual.",
        tone: "neutral",
        icon: Landmark,
        priority: 1,
      });
    }

    return signals
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 6);
  }, [decisionFacts, currency, unitValue]);

  const summaryItems = [
    {
      label: "Yield",
      value: formatPct(decisionFacts.periodYieldPct),
      tone: decisionFacts.periodYieldPct >= 0 ? "text-win" : "text-loss",
    },
    {
      label: "DD máximo",
      value: formatSignedValue(decisionFacts.drawdown.maxDrawdownUnits),
      tone: decisionFacts.drawdown.maxDrawdownUnits < 0 ? "text-loss" : "text-foreground",
    },
    {
      label: "Prueba",
      value: decisionFacts.verificationRatePct != null ? `${decisionFacts.verificationRatePct.toFixed(0)}%` : "N/D",
      tone: decisionFacts.verificationRatePct != null && decisionFacts.verificationRatePct < 40 ? "text-pending" : "text-foreground",
    },
  ];

  return (
    <section className="app-container app-section pb-36 lg:pb-8">
      <div className="surface-panel overflow-hidden rounded-lg" data-testid="card-decision-signals">
        <div className="border-b border-border/70 p-3 sm:p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-foreground/15 bg-foreground/[0.045] text-foreground">
                <Landmark className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="mono-section-title">Lecturas del historial</p>
                <p className="text-sm font-bold text-foreground">Diagnóstico operativo</p>
              </div>
            </div>
            <Badge variant="outline" className="shrink-0 rounded-full text-[10px]">
              {decisionFacts.periodAggregate.settled} resueltas
            </Badge>
          </div>

          <div className="mt-3 grid grid-cols-3 divide-x divide-border/60 overflow-hidden rounded-md border border-border/70 bg-foreground/[0.025]">
            {summaryItems.map((item) => (
              <div key={item.label} className="min-w-0 px-2.5 py-2">
                <p className="truncate text-[9px] font-bold uppercase text-muted-foreground">{item.label}</p>
                <p className={cn("mt-1 truncate font-mono text-sm font-black", item.tone)}>{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="p-3 sm:p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold text-foreground">Señales priorizadas</p>
              <p className="text-[11px] text-muted-foreground">Lectura para decidir si seguir, pausar o ajustar.</p>
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 rounded-full text-muted-foreground"
                  aria-label="Información sobre señales"
                >
                  <Info className="h-3.5 w-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-72 text-xs leading-relaxed">
                Prioriza señales con más impacto operativo: concentración de beneficio,
                dependencia de outliers, live contra pre-match, drawdown, exposición,
                verificación pública, forma reciente y segmentos dominantes.
              </PopoverContent>
            </Popover>
          </div>

          <div className="divide-y divide-border/60">
            {decisionSignals.map((signal) => {
              const tone = toneStyles[signal.tone];
              const Icon = signal.icon;

              return (
                <article key={signal.id} className={cn("relative py-3 pl-3", tone.background)}>
                  <span className={cn("absolute inset-y-3 left-0 w-0.5 rounded-full", tone.rail)} />
                  <div className="flex gap-2.5">
                    <span className={cn("mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md border border-border/70 bg-background/45", tone.icon)}>
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="min-w-0 text-sm font-bold leading-tight text-foreground">{signal.title}</h3>
                        <span className={cn("shrink-0 font-mono text-xs font-black", tone.metric)}>{signal.metric}</span>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{signal.detail}</p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
