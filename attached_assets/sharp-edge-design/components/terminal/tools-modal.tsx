"use client"

import { useState, useMemo } from "react"

interface ToolsModalProps {
  isOpen: boolean
  onClose: () => void
  bankroll: number
}

function poissonProbability(lambda: number, k: number): number {
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k)
}

function factorial(n: number): number {
  if (n <= 1) return 1
  let result = 1
  for (let i = 2; i <= n; i++) result *= i
  return result
}

function calculateOverUnder(lambda: number, line: number): { over: number; under: number } {
  const intLine = Math.floor(line)
  let underProb = 0
  for (let k = 0; k <= intLine; k++) {
    underProb += poissonProbability(lambda, k)
  }
  // Si la línea tiene .5, el under es exactamente hasta ese punto
  // Si no, necesitamos considerar el empate
  const isHalf = line % 1 !== 0
  if (isHalf) {
    return { over: (1 - underProb) * 100, under: underProb * 100 }
  }
  const exactProb = poissonProbability(lambda, intLine)
  return { over: (1 - underProb) * 100, under: (underProb - exactProb) * 100 }
}

function calculateMatchProbabilities(xgHome: number, xgAway: number) {
  const maxGoals = 10
  let homeWin = 0
  let draw = 0
  let awayWin = 0

  for (let h = 0; h <= maxGoals; h++) {
    for (let a = 0; a <= maxGoals; a++) {
      const prob = poissonProbability(xgHome, h) * poissonProbability(xgAway, a)
      if (h > a) homeWin += prob
      else if (h < a) awayWin += prob
      else draw += prob
    }
  }

  return {
    home: homeWin * 100,
    draw: draw * 100,
    away: awayWin * 100,
  }
}

