"use client"

import { useState, useMemo, useEffect } from "react"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
  Brush,
} from "recharts"
import type { Bet, Settings } from "@/lib/types"

interface BankrollChartProps {
  bets: Bet[]
  settings: Settings
  onPeriodChange?: (stats: { profit: number; yieldPct: number; bankroll: number }) => void
}

type TimeRange = "1D" | "1W" | "1M" | "3M" | "6M" | "1Y" | "ALL"

interface ChartDataPoint {
  name: string
  date: string
  timeLabel?: string
  fullDate: string
  value: number
  pnl: number
  timestamp: number
}

function CustomTooltip({ active, payload, timeRange }: { active?: boolean; payload?: any[]; timeRange: TimeRange }) {
  if (active && payload && payload.length) {
    const data = payload[0].payload as ChartDataPoint
    const pnl = data.pnl || 0

    const formatDate = () => {
      if (timeRange === "1D" && data.timeLabel) {
        return data.timeLabel
      }
      return data.fullDate || data.date
    }

    return (
      <div className="bg-[#141414] border border-border rounded-lg p-3 shadow-xl">
        <p className="text-[10px] text-muted-foreground font-mono mb-2">{formatDate()}</p>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-4">
            <span className="text-[10px] text-muted-foreground">BANKROLL</span>
            <span className="text-sm font-mono font-bold text-foreground">€{data.value.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-[10px] text-muted-foreground">P/L NETO</span>
            <span className={`text-sm font-mono font-bold ${pnl >= 0 ? "text-profit" : "text-loss"}`}>
              {pnl >= 0 ? "+" : ""}€{pnl.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    )
  }
  return null
}

function generateMockData(period: TimeRange, initialCapital: number): ChartDataPoint[] {
  const now = new Date()
  const data: ChartDataPoint[] = []
  let cumulative = initialCapital

  const randomPnL = () => {
    const base = Math.random() * 50 - 20
    return Math.round(base * 100) / 100
  }

  switch (period) {
    case "1D": {
      const times = [
        { hour: 13, minute: 0 },
        { hour: 15, minute: 30 },
        { hour: 17, minute: 0 },
        { hour: 19, minute: 45 },
        { hour: 21, minute: 0 },
        { hour: 22, minute: 30 },
      ]

      data.push({
        name: "Inicio",
        date: "00:00",
        timeLabel: "00:00 - Inicio del día",
        fullDate: now.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" }),
        value: initialCapital,
        pnl: 0,
        timestamp: new Date(now).setHours(0, 0, 0, 0),
      })

      times.forEach((time, idx) => {
        const pnl = [18, -12, 25, -8, 32, 15][idx] || randomPnL()
        cumulative += pnl
        const timeStr = `${time.hour.toString().padStart(2, "0")}:${time.minute.toString().padStart(2, "0")}`

        data.push({
          name: `#${idx + 1}`,
          date: timeStr,
          timeLabel: `${timeStr} - Apuesta #${idx + 1}`,
          fullDate: `Hoy ${timeStr}`,
          value: cumulative,
          pnl,
          timestamp: new Date(now).setHours(time.hour, time.minute),
        })
      })
      break
    }

    case "1W": {
      const days = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
      const pnls = [22, -15, 35, 12, -8, 45, 28]

      data.push({
        name: "Inicio",
        date: "Inicio",
        fullDate: "Inicio de semana",
        value: initialCapital,
        pnl: 0,
        timestamp: now.getTime() - 7 * 24 * 60 * 60 * 1000,
      })

      days.forEach((day, idx) => {
        const pnl = pnls[idx]
        cumulative += pnl
        const dateObj = new Date(now.getTime() - (6 - idx) * 24 * 60 * 60 * 1000)

        data.push({
          name: day,
          date: day,
          fullDate: dateObj.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "short" }),
          value: cumulative,
          pnl,
          timestamp: dateObj.getTime(),
        })
      })
      break
    }

    case "1M": {
      const pnls = [15, -22, 38, 12, 45, -8, 32, 55]

      data.push({
        name: "Inicio",
        date: "Inicio",
        fullDate: "Inicio del mes",
        value: initialCapital,
        pnl: 0,
        timestamp: now.getTime() - 30 * 24 * 60 * 60 * 1000,
      })

      pnls.forEach((pnl, idx) => {
        cumulative += pnl
        const daysAgo = Math.floor(30 - (idx * 30) / pnls.length)
        const dateObj = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000)

        data.push({
          name: `#${idx + 1}`,
          date: `${dateObj.getDate()}/${dateObj.getMonth() + 1}`,
          fullDate: dateObj.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" }),
          value: cumulative,
          pnl,
          timestamp: dateObj.getTime(),
        })
      })
      break
    }

    case "3M": {
      const weeks = 12
      const pnls = [25, -18, 42, 15, -28, 55, 22, -12, 38, 18, -8, 65]

      data.push({
        name: "Inicio",
        date: "Inicio",
        fullDate: "Hace 3 meses",
        value: initialCapital,
        pnl: 0,
        timestamp: now.getTime() - 90 * 24 * 60 * 60 * 1000,
      })

      for (let i = 0; i < weeks; i++) {
        const pnl = pnls[i] || randomPnL()
        cumulative += pnl
        const daysAgo = Math.floor(90 - (i * 90) / weeks)
        const dateObj = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000)

        data.push({
          name: `S${i + 1}`,
          date: `${dateObj.getDate()}/${dateObj.getMonth() + 1}`,
          fullDate: dateObj.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }),
          value: cumulative,
          pnl,
          timestamp: dateObj.getTime(),
        })
      }
      break
    }

    case "6M": {
      const points = 12
      const pnls = [35, -25, 48, 22, -32, 65, 28, -15, 52, 35, -18, 78]

      data.push({
        name: "Inicio",
        date: "Inicio",
        fullDate: "Hace 6 meses",
        value: initialCapital,
        pnl: 0,
        timestamp: now.getTime() - 180 * 24 * 60 * 60 * 1000,
      })

      for (let i = 0; i < points; i++) {
        const pnl = pnls[i] || randomPnL()
        cumulative += pnl
        const daysAgo = Math.floor(180 - (i * 180) / points)
        const dateObj = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000)

        data.push({
          name: `Q${i + 1}`,
          date: dateObj.toLocaleDateString("es-ES", { day: "numeric", month: "short" }),
          fullDate: dateObj.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }),
          value: cumulative,
          pnl,
          timestamp: dateObj.getTime(),
        })
      }
      break
    }

    case "1Y": {
      const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
      const pnls = [45, -35, 68, 32, -42, 85, 38, -22, 72, 45, -28, 95]

      data.push({
        name: "Inicio",
        date: "Inicio",
        fullDate: "Hace 1 año",
        value: initialCapital,
        pnl: 0,
        timestamp: now.getTime() - 365 * 24 * 60 * 60 * 1000,
      })

      months.forEach((month, idx) => {
        const pnl = pnls[idx]
        cumulative += pnl
        const dateObj = new Date(now)
        dateObj.setMonth(now.getMonth() - 11 + idx)

        data.push({
          name: month,
          date: month,
          fullDate: dateObj.toLocaleDateString("es-ES", { month: "long", year: "numeric" }),
          value: cumulative,
          pnl,
          timestamp: dateObj.getTime(),
        })
      })
      break
    }

    default:
      return generateMockData("1Y", initialCapital)
  }

  return data
}

