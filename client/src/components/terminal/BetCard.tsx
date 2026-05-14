import { calculateBetProfit } from "@/lib/bet-calculations";
import { Copy, Trash2, Share2, Puzzle, Footprints, Check, X as XIcon, Hourglass, Wallet2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn, formatNumber } from "@/lib/utils";
import type { Bet } from "@shared/schema";

const parseLocalDate = (dateStr: string): Date | null => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
};

const formatBetDate = (date: string | Date, time?: string | null): string => {
  const d = typeof date === "string" ? parseLocalDate(date) : date;
  if (!d || isNaN(d.getTime())) return typeof date === "string" ? date : "";
  const formatted = d.toLocaleDateString("es-ES", { day: "numeric", month: "short" }).replace(".", "");
  const capitalized = formatted.replace(/(\s)(\w)/, (_, space, letter) => space + letter.toUpperCase());
  if (time) {
    return `${capitalized}, ${time}`;
  }
  return capitalized;
};

const leagueAccentClasses = [
  "border-sky-500/35 bg-sky-500/10 text-sky-700 dark:text-sky-200",
  "border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200",
  "border-violet-500/35 bg-violet-500/10 text-violet-700 dark:text-violet-200",
  "border-rose-500/35 bg-rose-500/10 text-rose-700 dark:text-rose-200",
  "border-cyan-500/35 bg-cyan-500/10 text-cyan-700 dark:text-cyan-200",
  "border-lime-500/35 bg-lime-500/10 text-lime-700 dark:text-lime-200",
  "border-fuchsia-500/35 bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-200",
];

const getLeagueAccentClass = (value: string): string => {
  const source = value.trim().toLowerCase();
  if (!source) return leagueAccentClasses[0];
  let hash = 0;
  for (let i = 0; i < source.length; i += 1) {
    hash = (hash * 31 + source.charCodeAt(i)) >>> 0;
  }
  return leagueAccentClasses[hash % leagueAccentClasses.length];
};

interface Selection {
  event: string;
  market: string;
  odds: number;
  line?: number;
  stake?: number;
  status?: "pending" | "won" | "lost" | "void";
  isCashout?: boolean;
  cashoutVal?: number;
  cashout_units?: number;
  cashout_fiat?: number;
  cashout_timestamp?: string;
  closure_status?: "cashout" | "standard";
}

interface BetCardProps {
  bet: Bet;
  currency: "units" | "money";
  unitValue: number;
  onEdit: (bet: Bet) => void;
  onDelete: (id: string) => void;
  onCopy: (text: string) => void;
  onDuplicate?: (bet: Bet) => void;
  onShare?: (bet: Bet) => void;
  onUpdateLegStatus?: (betId: string, legIndex: number, status: "won" | "lost") => void;
}