export function ToolsModal({ isOpen, onClose, bankroll }: ToolsModalProps) {
  const [activeTab, setActiveTab] = useState<"kelly" | "poisson" | "cashout">("kelly")

  // Kelly Calculator State
  const [kellyOdds, setKellyOdds] = useState(2.0)
  const [kellyProb, setKellyProb] = useState(55)

  const [poissonTab, setPoissonTab] = useState<"match" | "props">("match")
  const [xgHome, setXgHome] = useState(1.5)
  const [xgAway, setXgAway] = useState(1.2)
  const [lambdaProps, setLambdaProps] = useState(2.5)
  const [lineProps, setLineProps] = useState(2.5)

  // Kelly Calculation
  const kellyFraction = ((kellyProb / 100) * kellyOdds - 1) / (kellyOdds - 1)
  const kellyStake = Math.max(0, kellyFraction * bankroll)

  const matchProbs = useMemo(() => calculateMatchProbabilities(xgHome, xgAway), [xgHome, xgAway])
  const propsProbs = useMemo(() => calculateOverUnder(lambdaProps, lineProps), [lambdaProps, lineProps])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-background/90 backdrop-blur-xl">
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-semibold tracking-tight">HERRAMIENTAS</h2>
          <button onClick={onClose} className="text-2xl text-muted-foreground hover:text-foreground">
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          {(["kelly", "poisson", "cashout"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-4 text-sm font-semibold tracking-wider transition-colors relative ${
                activeTab === tab ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {tab === "kelly" ? "KELLY" : tab === "poisson" ? "POISSON" : "CASHOUT"}
              {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === "kelly" && (
            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground tracking-wider mb-2">
                  CUOTA DECIMAL
                </label>
                <input
                  type="number"
                  value={kellyOdds}
                  onChange={(e) => setKellyOdds(Number.parseFloat(e.target.value) || 1.01)}
                  step="0.01"
                  className="w-full px-4 py-3 bg-card border border-border rounded-xl font-mono text-foreground focus:border-accent focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-muted-foreground tracking-wider mb-2">
                  PROBABILIDAD ESTIMADA: {kellyProb}%
                </label>
                <input
                  type="range"
                  min="1"
                  max="99"
                  value={kellyProb}
                  onChange={(e) => setKellyProb(Number.parseInt(e.target.value))}
                  className="w-full h-1 bg-border rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:bg-foreground [&::-webkit-slider-thumb]:rounded-full"
                />
              </div>

              <div className="text-center py-8 bg-card rounded-xl border border-border">
                <div className="text-xs text-muted-foreground mb-2">STAKE KELLY</div>
                <div className="font-mono text-4xl font-bold text-accent">€{kellyStake.toFixed(2)}</div>
                <div className="text-xs text-muted-foreground mt-2">
                  {(kellyFraction * 100).toFixed(1)}% del bankroll
                </div>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                El Criterio de Kelly calcula el stake óptimo para maximizar el crecimiento a largo plazo. Se recomienda
                usar fracciones (1/2 o 1/4 Kelly) para mayor protección.
              </p>
            </div>
          )}

          {activeTab === "poisson" && (
            <div className="space-y-4">
              {/* Sub-tabs para Poisson */}
              <div className="flex gap-2">
                <button
                  onClick={() => setPoissonTab("match")}
                  className={`flex-1 py-2.5 text-xs font-bold tracking-wider rounded-lg border transition-colors ${
                    poissonTab === "match"
                      ? "bg-card border-accent/50 text-foreground"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  PARTIDO
                </button>
                <button
                  onClick={() => setPoissonTab("props")}
                  className={`flex-1 py-2.5 text-xs font-bold tracking-wider rounded-lg border transition-colors ${
                    poissonTab === "props"
                      ? "bg-card border-accent/50 text-foreground"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  PROPS
                </button>
              </div>

              {poissonTab === "match" && (
                <div className="space-y-5">
                  <p className="text-xs text-muted-foreground">
                    Calcula probabilidades 1X2 basándote en los goles esperados (xG) de cada equipo.
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-muted-foreground tracking-wider mb-2">
                        xG LOCAL
                      </label>
                      <input
                        type="number"
                        value={xgHome}
                        onChange={(e) => setXgHome(Math.max(0, Number.parseFloat(e.target.value) || 0))}
                        step="0.1"
                        min="0"
                        className="w-full px-4 py-3 bg-card border border-border rounded-xl font-mono text-foreground focus:border-accent focus:outline-none text-center text-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-muted-foreground tracking-wider mb-2">
                        xG VISITANTE
                      </label>
                      <input
                        type="number"
                        value={xgAway}
                        onChange={(e) => setXgAway(Math.max(0, Number.parseFloat(e.target.value) || 0))}
                        step="0.1"
                        min="0"
                        className="w-full px-4 py-3 bg-card border border-border rounded-xl font-mono text-foreground focus:border-accent focus:outline-none text-center text-lg"
                      />
                    </div>
                  </div>

                  {/* Resultados 1X2 */}
                  <div className="grid grid-cols-3 gap-2 pt-2">
                    <div className="bg-card rounded-xl border border-border p-4 text-center">
                      <div className="text-[10px] font-bold text-muted-foreground tracking-wider mb-1">LOCAL</div>
                      <div className="font-mono text-2xl font-bold text-profit">{matchProbs.home.toFixed(1)}%</div>
                      <div className="text-[10px] text-muted-foreground mt-1 font-mono">
                        @{(100 / matchProbs.home).toFixed(2)}
                      </div>
                    </div>
                    <div className="bg-card rounded-xl border border-border p-4 text-center">
                      <div className="text-[10px] font-bold text-muted-foreground tracking-wider mb-1">EMPATE</div>
                      <div className="font-mono text-2xl font-bold text-pending">{matchProbs.draw.toFixed(1)}%</div>
                      <div className="text-[10px] text-muted-foreground mt-1 font-mono">
                        @{(100 / matchProbs.draw).toFixed(2)}
                      </div>
                    </div>
                    <div className="bg-card rounded-xl border border-border p-4 text-center">
                      <div className="text-[10px] font-bold text-muted-foreground tracking-wider mb-1">VISITANTE</div>
                      <div className="font-mono text-2xl font-bold text-loss">{matchProbs.away.toFixed(1)}%</div>
                      <div className="text-[10px] text-muted-foreground mt-1 font-mono">
                        @{(100 / matchProbs.away).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {poissonTab === "props" && (
                <div className="space-y-5">
                  <p className="text-xs text-muted-foreground">
                    Calcula probabilidades Over/Under para props de jugador basándote en su media histórica.
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-muted-foreground tracking-wider mb-2">
                        MEDIA (λ)
                      </label>
                      <input
                        type="number"
                        value={lambdaProps}
                        onChange={(e) => setLambdaProps(Math.max(0, Number.parseFloat(e.target.value) || 0))}
                        step="0.1"
                        min="0"
                        className="w-full px-4 py-3 bg-card border border-border rounded-xl font-mono text-foreground focus:border-accent focus:outline-none text-center text-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-muted-foreground tracking-wider mb-2">
                        LÍNEA
                      </label>
                      <input
                        type="number"
                        value={lineProps}
                        onChange={(e) => setLineProps(Math.max(0, Number.parseFloat(e.target.value) || 0))}
                        step="0.5"
                        min="0"
                        className="w-full px-4 py-3 bg-card border border-border rounded-xl font-mono text-foreground focus:border-accent focus:outline-none text-center text-lg"
                      />
                    </div>
                  </div>

                  {/* Resultados Over/Under */}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="bg-card rounded-xl border border-profit/30 p-5 text-center">
                      <div className="text-[10px] font-bold text-muted-foreground tracking-wider mb-2">
                        OVER {lineProps}
                      </div>
                      <div className="font-mono text-3xl font-bold text-profit">{propsProbs.over.toFixed(1)}%</div>
                      <div className="text-xs text-muted-foreground mt-2 font-mono">
                        Cuota justa: @{(100 / propsProbs.over).toFixed(2)}
                      </div>
                    </div>
                    <div className="bg-card rounded-xl border border-loss/30 p-5 text-center">
                      <div className="text-[10px] font-bold text-muted-foreground tracking-wider mb-2">
                        UNDER {lineProps}
                      </div>
                      <div className="font-mono text-3xl font-bold text-loss">{propsProbs.under.toFixed(1)}%</div>
                      <div className="text-xs text-muted-foreground mt-2 font-mono">
                        Cuota justa: @{(100 / propsProbs.under).toFixed(2)}
                      </div>
                    </div>
                  </div>

                  <p className="text-[10px] text-muted-foreground leading-relaxed mt-4">
                    Ejemplo: Si un jugador tiene media de 2.5 remates y la casa ofrece Over 1.5 @1.50, compara con la
                    cuota justa calculada.
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === "cashout" && (
            <div className="space-y-6">
              <p className="text-sm text-muted-foreground">
                Calcula el valor óptimo de cashout basándote en la probabilidad actual del evento.
              </p>
              <div className="text-center py-12 bg-card rounded-xl border border-border">
                <div className="text-4xl mb-4">💸</div>
                <div className="text-muted-foreground">Próximamente</div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border">
          <button
            onClick={onClose}
            className="w-full py-4 bg-card text-muted-foreground font-semibold text-sm tracking-wider rounded-xl border border-border hover:bg-background transition-colors"
          >
            CERRAR
          </button>
        </div>
      </div>
    </div>
  )
}
