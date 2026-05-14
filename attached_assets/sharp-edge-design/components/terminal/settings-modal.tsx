"use client"

import { useState, useEffect } from "react"
import type { Settings } from "@/lib/types"

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  settings: Settings
  onSave: (settings: Settings) => void
}

export function SettingsModal({ isOpen, onClose, settings, onSave }: SettingsModalProps) {
  const [formData, setFormData] = useState(settings)

  useEffect(() => {
    setFormData(settings)
  }, [settings, isOpen])

  const handleSave = () => {
    onSave(formData)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-background/90 backdrop-blur-xl">
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-semibold tracking-tight">CONFIGURACIÓN</h2>
          <button onClick={onClose} className="text-2xl text-muted-foreground hover:text-foreground">
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div>
            <label className="block text-[10px] font-bold text-muted-foreground tracking-wider mb-2">
              VALOR DE UNIDAD (€)
            </label>
            <input
              type="number"
              value={formData.unitValue}
              onChange={(e) => setFormData({ ...formData, unitValue: Number.parseInt(e.target.value) || 10 })}
              className="w-full px-4 py-3 bg-card border border-border rounded-xl font-mono text-foreground focus:border-accent focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-muted-foreground tracking-wider mb-2">
              CAPITAL INICIAL (€)
            </label>
            <input
              type="number"
              value={formData.initialCapital}
              onChange={(e) => setFormData({ ...formData, initialCapital: Number.parseInt(e.target.value) || 0 })}
              className="w-full px-4 py-3 bg-card border border-border rounded-xl font-mono text-foreground focus:border-accent focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-muted-foreground tracking-wider mb-2">
              OBJETIVO (€)
            </label>
            <input
              type="number"
              value={formData.targetCapital}
              onChange={(e) => setFormData({ ...formData, targetCapital: Number.parseInt(e.target.value) || 0 })}
              className="w-full px-4 py-3 bg-card border border-border rounded-xl font-mono text-foreground focus:border-accent focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-muted-foreground tracking-wider mb-2">MONEDA</label>
            <div className="flex gap-2">
              {(["EUR", "USD"] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setFormData({ ...formData, currency: c })}
                  className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-colors border ${
                    formData.currency === c
                      ? "bg-foreground text-background border-foreground"
                      : "bg-card text-muted-foreground border-border"
                  }`}
                >
                  {c === "EUR" ? "€ Euro" : "$ Dólar"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border space-y-3">
          <button
            onClick={handleSave}
            className="w-full py-4 bg-accent text-accent-foreground font-bold text-sm tracking-wider rounded-xl hover:bg-accent/90 transition-colors"
          >
            GUARDAR
          </button>
          <button
            onClick={onClose}
            className="w-full py-4 bg-card text-muted-foreground font-semibold text-sm tracking-wider rounded-xl border border-border hover:bg-background transition-colors"
          >
            CANCELAR
          </button>
        </div>
      </div>
    </div>
  )
}
