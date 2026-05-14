import { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Cell, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { Button } from "@/components/ui/button";
import { aggregateBets, aggregateYield } from "@/lib/bet-math";
import { calculateBetProfit } from "@/lib/bet-calculations";
import { isBetSettled } from "@/lib/bet-analysis";
import type { Bet } from "@shared/schema";

interface PnLHistogramProps {
  bets: Bet[];
  testId?: string;
}

// Bucket boundaries in bet units. Chosen so typical flat-stake profiles
// (1U wins, 2U value plays, occasional 5U long shots) each get their own bar.
// Buckets are half-open on the right: a result of exactly +2U lands in
// "+1 a +2".
const BUCKETS: Array<{ label: string; min: number; max: number }> = [
  { label: "≤ −5U", min: -Infinity, max: -5 },
  { label: "−5 a −2", min: -5, max: -2 },
  { label: "−2 a −1", min: -2, max: -1 },
  { label: "−1 a 0", min: -1, max: 0 },
  { label: "0 (cash)", min: 0, max: 0.0001 },
  { label: "0 a +1", min: 0.0001, max: 1 },
  { label: "+1 a +2", min: 1, max: 2 },
  { label: "+2 a +5", min: 2, max: 5 },
  { label: "> +5U", min: 5, max: Infinity },
];

function bucketize(values: number[]): number[] {
  const counts = BUCKETS.map(() => 0);
  for (const v of values) {
    for (let i = 0; i < BUCKETS.length; i++) {
      const b = BUCKETS[i];
      if (v >= b.min && v < b.max) {
        counts[i] += 1;
        break;
      }
    }
  }
  return counts;
}

/**
 * Histogram of per-bet profit outcomes with an "outlier trim" toggle.
 *
 * The key insight this chart reveals is whether a positive yield is
 * concentrated in a few extreme outcomes or distributed across the sample.
 * Trimming the top/bottom 5% and recomputing the yield simulates removing
 * the outliers: if the trimmed yield collapses, the result is highly
 * sensitive to a small number of bets.
 */
export function PnLHistogram({ bets, testId }: PnLHistogramProps) {
  const [trimOutliers, setTrimOutliers] = useState(false);

  const analysis = useMemo(() => {
    const fullYield = aggregateYield(aggregateBets(bets));

    // One pass: collect (profit, stake) for every bet that's neither void nor
    // pending (calculateBetProfit's isPending covers both flat pending and
    // partial escaleras). Sorting by profit lets the trimming slice both
    // profit and stake together, keeping yield math coherent.
    const pairs: Array<{ profit: number; stake: number }> = [];
    for (const bet of bets) {
      if (!isBetSettled(bet)) continue;
      const { profit, totalStake } = calculateBetProfit(bet, 1);
      pairs.push({ profit, stake: totalStake });
    }
    pairs.sort((a, b) => a.profit - b.profit);

    const dropped = trimOutliers ? Math.floor(pairs.length * 0.05) : 0;
    const kept = pairs.slice(dropped, pairs.length - dropped);
    const keptProfit = kept.reduce((s, p) => s + p.profit, 0);
    const keptStake = kept.reduce((s, p) => s + p.stake, 0);
    const trimmedYield = keptStake > 0 ? (keptProfit / keptStake) * 100 : 0;
    const mean = kept.length > 0 ? keptProfit / kept.length : 0;
    const counts = bucketize(kept.map(p => p.profit));

    return {
      buckets: BUCKETS.map((b, i) => ({ label: b.label, count: counts[i], min: b.min })),
      total: kept.length,
      fullYield,
      trimmedYield,
      mean,
    };
  }, [bets, trimOutliers]);

  if (analysis.total === 0 && !trimOutliers) {
    return (
      <div className="space-y-2" data-testid={testId}>
        <h3 className="text-sm font-medium">Distribución de P&L por apuesta</h3>
        <p className="text-xs text-muted-foreground py-3">Sin apuestas resueltas para analizar</p>
      </div>
    );
  }

  const yieldDelta = analysis.trimmedYield - analysis.fullYield;
  const warning = trimOutliers && analysis.fullYield > 0 && analysis.trimmedYield < 0;

  return (
    <div className="space-y-2" data-testid={testId}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium">Distribución de P&L por apuesta</h3>
          <p className="text-[10px] text-muted-foreground">
            {analysis.total} apuestas · media {analysis.mean >= 0 ? "+" : ""}{analysis.mean.toFixed(2)}U
          </p>
        </div>
        <Button
          variant={trimOutliers ? "default" : "ghost"}
          size="sm"
          className="text-[10px] h-6 px-2"
          onClick={() => setTrimOutliers(v => !v)}
          data-testid={`${testId}-trim`}
        >
          {trimOutliers ? `✓ sin 5% extremos` : "Quitar outliers"}
        </Button>
      </div>

      {trimOutliers && (
        <div
          className={`text-[10px] rounded-md px-2 py-1.5 font-mono ${
            warning ? "bg-destructive/10 text-destructive" : "bg-muted/50 text-muted-foreground"
          }`}
          data-testid={`${testId}-delta`}
        >
          Yield sin extremos: {analysis.trimmedYield >= 0 ? "+" : ""}{analysis.trimmedYield.toFixed(2)}%
          {" "}(vs {analysis.fullYield >= 0 ? "+" : ""}{analysis.fullYield.toFixed(2)}% completo,
          {" "}Δ {yieldDelta >= 0 ? "+" : ""}{yieldDelta.toFixed(2)}%)
          {warning && <> · la rentabilidad se concentra en resultados extremos</>}
        </div>
      )}

      <div className="h-52 sm:h-48 overflow-x-auto">
        <div className="min-w-[420px] h-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={analysis.buckets} margin={{ top: 4, right: 4, left: -20, bottom: 20 }}>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 9, fontFamily: "JetBrains Mono" }}
              tickLine={false}
              axisLine={false}
              interval={0}
              angle={-30}
              textAnchor="end"
              height={40}
            />
            <YAxis
              tick={{ fontSize: 9, fontFamily: "JetBrains Mono" }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
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
              }}
              formatter={(v: number) => [`${v} apuestas`, "Count"]}
            />
            <ReferenceLine x="0 (cash)" stroke="hsl(var(--muted-foreground))" strokeDasharray="2 2" />
            <Bar dataKey="count" radius={[3, 3, 0, 0]} isAnimationActive={false}>
              {analysis.buckets.map((b, i) => (
                <Cell key={i} fill={b.min < 0 ? "hsl(0, 84%, 60%)" : b.min > 0 ? "hsl(142, 71%, 45%)" : "hsl(var(--muted-foreground))"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
