import { useState, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  Search,
  ShieldCheck,
  Users,
  Filter,
  GitCompare,
  Pencil,
  Clock,
  Share2,
  AlertCircle,
  Camera,
} from "lucide-react";
import type { Bet } from "@shared/schema";
import type { TipsterData, TimePeriod } from "@/components/tipster/types";
import { tierConfig } from "@/components/tipster/types";
import { TipsterProfileModal } from "@/components/tipster/TipsterProfileModal";
import { TipsterOfTheMonth } from "@/components/tipster/TipsterOfTheMonth";
import { TipsterComparator } from "@/components/tipster/TipsterComparator";
import { EditTipsterProfileModal, type TipsterProfileEdit } from "@/components/tipster/EditTipsterProfileModal";
import { ProfitSparkline } from "@/components/tipster/ProfitSparkline";
import { betService } from "@/services/betService";
import {
  generateTipstersFromBets,
  getTierFromStats,
  getProfileReadiness,
  normalizeTipsterProfile,
  formatSportLabel,
  type ServerTipsterProfile,
} from "@/lib/tipster-profile";

/* ─── Types ─── */
type SortBy = "yield" | "winRate" | "profit" | "followers" | "totalBets";
type FilterSport = "all" | string;

interface PublicTipsterSummary {
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  isVerified: boolean;
  mainSport: string | null;
  specialties: string[];
  totalBets: number;
  winRate: number;
  yield: number;
  profitUnits: number;
  avgOdds: number;
  currentStreak: number;
  bestStreak: number;
  monthlyProfit: number;
  telegramUrl: string | null;
  twitterUrl: string | null;
  instagramUrl: string | null;
  youtubeUrl: string | null;
  verifiedSince: string | null;
  recentForm: ("W" | "L" | "P")[];
  profitHistory: number[];
  followers: number;
}