export function BetCard({ bet, currency, unitValue, onEdit, onDelete, onCopy, onDuplicate, onShare, onUpdateLegStatus }: BetCardProps) {
  const multiplier = currency === "money" ? unitValue : 1;
  const currencySymbol = currency === "money" ? "€" : "U";
  const selections = (bet.selections as Selection[]) || [];
  const isMultiBet = bet.betType === "combinada" || bet.betType === "escalera";
  const canonicalResult = calculateBetProfit(bet, multiplier);

  let result = 0;
  let escaleraVisualStatus: "won" | "lost" | "pending" | "void" = "pending";
  
  if (bet.betType === "escalera" && selections.length > 0) {
    result = canonicalResult.profit;
    if (canonicalResult.isPending) {
      escaleraVisualStatus = "pending";
    } else if (result > 0) {
      escaleraVisualStatus = "won";
    } else if (result < 0) {
      escaleraVisualStatus = "lost";
    } else {
      escaleraVisualStatus = "void";
    }
  } else if (bet.status !== "pending") {
    result = canonicalResult.profit;
  }
  
  const displayStatus = bet.betType === "escalera" ? escaleraVisualStatus : bet.status;
  const leagueLabel = bet.league || bet.sport || "Sin liga";

  const getStatusIndicator = () => {
    if (bet.isCashout) {
      if (bet.cashoutVal) {
        if (bet.cashoutVal > bet.stake) return "bg-win-cashout";
        if (bet.cashoutVal < bet.stake) return "bg-loss-cashout";
        return "bg-muted";
      }
      if (bet.status === "won") return "bg-win-cashout";
      if (bet.status === "lost") return "bg-loss-cashout";
      return "bg-muted";
    }
    const statusIndicator: Record<string, string> = {
      won: "bg-win",
      lost: "bg-loss",
      pending: "bg-pending",
      void: "bg-muted",
    };
    return statusIndicator[displayStatus] || "bg-muted";
  };
  
  const copyText = `${bet.event} | ${bet.market} @${bet.odds}`;
  const hasBetTypeBadge = bet.betType === "combinada" || bet.betType === "escalera";
  const hasCashoutOffer = Boolean(bet.status === "pending" && bet.currentCashout && bet.currentCashout > 0 && !bet.isCashout);
  const showOutcomeRow = hasBetTypeBadge || bet.isLive || bet.isCashout || hasCashoutOffer || bet.isLongTerm || displayStatus !== "pending";

  const getLegStatusColor = (sel: Selection) => {
    const isCashoutLeg = sel.isCashout || sel.closure_status === "cashout";
    if (isCashoutLeg) {
      if (sel.cashoutVal !== undefined && sel.stake !== undefined) {
        return sel.cashoutVal > sel.stake ? "text-win-cashout" : sel.cashoutVal < sel.stake ? "text-loss-cashout" : "text-muted-foreground";
      }
      if (sel.status === "won") return "text-win-cashout";
      if (sel.status === "lost") return "text-loss-cashout";
      return "text-muted-foreground";
    }
    if (sel.status === "won") return "text-win";
    if (sel.status === "lost") return "text-loss";
    return "text-muted-foreground";
  };
  
  const getLegButtonColor = (sel: Selection, status: "won" | "lost") => {
    const isCashoutLeg = sel.isCashout || sel.closure_status === "cashout";
    if (sel.status === status) {
      if (isCashoutLeg) {
        return status === "won" ? "bg-win-cashout/20 text-win-cashout" : "bg-loss-cashout/20 text-loss-cashout";
      }
      return status === "won" ? "bg-win/20 text-win" : "bg-loss/20 text-loss";
    }
    return "";
  };

  return (
    <Card
      className={cn(
        "surface-panel group relative cursor-pointer overflow-hidden rounded-lg py-0 transition-all duration-200",
        "hover:-translate-y-0.5 hover:border-foreground/25 hover:shadow-lg"
      )}
      onClick={() => onEdit(bet)}
      data-testid={`bet-card-${bet.id}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-foreground/[0.045] via-transparent to-transparent opacity-70 dark:from-white/[0.035]" />
      <div className={cn(
        "absolute bottom-3 left-2 top-3 w-1 rounded-full",
        getStatusIndicator()
      )} />

      <div className="relative space-y-3 px-4 py-3 pl-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge
                variant="outline"
                className={cn(
                  "h-5 max-w-full rounded-full px-2 text-[9px] font-black uppercase tracking-wide",
                  getLeagueAccentClass(leagueLabel),
                )}
              >
                <span className="truncate">{leagueLabel}</span>
              </Badge>
              {bet.verified && (
                <span className="inline-flex h-5 items-center gap-1 text-[10px] font-bold text-muted-foreground">
                  <ShieldCheck className="h-3 w-3" />
                  Pre-evento
                </span>
              )}
            </div>
            <h3 className="line-clamp-2 text-[15px] font-bold leading-tight text-foreground">
              {bet.event}
            </h3>
            <p className="line-clamp-2 text-xs leading-snug text-muted-foreground sm:text-sm">
              {bet.market}
            </p>
          </div>

          <div className="min-w-[4.5rem] shrink-0 text-right">
            <p className="font-mono text-xl font-black leading-none">
              {bet.betType === "escalera" && selections.length > 0
                ? selections.map(s => formatNumber(s.odds)).join(" | ")
                : formatNumber(bet.odds)
              }
            </p>
            {bet.betType !== "escalera" && (
              <p className="mt-0.5 font-mono text-[9px] text-muted-foreground/65">
                {(100 / bet.odds).toFixed(1)}%
              </p>
            )}
            <p className="mt-0.5 font-mono text-xs font-semibold text-muted-foreground">
              {(() => {
                const stakeUnits = bet.betType === "escalera" && selections.length > 0
                  ? canonicalResult.totalStake / multiplier
                  : bet.stake;
                if (currency === "money") {
                  return `${formatNumber(stakeUnits * unitValue, 0)}€`;
                }
                return `${formatNumber(stakeUnits, 2)}U`;
              })()}
            </p>
          </div>
        </div>

        {isMultiBet && selections.length > 0 && (
          <div className={cn(
            "space-y-1 rounded-md border p-2.5",
            bet.betType === "combinada" ? "border-cashout/20 bg-cashout/5" : "border-pending/20 bg-pending/5"
          )}>
            {selections.map((sel, idx) => (
              <div 
                key={idx} 
                className="flex items-center justify-between gap-2 text-xs"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  {bet.betType === "escalera" && (
                    <span className="text-foreground font-mono shrink-0">#{idx + 1}</span>
                  )}
                  <span className={cn("truncate", getLegStatusColor(sel))}>
                    {sel.event || "Sin evento"} - {sel.market || "Sin mercado"}
                  </span>
                  {sel.isCashout && (
                    <Wallet2 className="h-3 w-3 text-muted-foreground shrink-0" />
                  )}
                  {bet.betType === "escalera" && sel.line !== undefined && (
                    <span className="text-muted-foreground font-mono shrink-0">L{sel.line}</span>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="font-mono text-muted-foreground">@{formatNumber(sel.odds)}</span>
                  {onUpdateLegStatus && (
                    <div className="flex gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "h-8 w-8 sm:h-6 sm:w-6",
                          getLegButtonColor(sel, "won")
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdateLegStatus(bet.id, idx, "won");
                        }}
                        data-testid={`button-leg-win-${bet.id}-${idx}`}
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "h-8 w-8 sm:h-6 sm:w-6",
                          getLegButtonColor(sel, "lost")
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdateLegStatus(bet.id, idx, "lost");
                        }}
                        data-testid={`button-leg-loss-${bet.id}-${idx}`}
                      >
                        <XIcon className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {showOutcomeRow && (
          <div className="flex items-center justify-between gap-2 border-t border-border/45 pt-2">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {bet.betType === "combinada" && (
                <span className="inline-flex items-center gap-1 text-[0.65rem] font-bold uppercase text-muted-foreground">
                  <Puzzle className="h-2.5 w-2.5" />
                  COMB {selections.length > 0 ? `(${selections.length})` : ""}
                </span>
              )}
              {bet.betType === "escalera" && (
                <span className="inline-flex items-center gap-1 text-[0.65rem] font-bold uppercase text-muted-foreground">
                  <Footprints className="h-2.5 w-2.5" />
                  ESC {selections.length > 0 ? `(${selections.length})` : ""}
                </span>
              )}
              {bet.isLive && (
                <span className="text-[0.65rem] font-bold uppercase text-loss">
                  LIVE
                </span>
              )}
              {bet.isCashout && (
                <Wallet2 className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              {hasCashoutOffer && (
                <span className="text-[0.65rem] font-semibold text-muted-foreground">
                  Cashout {formatNumber((bet.currentCashout ?? 0) * (currency === "money" ? unitValue : 1))}{currencySymbol}
                </span>
              )}
              {bet.isLongTerm && (
                <span className="inline-flex items-center gap-1 text-[0.65rem] font-bold uppercase text-muted-foreground">
                  <Hourglass className="h-2.5 w-2.5" />
                  {bet.resolutionDate ? `Resuelve: ${formatBetDate(bet.resolutionDate)}` : "Largo plazo"}
                </span>
              )}
            </div>

            {displayStatus !== "pending" && (
              <p className={cn(
                "font-mono text-sm font-semibold",
                bet.isCashout
                  ? (result >= 0 ? "text-win-cashout" : "text-loss-cashout")
                  : (result >= 0 ? "text-win" : "text-loss")
              )}>
                {result >= 0 ? "+" : ""}{formatNumber(result)}{currencySymbol}
              </p>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-border/45 pt-2">
          <div className="min-w-0 space-y-0.5 text-xs text-muted-foreground">
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground/75">
                {formatBetDate(bet.date, bet.time)}
                {bet.bookie && ` · ${bet.bookie}`}
              </p>
            </div>
            {bet.createdAt && (
              <p className="truncate text-[10px] text-muted-foreground/70">
                Creada: {formatBetDate(new Date(bet.createdAt), new Date(bet.createdAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }))}
              </p>
            )}
          </div>

          <div className="flex shrink-0 gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              className="rounded-full text-muted-foreground hover:bg-foreground/[0.07] hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                if (onDuplicate) {
                  onDuplicate(bet);
                } else {
                  onCopy(copyText);
                }
              }}
              data-testid={`button-copy-${bet.id}`}
              title="Duplicar como borrador"
              aria-label="Duplicar apuesta como borrador"
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="rounded-full text-muted-foreground hover:bg-foreground/[0.07] hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                if (onShare) onShare(bet);
              }}
              data-testid={`button-share-${bet.id}`}
              title="Compartir apuesta"
              aria-label="Compartir apuesta"
            >
              <Share2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(bet.id);
              }}
              className="rounded-full text-loss/80 hover:bg-loss/10 hover:text-loss"
              data-testid={`button-delete-${bet.id}`}
              title="Eliminar apuesta"
              aria-label="Eliminar apuesta"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
