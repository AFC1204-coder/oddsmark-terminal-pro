import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { BetCard } from "./BetCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, X, ChevronLeft, ChevronRight, SlidersHorizontal, ListFilter, Plus } from "lucide-react";
import { staggerContainer, staggerItem } from "@/lib/animations";
import type { Bet } from "@shared/schema";

const BETS_PER_PAGE = 10;

type SortOption = "createdAt" | "eventDate" | "highestProfit" | "highestStake";
type ClosureFilter = "all" | "excludeCashouts" | "onlyCashouts";
type StatusFilter = "all" | "pending" | "settled";

function isDemoBet(bet: Bet): boolean {
  return bet.event.toUpperCase().includes("DEMO") || (bet.comment ?? "").toLowerCase().includes("demo-seed");
}

interface BetFeedProps {
  bets: Bet[];
  totalBets?: number;
  currency: "units" | "money";
  unitValue: number;
  onEdit: (bet: Bet) => void;
  onDelete: (id: string) => void;
  onCopy: (text: string) => void;
  onDuplicate?: (bet: Bet) => void;
  onShare?: (bet: Bet) => void;
  onCreateBet?: () => void;
  onClearAll: () => void;
  onUpdateLegStatus?: (betId: string, legIndex: number, status: "won" | "lost") => void;
  hasMore?: boolean;
  onLoadMore?: () => void;
  searchQuery?: string;
  onSearchChange?: (v: string) => void;
  sortBy?: SortOption;
  onSortByChange?: (v: SortOption) => void;
  closureFilter?: ClosureFilter;
  onClosureFilterChange?: (v: ClosureFilter) => void;
  advancedFiltersActive?: boolean;
}