export function BankrollChart({ bets, settings, onPeriodChange }: BankrollChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>("ALL")

  const filteredBets = useMemo(() => {
    const completedBets = bets.filter((b) => b.status !== "pending")

    if (timeRange === "ALL") return completedBets

    const now = new Date()
    const cutoffDate = new Date()

    switch (timeRange) {
      case "1D":
        cutoffDate.setHours(0, 0, 0, 0)
        break
      case "1W":
        cutoffDate.setDate(now.getDate() - 7)
        break
      case "1M":
        cutoffDate.setMonth(now.getMonth() - 1)
        break
      case "3M":
        cutoffDate.setMonth(now.getMonth() - 3)
        break
      case "6M":
        cutoffDate.setMonth(now.getMonth() - 6)
        break
      case "1Y":
        cutoffDate.setFullYear(now.getFullYear() - 1)
        break
    }

    return completedBets.filter((b) => new Date(b.date) >= cutoffDate)
  }, [bets, timeRange])

  const chartData = useMemo(() => {
    const minDataPoints = {
      "1D": 3,
      "1W": 4,
      "1M": 5,
      "3M": 6,
      "6M": 6,
      "1Y": 6,
      ALL: 3,
    }

    if (filteredBets.length < minDataPoints[timeRange]) {
      return generateMockData(timeRange, settings.initialCapital)
    }

    const sortedBets = [...filteredBets].sort((a, b) => {
      const dateA = new Date(`${a.date}T${a.time || "12:00"}`)
      const dateB = new Date(`${b.date}T${b.time || "12:00"}`)
      return dateA.getTime() - dateB.getTime()
    })

    const betsBeforePeriod = bets
      .filter((b) => b.status !== "pending" && !filteredBets.includes(b))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    let startingBankroll = settings.initialCapital
    betsBeforePeriod.forEach((bet) => {
      const pnl =
        bet.status === "won" ? (bet.stake * bet.odds - bet.stake) * settings.unitValue : -bet.stake * settings.unitValue
      startingBankroll += pnl
    })

    let cumulative = startingBankroll

    const data: ChartDataPoint[] = [
      {
        name: "Inicio",
        date: timeRange === "1D" ? "00:00" : "Inicio",
        timeLabel: timeRange === "1D" ? "00:00 - Inicio del día" : undefined,
        fullDate: timeRange === "ALL" ? "Capital Inicial" : `Inicio período ${timeRange}`,
        value: startingBankroll,
        pnl: 0,
        timestamp: 0,
      },
    ]

    sortedBets.forEach((bet, index) => {
      const pnl =
        bet.status === "won" ? (bet.stake * bet.odds - bet.stake) * settings.unitValue : -bet.stake * settings.unitValue
      cumulative += pnl

      const dateObj = new Date(`${bet.date}T${bet.time || "12:00"}`)
      let formattedDate: string
      let timeLabel: string | undefined

      switch (timeRange) {
        case "1D":
          formattedDate = dateObj.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })
          timeLabel = `${formattedDate} - ${bet.event}`
          break
        case "1W":
          formattedDate = dateObj.toLocaleDateString("es-ES", { weekday: "short" })
          break
        case "1M":
          formattedDate = `${dateObj.getDate()}/${dateObj.getMonth() + 1}`
          break
        case "3M":
        case "6M":
          formattedDate = `${dateObj.getDate()}/${dateObj.getMonth() + 1}`
          break
        case "1Y":
          formattedDate = dateObj.toLocaleDateString("es-ES", { month: "short" })
          break
        default:
          formattedDate = dateObj.toLocaleDateString("es-ES", { day: "numeric", month: "short" })
      }

      data.push({
        name: `#${index + 1}`,
        date: formattedDate,
        timeLabel,
        fullDate: dateObj.toLocaleDateString("es-ES", {
          weekday: "short",
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        value: cumulative,
        pnl,
        timestamp: dateObj.getTime(),
      })
    })

    return data
  }, [filteredBets, bets, settings, timeRange])

  const periodStats = useMemo(() => {
    if (chartData.length > 1) {
      const lastPoint = chartData[chartData.length - 1]
      const firstPoint = chartData[0]
      const profit = lastPoint.value - firstPoint.value
      const totalStaked = chartData.slice(1).reduce((acc, d) => acc + Math.abs(d.pnl), 0)
      const yieldPct = totalStaked > 0 ? (profit / totalStaked) * 100 : 0
      return { profit, yieldPct, bankroll: lastPoint.value }
    }
    return { profit: 0, yieldPct: 0, bankroll: settings.initialCapital }
  }, [chartData, settings.initialCapital])

  useEffect(() => {
    onPeriodChange?.(periodStats)
  }, [periodStats, onPeriodChange])

  const handleTimeRangeChange = (range: TimeRange) => {
    setTimeRange(range)
  }

  const currentValue = chartData[chartData.length - 1]?.value || settings.initialCapital
  const startValue = chartData[0]?.value || settings.initialCapital
  const isPositive = currentValue >= startValue
  const percentChange = ((currentValue - startValue) / startValue) * 100

  const formatYAxis = (value: number) => {
    if (value >= 1000) return `€${(value / 1000).toFixed(1)}k`
    return `€${value.toFixed(0)}`
  }

  const timeRanges: TimeRange[] = ["1D", "1W", "1M", "3M", "6M", "1Y", "ALL"]

  const getPeriodLabel = () => {
    switch (timeRange) {
      case "1D":
        return "hoy"
      case "1W":
        return "últimos 7 días"
      case "1M":
        return "último mes"
      case "3M":
        return "últimos 3 meses"
      case "6M":
        return "últimos 6 meses"
      case "1Y":
        return "último año"
      case "ALL":
        return "total"
    }
  }

  return (
    <div className="border-y border-border py-6">
      <div className="flex items-center justify-between px-4 mb-4">
        <div>
          <span className="text-[10px] font-bold text-muted-foreground tracking-wider">
            EVOLUCIÓN BANKROLL
            {timeRange !== "ALL" && <span className="text-accent ml-2">({timeRange})</span>}
          </span>
          <div className="flex items-baseline gap-3 mt-1">
            <span className="font-mono text-2xl font-bold text-foreground">€{currentValue.toFixed(2)}</span>
            <span className={`font-mono text-sm font-semibold ${isPositive ? "text-profit" : "text-loss"}`}>
              {isPositive ? "+" : ""}
              {percentChange.toFixed(2)}%
            </span>
            <span className={`font-mono text-xs ${periodStats.profit >= 0 ? "text-profit/70" : "text-loss/70"}`}>
              ({periodStats.profit >= 0 ? "+" : ""}€{periodStats.profit.toFixed(2)})
            </span>
          </div>
        </div>
        <div className="flex gap-1">
          {timeRanges.map((range) => (
            <button
              key={range}
              onClick={() => handleTimeRangeChange(range)}
              className={`px-2.5 py-1.5 text-[10px] font-bold tracking-wide rounded transition-all duration-200 ${
                timeRange === range
                  ? "bg-card text-foreground border border-accent/50 shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/50"
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      <div className="h-64 px-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 30 }}>
            <defs>
              <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#047857" stopOpacity={0.5} />
                <stop offset="50%" stopColor="#047857" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#047857" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorLoss" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7f1d1d" stopOpacity={0.5} />
                <stop offset="50%" stopColor="#7f1d1d" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#7f1d1d" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />

            <XAxis
              dataKey="date"
              axisLine={{ stroke: "#262626" }}
              tickLine={false}
              tick={{ fill: "#525252", fontSize: 10, fontFamily: "JetBrains Mono, monospace" }}
              minTickGap={30}
              interval="preserveStartEnd"
            />

            <YAxis
              domain={["auto", "auto"]}
              axisLine={{ stroke: "#262626" }}
              tickLine={false}
              tick={{ fill: "#525252", fontSize: 10, fontFamily: "JetBrains Mono, monospace" }}
              tickFormatter={formatYAxis}
              width={55}
            />

            <Tooltip
              content={<CustomTooltip timeRange={timeRange} />}
              cursor={{ stroke: "#404040", strokeDasharray: "4 4" }}
            />

            <ReferenceLine
              y={startValue}
              stroke="#404040"
              strokeDasharray="4 4"
              label={{
                value: `BASE €${startValue.toFixed(0)}`,
                fill: "#525252",
                fontSize: 9,
                fontFamily: "JetBrains Mono, monospace",
                position: "left",
              }}
            />

            <Area
              type="monotone"
              dataKey="value"
              stroke={isPositive ? "#047857" : "#7f1d1d"}
              strokeWidth={2}
              fill={isPositive ? "url(#colorProfit)" : "url(#colorLoss)"}
              dot={false}
              activeDot={{
                r: 5,
                fill: isPositive ? "#047857" : "#7f1d1d",
                stroke: "#0a0a0a",
                strokeWidth: 2,
              }}
            />

            <Brush
              dataKey="date"
              height={24}
              stroke="#262626"
              fill="#0a0a0a"
              travellerWidth={8}
              tickFormatter={() => ""}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <p className="text-center text-[10px] text-muted-foreground mt-2 px-4 font-mono">
        {chartData.length - 1} operaciones {getPeriodLabel()} · Desliza para zoom
      </p>
    </div>
  )
}
