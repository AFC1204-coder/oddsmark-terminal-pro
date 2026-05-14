"use client"

import { useState } from "react"
import { Header } from "./terminal/header"
import { KPIGrid } from "./terminal/kpi-grid"
import { BankrollChart } from "./terminal/bankroll-chart"
import { BetHistory } from "./terminal/bet-history"
import { StrategiesPanel } from "./terminal/strategies-panel"
import { BetEditor } from "./terminal/bet-editor"
import { ToolsModal } from "./terminal/tools-modal"
import { SettingsModal } from "./terminal/settings-modal"
import { Plus } from "lucide-react"
import type { Bet, Settings, Strategy } from "@/lib/types"

const initialSettings: Settings = {
  unitValue: 10,
  initialCapital: 1000,
  targetCapital: 2000,
  currency: "EUR",
}

const demoStrategies: Strategy[] = [
  { id: "1", name: "Value Betting", color: "#047857" },
  { id: "2", name: "Kelly Criterion", color: "#0369a1" },
  { id: "3", name: "Arbitrage", color: "#7c3aed" },
]

const demoBets: Bet[] = [
  {
    id: "1",
    date: "2024-01-15",
    time: "20:00",
    event: "Real Madrid vs Barcelona",
    league: "LaLiga",
    sport: "Fútbol",
    market: "Over 2.5 Goals",
    odds: 1.95,
    stake: 2.0,
    status: "won",
    bookie: "Bet365",
    isLive: false,
    strategies: ["Value Betting"],
  },
  {
    id: "2",
    date: "2024-01-14",
    time: "18:30",
    event: "Man City vs Liverpool",
    league: "Premier League",
    sport: "Fútbol",
    market: "BTTS - Yes",
    odds: 1.72,
    stake: 1.5,
    status: "won",
    bookie: "Betfair",
    isLive: false,
    strategies: ["Kelly Criterion"],
  },
  {
    id: "3",
    date: "2024-01-13",
    time: "21:00",
    event: "Bayern vs Dortmund",
    league: "Bundesliga",
    sport: "Fútbol",
    market: "Over 3.5 Goals",
    odds: 2.1,
    stake: 1.0,
    status: "lost",
    bookie: "Pinnacle",
    isLive: true,
    strategies: [],
  },
  {
    id: "4",
    date: "2024-01-12",
    time: "16:00",
    event: "Juventus vs Inter",
    league: "Serie A",
    sport: "Fútbol",
    market: "Under 2.5 Goals",
    odds: 1.85,
    stake: 2.5,
    status: "won",
    bookie: "Bet365",
    isLive: false,
    strategies: ["Value Betting"],
  },
  {
    id: "5",
    date: "2024-01-11",
    time: "19:45",
    event: "PSG vs Lyon",
    league: "Ligue 1",
    sport: "Fútbol",
    market: "1X Double Chance",
    odds: 1.35,
    stake: 3.0,
    status: "pending",
    bookie: "Unibet",
    isLive: false,
    strategies: [],
  },
]

export function TerminalDashboard() {
  const [bets, setBets] = useState<Bet[]>(demoBets)
  const [strategies, setStrategies] = useState<Strategy[]>(demoStrategies)
  const [settings, setSettings] = useState<Settings>(initialSettings)
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [isStrategiesOpen, setIsStrategiesOpen] = useState(false)
  const [isToolsOpen, setIsToolsOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [editingBet, setEditingBet] = useState<Bet | null>(null)

  const [periodStats, setPeriodStats] = useState<{ profit: number; yieldPct: number; bankroll: number } | null>(null)

  // Calculate stats (totales)
  const completedBets = bets.filter((b) => b.status !== "pending")
  const totalStaked = completedBets.reduce((acc, b) => acc + b.stake * settings.unitValue, 0)
  const totalProfit = completedBets.reduce((acc, b) => {
    if (b.status === "won") return acc + (b.stake * b.odds - b.stake) * settings.unitValue
    if (b.status === "lost") return acc - b.stake * settings.unitValue
    return acc
  }, 0)
  const yieldPct = totalStaked > 0 ? (totalProfit / totalStaked) * 100 : 0
  const bankroll = settings.initialCapital + totalProfit
  const avgOdds =
    completedBets.length > 0 ? completedBets.reduce((acc, b) => acc + b.odds, 0) / completedBets.length : 0
  const avgStake =
    completedBets.length > 0 ? completedBets.reduce((acc, b) => acc + b.stake, 0) / completedBets.length : 0

  const displayBankroll = periodStats?.bankroll ?? bankroll
  const displayProfit = periodStats?.profit ?? totalProfit
  const displayYield = periodStats?.yieldPct ?? yieldPct

  const handleNewBet = () => {
    setEditingBet(null)
    setIsEditorOpen(true)
  }

  const handleEditBet = (bet: Bet) => {
    setEditingBet(bet)
    setIsEditorOpen(true)
  }

  const handleDuplicateBet = (bet: Bet) => {
    // Crea una copia de la apuesta sin ID para que se guarde como nueva
    const duplicatedBet: Bet = {
      ...bet,
      id: "", // Se generará nuevo ID al guardar
      status: "pending", // Nueva apuesta siempre empieza como pendiente
      date: new Date().toISOString().split("T")[0], // Fecha actual
      time: new Date().toTimeString().slice(0, 5), // Hora actual
    }
    setEditingBet(duplicatedBet)
    setIsEditorOpen(true)
  }

  const handleSaveBet = (bet: Bet) => {
    if (editingBet && editingBet.id) {
      setBets(bets.map((b) => (b.id === bet.id ? bet : b)))
    } else {
      setBets([{ ...bet, id: Date.now().toString() }, ...bets])
    }
    setIsEditorOpen(false)
    setEditingBet(null)
  }

  const handleDeleteBet = (id: string) => {
    setBets(bets.filter((b) => b.id !== id))
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header
        onOpenStrategies={() => setIsStrategiesOpen(true)}
        onOpenTools={() => setIsToolsOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <main className="px-4 pb-24">
        <KPIGrid
          bankroll={displayBankroll}
          profit={displayProfit}
          yieldPct={displayYield}
          avgOdds={avgOdds}
          avgStake={avgStake}
          targetCapital={settings.targetCapital}
          unitValue={settings.unitValue}
          currency={settings.currency}
        />

        <BankrollChart bets={bets} settings={settings} onPeriodChange={(stats) => setPeriodStats(stats)} />

        <BetHistory
          bets={bets}
          unitValue={settings.unitValue}
          currency={settings.currency}
          onEdit={handleEditBet}
          onDelete={handleDeleteBet}
          onDuplicate={handleDuplicateBet}
        />
      </main>

      <button
        onClick={handleNewBet}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-xl shadow-emerald-900/40 transition-all hover:scale-105 active:scale-95"
        aria-label="Nueva entrada"
      >
        <Plus className="w-7 h-7" strokeWidth={2.5} />
      </button>

      {/* Modals */}
      <BetEditor
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        onSave={handleSaveBet}
        bet={editingBet}
        strategies={strategies}
      />

      <StrategiesPanel
        isOpen={isStrategiesOpen}
        onClose={() => setIsStrategiesOpen(false)}
        strategies={strategies}
        bets={bets}
        unitValue={settings.unitValue}
      />

      <ToolsModal isOpen={isToolsOpen} onClose={() => setIsToolsOpen(false)} bankroll={bankroll} />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={setSettings}
      />
    </div>
  )
}
