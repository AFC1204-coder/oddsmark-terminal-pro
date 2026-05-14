"use client"

import type React from "react"

import { useMemo, useState } from "react"
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts"
import type { Bet, Strategy } from "@/lib/types"

const MARKET_CATEGORIES = {
  winner: {
    label: "MERCADOS PRINCIPALES",
    markets: [
      { id: "1x2", label: "Ganador 1x2" },
      { id: "moneyline", label: "Moneyline" },
      { id: "double-chance", label: "Doble Oportunidad" },
      { id: "asian-handicap", label: "Hándicap Asiático" },
      { id: "draw-no-bet", label: "Empate no Válido" },
    ],
  },
  props: {
    label: "MERCADOS DE PROPS",
    markets: [
      { id: "shots", label: "Remates" },
      { id: "shots-on-target", label: "A Puerta" },
      { id: "passes", label: "Pases" },
      { id: "tackles", label: "Entradas" },
      { id: "fouls", label: "Faltas" },
    ],
  },
  totals: {
    label: "GOLES / PUNTOS",
    markets: [
      { id: "over-under", label: "Over/Under" },
      { id: "btts", label: "BTTS" },
      { id: "corners", label: "Córners" },
    ],
  },
}

const CONTEXT_FILTERS = [
  { id: "live", label: "Live" },
  { id: "pre", label: "Pre-partido" },
]

const TACTIC_FILTERS = [
  { id: "4-3-3", label: "4-3-3" },
  { id: "4-4-2", label: "4-4-2" },
  { id: "3-5-2", label: "3-5-2" },
  { id: "4-2-3-1", label: "4-2-3-1" },
  { id: "5-3-2", label: "5-3-2" },
]

const COMPETITION_FILTERS = [
  { id: "laliga", label: "LaLiga" },
  { id: "premier", label: "Premier" },
  { id: "seriea", label: "Serie A" },
  { id: "bundesliga", label: "Bundesliga" },
  { id: "ligue1", label: "Ligue 1" },
  { id: "champions", label: "UCL" },
]

const BOOKIE_FILTERS = [
  { id: "bet365", label: "Bet365" },
  { id: "pinnacle", label: "Pinnacle" },
  { id: "betfair", label: "Betfair" },
  { id: "unibet", label: "Unibet" },
]

const POSITION_FILTERS = [
  { id: "dc", label: "DC" },
  { id: "mc", label: "MC" },
  { id: "ext", label: "EXT" },
  { id: "mp", label: "MP" },
]

interface StrategiesPanelProps {
  isOpen: boolean
  onClose: () => void
  strategies: Strategy[]
  bets: Bet[]
  unitValue: number
}

