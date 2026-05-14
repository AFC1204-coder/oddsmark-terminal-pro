import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  LineChart,
  Plus,
  Target,
  Trash2,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Strategy, Bet } from "@shared/schema";
import { cn } from "@/lib/utils";
import { useLocalState } from "@/hooks/use-local-state";
import {
  analyzeStrategies,
  emptyStrategyRules,
  isStrategyRulesById,
  type StrategyAnalysis,
  type StrategyBetSnapshot,
  type StrategyDimensionSummary,
  type StrategyHealthTag,
  type StrategyPnlPoint,
  type StrategyRules,
  type StrategyRulesById,
} from "@/lib/strategy-analysis";

interface StrategiesModalProps {
  open: boolean;
  onClose: () => void;
  strategies: Strategy[];
  bets: Bet[];
  onAdd: (name: string) => void;
  onDelete: (id: number) => void;
}

type RuleField = keyof StrategyRules;

const statusLabel: Record<string, string> = {
  won: "Ganada",
  lost: "Perdida",
  pending: "Pendiente",
  void: "Nula",
};

export function StrategiesModal({ open, onClose, strategies, bets, onAdd, onDelete }: StrategiesModalProps) {
  const [newName, setNewName] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [selectedStrategyId, setSelectedStrategyId] = useState<number | null>(strategies[0]?.id ?? null);
  const [rulesById, setRulesById] = useLocalState<StrategyRulesById>(
    "tp-strategy-rules-v1",
    {},
    isStrategyRulesById,
  );

  const analyses = useMemo(() => analyzeStrategies(strategies, bets), [strategies, bets]);
  const selectedAnalysis = analyses.find((analysis) => analysis.strategy.id === selectedStrategyId) ?? analyses[0] ?? null;

  useEffect(() => {
    setRulesById((prev) => {
      const next = Object.fromEntries(
        Object.entries(prev).filter(([, rules]) => !areRulesEmpty(rules)),
      );
      return Object.keys(next).length === Object.keys(prev).length ? prev : next;
    });
  }, [setRulesById]);

  useEffect(() => {
    if (!open) return;
    if (strategies.length === 0) {
      setSelectedStrategyId(null);
      return;
    }
    if (!strategies.some((strategy) => strategy.id === selectedStrategyId)) {
      setSelectedStrategyId(strategies[0].id);
    }
  }, [open, selectedStrategyId, strategies]);

  const handleAdd = () => {
    const trimmedName = newName.trim();
    if (!trimmedName) return;
    onAdd(trimmedName);
    setNewName("");
    setIsAdding(false);
  };

  const handleDelete = (strategy: Strategy) => {
    const confirmed = window.confirm(
      `Eliminar la estrategia "${strategy.name}"? Las apuestas asociadas no se borrarán.`,
    );
    if (!confirmed) return;
    onDelete(strategy.id);
  };

  const updateRules = (strategyId: number, field: RuleField, value: string) => {
    setRulesById((prev) => {
      const key = String(strategyId);
      const current = prev[key] ?? emptyStrategyRules;
      const nextRules = {
        ...current,
        [field]: value,
      };
      if (areRulesEmpty(nextRules)) {
        const { [key]: _removed, ...rest } = prev;
        return rest;
      }
      return {
        ...prev,
        [key]: nextRules,
      };
    });
  };

  const updateTiming = (strategyId: number, value: StrategyRules["timing"]) => {
    setRulesById((prev) => {
      const key = String(strategyId);
      const current = prev[key] ?? emptyStrategyRules;
      const nextRules = {
        ...current,
        timing: value,
      };
      if (areRulesEmpty(nextRules)) {
        const { [key]: _removed, ...rest } = prev;
        return rest;
      }
      return {
        ...prev,
        [key]: nextRules,
      };
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] gap-0 overflow-y-auto p-0 sm:max-w-5xl">
        <div className="sticky top-0 z-10 border-b bg-background/95 p-4 backdrop-blur sm:p-5">
          <DialogHeader className="space-y-1 pr-8">
            <div className="flex items-center justify-between gap-3">
              <DialogTitle className="text-left">
                Estrategias
              </DialogTitle>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setIsAdding(true)}
                data-testid="button-add-strategy"
                aria-label="Crear estrategia"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <DialogDescription className="sr-only">
              Panel de análisis, salud y reglas operativas de estrategias.
            </DialogDescription>
          </DialogHeader>

          {isAdding && (
            <div className="mt-4 flex gap-2">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nombre de la estrategia..."
                autoFocus
                data-testid="input-strategy-name"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAdd();
                  if (e.key === "Escape") {
                    setNewName("");
                    setIsAdding(false);
                  }
                }}
              />
              <Button onClick={handleAdd} data-testid="button-confirm-strategy">
                Guardar
              </Button>
            </div>
          )}
        </div>

        {strategies.length === 0 && !isAdding ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            No hay estrategias creadas
          </p>
        ) : (
          <div className="grid gap-0 lg:grid-cols-[20rem_minmax(0,1fr)]">
            <aside className="border-b p-3 lg:border-b-0 lg:border-r">
              <div className="space-y-2">
                {analyses.map((analysis) => (
                  <StrategyListItem
                    key={analysis.strategy.id}
                    analysis={analysis}
                    active={selectedAnalysis?.strategy.id === analysis.strategy.id}
                    onSelect={() => setSelectedStrategyId(analysis.strategy.id)}
                    onDelete={() => handleDelete(analysis.strategy)}
                  />
                ))}
              </div>
            </aside>

            <section className="min-w-0 p-4 sm:p-5">
              {selectedAnalysis ? (
                <StrategyDetail
                  analysis={selectedAnalysis}
                  rules={{
                    ...emptyStrategyRules,
                    ...(rulesById[String(selectedAnalysis.strategy.id)] ?? {}),
                  }}
                  onUpdateRules={(field, value) => updateRules(selectedAnalysis.strategy.id, field, value)}
                  onUpdateTiming={(value) => updateTiming(selectedAnalysis.strategy.id, value)}
                />
              ) : (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Selecciona una estrategia
                </p>
              )}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function StrategyListItem({
  analysis,
  active,
  onSelect,
  onDelete,
}: {
  analysis: StrategyAnalysis;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const firstWarning = analysis.healthTags.find((tag) => tag.tone !== "good") ?? analysis.healthTags[0];

  return (
    <div
      data-testid={`strategy-card-${analysis.strategy.id}`}
      data-active={active}
      className={cn(
        "surface-subtle group w-full rounded-lg p-3 text-left transition-colors hover:border-foreground/25",
        active && "border-foreground/30 bg-foreground/[0.06]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left">
          <p className="truncate text-sm font-semibold">{analysis.strategy.name}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {analysis.settledCount} resueltas · {analysis.pendingCount} pendiente{analysis.pendingCount === 1 ? "" : "s"}
          </p>
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
          className="rounded-md p-1 text-muted-foreground opacity-60 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
          data-testid={`button-delete-strategy-${analysis.strategy.id}`}
          aria-label={`Eliminar ${analysis.strategy.name}`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <button type="button" onClick={onSelect} className="mt-3 w-full text-left">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <p className="text-muted-foreground">P&L</p>
            <p className={cn("font-mono font-semibold", analysis.profit >= 0 ? "text-win" : "text-loss")}>
              {formatSignedUnits(analysis.profit)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Yield</p>
            <p className={cn("font-mono font-semibold", analysis.yieldPct >= 0 ? "text-win" : "text-loss")}>
              {formatSignedPct(analysis.yieldPct)}
            </p>
          </div>
        </div>

        {firstWarning && (
          <div className="mt-3">
            <HealthBadge tag={firstWarning} />
          </div>
        )}
      </button>
    </div>
  );
}

function StrategyDetail({
  analysis,
  rules,
  onUpdateRules,
  onUpdateTiming,
}: {
  analysis: StrategyAnalysis;
  rules: StrategyRules;
  onUpdateRules: (field: RuleField, value: string) => void;
  onUpdateTiming: (value: StrategyRules["timing"]) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Detalle de estrategia</p>
          <h2 className="mt-1 truncate text-2xl font-semibold tracking-tight">{analysis.strategy.name}</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {analysis.healthTags.map((tag) => (
            <HealthBadge key={`${tag.label}-${tag.tone}`} tag={tag} />
          ))}
        </div>
      </div>

      <DecisionCallout analysis={analysis} />

      <MetricsGrid analysis={analysis} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
        <section className="surface-panel min-w-0 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="mono-section-title">Evolución P&L</p>
              <p className="text-xs text-muted-foreground">Beneficio acumulado por apuesta resuelta</p>
            </div>
            <LineChart className="h-4 w-4 text-muted-foreground" />
          </div>
          <PnlSparkline points={analysis.pnlCurve} />
        </section>

        <section className="surface-panel p-4">
          <p className="mono-section-title">Mejor y peor</p>
          <div className="mt-3 space-y-3">
            <BetExtrema
              label="Mejor apuesta"
              snapshot={analysis.bestBet}
              icon={<ArrowUpRight className="h-4 w-4 text-win" />}
            />
            <BetExtrema
              label="Peor apuesta"
              snapshot={analysis.worstBet}
              icon={<ArrowDownRight className="h-4 w-4 text-loss" />}
            />
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(19rem,0.85fr)]">
        <section className="surface-panel min-w-0 p-4">
          <p className="mono-section-title">Últimas apuestas</p>
          <div className="mt-3 divide-y divide-border/70">
            {analysis.latestBets.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Sin apuestas asociadas</p>
            ) : (
              analysis.latestBets.map((snapshot) => (
                <BetRow key={snapshot.bet.id} snapshot={snapshot} />
              ))
            )}
          </div>
        </section>

        <section className="surface-panel p-4">
          <p className="mono-section-title">Ángulos principales</p>
          <div className="mt-3 space-y-4">
            <DimensionList title="Deportes" items={analysis.sports} />
            <DimensionList title="Ligas" items={analysis.leagues} />
            <DimensionList title="Mercados" items={analysis.markets} />
            <div className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2 text-xs">
              <span className="text-muted-foreground">Modo</span>
              <span className="font-mono">
                {analysis.preMatchCount} pre · {analysis.liveCount} live
              </span>
            </div>
          </div>
        </section>
      </div>

      <RulesPanel
        rules={rules}
        onUpdateRules={onUpdateRules}
        onUpdateTiming={onUpdateTiming}
      />
    </div>
  );
}

function DecisionCallout({ analysis }: { analysis: StrategyAnalysis }) {
  return (
    <section className={cn(
      "rounded-lg border px-4 py-3",
      analysis.decision.tone === "good" && "border-win/40 bg-win/10",
      analysis.decision.tone === "warning" && "border-pending/40 bg-pending/10",
      analysis.decision.tone === "danger" && "border-loss/40 bg-loss/10",
      analysis.decision.tone === "neutral" && "border-border bg-muted/30",
    )}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Decisión sugerida</p>
          <p className={cn(
            "mt-1 text-lg font-semibold",
            analysis.decision.tone === "good" && "text-win",
            analysis.decision.tone === "warning" && "text-pending",
            analysis.decision.tone === "danger" && "text-loss",
          )}>
            {analysis.decision.label}
          </p>
        </div>
        <p className="max-w-xl text-sm text-muted-foreground">
          {analysis.decision.reason}
        </p>
      </div>
    </section>
  );
}

function MetricsGrid({ analysis }: { analysis: StrategyAnalysis }) {
  const metrics = [
    { label: "P&L", value: formatSignedUnits(analysis.profit), tone: analysis.profit >= 0 ? "win" : "loss" },
    { label: "Yield", value: formatSignedPct(analysis.yieldPct), tone: analysis.yieldPct >= 0 ? "win" : "loss" },
	    { label: "Acierto", value: `${analysis.winRate.toFixed(0)}%`, tone: "default" },
    { label: "Resueltas", value: String(analysis.settledCount), tone: "default" },
    { label: "Pendientes", value: String(analysis.pendingCount), tone: analysis.pendingCount > 0 ? "pending" : "default" },
    { label: "Stake medio", value: `${analysis.averageStake.toFixed(2)}U`, tone: "default" },
    { label: "Cuota media", value: analysis.averageOdds > 0 ? analysis.averageOdds.toFixed(2) : "—", tone: "default" },
    { label: "DD máximo", value: `${analysis.maxDrawdownUnits.toFixed(2)}U`, tone: analysis.maxDrawdownUnits > 0 ? "loss" : "default" },
  ] as const;

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {metrics.map((metric) => (
        <div key={metric.label} className="metric-tile min-w-0 p-3">
          <p className="truncate text-[11px] uppercase tracking-wide text-muted-foreground">{metric.label}</p>
          <p className={cn(
            "mt-1 truncate font-mono text-lg font-semibold",
            metric.tone === "win" && "text-win",
            metric.tone === "loss" && "text-loss",
            metric.tone === "pending" && "text-pending",
          )}>
            {metric.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function BetExtrema({
  label,
  snapshot,
  icon,
}: {
  label: string;
  snapshot: StrategyBetSnapshot | null;
  icon: ReactNode;
}) {
  if (!snapshot) {
    return (
      <div className="rounded-lg border border-border/70 p-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-sm">Sin apuestas resueltas</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border/70 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        {icon}
      </div>
      <p className="mt-2 line-clamp-1 text-sm font-medium">{snapshot.bet.event}</p>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>{snapshot.date || "Sin fecha"}</span>
        <span>@{snapshot.odds.toFixed(2)}</span>
        <span>{snapshot.stake.toFixed(2)}U</span>
      </div>
      <p className={cn("mt-2 font-mono text-sm font-semibold", snapshot.profit >= 0 ? "text-win" : "text-loss")}>
        {formatSignedUnits(snapshot.profit)}
      </p>
    </div>
  );
}

function BetRow({ snapshot }: { snapshot: StrategyBetSnapshot }) {
  const label = statusLabel[snapshot.bet.status] ?? snapshot.bet.status;

  return (
    <div className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-sm font-medium">{snapshot.bet.event}</p>
          <Badge variant="outline" className="shrink-0 text-[10px]">
            {label}
          </Badge>
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {snapshot.date || "Sin fecha"} · {snapshot.bet.league} · {snapshot.bet.market}
        </p>
      </div>
      <div className="flex items-center justify-between gap-3 text-xs sm:justify-end">
        <span className="font-mono text-muted-foreground">@{snapshot.odds.toFixed(2)}</span>
        <span className="font-mono text-muted-foreground">{snapshot.stake.toFixed(2)}U</span>
        <span className={cn("font-mono font-semibold", snapshot.profit >= 0 ? "text-win" : "text-loss")}>
          {snapshot.isSettled ? formatSignedUnits(snapshot.profit) : "Pend."}
        </span>
      </div>
    </div>
  );
}

function DimensionList({ title, items }: { title: string; items: StrategyDimensionSummary[] }) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-muted-foreground">{title}</p>
      <div className="space-y-2">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sin datos</p>
        ) : (
          items.map((item) => (
            <div key={`${title}-${item.label}`} className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">{item.label}</span>
              <span className="shrink-0 font-mono text-xs text-muted-foreground">
                {item.count} · {formatSignedUnits(item.profit)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function PnlSparkline({ points }: { points: StrategyPnlPoint[] }) {
  if (points.length <= 1) {
    return (
      <div className="flex aspect-[16/6] items-center justify-center rounded-lg border border-dashed border-border/70 text-sm text-muted-foreground">
        Sin apuestas resueltas
      </div>
    );
  }

  const width = 640;
  const height = 220;
  const padding = 14;
  const profits = points.map((point) => point.profit);
  const minProfit = Math.min(...profits);
  const maxProfit = Math.max(...profits);
  const range = Math.max(1, maxProfit - minProfit);
  const maxIndex = Math.max(1, points.length - 1);
  const zeroY = padding + ((maxProfit - 0) / range) * (height - padding * 2);
  const coordinates = points.map((point, index) => {
    const x = padding + (index / maxIndex) * (width - padding * 2);
    const y = padding + ((maxProfit - point.profit) / range) * (height - padding * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const lastPoint = points[points.length - 1];

  return (
    <div className="overflow-hidden rounded-lg border border-border/70 bg-background/40">
      <svg viewBox={`0 0 ${width} ${height}`} className="block aspect-[16/6] w-full" role="img" aria-label="Evolución de P&L">
        <line x1={padding} x2={width - padding} y1={zeroY} y2={zeroY} className="stroke-border" strokeDasharray="5 5" />
        <polyline
          fill="none"
          points={coordinates}
          className={cn(lastPoint.profit >= 0 ? "stroke-win" : "stroke-loss")}
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="flex items-center justify-between border-t border-border/70 px-3 py-2 text-xs text-muted-foreground">
        <span>{points.length - 1} resueltas</span>
        <span className={cn("font-mono font-semibold", lastPoint.profit >= 0 ? "text-win" : "text-loss")}>
          {formatSignedUnits(lastPoint.profit)}
        </span>
      </div>
    </div>
  );
}

function RulesPanel({
  rules,
  onUpdateRules,
  onUpdateTiming,
}: {
  rules: StrategyRules;
  onUpdateRules: (field: RuleField, value: string) => void;
  onUpdateTiming: (value: StrategyRules["timing"]) => void;
}) {
  return (
    <section className="surface-panel p-4">
      <div className="mb-4 flex items-center gap-2">
        <Target className="h-4 w-4 text-muted-foreground" />
        <p className="mono-section-title">Reglas operativas</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 sm:col-span-2">
          <span className="text-xs text-muted-foreground">Descripción</span>
          <Textarea
            value={rules.description}
            onChange={(e) => onUpdateRules("description", e.target.value)}
            placeholder="Contexto, edge, filtros de entrada..."
            className="min-h-20 resize-none text-sm"
          />
        </label>

        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">Rango de cuota</span>
          <Input
            value={rules.oddsRange}
            onChange={(e) => onUpdateRules("oddsRange", e.target.value)}
            placeholder="1.70 - 2.30"
          />
        </label>

        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">Stake base</span>
          <Input
            value={rules.baseStake}
            onChange={(e) => onUpdateRules("baseStake", e.target.value)}
            placeholder="1U"
          />
        </label>

        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">Tipo</span>
          <Select value={rules.timing} onValueChange={(value) => onUpdateTiming(value as StrategyRules["timing"])}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Mixta</SelectItem>
              <SelectItem value="pre">Prepartido</SelectItem>
              <SelectItem value="live">Live</SelectItem>
            </SelectContent>
          </Select>
        </label>

        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">Límite de exposición</span>
          <Input
            value={rules.exposureLimit}
            onChange={(e) => onUpdateRules("exposureLimit", e.target.value)}
            placeholder="Máx. 4U abiertas"
          />
        </label>

        <label className="space-y-1 sm:col-span-2">
          <span className="text-xs text-muted-foreground">Deportes y mercados preferidos</span>
          <Input
            value={rules.preferredSportsMarkets}
            onChange={(e) => onUpdateRules("preferredSportsMarkets", e.target.value)}
            placeholder="Fútbol: asiáticos, over/under; Tenis: ML..."
          />
        </label>

        <label className="space-y-1 sm:col-span-2">
          <span className="text-xs text-muted-foreground">Condición de pausa</span>
          <Input
            value={rules.pauseCondition}
            onChange={(e) => onUpdateRules("pauseCondition", e.target.value)}
            placeholder="Pausar con 3 pérdidas seguidas o DD > 5U"
          />
        </label>
      </div>
    </section>
  );
}

function HealthBadge({ tag }: { tag: StrategyHealthTag }) {
  const icon = tag.tone === "danger" || tag.tone === "warning"
    ? <AlertTriangle className="h-3 w-3" />
    : null;

  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-full text-[11px]",
        tag.tone === "good" && "border-win/50 bg-win/10 text-win",
        tag.tone === "warning" && "border-pending/50 bg-pending/10 text-pending",
        tag.tone === "danger" && "border-loss/50 bg-loss/10 text-loss",
        tag.tone === "neutral" && "border-border text-muted-foreground",
      )}
    >
      {icon}
      {tag.label}
    </Badge>
  );
}

function formatSignedUnits(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}U`;
}

function formatSignedPct(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function areRulesEmpty(rules: StrategyRules): boolean {
  return (
    rules.timing === "any" &&
    rules.description.trim() === "" &&
    rules.oddsRange.trim() === "" &&
    rules.baseStake.trim() === "" &&
    rules.preferredSportsMarkets.trim() === "" &&
    rules.exposureLimit.trim() === "" &&
    rules.pauseCondition.trim() === ""
  );
}
