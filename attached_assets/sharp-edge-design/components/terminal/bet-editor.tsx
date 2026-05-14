"use client"

import { useState, useEffect, useMemo } from "react"
import type { Bet, Strategy } from "@/lib/types"

interface BetEditorProps {
  isOpen: boolean
  onClose: () => void
  onSave: (bet: Bet) => void
  bet: Bet | null
  strategies: Strategy[]
}

const LEAGUES = {
  internacionales: {
    label: "INTERNACIONALES",
    options: [
      "Mundial FIFA",
      "Eurocopa UEFA",
      "Champions League",
      "Europa League",
      "Conference League",
      "Copa Libertadores",
      "Copa Sudamericana",
    ],
  },
  top5: {
    label: "TOP 5 EUROPA",
    options: ["Premier League", "LaLiga", "Serie A", "Bundesliga", "Ligue 1"],
  },
  segundas: {
    label: "SEGUNDAS DIVISIONES",
    options: ["Championship (UK)", "LaLiga Hypermotion (ES)", "Serie B (IT)", "2. Bundesliga (DE)"],
  },
  otras: {
    label: "OTRAS CON PROPS",
    options: [
      "Eredivisie (NL)",
      "Primeira Liga (PT)",
      "Brasileirão (BR)",
      "Süper Lig (TR)",
      "MLS (US)",
      "Saudi Pro League",
      "Superliga (DK)",
    ],
  },
}

const MARKET_GROUPS = {
  main: {
    label: "PRINCIPALES",
    markets: ["Ganador 1x2", "Moneyline", "Doble Oportunidad", "Hándicap Asiático", "Empate no Válido"],
  },
  props: {
    label: "PROPS JUGADOR",
    markets: ["Remates", "Tiros a Puerta", "Pases", "Entradas", "Faltas", "Asistencias"],
  },
  goals: {
    label: "GOLES / PUNTOS",
    markets: ["Over/Under", "BTTS", "Córners"],
  },
}

const POSITIONS = ["DC", "MC", "EXT", "MP", "DEF", "POR"]
const TACTICS = ["4-3-3", "4-4-2", "3-5-2", "4-2-3-1", "5-3-2", "3-4-3"]
const bookies = ["Bet365", "Betfair", "Pinnacle", "Bwin", "Unibet", "888sport"]