export function BetFeed({
  bets,
  totalBets,
  currency,
  unitValue,
  onEdit,
  onDelete,
  onCopy,
  onDuplicate,
  onShare,
  onCreateBet,
  onClearAll,
  onUpdateLegStatus,
  hasMore,
  onLoadMore,
  searchQuery = "",
  onSearchChange,
  sortBy = "eventDate",
  onSortByChange,
  closureFilter = "all",
  onClosureFilterChange,
  advancedFiltersActive = false,
}: BetFeedProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const feedRef = useRef<HTMLDivElement>(null);
  
  const hasTextFilter = searchQuery.trim().length > 0;
  const hasFeedFilters = hasTextFilter || closureFilter !== "all" || advancedFiltersActive;
  const total = totalBets ?? bets.length;
  const pendingCount = bets.filter((bet) => bet.status === "pending").length;
  const settledCount = bets.filter((bet) => bet.status === "won" || bet.status === "lost" || bet.status === "void").length;
  const demoCount = bets.filter(isDemoBet).length;
  const filteredByStatus = bets.filter((bet) => {
    if (statusFilter === "pending") return bet.status === "pending";
    if (statusFilter === "settled") return bet.status === "won" || bet.status === "lost" || bet.status === "void";
    return true;
  });
  
  const totalPages = Math.ceil(filteredByStatus.length / BETS_PER_PAGE);
  const startIndex = (currentPage - 1) * BETS_PER_PAGE;
  const endIndex = startIndex + BETS_PER_PAGE;
  const visibleBets = filteredByStatus.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortBy, closureFilter, statusFilter]);

  useEffect(() => {
    const maxPage = Math.max(totalPages, 1);
    if (currentPage > maxPage) {
      setCurrentPage(maxPage);
    }
  }, [filteredByStatus.length, totalPages, currentPage]);

  const confirmDeleteBet = (bet: Bet) => {
    const demoWarning = isDemoBet(bet)
      ? "\n\nEsta apuesta es demo. Confirma explícitamente que quieres ocultarla."
      : "";
    const confirmed = window.confirm(
      `¿Ocultar "${bet.event}" del historial?\n\nEl registro verificable se conserva para integridad del ledger.${demoWarning}`,
    );
    if (confirmed) onDelete(bet.id);
  };

  const confirmClearAll = () => {
    const demoWarning = demoCount > 0
      ? `\n\nIncluye ${demoCount} apuesta${demoCount === 1 ? "" : "s"} demo.`
      : "";
    const confirmed = window.confirm(
      `¿Limpiar el historial visible?\n\nSe ocultarán ${bets.length} apuesta${bets.length === 1 ? "" : "s"} del feed. El ledger verificable se conserva.${demoWarning}`,
    );
    if (confirmed) onClearAll();
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    feedRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const emptyTitle = hasFeedFilters || statusFilter !== "all"
    ? "Sin resultados para estos filtros"
    : "Aún no hay apuestas";
  const emptyDescription = hasFeedFilters || statusFilter !== "all"
    ? "Ajusta la búsqueda, cambia el estado o limpia filtros para recuperar el historial."
    : "Crea tu primera apuesta para activar banca, evolución, riesgo y tarjetas compartibles.";
  const showCreateEmptyAction = !hasFeedFilters && statusFilter === "all" && !!onCreateBet;
  
  return (
    <div ref={feedRef} className="app-container app-section pb-4">
      <div className="surface-panel mb-3 flex flex-col gap-3 rounded-lg p-3 sm:p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="mono-section-title text-foreground">
                Historial
              </span>
              {hasFeedFilters && (
                <Badge variant="secondary" className="h-5 gap-1 rounded-full text-[10px]">
                  <SlidersHorizontal className="h-3 w-3" />
                  Filtro activo
                </Badge>
              )}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {filteredByStatus.length} de {total} apuestas · {pendingCount} pendientes · {settledCount} resueltas
            </p>
          </div>
          <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center">
            {onClosureFilterChange && (
              <Select 
                value={closureFilter} 
                onValueChange={(v) => onClosureFilterChange(v as ClosureFilter)}
              >
                <SelectTrigger className="h-8 w-full min-w-0 rounded-full text-xs sm:w-auto sm:min-w-[100px]" data-testid="closure-filter">
                  <SelectValue placeholder="Tipo cierre" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="excludeCashouts">Sin Cashouts</SelectItem>
                  <SelectItem value="onlyCashouts">Solo Cashouts</SelectItem>
                </SelectContent>
              </Select>
            )}
            {onSortByChange && (
              <Select 
                value={sortBy} 
                onValueChange={(v) => onSortByChange(v as SortOption)}
              >
                <SelectTrigger className="h-8 w-full min-w-0 rounded-full text-xs sm:w-auto sm:min-w-[130px]" data-testid="sort-by">
                  <SelectValue placeholder="Ordenar por..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="createdAt">Fecha creación</SelectItem>
                  <SelectItem value="eventDate">Fecha evento</SelectItem>
                  <SelectItem value="highestProfit">Mayor beneficio</SelectItem>
                  <SelectItem value="highestStake">Mayor Stake</SelectItem>
                </SelectContent>
              </Select>
            )}
            {bets.length > 0 && (
              <Button
	                variant="ghost"
	                size="sm"
	                onClick={confirmClearAll}
	                className="h-8 w-full rounded-full text-xs font-bold text-destructive sm:w-auto"
	                data-testid="button-clear-all"
              >
                Limpiar
              </Button>
            )}
          </div>
        </div>

        <div className="mono-pill grid grid-cols-3 gap-1 p-0.5">
          {([
            { id: "all", label: "Todas", count: bets.length },
            { id: "pending", label: "Pendientes", count: pendingCount },
            { id: "settled", label: "Resueltas", count: settledCount },
          ] as const).map((option) => (
            <Button
              key={option.id}
              type="button"
              variant={statusFilter === option.id ? "default" : "ghost"}
              size="sm"
              className="h-8 min-w-0 rounded-full px-2 text-[11px]"
              onClick={() => setStatusFilter(option.id)}
              data-testid={`button-feed-status-${option.id}`}
            >
              <span className="truncate">{option.label}</span>
              <span className="font-mono text-[10px] opacity-70">{option.count}</span>
            </Button>
          ))}
        </div>

        {onSearchChange && (
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar evento, tipster, mercado, posición..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="h-9 rounded-full border-border/70 bg-card/70 pl-8 pr-8 text-xs"
              data-testid="input-search"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                onClick={() => onSearchChange("")}
                data-testid="button-clear-search"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}

        {(hasFeedFilters || statusFilter !== "all" || totalPages > 1) && (
          <p className="text-xs text-muted-foreground">
            Mostrando {filteredByStatus.length === 0 ? 0 : startIndex + 1}-{Math.min(endIndex, filteredByStatus.length)} de {filteredByStatus.length} apuestas
          </p>
        )}
      </div>

      <motion.div
        className="space-y-3"
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        key={currentPage}
      >
        {filteredByStatus.length === 0 ? (
          <div className="surface-panel rounded-lg px-4 py-10 text-center" data-testid="empty-feed">
            <div className="mx-auto grid h-10 w-10 place-items-center rounded-lg border border-border/70 bg-foreground/[0.04] text-muted-foreground">
              {hasFeedFilters || statusFilter !== "all" ? (
                <ListFilter className="h-4 w-4" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </div>
            <p className="mt-3 text-sm font-bold text-foreground">{emptyTitle}</p>
            <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
              {emptyDescription}
            </p>
            {showCreateEmptyAction && (
              <Button
                onClick={onCreateBet}
                size="sm"
                className="mt-4 h-9 rounded-full px-4 text-xs font-black"
                data-testid="button-empty-create-bet"
              >
                <Plus className="h-3.5 w-3.5" />
                Crear primera apuesta
              </Button>
            )}
          </div>
        ) : (
          visibleBets.map((bet) => (
            <motion.div key={bet.id} variants={staggerItem}>
              <BetCard
                bet={bet}
                currency={currency}
	                unitValue={unitValue}
	                onEdit={onEdit}
	                onDelete={() => confirmDeleteBet(bet)}
	                onCopy={onCopy}
                onDuplicate={onDuplicate}
                onShare={onShare}
                onUpdateLegStatus={onUpdateLegStatus}
              />
            </motion.div>
          ))
        )}
      </motion.div>

      {totalPages > 1 && (
        <div className="mt-6 flex flex-col items-center gap-3 border-t border-border/50 pt-4 sm:flex-row sm:justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="h-8 px-3 text-xs gap-1"
            data-testid="button-prev-page"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Anterior
          </Button>
          <span className="font-mono text-xs text-muted-foreground">
            Página <span className="text-foreground font-semibold">{currentPage}</span> de{" "}
            <span className="text-foreground font-semibold">{totalPages}</span>
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="h-8 px-3 text-xs gap-1"
            data-testid="button-next-page"
          >
            Siguiente
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {hasMore && (
        <Button
          variant="outline"
          className="w-full mt-4"
          onClick={onLoadMore}
          data-testid="button-load-more"
        >
          Ver más antiguas
        </Button>
      )}
    </div>
  );
}
