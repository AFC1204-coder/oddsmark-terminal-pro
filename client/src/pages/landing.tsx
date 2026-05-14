import type { ReactNode } from "react";
import { useLocation } from "wouter";
import { ArrowRight, BarChart3, FileCheck2, LockKeyhole, ShieldCheck, Users } from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Button } from "@/components/ui/button";

interface LandingProps {
  onGetStarted: () => void;
}

const proofItems = [
  "Hash público solo cuando existe prueba real.",
  "Tickets compartibles sin prometer verificación falsa.",
  "Perfil público opcional, separado del historial privado.",
];

export default function Landing({ onGetStarted }: LandingProps) {
  const [, setLocation] = useLocation();

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <section className="relative min-h-[92vh] overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.055)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[size:54px_54px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_52%_18%,rgba(255,255,255,0.14),transparent_32rem),linear-gradient(180deg,rgba(9,9,11,0.2),#09090b_86%)]" />

        <div className="relative mx-auto flex min-h-[92vh] w-full max-w-6xl flex-col px-4 py-4 sm:px-6 lg:px-8">
          <nav className="flex items-center justify-between gap-4">
            <BrandLogo className="h-9 w-44" imageClassName="max-h-full" />
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation("/ranking")}
                className="hidden h-9 rounded-full text-xs text-zinc-300 hover:bg-white/10 hover:text-white sm:inline-flex"
              >
                Ranking
              </Button>
              <Button
                onClick={onGetStarted}
                size="sm"
                variant="outline"
                className="h-9 rounded-full border-white/15 bg-white/5 text-xs text-zinc-100 hover:bg-white/10"
              >
                Entrar
              </Button>
            </div>
          </nav>

          <div className="grid flex-1 content-center gap-10 py-12 lg:grid-cols-[minmax(0,0.95fr)_minmax(22rem,28rem)] lg:items-center">
            <div className="max-w-3xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1 text-[10px] font-bold uppercase tracking-normal text-zinc-300">
                <ShieldCheck className="h-3.5 w-3.5" />
                Beta pública controlada
              </div>
              <h1 className="text-4xl font-black leading-[0.98] tracking-normal sm:text-6xl lg:text-7xl">
                Oddsmark
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-relaxed text-zinc-300 sm:text-lg">
                Panel serio para registrar apuestas, controlar banca real y compartir resultados con prueba pública cuando existe hash verificable.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button onClick={onGetStarted} className="h-11 rounded-full bg-white px-6 font-black text-zinc-950 hover:bg-zinc-200">
                  Crear cuenta beta
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setLocation("/ranking")}
                  className="h-11 rounded-full border-white/15 bg-transparent px-6 font-bold text-zinc-100 hover:bg-white/10"
                >
                  Ver perfiles públicos
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-white/12 bg-zinc-950/70 p-3 shadow-2xl shadow-black/40">
              <div className="rounded-md border border-white/10 bg-white/[0.03] p-4">
                <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase text-zinc-500">Banca real</p>
                    <p className="mt-1 font-mono text-3xl font-black">55.73u</p>
                  </div>
                  <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-xs font-bold text-emerald-300">
                    +5.74u
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <Metric label="P&L" value="+5.74u" tone="text-emerald-300" />
                  <Metric label="Exposición" value="4.70u" tone="text-zinc-100" />
                  <Metric label="Prueba" value="35%" tone="text-zinc-100" />
                </div>
                <div className="mt-5 h-28 rounded-md border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),transparent)] p-3">
                  <svg viewBox="0 0 320 100" className="h-full w-full" role="img" aria-label="Vista previa de evolución de banca">
                    <path d="M4 78 C35 24, 55 86, 82 58 S135 34, 160 56 210 34, 238 48 284 34, 316 18" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="4" strokeLinecap="round" />
                    <path d="M4 78 C35 24, 55 86, 82 58 S135 34, 160 56 210 34, 238 48 284 34, 316 18 L316 100 L4 100 Z" fill="rgba(255,255,255,0.08)" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-2 pb-5 sm:grid-cols-3">
            {proofItems.map((item) => (
              <div key={item} className="rounded-md border border-white/10 bg-white/[0.035] px-3 py-2 text-xs text-zinc-300">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-3 px-4 py-12 sm:px-6 md:grid-cols-3 lg:px-8">
        <Feature
          icon={<FileCheck2 className="h-5 w-5" />}
          title="Registro verificable"
          description="Cada apuesta puede mostrar prueba pre-evento si fue creada con hash público real. Si no existe, se indica sin prueba pública."
        />
        <Feature
          icon={<BarChart3 className="h-5 w-5" />}
          title="Decisión, no ruido"
          description="Yield, P&L, exposición, evolución, estrategias y señales para decidir si seguir, pausar o ajustar."
        />
        <Feature
          icon={<Users className="h-5 w-5" />}
          title="Perfil social serio"
          description="Ficha pública opcional con métricas, especialidades y ledger. Pensada para credibilidad, no para gamificación."
        />
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pb-14 sm:px-6 lg:px-8">
        <div className="grid gap-4 rounded-lg border border-white/10 bg-white/[0.035] p-4 sm:grid-cols-[1fr_auto] sm:items-center sm:p-5">
          <div>
            <p className="text-sm font-black">Beta pública con trazabilidad</p>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-zinc-400">
              Entramos en fase de cierre: QA móvil y desktop, share cards, verificación, feedback y seguridad básica antes de abrir más usuarios.
            </p>
          </div>
          <Button onClick={onGetStarted} className="h-10 rounded-full bg-white font-black text-zinc-950 hover:bg-zinc-200">
            Solicitar acceso
          </Button>
        </div>
      </section>

      <footer className="border-t border-white/10 px-4 py-6 text-xs text-zinc-500 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <span>Oddsmark</span>
          <div className="flex flex-wrap items-center gap-4">
            <button onClick={() => setLocation("/privacidad")} className="hover:text-zinc-200">Privacidad</button>
            <button onClick={() => setLocation("/condiciones")} className="hover:text-zinc-200">Condiciones</button>
            <button onClick={() => setLocation("/juego-responsable")} className="hover:text-zinc-200">Juego responsable</button>
            <button onClick={() => setLocation("/soporte")} className="hover:text-zinc-200">Soporte</button>
          </div>
        </div>
      </footer>
    </main>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-black/20 px-2.5 py-2">
      <p className="text-[9px] font-bold uppercase text-zinc-500">{label}</p>
      <p className={`mt-1 font-mono text-sm font-black ${tone}`}>{value}</p>
    </div>
  );
}

function Feature({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <article className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
      <div className="mb-4 grid h-10 w-10 place-items-center rounded-md border border-white/10 bg-white/[0.04] text-zinc-200">
        {icon}
      </div>
      <h2 className="text-sm font-black text-white">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">{description}</p>
    </article>
  );
}
