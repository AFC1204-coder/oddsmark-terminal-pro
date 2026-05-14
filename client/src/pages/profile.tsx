import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Award, BarChart3, Edit3, ExternalLink, Link2, ShieldCheck, Share2, Target, TrendingUp, Users } from "lucide-react";
import { useLocation } from "wouter";
import type { Bet } from "@shared/schema";
import { SkillRadar } from "@/components/profile/SkillRadar";
import { EditTipsterProfileModal, type TipsterProfileEdit } from "@/components/tipster/EditTipsterProfileModal";
import { TipsterProfileModal } from "@/components/tipster/TipsterProfileModal";
import { tierConfig } from "@/components/tipster/types";
import { betService } from "@/services/betService";
import { generateTipstersFromBets, getProfileReadiness, normalizeTipsterProfile, type ServerTipsterProfile } from "@/lib/tipster-profile";

export default function ProfilePage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [publicPreviewOpen, setPublicPreviewOpen] = useState(false);
  const [savedProfileOverride, setSavedProfileOverride] = useState<TipsterProfileEdit | null>(null);

  const { data: serverProfile = null } = useQuery<ServerTipsterProfile | null>({
    queryKey: ["/api/tipster-profile"],
    enabled: !!user,
    retry: false,
  });

  const { data: bets = [] } = useQuery<Bet[]>({
    queryKey: ["supabase-bets"],
    queryFn: () => betService.getBets(),
    enabled: !!user,
  });

  const savedProfile = useMemo<TipsterProfileEdit | null>(() => {
    if (savedProfileOverride) return savedProfileOverride;
    return normalizeTipsterProfile(serverProfile);
  }, [savedProfileOverride, serverProfile]);

  const selfTipster = useMemo(() => {
    return generateTipstersFromBets(bets, user?.id || "", "all", savedProfile).find(t => t.id === user?.id) || null;
  }, [bets, user?.id, savedProfile]);

  const readiness = useMemo(() => getProfileReadiness(bets), [bets]);
  const tier = selfTipster ? tierConfig[selfTipster.tier] : tierConfig.bronze;
  const readinessPercent = Math.min(100, (readiness.closedBets / readiness.recommendedBets) * 100);
  const displayName = selfTipster?.displayName || savedProfile?.displayName || user?.email?.split("@")[0] || "Tu Perfil";
  const avatarInitials = selfTipster?.avatarInitials || displayName.slice(0, 2).toUpperCase();
  const hasPublicProfile = Boolean(savedProfile?.username && savedProfile.isPublic);
  const profileUrl = hasPublicProfile ? `${window.location.origin}/tipster/${savedProfile?.username}` : null;
  const connectedSocials = [
    savedProfile?.telegramUrl,
    savedProfile?.twitterUrl,
    savedProfile?.instagramUrl,
    savedProfile?.youtubeUrl,
  ].filter(Boolean).length;

  const currentProfile = {
    username: savedProfile?.username || "",
    displayName: savedProfile?.displayName || selfTipster?.displayName || "",
    bio: savedProfile?.bio || selfTipster?.bio || "",
    avatarUrl: savedProfile?.avatarUrl || null,
    telegramUrl: savedProfile?.telegramUrl || null,
    twitterUrl: savedProfile?.twitterUrl || null,
    instagramUrl: savedProfile?.instagramUrl || null,
    youtubeUrl: savedProfile?.youtubeUrl || null,
    isPublic: savedProfile?.isPublic ?? false,
  };

  const handleShareProfile = async () => {
    if (!profileUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: `${displayName} - Oddsmark`, url: profileUrl });
        return;
      } catch {}
    }
    await navigator.clipboard.writeText(profileUrl);
  };

  if (!user || !selfTipster) return null;

  return (
    <div className="terminal-shell min-h-screen p-4 text-foreground md:p-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocation("/")}
          className="text-muted-foreground hover:text-foreground"
          data-testid="button-back-dashboard"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver al Dashboard
        </Button>

        <section className="surface-panel rounded-lg p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg ${tier.bg} ${tier.border} border flex items-center justify-center`}>
              {selfTipster.avatarUrl ? (
                <img src={selfTipster.avatarUrl} className="h-full w-full object-cover" alt="" />
              ) : (
                <span className={`text-xl font-black ${tier.color}`}>{avatarInitials}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-2xl font-black text-foreground">{displayName}</h1>
                <span className={`rounded border px-1.5 py-0.5 text-[9px] font-bold ${tier.color} ${tier.bg} ${tier.border}`}>
                  {readiness.statusLabel.toUpperCase()}
                </span>
                {selfTipster.isVerified && (
                  <span className="inline-flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400">
                    <ShieldCheck className="h-3 w-3" />
                    VERIFICADO
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {hasPublicProfile ? `@${savedProfile?.username}` : "Ficha no pública"} · {readiness.closedBets} cerradas · {readiness.verifiedBets} con prueba
              </p>
              {selfTipster.bio ? (
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  {selfTipster.bio}
                </p>
              ) : (
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground/70">
                  Añade una descripción breve para explicar tu enfoque, deportes y gestión de stake.
                </p>
              )}
              <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
                <TrustPill label="Prueba pública" value={`${readiness.verifiedBets} apuestas`} />
                <TrustPill label="Muestra" value={`${readiness.closedBets}/${readiness.recommendedBets}`} />
                <TrustPill label="Redes" value={`${connectedSocials}/4`} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:w-44 sm:grid-cols-1">
              <Button
                size="sm"
                onClick={() => setEditProfileOpen(true)}
                className="h-8 bg-primary text-xs text-primary-foreground hover:bg-primary/90"
              >
                <Edit3 className="h-3.5 w-3.5" />
                Editar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocation("/tipsters")}
                className="h-8 border-border/70 bg-card/70 text-xs text-muted-foreground hover:bg-muted/70 hover:text-foreground"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Ver en Hub
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPublicPreviewOpen(true)}
                className="h-8 border-border/70 bg-card/70 text-xs text-muted-foreground hover:bg-muted/70 hover:text-foreground"
              >
                <BarChart3 className="h-3.5 w-3.5" />
                Previsualizar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleShareProfile}
                disabled={!profileUrl}
                className="h-8 border-border/70 bg-card/70 text-xs text-muted-foreground hover:bg-muted/70 hover:text-foreground"
              >
                <Share2 className="h-3.5 w-3.5" />
                Compartir
              </Button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1fr_1.15fr]">
          <div className="surface-panel rounded-lg p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-foreground">Presencia pública</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {hasPublicProfile ? "Ficha pública preparada" : "Ficha pública pendiente"}
                </p>
              </div>
              <span className="rounded-md border border-border/70 bg-card/60 px-2 py-1 text-[10px] uppercase text-muted-foreground">
                Fiabilidad {readiness.reliability}
              </span>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-foreground" style={{ width: `${readinessPercent}%` }} />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <MetricMini label="Cerradas" value={`${readiness.closedBets}/${readiness.recommendedBets}`} />
              <MetricMini label="Verificadas" value={String(readiness.verifiedBets)} />
              <MetricMini label="Deportes" value={String(selfTipster.specialties.length)} />
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              {readiness.missingForPublicStrength > 0
                ? `Faltan ${readiness.missingForPublicStrength} apuestas cerradas para una muestra pública más sólida.`
                : "La muestra ya permite leer el perfil con más contexto."}
            </p>
          </div>

          <div className="surface-panel rounded-lg p-4">
            <h2 className="text-sm font-bold text-foreground">Resumen de rendimiento</h2>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatCard icon={<Target className="h-3.5 w-3.5" />} label="Aciertos" value={`${selfTipster.winRate.toFixed(1)}%`} hint={`${selfTipster.recentForm.filter(r => r === "W").length}/${selfTipster.recentForm.length || 0} últimos`} />
              <StatCard icon={<TrendingUp className="h-3.5 w-3.5" />} label="Yield" value={`${selfTipster.yield >= 0 ? "+" : ""}${selfTipster.yield.toFixed(2)}%`} tone={selfTipster.yield >= 0 ? "positive" : "negative"} />
              <StatCard icon={<Award className="h-3.5 w-3.5" />} label="P&L" value={`${selfTipster.profitUnits >= 0 ? "+" : ""}${selfTipster.profitUnits.toFixed(2)}u`} tone={selfTipster.profitUnits >= 0 ? "positive" : "negative"} />
              <StatCard icon={<ShieldCheck className="h-3.5 w-3.5" />} label="Prueba" value={String(readiness.verifiedBets)} hint="con hash" tone="warm" />
            </div>
          </div>
        </section>

        <SkillRadar bets={bets} compactLocked />

        <section className="surface-panel rounded-lg p-4">
          <h2 className="text-sm font-bold text-foreground">Preparación social</h2>
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
            <ProfileSignal icon={<Link2 className="h-3.5 w-3.5" />} label="Enlace público" value={hasPublicProfile ? "Activo" : "Pendiente"} />
            <ProfileSignal icon={<ShieldCheck className="h-3.5 w-3.5" />} label="Apuestas con prueba" value={String(readiness.verifiedBets)} />
            <ProfileSignal icon={<Users className="h-3.5 w-3.5" />} label="Redes conectadas" value={`${connectedSocials}/4`} />
          </div>
        </section>

        <EditTipsterProfileModal
          open={editProfileOpen}
          onClose={() => setEditProfileOpen(false)}
          onSave={setSavedProfileOverride}
          currentProfile={currentProfile}
        />

        <TipsterProfileModal
          tipster={selfTipster}
          mode="preview"
          open={publicPreviewOpen}
          onClose={() => setPublicPreviewOpen(false)}
        />
      </div>
    </div>
  );
}

function TrustPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/60 bg-muted/35 px-2.5 py-1.5">
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-mono text-xs font-bold text-foreground">{value}</p>
    </div>
  );
}

function MetricMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-tile p-2">
      <p className="font-mono text-sm font-bold text-foreground">{value}</p>
      <p className="mt-0.5 text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "positive" | "negative" | "warm";
}) {
  const color =
    tone === "positive" ? "text-emerald-400" :
    tone === "negative" ? "text-red-400" :
    tone === "warm" ? "text-foreground" :
    "text-foreground";

  return (
    <div className="metric-tile p-3">
      <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <p className={`font-mono text-lg font-black ${color}`}>{value}</p>
      {hint && <p className="mt-0.5 text-[10px] text-muted-foreground/70">{hint}</p>}
    </div>
  );
}

function ProfileSignal({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="metric-tile flex items-center justify-between gap-3 px-3 py-2">
      <span className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
        {icon}
        <span className="truncate">{label}</span>
      </span>
      <span className="font-mono text-xs text-foreground">{value}</span>
    </div>
  );
}
