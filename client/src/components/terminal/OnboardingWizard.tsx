import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronRight, ChevronLeft, Wallet, Target, ShieldCheck, UserRound } from "lucide-react";

interface OnboardingWizardProps {
  open: boolean;
  onComplete: (data: { unitValue: number; initialCapital: number; targetBankroll: number; mainSport: string; mainBookie: string }) => void;
}

const steps = [
  { title: "Configura tu espacio", subtitle: "Deja lista la unidad, banca y criterios básicos.", icon: ShieldCheck },
  { title: "Tu bankroll", subtitle: "Define la banca que vas a controlar.", icon: Wallet },
  { title: "Tu referencia", subtitle: "Marca un umbral para revisar progreso, no una promesa.", icon: Target },
  { title: "Tu operativa", subtitle: "Deporte principal y casa más habitual.", icon: UserRound },
];

export function OnboardingWizard({ open, onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const [unitValue, setUnitValue] = useState(10);
  const [initialCapital, setInitialCapital] = useState(500);
  const [targetBankroll, setTargetBankroll] = useState(2000);
  const [mainSport, setMainSport] = useState("Fútbol");
  const [mainBookie, setMainBookie] = useState("");

  const handleFinish = () => {
    onComplete({ unitValue, initialCapital, targetBankroll, mainSport, mainBookie });
  };

  const sports = ["Fútbol", "Basket", "Tenis", "Otros"];
  const defaultBookies = ["Bet365", "Winamax", "Betfair", "William Hill", "Kirolbet", "Bwin", "Pokerstars", "Codere"];

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="surface-panel max-w-sm overflow-hidden rounded-lg border-border/70 p-0 shadow-2xl shadow-black/30 [&>button]:hidden">
        <DialogTitle className="sr-only">Configuración inicial de Oddsmark</DialogTitle>
        <DialogDescription className="sr-only">
          Configura unidad, banca inicial, objetivo y preferencias básicas antes de entrar al dashboard.
        </DialogDescription>
        {/* Progress bar */}
        <div className="h-1 bg-foreground/[0.06]">
          <motion.div
            className="h-full bg-foreground/80"
            animate={{ width: `${((step + 1) / steps.length) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        <div className="p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {/* Step 0: Welcome */}
              {step === 0 && (
                <div className="text-center py-6">
                  <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-lg border border-foreground/15 bg-foreground/[0.06]">
                    <ShieldCheck className="h-7 w-7 text-foreground" />
                  </div>
                  <p className="mono-section-title mb-2">Inicio beta</p>
                  <h2 className="mb-2 text-xl font-black text-foreground">{steps[0].title}</h2>
                  <p className="mx-auto max-w-xs text-sm text-muted-foreground">{steps[0].subtitle}</p>
                  <div className="surface-subtle mt-6 space-y-1.5 rounded-lg p-2.5 text-left">
                    {[
                      "Separa banca real, exposición y P&L",
                      "Muestra prueba pública solo cuando exista",
                      "Revisa patrones antes de aumentar riesgo",
                    ].map((feat, i) => (
                      <div key={i} className="flex items-center gap-2 rounded-md px-1.5 py-1 text-xs text-muted-foreground">
                        <div className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-foreground/15 bg-foreground/[0.07]">
                          <span className="font-mono text-[9px] font-black text-foreground">{i + 1}</span>
                        </div>
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 1: Bankroll */}
              {step === 1 && (
                <div className="space-y-5">
                  <div>
                    <p className="mono-section-title mb-1">Banca</p>
                    <h2 className="text-lg font-black text-foreground mb-1">{steps[1].title}</h2>
                    <p className="text-xs text-muted-foreground">{steps[1].subtitle}</p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Capital inicial (€)</label>
                    <Input
                      type="number"
                      value={initialCapital}
                      onChange={(e) => setInitialCapital(Number(e.target.value))}
                      className="h-12 rounded-lg border-border/70 bg-muted/45 font-mono text-lg text-foreground"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Valor de 1 unidad (€)</label>
                    <Input
                      type="number"
                      value={unitValue}
                      onChange={(e) => setUnitValue(Number(e.target.value))}
                      className="h-12 rounded-lg border-border/70 bg-muted/45 font-mono text-foreground"
                    />
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      Con {initialCapital}€ y unidades de {unitValue}€, tu banca equivale a {initialCapital > 0 && unitValue > 0 ? Math.floor(initialCapital / unitValue) : 0} unidades.
                    </p>
                  </div>
                </div>
              )}

              {/* Step 2: Goals */}
              {step === 2 && (
                <div className="space-y-5">
                  <div>
                    <p className="mono-section-title mb-1">Objetivo</p>
                    <h2 className="text-lg font-black text-foreground mb-1">{steps[2].title}</h2>
                    <p className="text-xs text-muted-foreground">{steps[2].subtitle}</p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Objetivo de bankroll (€)</label>
                    <Input
                      type="number"
                      value={targetBankroll}
                      onChange={(e) => setTargetBankroll(Number(e.target.value))}
                      className="h-12 rounded-lg border-border/70 bg-muted/45 font-mono text-lg text-foreground"
                    />
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      Referencia: {initialCapital > 0 ? `x${(targetBankroll / initialCapital).toFixed(1)}` : "..."} tu capital inicial.
                    </p>
                  </div>
                </div>
              )}

              {/* Step 3: Style */}
              {step === 3 && (
                <div className="space-y-5">
                  <div>
                    <p className="mono-section-title mb-1">Preferencias</p>
                    <h2 className="text-lg font-black text-foreground mb-1">{steps[3].title}</h2>
                    <p className="text-xs text-muted-foreground">{steps[3].subtitle}</p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Deporte principal</label>
                    <div className="grid grid-cols-2 gap-2">
                      {sports.map(s => (
                        <button
                          key={s}
                          onClick={() => setMainSport(s)}
                          className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-all ${
                            mainSport === s
                              ? "border-foreground/20 bg-foreground/[0.08] text-foreground"
                              : "border-border/70 bg-muted/35 text-muted-foreground hover:border-foreground/20 hover:text-foreground"
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Casa de apuestas</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {defaultBookies.map(b => (
                        <button
                          key={b}
                          onClick={() => setMainBookie(b)}
                          className={`rounded-lg border px-2 py-2 text-xs font-medium transition-all ${
                            mainBookie === b
                              ? "border-foreground/20 bg-foreground/[0.08] text-foreground"
                              : "border-border/70 bg-muted/35 text-muted-foreground hover:border-foreground/20 hover:text-foreground"
                          }`}
                        >
                          {b}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="flex gap-2 mt-6">
            {step > 0 && (
              <Button
                variant="outline"
                onClick={() => setStep(s => s - 1)}
                className="rounded-full border-border/70 text-muted-foreground"
                aria-label="Volver"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
            )}
            {step === 0 && (
              <Button
                variant="ghost"
                onClick={handleFinish}
                className="h-10 rounded-full px-3 text-xs font-bold text-muted-foreground"
              >
                Ahora no
              </Button>
            )}
            <Button
              onClick={() => step < steps.length - 1 ? setStep(s => s + 1) : handleFinish()}
              className="h-10 flex-1 rounded-full bg-primary font-black text-primary-foreground hover:bg-primary/90"
            >
              {step === steps.length - 1 ? "Empezar" : "Siguiente"}
              {step < steps.length - 1 && <ChevronRight className="w-4 h-4 ml-1" />}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
