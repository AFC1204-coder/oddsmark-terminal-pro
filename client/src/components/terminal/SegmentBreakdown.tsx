import { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Cell, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { Button } from "@/components/ui/button";
import { aggregateBets, aggregateYield, aggregateWinRate, type BetAggregate } from "@/lib/bet-math";
// Re-exported for backward compat — the helpers now live in lib/bet-dimensions.
// External callers (including the existing test file) import from here.
export { oddsBucket, stakeBucket, betTypeLabel } from "@/lib/bet-dimensions";
import type { Bet } from "@shared/schema";

export type SegmentMetric = "profit" | "yield" | "winrate" | "count";

interface SegmentBreakdownProps {
  /** Pre-filtered bet list — SegmentBreakdown does not filter further. */
  bets: Bet[];
  /** Section title, e.g. "Por Liga". */
  title: string;
  /**
   * Extract the segment key for a bet. Return `null` to exclude the bet from
   * the breakdown (e.g. when the field is empty or not applicable).
   */
  keyOf: (bet: Bet) => string | null;
  /** How many segments to display; the rest are rolled into "Otros". */
  topN?: number;
  /** Restrict the set of metrics the user can toggle between. */
  allowedMetrics?: SegmentMetric[];
  /** Initial metric. */
  defaultMetric?: SegmentMetric;
  /** Test id for the container div (for automated tests). */
  testId?: string;
}

type KeyedAggregate = BetAggregate & { key: string };

const METRIC_LABELS: Record<SegmentMetric, string> = {
  profit: "P&L",
  yield: "Yield %",
  winrate: "Acierto %",
  count: "Apuestas",
};

/**
 * Reusable chart that breaks down a bet list by an arbitrary dimension
 * (league, market, tipster, odds bucket…) and shows one of four metrics.
 *
 * - Profit and Yield/Winrate exclude pending bets.
 * - Count uses the total number of bets (including pending) so the user sees
 *   distribution of activity, not just resolved outcomes.
 * - Segments with fewer than `minSampleSize` settled bets are rendered in
 *   grey for Yield/Winrate, since small samples can lie.
 * - The top N by metric (excluding "Otros") are shown; the rest are
 *   aggregated into an "Otros" bar so totals still add up.
 */
// Below this many settled bets in a segment, yield/winrate are flagged as
// unreliable (rendered grey). 5 is a pragmatic floor for bet tracking UX.
const SMALL_SAMPLE_THRESHOLD = 5;

export function SegmentBreakdown({
  bets,
  title,
  keyOf,
  topN = 8,
  allowedMetrics = ["profit", "yield", "winrate", "count"],
  defaultMetric = "profit",
  testId,
}: SegmentBreakdownProps) {
  const [metric, setMetric] = useState<SegmentMetric>(defaultMetric);

  const segments = useMemo<KeyedAggregate[]>(() => {
    // Bucket bets by key first, then delegate the actual aggregation to the
    // shared aggregateBets helper so escalera / void / cashout semantics are
    // identical here and in the rest of the app.
    const buckets = new Map<string, Bet[]>();
    for (const bet of bets) {
      const key = keyOf(bet);
      if (!key) continue;
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = [];
        buckets.set(key, bucket);
      }
      bucket.push(bet);
    }
    return Array.from(buckets.entries()).map(([key, bs]) => ({ key, ...aggregateBets(bs) }));
  }, [bets, keyOf]);

  const chartData = useMemo(() => {
    if (segments.length === 0) return [];
    const valueOf = (s: KeyedAggregate): number => {
      switch (metric) {
        case "profit": return s.profit;
        case "yield": return aggregateYield(s);
        case "winrate": return aggregateWinRate(s);
        case "count": return s.total;
      }
    };

    // Sort by |value| so both big winners and big losers surface at the top —
    // a losing segment is just as interesting as a winning one.
    const sorted = [...segments].sort((a, b) => Math.abs(valueOf(b)) - Math.abs(valueOf(a)));
    const top = sorted.slice(0, topN);
    const rest = sorted.slice(topN);

    const rows = top.map(s => ({
      key: s.key,
      value: Math.round(valueOf(s) * 100) / 100,
      sample: s.settled,
      total: s.total,
      profit: Math.round(s.profit * 100) / 100,
      isSmallSample: metric !== "profit" && metric !== "count" && s.settled < SMALL_SAMPLE_THRESHOLD,
    }));

    if (rest.length > 0) {
      // Collapse the tail into "Otros" so totals stay honest.
      const acc: KeyedAggregate = rest.reduce<KeyedAggregate>(
        (a, s) => ({
          key: "Otros",
          total: a.total + s.total,
          settled: a.settled + s.settled,
          wins: a.wins + s.wins,
          losses: a.losses + s.losses,
          profit: a.profit + s.profit,
          stake: a.stake + s.stake,
          oddsSum: a.oddsSum + s.oddsSum,
        }),
        { key: "Otros", total: 0, settled: 0, wins: 0, losses: 0, profit: 0, stake: 0, oddsSum: 0 },
      );
      rows.push({
        key: "Otros",
        value: Math.round(valueOf(acc) * 100) / 100,
        sample: acc.settled,
        total: acc.total,
        profit: Math.round(acc.profit * 100) / 100,
        isSmallSample: false,
      });
    }
    return rows;
  }, [segments, metric, topN]);

  if (segments.length === 0) {
    return (
      <div className="space-y-2" data-testid={testId}>
        <h3 className="text-sm font-medium">{title}</h3>
        <p className="text-xs text-muted-foreground py-3">Sin datos para este segmento</p>
      </div>
    );
  }

  const isPercent = metric === "yield" || metric === "winrate";
  const suffix = isPercent ? "%" : "";
  const countTicks = useMemo(() => {
    if (metric !== "count") return undefined;
    const max = Math.max(0, ...chartData.map(row => row.value));
    if (max <= 6) {
      return Array.from({ length: Math.floor(max) + 1 }, (_, index) => index);
    }
    const step = Math.max(1, Math.ceil(max / 5));
    const ticks = Array.from({ length: Math.ceil(max / step) + 1 }, (_, index) => index * step);
    return ticks[ticks.length - 1] >= max ? ticks : [...ticks, Math.ceil(max)];
  }, [chartData, metric]);
  // Bars above zero are green (good), below zero red (bad).
  // Count/winrate don't have a meaningful zero — render in neutral blue.
  const colorFor = (value: number, isSmall: boolean, key: string) => {
    if (key === "Otros") return "hsl(var(--muted-foreground))";
    if (isSmall) return "hsl(0 0% 60%)"; // grey: small sample
    if (metric === "count") return "#06b6d4";
    if (metric === "winrate") return value >= 50 ? "hsl(142, 71%, 45%)" : "hsl(0, 84%, 60%)";
    return value >= 0 ? "hsl(142, 71%, 45%)" : "hsl(0, 84%, 60%)";
  };

  return (
    <div className="space-y-2" data-testid={testId}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h3 className="text-sm font-medium">{title}</h3>
        <div className="flex items-center gap-0.5 bg-muted/50 rounded-md p-0.5 overflow-x-auto max-w-full">
          {allowedMetrics.map(m => (
            <Button
              key={m}
              variant={metric === m ? "default" : "ghost"}
              size="sm"
              className={`text-[10px] h-6 px-2 ${
                metric === m ? "font-semibold" : "text-muted-foreground font-normal"
              }`}
              onClick={() => setMetric(m)}
              data-testid={`${testId}-metric-${m}`}
            >
              {METRIC_LABELS[m]}
            </Button>
          ))}
        </div>
      </div>
      <div className="h-56 overflow-x-auto">
        <div className="min-w-[360px] h-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 4, right: 12, left: 4, bottom: 4 }}
          >
            <XAxis
              type="number"
              allowDecimals={metric !== "count"}
              ticks={countTicks}
              tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => metric === "count" ? `${Math.round(Number(v))}` : `${v}${suffix}`}
            />
            <YAxis
              type="category"
              dataKey="key"
              tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }}
              tickLine={false}
              axisLine={false}
              width={90}
            />
            <Tooltip
              cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
              contentStyle={{
                backgroundColor: "hsl(0 0% 12%)",
                border: "none",
                borderRadius: "8px",
                color: "hsl(0 0% 98%)",
                fontSize: "11px",
                fontFamily: "JetBrains Mono",
                padding: "8px 10px",
              }}
              formatter={(_v: number, _n: string, entry: any) => {
                const row = entry?.payload;
                if (!row) return [`${_v}${suffix}`, METRIC_LABELS[metric]];
                const lines = [`${row.value}${suffix} · ${METRIC_LABELS[metric]}`];
                if (metric !== "profit") lines.push(`P&L: ${row.profit}`);
                lines.push(`${row.sample}/${row.total} resueltas`);
                if (row.isSmallSample) lines.push("⚠ muestra pequeña");
                return [lines.join("\n"), row.key];
              }}
              labelFormatter={() => ""}
            />
            <ReferenceLine
              x={metric === "winrate" ? 50 : 0}
              stroke="hsl(var(--muted-foreground))"
              strokeDasharray="3 3"
              strokeOpacity={0.5}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} isAnimationActive={false}>
              {chartData.map((row, i) => (
                <Cell key={i} fill={colorFor(row.value, row.isSmallSample, row.key)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
