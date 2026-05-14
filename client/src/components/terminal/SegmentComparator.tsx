import { useMemo, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { aggregateBets, aggregateYield, aggregateWinRate, type BetAggregate } from "@/lib/bet-math";
import { buildBankrollSeries, type BankrollPoint } from "@/lib/bankroll-series";
import { SEGMENT_DIMENSIONS, getDimension, type SegmentDimensionId } from "@/lib/bet-dimensions";
import { getBetDisplayDate, isBetSettled } from "@/lib/bet-analysis";
import type { Bet } from "@shared/schema";

interface SegmentComparatorProps {
  bets: Bet[];
  testId?: string;
}

// Same floor SegmentBreakdown uses, so both features speak the same language
// about reliability. Below this many resolved bets, the ⚠ badge lights up.
const SMALL_SAMPLE_THRESHOLD = 5;

interface SideStats {
  agg: BetAggregate;
  yieldPct: number;
  winratePct: number;
  maxDrawdownPct: number;
  series: BankrollPoint[];
}

interface OverlayPoint {
  step: number;
  label: string;
  aProfit?: number;
  bProfit?: number;
}

function buildSideStats(bets: Bet[]): SideStats {
  const agg = aggregateBets(bets);
  const settled = bets.filter(isBetSettled);
  let series: BankrollPoint[] = [];
  if (settled.length > 0) {
    const sorted = [...settled].sort((a, b) => getBetDisplayDate(a).localeCompare(getBetDisplayDate(b)));
    const firstDate = getBetDisplayDate(sorted[0]) || new Date().toISOString().slice(0, 10);
    series = buildBankrollSeries({
      bets: sorted,
      transactions: [],
      unitValue: 1,
      currency: "money",
      openingBankrollEUR: 0,
      openingDate: firstDate,
      aggregation: "bet",
    });
  }
  // Derive max drawdown from the series we already have — one walk, not two.
  const maxDrawdownPct = series.reduce((m, p) => Math.min(m, p.drawdownPct), 0);
  return {
    agg,
    yieldPct: aggregateYield(agg),
    winratePct: aggregateWinRate(agg),
    maxDrawdownPct,
    series,
  };
}

function buildOverlaySeries(a: BankrollPoint[], b: BankrollPoint[]): OverlayPoint[] {
  const maxLength = Math.max(a.length, b.length);
  return Array.from({ length: maxLength }, (_, index) => ({
    step: index,
    label: index === 0 ? "Inicio" : `#${index}`,
    aProfit: a[index]?.profit,
    bProfit: b[index]?.profit,
  }));
}

/**
 * Side-by-side comparator for two values of a single dimension (league vs
 * league, tipster vs tipster, odds bucket vs odds bucket, …). Answers the
 * single most useful post-analysis question: "which of these two buckets is
 * actually better, and by how much?"
 *
 * Deliberate scope choice: no duplicate filter panel. If the user needs
 * "La Liga AND cuota > 2 vs Premier AND cuota > 2", they apply cuota > 2 in
 * the main AnalyticsModal filters and the comparator works over the subset.
 */
export function SegmentComparator({ bets, testId }: SegmentComparatorProps) {
  const [dimensionId, setDimensionId] = useState<SegmentDimensionId>("league");
  const [sideA, setSideA] = useState<string | null>(null);
  const [sideB, setSideB] = useState<string | null>(null);

  const dimension = getDimension(dimensionId);

  // Single walk of `bets` per dimension change: group into Map<value, Bet[]>
  // AND derive the ordered counts list. Downstream `betsA`/`betsB` are O(1)
  // map lookups instead of two more O(n) filters.
  const { valuesWithCounts, groups } = useMemo(() => {
    const groups = new Map<string, Bet[]>();
    for (const bet of bets) {
      const key = dimension.keyOf(bet);
      if (!key) continue;
      let list = groups.get(key);
      if (!list) {
        list = [];
        groups.set(key, list);
      }
      list.push(bet);
    }
    const valuesWithCounts = Array.from(groups.entries())
      .sort((a, b) => b[1].length - a[1].length)
      .map(([value, list]) => ({ value, count: list.length }));
    return { valuesWithCounts, groups };
  }, [bets, dimension]);

  // Fall back to the top two segments when the user hasn't picked yet or the
  // current picks are stale (e.g. the user edited a bet and its league vanished).
  const effectiveA = sideA && groups.has(sideA) ? sideA : valuesWithCounts[0]?.value ?? null;
  const effectiveB = sideB && groups.has(sideB) ? sideB : valuesWithCounts[1]?.value ?? null;

  const betsA = effectiveA ? groups.get(effectiveA) ?? [] : [];
  const betsB = effectiveB ? groups.get(effectiveB) ?? [] : [];
  const statsA = useMemo(() => buildSideStats(betsA), [betsA]);
  const statsB = useMemo(() => buildSideStats(betsB), [betsB]);
  const overlaySeries = useMemo(() => buildOverlaySeries(statsA.series, statsB.series), [statsA.series, statsB.series]);

  if (valuesWithCounts.length < 2) {
    return (
      <div className="space-y-2" data-testid={testId}>
        <h3 className="text-sm font-medium">Comparador A/B</h3>
        <p className="text-xs text-muted-foreground py-3">
          Se necesitan al menos dos valores distintos en esta dimensión para comparar.
        </p>
      </div>
    );
  }

  const sameSelection = effectiveA !== null && effectiveA === effectiveB;

  return (
    <div className="space-y-3" data-testid={testId}>
      <h3 className="text-sm font-medium">Comparador A/B</h3>

      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-3 sm:col-span-1">
          <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Dimensión</label>
          <Select
            value={dimensionId}
            onValueChange={(v) => {
              setDimensionId(v as SegmentDimensionId);
              setSideA(null);
              setSideB(null);
            }}
          >
            <SelectTrigger className="h-8 text-xs mt-0.5" data-testid={`${testId}-dimension`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SEGMENT_DIMENSIONS.map(d => (
                <SelectItem key={d.id} value={d.id} className="text-xs">{d.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-3 sm:col-span-1">
          <label className="text-[10px] text-muted-foreground uppercase tracking-wide">A</label>
          <Select value={effectiveA ?? undefined} onValueChange={setSideA}>
            <SelectTrigger className="h-8 text-xs mt-0.5" data-testid={`${testId}-side-a`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {valuesWithCounts
                .filter(v => v.value !== effectiveB)
                .map(v => (
                  <SelectItem key={v.value} value={v.value} className="text-xs">
                    {v.value} ({v.count})
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-3 sm:col-span-1">
          <label className="text-[10px] text-muted-foreground uppercase tracking-wide">B</label>
          <Select value={effectiveB ?? undefined} onValueChange={setSideB}>
            <SelectTrigger className="h-8 text-xs mt-0.5" data-testid={`${testId}-side-b`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {valuesWithCounts
                .filter(v => v.value !== effectiveA)
                .map(v => (
                  <SelectItem key={v.value} value={v.value} className="text-xs">
                    {v.value} ({v.count})
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {sameSelection && (
        <div className="text-[10px] rounded-md bg-amber-500/10 text-amber-500 px-2 py-1.5 font-mono">
          A y B son el mismo segmento — elige valores distintos.
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <SideCard label="A" title={effectiveA ?? "—"} stats={statsA} color="hsl(142, 71%, 45%)" testId={`${testId}-card-a`} />
        <SideCard label="B" title={effectiveB ?? "—"} stats={statsB} color="#38bdf8" testId={`${testId}-card-b`} />
      </div>

      <OverlayChart
        data={overlaySeries}
        titleA={effectiveA ?? "A"}
        titleB={effectiveB ?? "B"}
        testId={`${testId}-overlay`}
      />

      <DeltaRow a={statsA} b={statsB} testId={`${testId}-delta`} />
    </div>
  );
}

function SideCard({
  label, title, stats, color, testId,
}: { label: string; title: string; stats: SideStats; color: string; testId: string }) {
  const profitColor = stats.agg.profit >= 0 ? "text-win" : "text-loss";
  const yieldColor = stats.yieldPct >= 0 ? "text-win" : "text-loss";
  const isSmall = stats.agg.settled > 0 && stats.agg.settled < SMALL_SAMPLE_THRESHOLD;

  return (
    <div className="rounded-md border border-border p-2 space-y-1.5" data-testid={testId}>
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0">
          <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</p>
          <p className="text-xs font-semibold truncate" title={title}>{title}</p>
        </div>
        <div className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
          {isSmall && (
            <span className="text-[9px] text-amber-500" title="Muestra pequeña">⚠</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] font-mono">
        <span className="text-muted-foreground">P&L</span>
        <span className={`text-right ${profitColor}`}>
          {stats.agg.profit >= 0 ? "+" : ""}{stats.agg.profit.toFixed(2)}U
        </span>

        <span className="text-muted-foreground">Yield</span>
        <span className={`text-right ${yieldColor}`}>
          {stats.yieldPct >= 0 ? "+" : ""}{stats.yieldPct.toFixed(2)}%
        </span>

        <span className="text-muted-foreground">Acierto</span>
        <span className="text-right">{stats.winratePct.toFixed(1)}%</span>

        <span className="text-muted-foreground">N</span>
        <span className="text-right">{stats.agg.settled}/{stats.agg.total}</span>

        <span className="text-muted-foreground">Max DD</span>
        <span className="text-right text-loss">{stats.maxDrawdownPct.toFixed(1)}%</span>
      </div>

    </div>
  );
}

function OverlayChart({
  data, titleA, titleB, testId,
}: { data: OverlayPoint[]; titleA: string; titleB: string; testId: string }) {
  const hasEnoughData = data.some(point => point.aProfit !== undefined) && data.some(point => point.bProfit !== undefined);
  if (!hasEnoughData) return null;

  return (
    <div className="rounded-md border border-border bg-muted/20 px-2.5 py-2" data-testid={testId}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Evoluciones superpuestas</p>
        <div className="flex min-w-0 items-center gap-2 text-[9px] font-mono">
          <span className="flex min-w-0 items-center gap-1 text-win">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-win" />
            <span className="truncate max-w-20">{titleA}</span>
          </span>
          <span className="flex min-w-0 items-center gap-1 text-sky-300">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sky-300" />
            <span className="truncate max-w-20">{titleB}</span>
          </span>
        </div>
      </div>
      <div className="h-28 -mx-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
              minTickGap={12}
            />
            <YAxis
              width={28}
              tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
              domain={["dataMin", "dataMax"]}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "6px",
                color: "hsl(var(--popover-foreground))",
                fontSize: "10px",
                padding: "4px 6px",
              }}
              formatter={(value: number, name: string) => [
                `${value >= 0 ? "+" : ""}${value.toFixed(2)}U`,
                name === "aProfit" ? "A" : "B",
              ]}
              labelFormatter={(label) => `Resuelta ${label}`}
            />
            <Line
              type="monotone"
              dataKey="aProfit"
              stroke="hsl(var(--win))"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3 }}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="bProfit"
              stroke="#38bdf8"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function DeltaRow({ a, b, testId }: { a: SideStats; b: SideStats; testId: string }) {
  const profitDelta = a.agg.profit - b.agg.profit;
  const yieldDelta = a.yieldPct - b.yieldPct;
  const winrateDelta = a.winratePct - b.winratePct;

  const fmt = (v: number, suffix: string, decimals = 2) =>
    `${v >= 0 ? "+" : ""}${v.toFixed(decimals)}${suffix}`;
  // Positive delta = A is better, so the card order left→right reads as
  // "A's advantage over B". Sign flips invert the color.
  const cls = (v: number) => (v > 0 ? "text-win" : v < 0 ? "text-loss" : "text-muted-foreground");

  return (
    <div
      className="rounded-md bg-muted/40 px-2 py-1.5 text-[10px] font-mono grid grid-cols-3 gap-2"
      data-testid={testId}
    >
      <div className="text-center">
        <div className="text-muted-foreground text-[9px] uppercase tracking-wider">ΔP&L (A-B)</div>
        <div className={cls(profitDelta)}>{fmt(profitDelta, "U")}</div>
      </div>
      <div className="text-center">
        <div className="text-muted-foreground text-[9px] uppercase tracking-wider">ΔYield</div>
        <div className={cls(yieldDelta)}>{fmt(yieldDelta, "%")}</div>
      </div>
      <div className="text-center">
        <div className="text-muted-foreground text-[9px] uppercase tracking-wider">ΔAcierto</div>
        <div className={cls(winrateDelta)}>{fmt(winrateDelta, "%", 1)}</div>
      </div>
    </div>
  );
}
