"use client"

import type React from "react"

import { useState } from "react"
import { Trash2, Copy, Share2 } from "lucide-react"
import type { Bet } from "@/lib/types"

interface BetHistoryProps {
  bets: Bet[]
  unitValue: number
  currency: string
  onEdit: (bet: Bet) => void
  onDelete: (id: string) => void
  onDuplicate?: (bet: Bet) => void
}

const BETS_PER_PAGE = 10

export function BetHistory({ bets, unitValue, currency, onEdit, onDelete, onDuplicate }: BetHistoryProps) {
  const [visibleCount, setVisibleCount] = useState(BETS_PER_PAGE)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const currencySymbol = currency === "EUR" ? "€" : "$"

  const sortedBets = [...bets].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  const visibleBets = sortedBets.slice(0, visibleCount)
  const hasMore = visibleCount < bets.length

  const loadMore = () => {
    setVisibleCount((prev) => Math.min(prev + BETS_PER_PAGE, bets.length))
  }

  const showToast = (message: string) => {
    setToastMessage(message)
    setTimeout(() => setToastMessage(null), 2500)
  }

  const handleShare = (bet: Bet, e: React.MouseEvent) => {
    e.stopPropagation()
    showToast("Ticket generado para compartir")
  }

  const handleDuplicate = (bet: Bet, e: React.MouseEvent) => {
    e.stopPropagation()
    if (onDuplicate) {
      onDuplicate(bet)
    }
  }

  return (
    <section className="py-6 relative">
      {toastMessage && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-card border border-border rounded-lg px-4 py-2.5 shadow-xl flex items-center gap-2">
            <Share2 className="w-4 h-4 text-accent" />
            <span className="text-sm font-medium text-foreground">{toastMessage}</span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-4 px-1">
        <h2 className="text-xs font-semibold text-muted-foreground tracking-wider">HISTORIAL</h2>
        <span className="text-xs text-muted-foreground font-mono">
          {visibleBets.length} / {bets.length}
        </span>
      </div>

      <div className="flex flex-col justify-start gap-2">
        {visibleBets.map((bet) => {
          const pnl =
            bet.status === "won"
              ? (bet.stake * bet.odds - bet.stake) * unitValue
              : bet.status === "lost"
                ? -bet.stake * unitValue
                : 0

          return (
            <div
              key={bet.id}
              onClick={() => onEdit(bet)}
              className="relative bg-card rounded-lg border border-border cursor-pointer hover:border-border/80 transition-colors"
            >
              {/* Status indicator */}
              <div
                className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-lg ${
                  bet.status === "won" ? "bg-profit" : bet.status === "lost" ? "bg-loss" : "bg-pending"
                }`}
              />

              {/* Main content */}
              <div className="py-3 px-4 pl-5">
                <div className="flex items-center justify-between gap-3">
                  {/* Info principal */}
                  <div className="flex-1 min-w-0 flex items-center gap-4">
                    {/* Liga + Evento */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-accent tracking-wider shrink-0">{bet.league}</span>
                        {bet.isLive && (
                          <span className="px-1.5 py-0.5 text-[8px] font-bold bg-loss/20 text-loss rounded">LIVE</span>
                        )}
                      </div>
                      <h3 className="font-medium text-sm text-foreground truncate">{bet.event}</h3>
                    </div>

                    {/* Mercado */}
                    <div className="hidden sm:block text-xs text-muted-foreground font-mono truncate max-w-32">
                      {bet.market}
                    </div>
                  </div>

                  {/* Financials */}
                  <div className="flex items-center gap-4 shrink-0">
                    {/* Cuota */}
                    <div className="text-right">
                      <span className="font-mono text-xs text-accent font-semibold">@{bet.odds.toFixed(2)}</span>
                      <div className="text-[10px] text-muted-foreground font-mono">{bet.stake.toFixed(1)}u</div>
                    </div>

                    {/* P/L */}
                    <div
                      className={`font-mono text-sm font-bold min-w-16 text-right ${
                        bet.status === "pending" ? "text-pending" : pnl >= 0 ? "text-profit" : "text-loss"
                      }`}
                    >
                      {bet.status === "pending" ? "PEND" : `${pnl >= 0 ? "+" : ""}${currencySymbol}${pnl.toFixed(0)}`}
                    </div>
                  </div>
                </div>

                {/* Detalles secundarios - solo visible en móvil para mercado */}
                <div className="sm:hidden mt-1">
                  <p className="text-[10px] text-muted-foreground font-mono truncate">{bet.market}</p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 px-3 py-2 border-t border-border/50">
                <button
                  onClick={(e) => handleShare(bet, e)}
                  className="p-2 rounded-lg hover:bg-accent/10 text-muted-foreground hover:text-accent transition-colors"
                  aria-label="Compartir apuesta"
                  title="Compartir"
                >
                  <Share2 className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => handleDuplicate(bet, e)}
                  className="p-2 rounded-lg hover:bg-accent/10 text-muted-foreground hover:text-accent transition-colors"
                  aria-label="Duplicar apuesta"
                  title="Duplicar"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(bet.id)
                  }}
                  className="p-2 rounded-lg hover:bg-loss/10 text-muted-foreground hover:text-loss transition-colors"
                  aria-label="Eliminar apuesta"
                  title="Eliminar"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {hasMore && (
        <div className="flex justify-center mt-4">
          <button
            onClick={loadMore}
            className="px-6 py-2 text-[10px] font-medium text-muted-foreground/50 hover:text-muted-foreground border border-border/30 hover:border-border rounded-lg transition-all duration-200"
          >
            Cargar más...
          </button>
        </div>
      )}
    </section>
  )
}
