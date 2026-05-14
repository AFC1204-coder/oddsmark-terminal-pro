"use client"

interface KPIGridProps {
  bankroll: number
  profit: number
  yieldPct: number
  avgOdds: number
  avgStake: number
  targetCapital: number
  unitValue: number
  currency: string
}

export function KPIGrid({
  bankroll,
  profit,
  yieldPct,
  avgOdds,
  avgStake,
  targetCapital,
  unitValue,
  currency,
}: KPIGridProps) {
  const progressPct = targetCapital > 0 ? Math.min((bankroll / targetCapital) * 100, 100) : 0
  const currencySymbol = currency === "EUR" ? "€" : "$"

  return (
    <div className="py-6 space-y-3">
      {/* Main KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <KPICard
          label="BANKROLL"
          value={`${currencySymbol}${bankroll.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          progress={progressPct}
        />
        <KPICard
          label="PROFIT"
          value={`${profit >= 0 ? "+" : ""}${currencySymbol}${profit.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          valueClass={profit >= 0 ? "text-profit" : "text-loss"}
        />
        <KPICard
          label="YIELD"
          value={`${yieldPct >= 0 ? "+" : ""}${yieldPct.toFixed(1)}%`}
          valueClass={yieldPct >= 0 ? "text-profit" : "text-loss"}
        />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <KPICard label="CUOTA MEDIA" value={avgOdds.toFixed(2)} />
        <KPICard label="STAKE MEDIO" value={`${avgStake.toFixed(1)}u`} />
      </div>
    </div>
  )
}

function KPICard({
  label,
  value,
  valueClass = "text-foreground",
  progress,
}: {
  label: string
  value: string
  valueClass?: string
  progress?: number
}) {
  return (
    <div className="relative bg-card rounded-xl border border-border p-4 overflow-hidden">
      <div className="text-[10px] font-semibold text-muted-foreground tracking-wider mb-2">{label}</div>
      <div className={`font-mono font-bold text-lg ${valueClass}`}>{value}</div>
      {progress !== undefined && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-border">
          <div className="h-full bg-accent transition-all duration-1000 ease-out" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  )
}
