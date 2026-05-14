import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck,
  ShieldAlert,
  Users,
  ExternalLink,
  Copy,
  Check,
  Loader2,
} from "lucide-react";
import type { TipsterData } from "./types";
import { tierConfig } from "./types";
import { ProfitSparkline } from "./ProfitSparkline";
import { getSafeExternalUrl } from "@/lib/safe-url";
import { apiRequest } from "@/lib/queryClient";

interface TipsterProfileModalProps {
  tipster: TipsterData;
  open: boolean;
  onClose: () => void;
  mode?: "public" | "preview";
}

export function TipsterProfileModal({ tipster, open, onClose, mode = "public" }: TipsterProfileModalProps) {
  const [isFollowing, setIsFollowing] = useState(tipster.isFollowing);
  const [followLoading, setFollowLoading] = useState(false);
  const [followerCount, setFollowerCount] = useState(tipster.followers);
  const [copied, setCopied] = useState(false);
  const tier = tierConfig[tipster.tier];
  const isPreview = mode === "preview";
  const canFollow = !isPreview && Boolean(tipster.username);

  const handleFollow = useCallback(async () => {
    if (!tipster.username || followLoading) return;
    setFollowLoading(true);
    try {
      const method = isFollowing ? "DELETE" : "POST";
      const res = await apiRequest(method, `/api/tipsters/${tipster.username}/follow`);
      const data = await res.json();
      setIsFollowing(data.following);
      setFollowerCount(data.followers);
    } catch {
      // silently fail
    } finally {
      setFollowLoading(false);
    }
  }, [tipster.username, isFollowing, followLoading]);

  const handleCopyProfile = async () => {
    const text = `${tipster.displayName} | Yield: ${tipster.yield >= 0 ? "+" : ""}${tipster.yield.toFixed(1)}% | Acierto: ${tipster.winRate.toFixed(0)}% | ${tipster.totalBets} apuestas | P&L: ${tipster.profitUnits >= 0 ? "+" : ""}${tipster.profitUnits.toFixed(2)}u`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const formWins = tipster.recentForm.filter(r => r === "W").length;
  const formTotal = tipster.recentForm.length;
  const formRate = formTotal > 0 ? (formWins / formTotal) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-0 overflow-hidden bg-zinc-950 border-zinc-800 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="sr-only">
          <DialogTitle>{isPreview ? "Previsualización pública" : `Perfil de ${tipster.displayName}`}</DialogTitle>
          <DialogDescription>
            Métricas públicas, forma reciente y acciones del perfil de tipster.
          </DialogDescription>
        </DialogHeader>

        {/* Profile Header */}
        <div className={`bg-gradient-to-br ${tier.gradientFrom} ${tier.gradientTo} p-5 pb-4 relative`}>
          <div className="absolute top-3 right-4">
            <div className="flex items-center gap-1 bg-zinc-950/60 backdrop-blur-sm px-2 py-1 rounded-lg">
              <span className="text-[10px] font-bold text-zinc-300">
                {isPreview ? "PREVISUALIZACIÓN" : `RANKING #${tipster.rank}`}
              </span>
            </div>
          </div>

          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="relative">
              <div className={`w-16 h-16 rounded-2xl ${tier.bg} ${tier.border} border flex items-center justify-center`}>
                {tipster.avatarUrl ? (
                  <img src={tipster.avatarUrl} className="w-full h-full object-cover rounded-2xl" alt="" />
                ) : (
                  <span className={`font-black text-xl ${tier.color}`}>{tipster.avatarInitials}</span>
                )}
              </div>
              {tipster.isVerified && (
                <div className="absolute -bottom-1 -right-1 bg-emerald-500 rounded-full p-0.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-white" />
                </div>
              )}
            </div>

            {/* Name & Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xl font-black text-white truncate">{tipster.displayName}</h2>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-[10px] font-bold tracking-wider ${tier.color} ${tier.bg} ${tier.border} border px-2 py-0.5 rounded-md`}>
                  {tipster.totalBets} APUESTAS
                </span>
                {tipster.isVerified && (
                  <span className="text-[10px] font-bold tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <ShieldCheck className="w-2.5 h-2.5" />
                    VERIFICADO
                  </span>
                )}
              </div>
              {tipster.bio && <p className="text-xs text-zinc-400">{tipster.bio}</p>}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 mt-4">
            {canFollow && (
              <Button
                onClick={handleFollow}
                disabled={followLoading}
                size="sm"
                className={`flex-1 h-9 text-xs font-bold ${
                  isFollowing
                    ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-700"
                    : "bg-emerald-600 text-white hover:bg-emerald-700"
                }`}
              >
                {followLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : isFollowing ? (
                  <>
                    <Check className="w-3.5 h-3.5 mr-1.5" />
                    Siguiendo
                  </>
                ) : (
                  <>
                    <Users className="w-3.5 h-3.5 mr-1.5" />
                    Seguir perfil
                  </>
                )}
              </Button>
            )}
            <Button
              onClick={handleCopyProfile}
              size="sm"
              variant="outline"
              className={`${canFollow ? "h-9 px-3" : "h-9 flex-1"} border-zinc-700 text-zinc-300`}
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {!canFollow && <span className="ml-2 text-xs">Copiar resumen</span>}
            </Button>
          </div>
        </div>

        {/* Verification Banner */}
        {tipster.isVerified && tipster.verifiedSince && (
          <div className="mx-4 mt-3 bg-emerald-950/30 border border-emerald-500/20 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-emerald-400">Ledger verificado</span>
            </div>
            <p className="text-[11px] text-zinc-400">
              Verificado desde <span className="text-zinc-300">{tipster.verifiedSince}</span>.
              Apuestas registradas antes de cada evento.
            </p>
          </div>
        )}

        {!tipster.isVerified && (
          <div className="mx-4 mt-3 bg-zinc-900 border border-zinc-800 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <ShieldAlert className="w-4 h-4 text-zinc-500" />
              <span className="text-xs font-bold text-zinc-400">
                {isPreview ? "Previsualización privada" : "Sin prueba pública completa"}
              </span>
            </div>
            <p className="text-[11px] text-zinc-500">
              {isPreview
                ? "La página pública debe apoyarse en apuestas verificadas pre-evento para construir confianza."
                : "La ficha aún no tiene suficiente muestra pública verificada pre-evento."}
            </p>
          </div>
        )}

        {/* Main Stats */}
        <div className="px-4 mt-3">
          {/* Hero stats — yield and P&L get the most weight */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-center">
              <p className={`text-2xl font-bold font-mono ${tipster.yield >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {tipster.yield >= 0 ? "+" : ""}{tipster.yield.toFixed(1)}%
              </p>
              <p className="text-[10px] text-zinc-500 mt-1">Yield</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-center">
              <p className={`text-2xl font-bold font-mono ${tipster.profitUnits >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {tipster.profitUnits >= 0 ? "+" : ""}{tipster.profitUnits.toFixed(1)}u
              </p>
              <p className="text-[10px] text-zinc-500 mt-1">P&L total</p>
            </div>
          </div>
          {/* Secondary stats — lighter weight, inline pairs */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-400">Acierto</span>
              <span className={`text-xs font-mono font-medium ${tipster.winRate > 50 ? "text-white" : "text-zinc-300"}`}>{tipster.winRate.toFixed(1)}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-400">Cuota media</span>
              <span className="text-xs font-mono text-zinc-300">@{tipster.avgOdds.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-400">Racha</span>
              <span className="text-xs font-mono text-zinc-300">{tipster.currentStreak > 0 ? "+" : ""}{tipster.currentStreak} <span className="text-zinc-600">/ mejor {tipster.bestStreak}</span></span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-400">Mes actual</span>
              <span className={`text-xs font-mono font-medium ${tipster.monthlyProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>{tipster.monthlyProfit >= 0 ? "+" : ""}{tipster.monthlyProfit.toFixed(2)}u</span>
            </div>
          </div>
        </div>

        {/* Summary bar */}
        <div className="px-4 mt-3">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 flex items-center justify-between">
            <div className="text-center flex-1">
              <p className="text-lg font-bold text-white font-mono">{tipster.totalBets}</p>
              <p className="text-[9px] text-zinc-500">Apuestas</p>
            </div>
            <div className="w-px h-8 bg-zinc-800" />
            <div className="text-center flex-1">
              <p className="text-lg font-bold text-white font-mono">{followerCount}</p>
              <p className="text-[9px] text-zinc-500">Seguidores</p>
            </div>
            <div className="w-px h-8 bg-zinc-800" />
            <div className="text-center flex-1">
              <p className="text-lg font-bold text-white font-mono">{tipster.specialties.length}</p>
              <p className="text-[9px] text-zinc-500">Deportes</p>
            </div>
          </div>
        </div>

        {/* Profit Evolution Sparkline */}
        {tipster.profitHistory && tipster.profitHistory.length > 1 && (
          <div className="px-4 mt-3">
            <span className="text-xs font-bold text-zinc-300 mb-2 block">Evolución del P&L</span>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 flex items-center justify-between">
              <div>
                <p className={`text-sm font-black font-mono ${tipster.profitUnits >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {tipster.profitUnits >= 0 ? "+" : ""}{tipster.profitUnits.toFixed(2)}u
                </p>
                <p className="text-[9px] text-zinc-500">{tipster.profitHistory.length} apuestas resueltas</p>
              </div>
              <ProfitSparkline data={tipster.profitHistory} width={160} height={40} />
            </div>
          </div>
        )}

        {/* Recent Form */}
        <div className="px-4 mt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-zinc-300">Forma reciente</span>
            <span className="text-[10px] text-zinc-500">
              {formWins}/{formTotal} ({formRate.toFixed(0)}%)
            </span>
          </div>
          <div className="flex gap-1">
            {tipster.recentForm.map((result, i) => (
              <div
                key={i}
                className={`flex-1 h-8 rounded-md flex items-center justify-center text-xs font-black transition-all ${
                  result === "W" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/20" :
                  result === "L" ? "bg-red-500/20 text-red-400 border border-red-500/20" :
                  "bg-zinc-800 text-zinc-500 border border-zinc-700"
                }`}
              >
                {result}
              </div>
            ))}
          </div>
        </div>

        {/* Specialties */}
        <div className="px-4 mt-3">
          <span className="text-xs font-bold text-zinc-300 mb-2 block">Especialidades</span>
          <div className="flex gap-1.5 flex-wrap">
            {tipster.specialties.map((sport) => (
              <span
                key={sport}
                className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-zinc-800 text-zinc-300 border border-zinc-700"
              >
                {sport}
              </span>
            ))}
          </div>
        </div>

        {/* Social Links */}
        <div className="px-4 mt-4 pb-5">
          <span className="text-xs font-bold text-zinc-300 mb-2 block">Redes sociales</span>
          <div className="grid grid-cols-2 gap-2">
            <SocialButton
              platform="Telegram"
              url={tipster.telegramUrl}
              icon={
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                </svg>
              }
              color="text-sky-400 bg-sky-500/10 border-sky-500/20"
            />
            <SocialButton
              platform="Twitter / X"
              url={tipster.twitterUrl}
              icon={
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              }
              color="text-zinc-300 bg-zinc-500/10 border-zinc-500/20"
            />
            <SocialButton
              platform="Instagram"
              url={tipster.instagramUrl}
              icon={
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
                </svg>
              }
              color="text-pink-400 bg-pink-500/10 border-pink-500/20"
            />
            <SocialButton
              platform="YouTube"
              url={tipster.youtubeUrl}
              icon={
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
              }
              color="text-red-400 bg-red-500/10 border-red-500/20"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Social Button ─── */
function SocialButton({ platform, url, icon, color }: {
  platform: string;
  url: string | null;
  icon: React.ReactNode;
  color: string;
}) {
  const safeUrl = getSafeExternalUrl(url);
  const isConnected = !!safeUrl;

  return (
    <button
      disabled={!isConnected}
      onClick={() => safeUrl && window.open(safeUrl, "_blank", "noopener,noreferrer")}
      className={`flex items-center gap-2.5 p-2.5 rounded-lg border transition-all ${
        isConnected
          ? `${color} hover:opacity-80`
          : "text-zinc-600 bg-zinc-900 border-zinc-800 opacity-40 cursor-not-allowed"
      }`}
    >
      {icon}
      <div className="text-left">
        <p className="text-xs font-bold">{platform}</p>
        <p className="text-[9px] opacity-60">
          {isConnected ? "Conectado" : "No conectado"}
        </p>
      </div>
      {isConnected && <ExternalLink className="w-3 h-3 ml-auto opacity-50" />}
    </button>
  );
}
