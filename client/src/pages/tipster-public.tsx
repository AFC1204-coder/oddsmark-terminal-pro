import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { getSafeExternalUrl } from "@/lib/safe-url";
import { formatSportLabel } from "@/lib/tipster-profile";
import { ArrowLeft, ShieldCheck, ExternalLink, Loader2, Share2, Copy, Check, Code2 } from "lucide-react";

interface StatsBlock {
  totalBets: number;
  settledBets: number;
  pendingBets: number;
  voidedBets: number;
  winRate: number;
  yield: number;
  profitUnits: number;
  avgOdds: number;
}

interface LedgerCompleteness {
  currentVerifiedBets: number;
  createdEvents: number;
  completenessPct: number;
  deletedVerifiedBets: number;
  editedVerifiedBets: number;
  otsAnchoredPct: number;
}

interface TipsterPublicData {
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  isVerified: boolean;
  mainSport: string | null;
  specialties: string[];
  telegramUrl: string | null;
  twitterUrl: string | null;
  instagramUrl: string | null;
  youtubeUrl: string | null;
  verifiedSince: string | null;
  followers?: number;
  stats: StatsBlock;
  preMatchStats: StatsBlock;
  liveStats: StatsBlock | null;
  ledger: LedgerCompleteness;
  recentForm: string[];
  recentBets: Array<{
    event: string;
    market: string;
    odds: number;
    stake: number;
    status: string;
    date: string;
    sport: string;
    league: string;
    isLive: boolean;
  }>;
}