export function BetEditor({ isOpen, onClose, onSave, bet, strategies }: BetEditorProps) {
  const [formData, setFormData] = useState<Partial<Bet>>({
    event: "",
    league: "",
    sport: "Fútbol",
    market: "",
    odds: 1.9,
    stake: 1.0,
    status: "pending",
    bookie: "",
    isLive: false,
    strategies: [],
    date: new Date().toISOString().split("T")[0],
    time: new Date().toTimeString().slice(0, 5),
    position: "",
    tactic: "",
    notes: "",
  })

  const [leagueSearch, setLeagueSearch] = useState("")
  const [showLeagueDropdown, setShowLeagueDropdown] = useState(false)
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  const filteredLeagues = useMemo(() => {
    const search = leagueSearch.toLowerCase()
    const results: { category: string; league: string }[] = []

    Object.entries(LEAGUES).forEach(([key, group]) => {
      group.options.forEach((league) => {
        if (league.toLowerCase().includes(search)) {
          results.push({ category: group.label, league })
        }
      })
    })

    return results
  }, [leagueSearch])

  useEffect(() => {
    if (bet) {
      setFormData(bet)
    } else {
      setFormData({
        event: "",
        league: "",
        sport: "Fútbol",
        market: "",
        odds: 1.9,
        stake: 1.0,
        status: "pending",
        bookie: "",
        isLive: false,
        strategies: [],
        date: new Date().toISOString().split("T")[0],
        time: new Date().toTimeString().slice(0, 5),
        position: "",
        tactic: "",
        notes: "",
      })
      setTouched({})
    }
  }, [bet, isOpen])

  const requiredFields = ["event", "market", "odds", "stake", "date", "time"]
  const isFieldInvalid = (field: string) => {
    if (!touched[field]) return false
    const value = formData[field as keyof typeof formData]
    if (field === "odds" || field === "stake") {
      return !value || Number(value) <= 0
    }
    return !value || String(value).trim() === ""
  }

  const isFormValid = requiredFields.every((field) => {
    const value = formData[field as keyof typeof formData]
    if (field === "odds" || field === "stake") {
      return value && Number(value) > 0
    }
    return value && String(value).trim() !== ""
  })

  const handleSubmit = () => {
    // Marcar todos los campos como tocados para mostrar errores
    const allTouched: Record<string, boolean> = {}
    requiredFields.forEach((f) => (allTouched[f] = true))
    setTouched(allTouched)

    if (!isFormValid) return

    onSave({
      ...formData,
      id: bet?.id || Date.now().toString(),
    } as Bet)
  }

  const selectMarket = (market: string) => {
    setFormData({ ...formData, market })
    setTouched({ ...touched, market: true })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-xl">
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-semibold tracking-tight">{bet ? "EDITAR ENTRADA" : "NUEVA ENTRADA"}</h2>
          <button onClick={onClose} className="text-2xl text-muted-foreground hover:text-foreground">
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div className="bg-card/50 border border-border rounded-lg p-3 flex items-start gap-2">
            <span className="text-sm">💡</span>
            <p className="text-xs text-muted-foreground leading-relaxed">
              <span className="text-foreground font-medium">Consejo Pro:</span> Rellena los datos opcionales para
              desbloquear el Análisis de Ineficiencias.
            </p>
          </div>

          {/* Evento - OBLIGATORIO */}
          <div>
            <label className="block text-[10px] font-bold text-muted-foreground tracking-wider mb-2">
              EVENTO <span className="text-loss">*</span>
            </label>
            <input
              type="text"
              value={formData.event}
              onChange={(e) => setFormData({ ...formData, event: e.target.value })}
              onBlur={() => setTouched({ ...touched, event: true })}
              placeholder="Real Madrid vs Barcelona"
              className={`w-full px-4 py-3 bg-card border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none transition-colors ${
                isFieldInvalid("event") ? "border-loss" : "border-border focus:border-accent"
              }`}
            />
          </div>

          <div className="relative">
            <label className="block text-[10px] font-bold text-muted-foreground tracking-wider mb-2">
              LIGA <span className="text-xs font-normal">(opcional)</span>
            </label>
            <input
              type="text"
              value={formData.league || leagueSearch}
              onChange={(e) => {
                setLeagueSearch(e.target.value)
                setFormData({ ...formData, league: e.target.value })
                setShowLeagueDropdown(true)
              }}
              onFocus={() => setShowLeagueDropdown(true)}
              onBlur={() => setTimeout(() => setShowLeagueDropdown(false), 200)}
              placeholder="Buscar liga..."
              className="w-full px-4 py-3 bg-card border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none transition-colors"
            />
            {showLeagueDropdown && filteredLeagues.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-lg max-h-64 overflow-y-auto">
                {Object.entries(LEAGUES).map(([key, group]) => {
                  const groupLeagues = filteredLeagues.filter((l) => l.category === group.label)
                  if (groupLeagues.length === 0) return null
                  return (
                    <div key={key}>
                      <div className="px-3 py-2 text-[10px] font-bold text-muted-foreground tracking-wider bg-background/50">
                        {group.label}
                      </div>
                      {groupLeagues.map(({ league }) => (
                        <button
                          key={league}
                          onClick={() => {
                            setFormData({ ...formData, league })
                            setLeagueSearch("")
                            setShowLeagueDropdown(false)
                          }}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-background/50 transition-colors"
                        >
                          {league}
                        </button>
                      ))}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div>
            <label className="block text-[10px] font-bold text-muted-foreground tracking-wider mb-3">
              MERCADO <span className="text-loss">*</span>
            </label>

            {Object.entries(MARKET_GROUPS).map(([key, group]) => (
              <div key={key} className="mb-4">
                <span className="block text-[9px] font-bold text-muted-foreground/60 tracking-widest mb-2 uppercase">
                  {group.label}
                </span>
                <div className="flex flex-wrap gap-2">
                  {group.markets.map((market) => (
                    <button
                      key={market}
                      onClick={() => selectMarket(market)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-all ${
                        formData.market === market
                          ? "bg-accent/20 border-accent text-accent"
                          : "bg-card border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                      }`}
                    >
                      {market}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {isFieldInvalid("market") && <p className="text-[10px] text-loss mt-1">Selecciona un mercado</p>}
          </div>

          {/* Cuota & Stake - OBLIGATORIOS */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-muted-foreground tracking-wider mb-2">
                CUOTA <span className="text-loss">*</span>
              </label>
              <div
                className={`flex items-center bg-card border rounded-lg overflow-hidden ${
                  isFieldInvalid("odds") ? "border-loss" : "border-border"
                }`}
              >
                <button
                  onClick={() => setFormData({ ...formData, odds: Math.max(1.01, (formData.odds || 1.9) - 0.05) })}
                  className="px-4 py-3 text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
                >
                  −
                </button>
                <input
                  type="number"
                  value={formData.odds}
                  onChange={(e) => setFormData({ ...formData, odds: Number.parseFloat(e.target.value) || 1.9 })}
                  onBlur={() => setTouched({ ...touched, odds: true })}
                  step="0.01"
                  className="flex-1 text-center bg-transparent font-mono font-bold text-foreground focus:outline-none"
                />
                <button
                  onClick={() => setFormData({ ...formData, odds: (formData.odds || 1.9) + 0.05 })}
                  className="px-4 py-3 text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
                >
                  +
                </button>
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-muted-foreground tracking-wider mb-2">
                STAKE (U) <span className="text-loss">*</span>
              </label>
              <div
                className={`flex items-center bg-card border rounded-lg overflow-hidden ${
                  isFieldInvalid("stake") ? "border-loss" : "border-border"
                }`}
              >
                <button
                  onClick={() => setFormData({ ...formData, stake: Math.max(0.1, (formData.stake || 1) - 0.5) })}
                  className="px-4 py-3 text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
                >
                  −
                </button>
                <input
                  type="number"
                  value={formData.stake}
                  onChange={(e) => setFormData({ ...formData, stake: Number.parseFloat(e.target.value) || 1 })}
                  onBlur={() => setTouched({ ...touched, stake: true })}
                  step="0.1"
                  className="flex-1 text-center bg-transparent font-mono font-bold text-foreground focus:outline-none"
                />
                <button
                  onClick={() => setFormData({ ...formData, stake: (formData.stake || 1) + 0.5 })}
                  className="px-4 py-3 text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Fecha y Hora - OBLIGATORIOS */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-muted-foreground tracking-wider mb-2">
                FECHA <span className="text-loss">*</span>
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                onBlur={() => setTouched({ ...touched, date: true })}
                className={`w-full px-4 py-3 bg-card border rounded-lg text-foreground font-mono focus:outline-none transition-colors ${
                  isFieldInvalid("date") ? "border-loss" : "border-border focus:border-accent"
                }`}
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-muted-foreground tracking-wider mb-2">
                HORA <span className="text-loss">*</span>
              </label>
              <input
                type="time"
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                onBlur={() => setTouched({ ...touched, time: true })}
                className={`w-full px-4 py-3 bg-card border rounded-lg text-foreground font-mono focus:outline-none transition-colors ${
                  isFieldInvalid("time") ? "border-loss" : "border-border focus:border-accent"
                }`}
              />
            </div>
          </div>

          {/* Campos Opcionales */}
          <div className="pt-4 border-t border-border/50">
            <span className="block text-[10px] font-bold text-muted-foreground/60 tracking-widest mb-4">
              CAMPOS OPCIONALES
            </span>

            {/* Posición y Táctica */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground tracking-wider mb-2">
                  POSICIÓN
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {POSITIONS.map((pos) => (
                    <button
                      key={pos}
                      onClick={() => setFormData({ ...formData, position: formData.position === pos ? "" : pos })}
                      className={`px-2 py-1 text-[10px] font-bold rounded border transition-all ${
                        formData.position === pos
                          ? "bg-accent/20 border-accent text-accent"
                          : "bg-card border-border text-muted-foreground hover:border-foreground/30"
                      }`}
                    >
                      {pos}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground tracking-wider mb-2">TÁCTICA</label>
                <select
                  value={formData.tactic || ""}
                  onChange={(e) => setFormData({ ...formData, tactic: e.target.value })}
                  className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm text-foreground focus:border-accent focus:outline-none"
                >
                  <option value="">Ninguna</option>
                  {TACTICS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Casa */}
            <div className="mb-4">
              <label className="block text-[10px] font-bold text-muted-foreground tracking-wider mb-2">CASA</label>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {bookies.map((b) => (
                  <button
                    key={b}
                    onClick={() => setFormData({ ...formData, bookie: formData.bookie === b ? "" : b })}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-all border ${
                      formData.bookie === b
                        ? "bg-foreground text-background border-foreground"
                        : "bg-card text-muted-foreground border-border hover:border-foreground/30"
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>

            {/* Notas */}
            <div>
              <label className="block text-[10px] font-bold text-muted-foreground tracking-wider mb-2">NOTAS</label>
              <textarea
                value={formData.notes || ""}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Añade contexto sobre tu apuesta..."
                rows={2}
                className="w-full px-4 py-3 bg-card border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none resize-none text-sm"
              />
            </div>
          </div>

          {/* Estado */}
          <div>
            <label className="block text-[10px] font-bold text-muted-foreground tracking-wider mb-2">ESTADO</label>
            <div className="grid grid-cols-3 gap-2">
              {(["pending", "won", "lost"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setFormData({ ...formData, status: s })}
                  className={`py-3 rounded-lg text-xs font-bold tracking-wide transition-all border ${
                    formData.status === s
                      ? s === "won"
                        ? "bg-profit/10 border-profit text-profit"
                        : s === "lost"
                          ? "bg-loss/10 border-loss text-loss"
                          : "bg-pending/10 border-pending text-pending"
                      : "bg-card border-border text-muted-foreground opacity-50"
                  }`}
                >
                  {s === "pending" ? "PENDIENTE" : s === "won" ? "GANADA" : "PERDIDA"}
                </button>
              ))}
            </div>
          </div>

          {/* Live Toggle */}
          <div
            onClick={() => setFormData({ ...formData, isLive: !formData.isLive })}
            className={`flex items-center justify-between p-3 bg-card border rounded-lg cursor-pointer transition-colors ${
              formData.isLive ? "border-loss" : "border-border"
            }`}
          >
            <span className={`text-sm font-medium ${formData.isLive ? "text-loss" : "text-muted-foreground"}`}>
              EN VIVO
            </span>
            <div
              className={`w-10 h-5 rounded-full transition-colors flex items-center px-0.5 ${formData.isLive ? "bg-loss justify-end" : "bg-border justify-start"}`}
            >
              <div className="w-4 h-4 rounded-full bg-foreground" />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border">
          <button
            onClick={handleSubmit}
            disabled={!isFormValid}
            className={`w-full py-4 font-bold text-sm tracking-wider rounded-lg transition-colors ${
              isFormValid
                ? "bg-accent text-accent-foreground hover:bg-accent/90"
                : "bg-card text-muted-foreground cursor-not-allowed"
            }`}
          >
            GUARDAR ENTRADA
          </button>
        </div>
      </div>
    </div>
  )
}
