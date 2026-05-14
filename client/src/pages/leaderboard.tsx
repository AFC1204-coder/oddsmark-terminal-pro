import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ShieldCheck, Loader2 } from "lucide-react";

interface LeaderboardEntry {
  username: string;
  displayName: string;
  avatarUrl: string | null;
  isVerified: boolean;
  mainSport: string | null;
  totalBets: number;
  winRate: number;
  yield: number;
  profitUnits: number;
}

export default function LeaderboardPage() {
  const [, setLocation] = useLocation();
  const {
    data: tipsters = [],
    isLoading: loading,
    isError: error,
    refetch,
  } = useQuery<LeaderboardEntry[]>({
    queryKey: ["/api/tipsters"],
    retry: false,
    queryFn: async () => {
      const res = await fetch("/api/tipsters");
      if (!res.ok) throw new Error("Failed to load tipsters");
      return await res.json();
    },
  });

  return (
    <div className="terminal-shell min-h-screen pb-12 text-foreground">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="px-4 pt-4 pb-6">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/")} className="-ml-2 mb-4 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Oddsmark
          </Button>
          <h1 className="text-2xl font-black text-foreground">Ranking de tipsters</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Perfiles con apuestas verificables cuando existe prueba pública. Stats reales, sin depender de capturas.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="text-center py-20 px-4">
            <p className="text-muted-foreground">Error al cargar el ranking.</p>
            <Button onClick={() => refetch()} variant="outline" size="sm" className="mt-4 border-border/70 text-muted-foreground">
              Reintentar
            </Button>
          </div>
        ) : tipsters.length === 0 ? (
          <div className="text-center py-20 px-4">
            <p className="text-muted-foreground">Aún no hay tipsters con perfil público.</p>
            <p className="text-sm text-muted-foreground/70 mt-1">Sé el primero en publicar una ficha con métricas serias.</p>
            <Button onClick={() => setLocation("/auth")} className="mt-4 bg-primary text-primary-foreground hover:bg-primary/90">
              Crear cuenta gratis
            </Button>
          </div>
        ) : (
          <div className="px-4 space-y-2">
            {tipsters.map((t, i) => {
              const initials = t.displayName.slice(0, 2).toUpperCase();
              return (
                <button
                  key={t.username}
                  onClick={() => setLocation(`/tipster/${t.username}`)}
                  className="surface-panel flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors hover:border-primary/25"
                >
                  {/* Rank */}
                  <span className="text-sm font-bold text-muted-foreground/70 w-6 text-right shrink-0">
                    {i + 1}
                  </span>

                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                    {t.avatarUrl ? (
                      <img src={t.avatarUrl} className="w-full h-full object-cover" alt="" />
                    ) : (
                      <span className="text-xs font-bold text-muted-foreground">{initials}</span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-foreground truncate">{t.displayName}</span>
                      {t.isVerified && <ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0" />}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                      {t.mainSport && <span>{t.mainSport}</span>}
                      <span>{t.totalBets} apuestas</span>
                      <span>{t.winRate.toFixed(0)}% acierto</span>
                    </div>
                  </div>

                  {/* Yield */}
                  <div className="text-right shrink-0">
                    <p className={`text-base font-bold font-mono ${t.yield >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {t.yield >= 0 ? "+" : ""}{t.yield.toFixed(1)}%
                    </p>
                    <p className="text-[10px] text-muted-foreground/70">yield</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* SEO footer */}
        <div className="px-4 mt-8 text-center">
          <p className="text-xs text-muted-foreground/60">
            Oddsmark — Tracker de apuestas con verificación pre-evento cuando existe hash público.
          </p>
        </div>
      </div>
    </div>
  );
}