export function StrategiesPanel({ isOpen, onClose, strategies, bets, unitValue }: StrategiesPanelProps) {
  const [selectedMarkets, setSelectedMarkets] = useState<string[]>([])
  const [selectedPositions, setSelectedPositions] = useState<string[]>([])
  const [selectedContext, setSelectedContext] = useState<string[]>([])
  const [selectedTactics, setSelectedTactics] = useState<string[]>([])
  const [selectedCompetitions, setSelectedCompetitions] = useState<string[]>([])
  const [selectedBookies, setSelectedBookies] = useState<string[]>([])

  const toggleFilter = (id: string, current: string[], setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    setter((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]))
  }

  const filteredBets = useMemo(() => {
    if (
      selectedMarkets.length === 0 &&
      selectedPositions.length === 0 &&
      selectedContext.length === 0 &&
      selectedTactics.length === 0 &&
      selectedCompetitions.length === 0 &&
      selectedBookies.length === 0
    ) {
      return bets
    }

    return bets.filter((bet) => {
      const marketLower = bet.market?.toLowerCase() || ""
      const leagueLower = bet.league?.toLowerCase() || ""
      const bookieLower = bet.bookie?.toLowerCase() || ""

      // Filtrar por contexto (Live/Pre)
      if (selectedContext.length > 0) {
        const isLive = bet.isLive === true
        const matchesContext = selectedContext.some((c) => {
          if (c === "live") return isLive
          if (c === "pre") return !isLive
          return false
        })
        if (!matchesContext) return false
      }

      // Filtrar por competición
      if (selectedCompetitions.length > 0) {
        const matchesCompetition = selectedCompetitions.some((c) => {
          if (c === "laliga") return leagueLower.includes("laliga") || leagueLower.includes("liga")
          if (c === "premier") return leagueLower.includes("premier")
          if (c === "seriea") return leagueLower.includes("serie a") || leagueLower.includes("seriea")
          if (c === "bundesliga") return leagueLower.includes("bundesliga")
          if (c === "ligue1") return leagueLower.includes("ligue 1") || leagueLower.includes("ligue1")
          if (c === "champions") return leagueLower.includes("champion") || leagueLower.includes("ucl")
          return false
        })
        if (!matchesCompetition) return false
      }

      // Filtrar por casa de apuestas
      if (selectedBookies.length > 0) {
        const matchesBookie = selectedBookies.some((b) => bookieLower.includes(b))
        if (!matchesBookie) return false
      }

      // Filtrar por mercado
      if (selectedMarkets.length > 0) {
        const matchesMarket = selectedMarkets.some((m) => {
          if (m === "1x2") return marketLower.includes("1x2") || marketLower.includes("ganador")
          if (m === "moneyline") return marketLower.includes("moneyline") || marketLower.includes("ml")
          if (m === "double-chance") return marketLower.includes("doble") || marketLower.includes("dc")
          if (m === "asian-handicap") return marketLower.includes("handicap") || marketLower.includes("ah")
          if (m === "draw-no-bet") return marketLower.includes("dnb") || marketLower.includes("empate no")
          if (m === "shots") return marketLower.includes("remate") || marketLower.includes("shot")
          if (m === "shots-on-target") return marketLower.includes("tiro") || marketLower.includes("sot")
          if (m === "passes") return marketLower.includes("pase") || marketLower.includes("pass")
          if (m === "tackles") return marketLower.includes("entrada") || marketLower.includes("tackle")
          if (m === "fouls") return marketLower.includes("falta") || marketLower.includes("foul")
          if (m === "over-under")
            return marketLower.includes("over") || marketLower.includes("under") || marketLower.includes("o/u")
          if (m === "btts") return marketLower.includes("btts") || marketLower.includes("ambos")
          if (m === "corners") return marketLower.includes("corner") || marketLower.includes("córner")
          return false
        })
        if (!matchesMarket) return false
      }

      return true
    })
  }, [
    bets,
    selectedMarkets,
    selectedPositions,
    selectedContext,
    selectedTactics,
    selectedCompetitions,
    selectedBookies,
  ])

  const filteredStats = useMemo(() => {
    const settledBets = filteredBets.filter((b) => b.status !== "pending")
    const totalStaked = settledBets.reduce((acc, b) => acc + b.stake * unitValue, 0)
    const profit = settledBets.reduce((acc, b) => {
      if (b.status === "won") return acc + (b.stake * b.odds - b.stake) * unitValue
      if (b.status === "lost") return acc - b.stake * unitValue
      return acc
    }, 0)
    const yieldPct = totalStaked > 0 ? (profit / totalStaked) * 100 : 0
    const winRate =
      settledBets.length > 0 ? (settledBets.filter((b) => b.status === "won").length / settledBets.length) * 100 : 0

    let cumulative = 0
    const chartData = settledBets.map((b, i) => {
      const pnl = b.status === "won" ? (b.stake * b.odds - b.stake) * unitValue : -b.stake * unitValue
      cumulative += pnl
      return { index: i + 1, value: cumulative, profit: pnl }
    })

    return {
      totalBets: settledBets.length,
      totalStaked,
      profit,
      yieldPct,
      winRate,
      chartData: [{ index: 0, value: 0, profit: 0 }, ...chartData],
    }
  }, [filteredBets, unitValue])

  const strategyStats = useMemo(() => {
    return strategies.map((strategy) => {
      const stratBets = filteredBets.filter((b) => b.strategies?.includes(strategy.name) && b.status !== "pending")
      const totalStaked = stratBets.reduce((acc, b) => acc + b.stake * unitValue, 0)
      const profit = stratBets.reduce((acc, b) => {
        if (b.status === "won") return acc + (b.stake * b.odds - b.stake) * unitValue
        if (b.status === "lost") return acc - b.stake * unitValue
        return acc
      }, 0)
      const yieldPct = totalStaked > 0 ? (profit / totalStaked) * 100 : 0

      return { ...strategy, picks: stratBets.length, yieldPct, profit }
    })
  }, [strategies, filteredBets, unitValue])

  const hasPropsSelected = selectedMarkets.some((m) => MARKET_CATEGORIES.props.markets.some((pm) => pm.id === m))

  const totalFilters =
    selectedMarkets.length +
    selectedPositions.length +
    selectedContext.length +
    selectedTactics.length +
    selectedCompetitions.length +
    selectedBookies.length

  const clearAllFilters = () => {
    setSelectedMarkets([])
    setSelectedPositions([])
    setSelectedContext([])
    setSelectedTactics([])
    setSelectedCompetitions([])
    setSelectedBookies([])
  }

  if (!isOpen) return null

  const FilterChip = ({
    id,
    label,
    selected,
    onToggle,
    variant = "default",
  }: {
    id: string
    label: string
    selected: boolean
    onToggle: () => void
    variant?: "default" | "mono"
  }) => (
    <button
      onClick={onToggle}
      className={`px-3 py-1.5 text-xs ${variant === "mono" ? "font-mono" : "font-medium"} rounded-md border transition-all duration-200 ${
        selected
          ? "bg-emerald-950/50 border-emerald-700 text-emerald-400"
          : "bg-card border-border text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground"
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-xl">
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-semibold tracking-tight">ANÁLISIS DE INEFICIENCIAS</h2>
          <button onClick={onClose} className="text-2xl text-muted-foreground hover:text-foreground transition-colors">
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 border-b border-border space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-[10px] font-semibold tracking-[0.2em] text-muted-foreground mb-2 uppercase">
                  CONTEXTO
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {CONTEXT_FILTERS.map((filter) => (
                    <FilterChip
                      key={filter.id}
                      id={filter.id}
                      label={filter.label}
                      selected={selectedContext.includes(filter.id)}
                      onToggle={() => toggleFilter(filter.id, selectedContext, setSelectedContext)}
                    />
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-[10px] font-semibold tracking-[0.2em] text-muted-foreground mb-2 uppercase">
                  CASA
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {BOOKIE_FILTERS.map((filter) => (
                    <FilterChip
                      key={filter.id}
                      id={filter.id}
                      label={filter.label}
                      selected={selectedBookies.includes(filter.id)}
                      onToggle={() => toggleFilter(filter.id, selectedBookies, setSelectedBookies)}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-[10px] font-semibold tracking-[0.2em] text-muted-foreground mb-2 uppercase">
                COMPETICIÓN
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {COMPETITION_FILTERS.map((filter) => (
                  <FilterChip
                    key={filter.id}
                    id={filter.id}
                    label={filter.label}
                    selected={selectedCompetitions.includes(filter.id)}
                    onToggle={() => toggleFilter(filter.id, selectedCompetitions, setSelectedCompetitions)}
                  />
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-[10px] font-semibold tracking-[0.2em] text-muted-foreground mb-2 uppercase">
                TÁCTICA
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {TACTIC_FILTERS.map((filter) => (
                  <FilterChip
                    key={filter.id}
                    id={filter.id}
                    label={filter.label}
                    selected={selectedTactics.includes(filter.id)}
                    onToggle={() => toggleFilter(filter.id, selectedTactics, setSelectedTactics)}
                    variant="mono"
                  />
                ))}
              </div>
            </div>

            <div className="border-t border-border/50 pt-4" />

            {/* Mercados Principales */}
            <div>
              <h4 className="text-[10px] font-semibold tracking-[0.2em] text-muted-foreground mb-2 uppercase">
                {MARKET_CATEGORIES.winner.label}
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {MARKET_CATEGORIES.winner.markets.map((market) => (
                  <FilterChip
                    key={market.id}
                    id={market.id}
                    label={market.label}
                    selected={selectedMarkets.includes(market.id)}
                    onToggle={() => toggleFilter(market.id, selectedMarkets, setSelectedMarkets)}
                  />
                ))}
              </div>
            </div>

            {/* Mercados de Props */}
            <div>
              <h4 className="text-[10px] font-semibold tracking-[0.2em] text-muted-foreground mb-2 uppercase">
                {MARKET_CATEGORIES.props.label}
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {MARKET_CATEGORIES.props.markets.map((market) => (
                  <FilterChip
                    key={market.id}
                    id={market.id}
                    label={market.label}
                    selected={selectedMarkets.includes(market.id)}
                    onToggle={() => toggleFilter(market.id, selectedMarkets, setSelectedMarkets)}
                  />
                ))}
              </div>
            </div>

            {/* Filtros de Posición (solo si hay props seleccionados) */}
            {hasPropsSelected && (
              <div className="pt-2 border-t border-border/50">
                <h4 className="text-[10px] font-semibold tracking-[0.2em] text-muted-foreground mb-2 uppercase">
                  POSICIÓN DEL JUGADOR
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {POSITION_FILTERS.map((pos) => (
                    <FilterChip
                      key={pos.id}
                      id={pos.id}
                      label={pos.label}
                      selected={selectedPositions.includes(pos.id)}
                      onToggle={() => toggleFilter(pos.id, selectedPositions, setSelectedPositions)}
                      variant="mono"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Mercados de Goles/Puntos */}
            <div>
              <h4 className="text-[10px] font-semibold tracking-[0.2em] text-muted-foreground mb-2 uppercase">
                {MARKET_CATEGORIES.totals.label}
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {MARKET_CATEGORIES.totals.markets.map((market) => (
                  <FilterChip
                    key={market.id}
                    id={market.id}
                    label={market.label}
                    selected={selectedMarkets.includes(market.id)}
                    onToggle={() => toggleFilter(market.id, selectedMarkets, setSelectedMarkets)}
                  />
                ))}
              </div>
            </div>

            {/* Limpiar filtros */}
            {totalFilters > 0 && (
              <button
                onClick={clearAllFilters}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4"
              >
                Limpiar filtros ({totalFilters})
              </button>
            )}
          </div>

          {/* KPIs Grid */}
          <div className="grid grid-cols-4 gap-px bg-border mx-4 mt-4 rounded-lg overflow-hidden">
            <div className="bg-card p-3 text-center">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Picks</div>
              <div className="font-mono font-bold text-lg">{filteredStats.totalBets}</div>
            </div>
            <div className="bg-card p-3 text-center">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Yield</div>
              <div
                className={`font-mono font-bold text-lg ${filteredStats.yieldPct >= 0 ? "text-profit" : "text-loss"}`}
              >
                {filteredStats.yieldPct >= 0 ? "+" : ""}
                {filteredStats.yieldPct.toFixed(1)}%
              </div>
            </div>
            <div className="bg-card p-3 text-center">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Win Rate</div>
              <div className="font-mono font-bold text-lg">{filteredStats.winRate.toFixed(0)}%</div>
            </div>
            <div className="bg-card p-3 text-center">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">P/L</div>
              <div className={`font-mono font-bold text-lg ${filteredStats.profit >= 0 ? "text-profit" : "text-loss"}`}>
                {filteredStats.profit >= 0 ? "+" : ""}
                {filteredStats.profit.toFixed(0)}€
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="mx-4 mt-4">
            <div className="h-52 bg-card rounded-lg border border-border p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Evolución del Bankroll
                  {totalFilters > 0 && (
                    <span className="text-emerald-500 ml-2">
                      ({totalFilters} filtro{totalFilters > 1 ? "s" : ""})
                    </span>
                  )}
                </span>
              </div>
              <ResponsiveContainer width="100%" height="85%">
                <LineChart data={filteredStats.chartData}>
                  <XAxis dataKey="index" hide />
                  <YAxis hide domain={["dataMin - 10", "dataMax + 10"]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#141414",
                      border: "1px solid #262626",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    labelStyle={{ color: "#737373" }}
                    formatter={(value: number) => [`${value >= 0 ? "+" : ""}${value.toFixed(2)}€`, "P/L"]}
                    labelFormatter={(label) => `Pick #${label}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={filteredStats.profit >= 0 ? "#047857" : "#7f1d1d"}
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Strategy List */}
          <div className="p-4 space-y-3">
            <h4 className="text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase mb-3">
              RENDIMIENTO POR ESTRATEGIA
            </h4>
            {strategyStats.length > 0 ? (
              strategyStats.map((strat) => (
                <div
                  key={strat.id}
                  className="flex items-center justify-between p-4 bg-card rounded-lg border border-border hover:border-border/80 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-8 rounded-full" style={{ backgroundColor: strat.color }} />
                    <div>
                      <h3 className="font-medium text-foreground text-sm">{strat.name}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{strat.picks} picks</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-mono font-bold ${strat.yieldPct >= 0 ? "text-profit" : "text-loss"}`}>
                      {strat.yieldPct >= 0 ? "+" : ""}
                      {strat.yieldPct.toFixed(1)}%
                    </div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">yield</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">No hay estrategias definidas</div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border">
          <button
            onClick={onClose}
            className="w-full py-3.5 bg-card text-muted-foreground font-medium text-sm tracking-wider rounded-lg border border-border hover:bg-background hover:text-foreground transition-colors"
          >
            CERRAR
          </button>
        </div>
      </div>
    </div>
  )
}