/* ─── Main Component ─── */
export default function TipsterHub() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("yield");
  const [filterSport, setFilterSport] = useState<FilterSport>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTipster, setSelectedTipster] = useState<TipsterData | null>(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("all");
  // Comparator
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [comparatorOpen, setComparatorOpen] = useState(false);
  // Edit profile
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [savedProfileOverride, setSavedProfileOverride] = useState<TipsterProfileEdit | null>(null);

  const { data: serverProfile = null } = useQuery<ServerTipsterProfile | null>({
    queryKey: ["/api/tipster-profile"],
    enabled: !!user,
    retry: false,
  });

  const savedProfile = useMemo<TipsterProfileEdit | null>(() => {
    if (savedProfileOverride) return savedProfileOverride;
    return normalizeTipsterProfile(serverProfile);
  }, [savedProfileOverride, serverProfile]);

  const { data: bets = [] } = useQuery<Bet[]>({
    queryKey: ["supabase-bets"],
    queryFn: () => betService.getBets(),
    enabled: !!user,
  });

  const { data: publicTipsters = [] } = useQuery<PublicTipsterSummary[]>({
    queryKey: ["/api/tipsters", timePeriod],
    queryFn: async () => {
      const res = await fetch(`/api/tipsters?period=${timePeriod}`);
      if (!res.ok) throw new Error("Error al cargar tipsters");
      return await res.json();
    },
    enabled: !!user,
  });

  const tipsters = useMemo(() => {
    const localTipsters = generateTipstersFromBets(bets, user?.id || "", timePeriod, savedProfile);
    const selfUsername = savedProfile?.username?.toLowerCase() || "";
    const publicList: TipsterData[] = publicTipsters
      .filter(t => t.username.toLowerCase() !== selfUsername)
      .map((t, index) => {
        const displayName = t.displayName || t.username;
        return {
          id: t.username,
          username: t.username,
          displayName,
          bio: t.bio || "",
          avatarUrl: t.avatarUrl,
          avatarInitials: displayName.slice(0, 2).toUpperCase(),
          isVerified: t.isVerified,
          mainSport: formatSportLabel(t.mainSport),
          specialties: (t.specialties || []).map(formatSportLabel),
          totalBets: t.totalBets,
          winRate: t.winRate,
          yield: t.yield,
          profitUnits: t.profitUnits,
          avgOdds: t.avgOdds,
          currentStreak: t.currentStreak,
          bestStreak: t.bestStreak,
          monthlyProfit: t.monthlyProfit,
          followers: t.followers,
          telegramUrl: t.telegramUrl,
          twitterUrl: t.twitterUrl,
          instagramUrl: t.instagramUrl,
          youtubeUrl: t.youtubeUrl,
          rank: index + 1,
          verifiedSince: t.verifiedSince,
          isFollowing: false,
          recentForm: t.recentForm || [],
          tier: getTierFromStats(t.yield, t.totalBets, t.winRate),
          profitHistory: t.profitHistory || [],
          bets: [],
        };
      });
    return [...localTipsters.filter(t => t.id === user?.id), ...publicList];
  }, [bets, user?.id, timePeriod, savedProfile, publicTipsters]);

  const publicTipstersForPeriod = useMemo(() => {
    return tipsters.filter(t => t.id !== user?.id);
  }, [tipsters, user?.id]);

  const tipsterOfTheMonth = useMemo(() => {
    if (publicTipstersForPeriod.length < 2) return null;
    const sorted = [...publicTipstersForPeriod].sort((a, b) => b.monthlyProfit - a.monthlyProfit);
    return sorted[0]?.monthlyProfit > 0 ? sorted[0] : null;
  }, [publicTipstersForPeriod]);

  const allSports = useMemo(() => {
    const sports = new Set<string>();
    publicTipstersForPeriod.forEach(t => sports.add(t.mainSport));
    return Array.from(sports);
  }, [publicTipstersForPeriod]);

  const filteredTipsters = useMemo(() => {
    let result = [...tipsters];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t =>
        t.displayName.toLowerCase().includes(q) ||
        t.mainSport.toLowerCase().includes(q) ||
        t.specialties.some(s => s.toLowerCase().includes(q))
      );
    }
    if (filterSport !== "all") {
      result = result.filter(t => t.mainSport === filterSport);
    }
    result.sort((a, b) => {
      switch (sortBy) {
        case "yield": return b.yield - a.yield;
        case "winRate": return b.winRate - a.winRate;
        case "profit": return b.profitUnits - a.profitUnits;
        case "followers": return b.followers - a.followers;
        case "totalBets": return b.totalBets - a.totalBets;
        default: return 0;
      }
    });
    return result;
  }, [tipsters, searchQuery, sortBy, filterSport]);

  const filteredPublicTipsters = useMemo(() => {
    return filteredTipsters.filter(t => t.id !== user?.id);
  }, [filteredTipsters, user?.id]);
  const topThree = filteredPublicTipsters.slice(0, 3);
  const restTipsters = filteredPublicTipsters.slice(3);

  const handleOpenProfile = (tipster: TipsterData) => {
    setSelectedTipster(tipster);
    setProfileModalOpen(true);
  };

  const toggleCompare = (id: string) => {
    setCompareIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  };

  const handleSaveProfile = (profile: TipsterProfileEdit) => {
    setSavedProfileOverride(profile);
  };

  const selfTipster = tipsters.find(t => t.id === user?.id);
  const profileReadiness = useMemo(() => getProfileReadiness(bets), [bets]);
  const hasPublicUsername = Boolean(savedProfile?.username?.trim() && savedProfile.isPublic);
  const publicRankingLabel = filteredPublicTipsters.length === 1 ? "1 tipster" : `${filteredPublicTipsters.length} tipsters`;

  return (
    <div className="min-h-screen bg-background pb-20 text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/80 bg-background/88 backdrop-blur-2xl">
        <div className="app-container app-section py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/")} className="h-8 w-8 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-md border border-primary/20 bg-primary/10 text-primary">
                <Users className="h-4 w-4" />
              </span>
              <span className="font-black text-lg text-foreground">Comunidad</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {compareIds.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setComparatorOpen(true)}
                className="h-7 px-2 text-xs text-cashout"
              >
                <GitCompare className="w-3.5 h-3.5 mr-1" />
                Comparar ({compareIds.length})
              </Button>
            )}
            {savedProfile?.username && savedProfile.isPublic && (
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  const url = `${window.location.origin}/tipster/${savedProfile.username}`;
                  if (navigator.share) {
                    try { await navigator.share({ title: `${savedProfile.displayName} — Oddsmark`, url }); } catch {}
                  } else {
                    await navigator.clipboard.writeText(url);
                  }
                }}
                className="h-8 px-2 text-muted-foreground hover:text-foreground"
              >
                <Share2 className="w-3.5 h-3.5" />
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={() => setEditProfileOpen(true)} className="h-8 w-8 text-muted-foreground hover:text-foreground">
              <Pencil className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowFilters(!showFilters)}
              className={`h-8 w-8 ${showFilters ? "text-primary" : "text-muted-foreground"}`}
            >
              <Filter className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="app-container app-section pt-4 pb-2">
        {/* Verification */}
        <div className="surface-panel mb-4 rounded-lg p-4">
          <div className="flex items-start gap-3 mb-3">
            <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <h2 className="text-sm font-bold text-foreground">Perfiles con prueba pública</h2>
              <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                Las fichas públicas se apoyan en apuestas registradas con hash antes del evento.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLocation("/verify")}
            className="h-8 w-full border-border/70 bg-card/70 text-xs text-muted-foreground hover:bg-muted/70 hover:text-foreground"
          >
            Verificar una apuesta
          </Button>
        </div>

        {selfTipster && (
          <section className="mb-5">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase text-muted-foreground">Tu perfil</h2>
              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                hasPublicUsername
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                  : "border-border/70 bg-foreground/5 text-foreground"
              }`}>
                {!hasPublicUsername && <AlertCircle className="h-3 w-3" />}
                {hasPublicUsername ? "Perfil público activo" : "Perfil incompleto"}
              </span>
            </div>
            <div className="surface-panel rounded-lg border-primary/20 p-4">
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => setEditProfileOpen(true)}
                  className={`group relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border ${tierConfig[selfTipster.tier].bg} ${tierConfig[selfTipster.tier].border} transition-colors hover:border-foreground/35 focus:outline-none focus:ring-2 focus:ring-primary/50`}
                  aria-label="Editar foto de perfil"
                  title="Editar foto de perfil"
                >
                  {selfTipster.avatarUrl ? (
                    <img src={selfTipster.avatarUrl} className="w-full h-full object-cover" alt="" />
                  ) : (
                    <span className={`font-black text-sm ${tierConfig[selfTipster.tier].color}`}>{selfTipster.avatarInitials}</span>
                  )}
                  <span className="absolute inset-0 grid place-items-center bg-background/68 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                    <Camera className="h-4 w-4 text-foreground" />
                  </span>
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-bold text-foreground truncate">Tu ficha pública</h2>
                    <span className={`text-[9px] font-bold ${tierConfig[selfTipster.tier].color} ${tierConfig[selfTipster.tier].bg} px-1.5 py-0.5 rounded`}>
                      {profileReadiness.statusLabel.toUpperCase()}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {profileReadiness.statusLabel} · {profileReadiness.closedBets}/{profileReadiness.recommendedBets} cerradas · fiabilidad {profileReadiness.reliability}
                  </p>
                  {!hasPublicUsername && (
                  <p className="mt-1 text-xs text-muted-foreground">
                      Añade un nombre de usuario para activar el enlace público y poder compartir tu ficha.
                    </p>
                  )}
                  <div className="mt-2 grid grid-cols-4 gap-2 text-xs">
                    <div>
                      <p className={`font-mono font-bold ${selfTipster.yield >= 0 ? "text-emerald-400" : "text-red-400"}`}>{selfTipster.yield >= 0 ? "+" : ""}{selfTipster.yield.toFixed(1)}%</p>
                      <p className="text-[10px] text-muted-foreground">Yield</p>
                    </div>
                    <div>
                      <p className={`font-mono font-bold ${selfTipster.profitUnits >= 0 ? "text-emerald-400" : "text-red-400"}`}>{selfTipster.profitUnits >= 0 ? "+" : ""}{selfTipster.profitUnits.toFixed(1)}u</p>
                      <p className="text-[10px] text-muted-foreground">P&L</p>
                    </div>
                    <div>
                      <p className="font-mono font-bold text-foreground">{selfTipster.totalBets}</p>
                      <p className="text-[10px] text-muted-foreground">Apuestas</p>
                    </div>
                    <div>
                      <p className="font-mono font-bold text-foreground">{profileReadiness.verifiedBets}</p>
                      <p className="text-[10px] text-muted-foreground">Prueba</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditProfileOpen(true)}
                  className="h-8 border-border/70 bg-card/70 text-xs text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                >
                  {hasPublicUsername ? "Editar ficha pública" : "Completar ficha"}
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleOpenProfile(selfTipster)}
                  className="h-8 bg-primary text-xs text-primary-foreground hover:bg-primary/90"
                >
                  Previsualizar
                </Button>
              </div>
            </div>
          </section>
        )}

        {/* Tipster of the Month */}
        {tipsterOfTheMonth && (
          <div className="mb-4">
            <TipsterOfTheMonth
              tipster={tipsterOfTheMonth}
              onClick={() => handleOpenProfile(tipsterOfTheMonth)}
            />
          </div>
        )}

        {/* Time Period + Search */}
        <div className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar tipster..."
              className="h-9 border-border/70 bg-card/70 pl-10 text-xs placeholder:text-muted-foreground/70"
            />
          </div>
        </div>

        {/* Period Filter */}
        <div className="flex gap-1 mb-3">
          <Clock className="w-3.5 h-3.5 text-muted-foreground mt-1 shrink-0" />
          {(["7d", "30d", "90d", "all"] as TimePeriod[]).map(p => (
            <button
              key={p}
              onClick={() => setTimePeriod(p)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                timePeriod === p
                  ? "border border-primary/20 bg-primary/10 text-primary"
                  : "border border-transparent bg-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {p === "all" ? "Todo" : p}
            </button>
          ))}
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="surface-panel mb-3 space-y-3 rounded-lg p-3">
            <div>
              <label className="text-[10px] text-muted-foreground mb-1.5 block">Ordenar por</label>
              <div className="flex gap-1.5 flex-wrap">
                {([
                  { key: "yield" as const, label: "Yield" },
                  { key: "winRate" as const, label: "Acierto" },
                  { key: "profit" as const, label: "P&L" },
                  { key: "totalBets" as const, label: "Apuestas" },
                  { key: "followers" as const, label: "Seguidores" },
                ]).map(opt => (
                  <button key={opt.key} onClick={() => setSortBy(opt.key)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${sortBy === opt.key ? "border border-primary/20 bg-primary/10 text-primary" : "border border-border/70 bg-card/70 text-muted-foreground hover:text-foreground"}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground mb-1.5 block">Deporte</label>
              <div className="flex gap-1.5 flex-wrap">
                <button onClick={() => setFilterSport("all")}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${filterSport === "all" ? "border border-primary/20 bg-primary/10 text-primary" : "border border-border/70 bg-card/70 text-muted-foreground"}`}>
                  Todos
                </button>
                {allSports.map(sport => (
                  <button key={sport} onClick={() => setFilterSport(sport)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${filterSport === sport ? "border border-primary/20 bg-primary/10 text-primary" : "border border-border/70 bg-card/70 text-muted-foreground"}`}>
                    {sport}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Top 3 Podium */}
      {topThree.length >= 3 && (
        <div className="app-container app-section mb-4">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="w-4 h-4 text-foreground" />
            <h3 className="text-sm font-bold text-foreground">Perfiles destacados</h3>
            <span className="text-[10px] text-muted-foreground ml-auto">{timePeriod === "all" ? "Histórico" : `Últimos ${timePeriod}`}</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="order-1"><PodiumCard tipster={topThree[1]} position={2} onClick={() => handleOpenProfile(topThree[1])} /></div>
            <div className="order-2"><PodiumCard tipster={topThree[0]} position={1} onClick={() => handleOpenProfile(topThree[0])} /></div>
            <div className="order-3"><PodiumCard tipster={topThree[2]} position={3} onClick={() => handleOpenProfile(topThree[2])} /></div>
          </div>
        </div>
      )}

      {/* Tipster List */}
      <div className="app-container app-section">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold text-foreground">Listado público</h3>
            <p className="text-[10px] text-muted-foreground">{publicRankingLabel} con perfil público y ledger verificable</p>
          </div>
          {filteredPublicTipsters.length > 0 && compareIds.length < 3 && (
            <span className="text-[10px] text-muted-foreground">Mantén pulsado para comparar</span>
          )}
        </div>

        {filteredPublicTipsters.length === 0 ? (
          <div className="surface-panel rounded-lg px-4 py-10 text-center">
            <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm font-bold">Aún no hay perfiles públicos</p>
            <p className="text-muted-foreground/70 text-xs mt-1">
              {searchQuery || filterSport !== "all"
                ? "Prueba con otra búsqueda o limpia el filtro de deporte."
                : "Cuando haya perfiles con apuestas verificadas aparecerán aquí."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {(topThree.length >= 3 ? restTipsters : filteredPublicTipsters).map((tipster, index) => (
              <TipsterCard
                key={tipster.id}
                tipster={tipster}
                onClick={() => handleOpenProfile(tipster)}
                onLongPress={() => toggleCompare(tipster.id)}
                isComparing={compareIds.includes(tipster.id)}
                rank={(topThree.length >= 3 ? index + 4 : index + 1)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {selectedTipster && (
        <TipsterProfileModal
          tipster={selectedTipster}
          mode={selectedTipster.id === user?.id ? "preview" : "public"}
          open={profileModalOpen}
          onClose={() => { setProfileModalOpen(false); setSelectedTipster(null); }}
        />
      )}

      <TipsterComparator
        tipsters={tipsters.filter(t => compareIds.includes(t.id))}
        open={comparatorOpen}
        onClose={() => setComparatorOpen(false)}
        onRemove={(id) => setCompareIds(prev => prev.filter(x => x !== id))}
      />

      <EditTipsterProfileModal
        open={editProfileOpen}
        onClose={() => setEditProfileOpen(false)}
        onSave={handleSaveProfile}
        currentProfile={{
          username: savedProfile?.username || "",
          displayName: savedProfile?.displayName || selfTipster?.displayName || "",
          bio: savedProfile?.bio || selfTipster?.bio || "",
          avatarUrl: savedProfile?.avatarUrl || null,
          telegramUrl: savedProfile?.telegramUrl || null,
          twitterUrl: savedProfile?.twitterUrl || null,
          instagramUrl: savedProfile?.instagramUrl || null,
          youtubeUrl: savedProfile?.youtubeUrl || null,
          isPublic: savedProfile?.isPublic ?? false,
        }}
      />
    </div>
  );
}

/* ─── Podium Card ─── */
function PodiumCard({ tipster, position, onClick }: { tipster: TipsterData; position: number; onClick: () => void }) {
  const isFirst = position === 1;
  const borderColors = {
    1: "border-foreground/25",
    2: "border-zinc-600",
    3: "border-zinc-700",
  };
  const medalColors = { 1: "text-foreground", 2: "text-zinc-400", 3: "text-zinc-500" };

  return (
    <button
      onClick={onClick}
      className={`surface-panel w-full ${borderColors[position as 1|2|3]} rounded-lg p-3 text-center transition-all hover:border-primary/25 active:scale-[0.98] ${isFirst ? "pt-2" : "mt-4"}`}
    >
      {isFirst && <ShieldCheck className="w-4 h-4 text-foreground mx-auto mb-1" />}
      <div className="relative mx-auto mb-2">
        <div className="w-11 h-11 mx-auto rounded-full bg-muted flex items-center justify-center">
          <span className={`font-bold text-sm ${tierConfig[tipster.tier].color}`}>{tipster.avatarInitials}</span>
        </div>
        {tipster.isVerified && <ShieldCheck className="w-3 h-3 text-primary absolute -bottom-0.5 -right-0.5 rounded-full bg-background" />}
        <span className={`absolute -top-1 -left-1 text-sm font-bold ${medalColors[position as 1|2|3]}`}>{position}</span>
      </div>
      <p className="text-xs font-medium text-foreground truncate">{tipster.displayName}</p>
      <p className="text-[10px] text-muted-foreground mb-1">{tipster.mainSport}</p>
      <p className="mb-1 inline-flex max-w-full items-center justify-center gap-1 text-[9px] text-muted-foreground">
        <Users className="h-2.5 w-2.5 shrink-0" />
        <span className="truncate">{formatFollowers(tipster.followers)}</span>
      </p>
      <ProfitSparkline data={tipster.profitHistory} width={60} height={18} />
      <div className={`font-mono text-base font-bold ${tipster.yield >= 0 ? "text-emerald-400" : "text-red-400"} mt-1`}>
        {tipster.yield >= 0 ? "+" : ""}{tipster.yield.toFixed(1)}%
      </div>
      <p className="text-[10px] text-muted-foreground/70">Yield</p>
    </button>
  );
}

/* ─── Tipster Card ─── */
function TipsterCard({ tipster, onClick, onLongPress, isComparing, rank }: {
  tipster: TipsterData;
  onClick: () => void;
  onLongPress: () => void;
  isComparing: boolean;
  rank: number;
}) {
  const tier = tierConfig[tipster.tier];
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePointerDown = () => {
    longPressTimer.current = setTimeout(() => onLongPress(), 500);
  };
  const handlePointerUp = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
  };

  return (
    <button
      onClick={onClick}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      className={`surface-panel flex w-full items-center gap-3 rounded-lg p-3 text-left transition-all hover:border-primary/25 active:scale-[0.99] ${
        isComparing ? "border-foreground/30 ring-1 ring-foreground/20" : tier.border
      }`}
    >
      {/* Rank */}
      <div className="text-center min-w-[24px]">
        {isComparing ? (
          <GitCompare className="w-4 h-4 text-foreground mx-auto" />
        ) : (
          <span className="text-xs font-bold text-muted-foreground/70">#{rank}</span>
        )}
      </div>

      {/* Avatar */}
      <div className="relative shrink-0">
        <div className={`w-11 h-11 rounded-full ${tier.bg} flex items-center justify-center overflow-hidden`}>
          {tipster.avatarUrl ? (
            <img src={tipster.avatarUrl} className="w-full h-full object-cover" alt="" />
          ) : (
            <span className={`font-bold text-sm ${tier.color}`}>{tipster.avatarInitials}</span>
          )}
        </div>
        {tipster.isVerified && <ShieldCheck className="w-3.5 h-3.5 text-primary absolute -bottom-0.5 -right-0.5 rounded-full bg-background" />}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-sm font-bold text-foreground truncate">{tipster.displayName}</span>
          <span className={`text-[9px] font-bold ${tier.color} ${tier.bg} px-1.5 py-0.5 rounded`}>
            {tier.label.toUpperCase()}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
          <span>{tipster.mainSport}</span>
          <span className="text-muted-foreground/50">·</span>
          <span>{formatBets(tipster.totalBets)}</span>
          <span className="text-muted-foreground/50">·</span>
          <span className="inline-flex items-center gap-1">
            <Users className="h-3 w-3" />
            {formatFollowers(tipster.followers)}
          </span>
        </div>
        {/* Recent form */}
        <div className="flex gap-0.5 mt-1.5">
          {tipster.recentForm.slice(0, 8).map((result, i) => (
            <span key={i} className={`w-4 h-4 rounded-sm text-[8px] font-black flex items-center justify-center ${
              result === "W" ? "bg-emerald-500/20 text-emerald-400" : result === "L" ? "bg-red-500/20 text-red-400" : "bg-muted text-muted-foreground"
            }`}>{result}</span>
          ))}
        </div>
      </div>

      {/* Sparkline + Stats */}
      <div className="text-right shrink-0 flex flex-col items-end gap-1">
        <ProfitSparkline data={tipster.profitHistory} width={48} height={18} />
        <div className={`font-mono text-base font-bold ${tipster.yield >= 0 ? "text-emerald-400" : "text-red-400"}`}>
          {tipster.yield >= 0 ? "+" : ""}{tipster.yield.toFixed(1)}%
        </div>
        <p className="text-[10px] text-muted-foreground font-mono">{tipster.winRate.toFixed(0)}% acierto</p>
      </div>
    </button>
  );
}

function formatFollowers(count: number): string {
  return `${count} ${count === 1 ? "seguidor" : "seguidores"}`;
}

function formatBets(count: number): string {
  return `${count} ${count === 1 ? "apuesta" : "apuestas"}`;
}