export default function TipsterPublicPage() {
  const [, params] = useRoute("/tipster/:username");
  const [, setLocation] = useLocation();
  const [copied, setCopied] = useState(false);
  const [embedCopied, setEmbedCopied] = useState(false);

  const username = params?.username;
  const { data: tipster, isError, isLoading: loading } = useQuery<TipsterPublicData | null>({
    queryKey: ["/api/tipsters", username],
    enabled: !!username,
    retry: false,
    queryFn: async () => {
      const res = await fetch(`/api/tipsters/${encodeURIComponent(username || "")}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed");
      return await res.json();
    },
  });
  const notFound = !loading && (isError || !tipster);

  if (loading) {
    return (
      <div className="terminal-shell flex min-h-screen items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound || !tipster) {
    return (
      <div className="terminal-shell flex min-h-screen flex-col items-center justify-center gap-4 p-4">
        <p className="text-muted-foreground">Perfil no encontrado</p>
        <Button variant="outline" size="sm" onClick={() => setLocation("/")} className="border-border/70 text-muted-foreground">
          <ArrowLeft className="w-4 h-4 mr-2" />Volver
        </Button>
      </div>
    );
  }

  const s = tipster.preMatchStats;
  const live = tipster.liveStats;
  const initials = tipster.displayName.slice(0, 2).toUpperCase();
  const ledgerPct = tipster.ledger.completenessPct;
  const hasPublicProof = tipster.ledger.currentVerifiedBets > 0;
  const ledgerTone = ledgerPct >= 99 ? "text-emerald-400" : ledgerPct >= 90 ? "text-amber-400" : "text-red-400";
  const ledgerBar = ledgerPct >= 99 ? "bg-emerald-500" : ledgerPct >= 90 ? "bg-amber-500" : "bg-red-500";

  return (
    <div className="terminal-shell min-h-screen pb-12 text-foreground">
      {/* Header */}
      <div className="mx-auto max-w-5xl px-4 pt-4 pb-2">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/")} className="-ml-2 mb-3 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Oddsmark
        </Button>
      </div>

      {/* Profile */}
      <div className="mx-auto max-w-5xl px-4 pb-6">
        <div className="surface-panel rounded-lg p-4 sm:p-5">
        <div className="flex items-start gap-4 mb-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/70 bg-muted">
            {tipster.avatarUrl ? (
              <img src={tipster.avatarUrl} className="w-full h-full object-cover" alt="" />
            ) : (
              <span className="text-lg font-bold text-muted-foreground">{initials}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h1 className="text-xl font-black text-foreground truncate">{tipster.displayName}</h1>
              {tipster.isVerified && <ShieldCheck className="w-4 h-4 text-primary shrink-0" />}
            </div>
            <p className="text-sm text-muted-foreground">@{tipster.username}</p>
            {typeof tipster.followers === "number" && (
              <p className="mt-1 text-[11px] text-muted-foreground">{tipster.followers} seguidores</p>
            )}
            {tipster.bio && <p className="text-sm text-muted-foreground mt-2">{tipster.bio}</p>}
          </div>
        </div>

        {/* Tags */}
        {(tipster.mainSport || tipster.specialties.length > 0) && (
          <div className="flex gap-1.5 flex-wrap mb-4">
            {tipster.mainSport && (
              <span className="rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs text-primary">{formatSportLabel(tipster.mainSport)}</span>
            )}
            {tipster.specialties.map(s => (
              <span key={s} className="rounded-md border border-border/70 bg-card/70 px-2 py-0.5 text-xs text-muted-foreground">{formatSportLabel(s)}</span>
            ))}
          </div>
        )}

        {/* Social + share */}
        <div className="flex gap-2 flex-wrap">
          {tipster.telegramUrl && <SocialLink label="Telegram" url={tipster.telegramUrl} />}
          {tipster.twitterUrl && <SocialLink label="Twitter" url={tipster.twitterUrl} />}
          {tipster.instagramUrl && <SocialLink label="Instagram" url={tipster.instagramUrl} />}
          {tipster.youtubeUrl && <SocialLink label="YouTube" url={tipster.youtubeUrl} />}
          <button
            onClick={async () => {
              const url = `${window.location.origin}/tipster/${tipster.username}`;
              if (navigator.share) {
                try {
                  await navigator.share({ title: `${tipster.displayName} — Oddsmark`, url });
                } catch {}
              } else {
                await navigator.clipboard.writeText(url);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }
            }}
            className="flex items-center gap-1 rounded-md border border-border/70 bg-card/70 px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Share2 className="w-3 h-3" />}
            {copied ? "Copiado" : "Compartir"}
          </button>
          <button
            onClick={async () => {
              const embedCode = `<iframe src="${window.location.origin}/embed/${tipster.username}" width="380" height="280" frameborder="0" style="border-radius:12px;border:none;"></iframe>`;
              await navigator.clipboard.writeText(embedCode);
              setEmbedCopied(true);
              setTimeout(() => setEmbedCopied(false), 2000);
            }}
            className="flex items-center gap-1 rounded-md border border-border/70 bg-card/70 px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            {embedCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Code2 className="w-3 h-3" />}
            {embedCopied ? "Copiado" : "Embed"}
          </button>
        </div>
        </div>
      </div>

      {/* Stats */}
      <div className="mx-auto max-w-5xl px-4 mb-6">
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="surface-panel rounded-lg p-3 text-center">
            <p className={`text-2xl font-bold font-mono ${s.yield >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {s.yield >= 0 ? "+" : ""}{s.yield.toFixed(1)}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">Yield</p>
          </div>
          <div className="surface-panel rounded-lg p-3 text-center">
            <p className={`text-2xl font-bold font-mono ${s.profitUnits >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {s.profitUnits >= 0 ? "+" : ""}{s.profitUnits.toFixed(1)}u
            </p>
            <p className="text-xs text-muted-foreground mt-1">P&L total</p>
          </div>
        </div>
        <div className="surface-panel rounded-lg px-3 py-2 space-y-1.5">
          <StatRow label="Acierto" value={`${s.winRate.toFixed(1)}%`} />
          <StatRow label="Cuota media" value={`@${s.avgOdds.toFixed(2)}`} />
          <StatRow label="Resueltas" value={`${s.settledBets} de ${s.totalBets}`} />
          {s.pendingBets > 0 && <StatRow label="Pendientes" value={`${s.pendingBets}`} muted />}
          {s.voidedBets > 0 && <StatRow label="Anuladas" value={`${s.voidedBets}`} muted />}
        </div>

        <div className="surface-panel rounded-lg px-3 py-2 mt-3 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] text-muted-foreground mb-0.5">Integridad del ledger</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Mide si las apuestas verificadas tienen evento inicial registrado y si las ediciones/borrados dejan rastro.
              </p>
            </div>
            <span className={`text-lg font-bold font-mono ${ledgerTone}`}>{ledgerPct.toFixed(1)}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div className={`h-full ${ledgerBar}`} style={{ width: `${Math.max(0, Math.min(100, ledgerPct))}%` }} />
          </div>
          <StatRow label="Completitud" value={`${tipster.ledger.completenessPct.toFixed(1)}%`} />
          <StatRow label="Apuestas con evento inicial" value={`${tipster.ledger.createdEvents} de ${tipster.ledger.currentVerifiedBets}`} muted />
          <StatRow label="Ediciones registradas" value={`${tipster.ledger.editedVerifiedBets}`} muted />
          <StatRow label="Borrados registrados" value={`${tipster.ledger.deletedVerifiedBets}`} muted />
          <StatRow label="OTS anclado" value={`${tipster.ledger.otsAnchoredPct.toFixed(1)}%`} muted />
        </div>

        {/* Live stats if they exist */}
        {live && live.settledBets > 0 && (
          <div className="surface-panel rounded-lg px-3 py-2 mt-3">
            <p className="text-[10px] text-muted-foreground mb-1.5">Apuestas live</p>
            <div className="space-y-1.5">
              <StatRow label="Yield" value={`${live.yield >= 0 ? "+" : ""}${live.yield.toFixed(1)}%`} />
              <StatRow label="P&L" value={`${live.profitUnits >= 0 ? "+" : ""}${live.profitUnits.toFixed(1)}u`} />
              <StatRow label="Resueltas" value={`${live.settledBets}`} />
            </div>
          </div>
        )}
      </div>

      {/* Recent form */}
      {tipster.recentForm.length > 0 && (
        <div className="mx-auto max-w-5xl px-4 mb-6">
          <p className="text-xs text-muted-foreground mb-2">Forma reciente</p>
          <div className="flex gap-1">
            {tipster.recentForm.map((r, i) => (
              <span key={i} className={`w-7 h-7 rounded flex items-center justify-center text-xs font-medium ${
                r === "W" ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
              }`}>{r}</span>
            ))}
          </div>
        </div>
      )}

      {/* Recent bets */}
      {tipster.recentBets.length > 0 && (
        <div className="mx-auto max-w-5xl px-4 mb-6">
          <p className="text-xs text-muted-foreground mb-2">Últimas apuestas con prueba pública</p>
          <div className="space-y-1.5">
            {tipster.recentBets.map((bet, i) => (
              <div key={i} className="surface-panel rounded-lg px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-foreground truncate flex-1">{bet.event}</p>
                  <span className={`text-xs font-mono shrink-0 ${
                    bet.status === "won" ? "text-emerald-400" :
                    bet.status === "lost" ? "text-red-400" :
                    bet.status === "void" ? "text-muted-foreground/70" :
                    "text-muted-foreground"
                  }`}>
                    {bet.status === "won" ? "W" : bet.status === "lost" ? "L" : bet.status === "void" ? "V" : "P"} @{bet.odds.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-muted-foreground">{bet.market}</span>
                  <span className="text-[10px] font-mono text-muted-foreground/70">{bet.stake.toFixed(1)}u</span>
                  {bet.isLive && <span className="text-[9px] text-amber-500">LIVE</span>}
                  <span className="text-[10px] text-muted-foreground/70 ml-auto">{bet.date}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Verification banner */}
      {(tipster.isVerified || hasPublicProof) && (
        <div className="mx-auto max-w-5xl px-4 mb-6">
          <div className="surface-panel rounded-lg px-3 py-2.5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
              <div>
                <p className="text-xs text-foreground">{tipster.isVerified ? "Perfil con ledger verificado" : "Prueba pública parcial"}</p>
                <p className="text-[10px] text-muted-foreground">
                  {tipster.ledger.currentVerifiedBets} apuestas con registro comprobable antes del evento.
                  {tipster.verifiedSince && ` Desde ${new Date(tipster.verifiedSince).toLocaleDateString("es-ES")}.`}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="mx-auto max-w-5xl px-4">
        <div className="surface-panel rounded-lg p-4 text-center">
          <p className="text-sm text-foreground mb-1">¿Quieres verificar tus apuestas?</p>
          <p className="text-xs text-muted-foreground mb-3">Crea tu perfil gratis en Oddsmark</p>
          <Button onClick={() => setLocation("/auth")} className="bg-primary text-primary-foreground hover:bg-primary/90 text-sm">
            Crear cuenta gratis
          </Button>
        </div>
      </div>
    </div>
  );
}

function StatRow({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-xs ${muted ? "text-muted-foreground/70" : "text-muted-foreground"}`}>{label}</span>
      <span className={`text-xs font-mono ${muted ? "text-muted-foreground/70" : "text-foreground"}`}>{value}</span>
    </div>
  );
}

function SocialLink({ label, url }: { label: string; url: string }) {
  const safeUrl = getSafeExternalUrl(url);
  if (!safeUrl) return null;
  return (
    <a
      href={safeUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1 rounded-md border border-border/70 bg-card/70 px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
    >
      {label}
      <ExternalLink className="w-3 h-3" />
    </a>
  );
}
