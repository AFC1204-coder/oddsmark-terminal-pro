import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { applyFilters, defaultFilters, type BetFilters } from "@/lib/bet-filters";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Bet } from "@shared/schema";

interface FilterModalProps {
  open: boolean;
  onClose: () => void;
  bets: Bet[];
  filters: BetFilters;
  onApply: (filters: BetFilters) => void;
}

export function FilterModal({ open, onClose, bets, filters, onApply }: FilterModalProps) {
  const [localFilters, setLocalFilters] = useState<BetFilters>(filters);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (open) setLocalFilters(filters);
  }, [filters, open]);

  const uniqueLeagues = useMemo(() => {
    const leagues = new Set<string>();
    bets.forEach((bet) => {
      if (bet.league) leagues.add(bet.league);
    });
    return Array.from(leagues).sort();
  }, [bets]);

  const statusOptions: Array<{ value: "won" | "lost" | "pending" | "void"; label: string }> = [
    { value: "won", label: "Ganada" },
    { value: "lost", label: "Perdida" },
    { value: "pending", label: "Pendiente" },
    { value: "void", label: "Nula" },
  ];

  const toggleLeague = (league: string) => {
    setLocalFilters((prev) => ({
      ...prev,
      leagues: prev.leagues.includes(league)
        ? prev.leagues.filter((item) => item !== league)
        : [...prev.leagues, league],
    }));
  };

  const toggleStatus = (status: "won" | "lost" | "pending" | "void") => {
    setLocalFilters((prev) => ({
      ...prev,
      statuses: prev.statuses.includes(status)
        ? prev.statuses.filter((item) => item !== status)
        : [...prev.statuses, status],
    }));
  };

  const handleReset = () => {
    setLocalFilters(defaultFilters);
  };

  const handleApply = () => {
    onApply(localFilters);
    onClose();
  };

  const filteredCount = useMemo(() => applyFilters(bets, localFilters).length, [bets, localFilters]);

  const content = (
    <div className="space-y-5 py-2">
      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Rango de fechas</Label>
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <Label className="mb-1 block text-xs">Desde</Label>
            <Input
              type="date"
              value={localFilters.dateFrom}
              onChange={(e) => setLocalFilters((prev) => ({ ...prev, dateFrom: e.target.value }))}
              className="text-sm"
              data-testid="input-date-from"
            />
          </div>
          <div>
            <Label className="mb-1 block text-xs">Hasta</Label>
            <Input
              type="date"
              value={localFilters.dateTo}
              onChange={(e) => setLocalFilters((prev) => ({ ...prev, dateTo: e.target.value }))}
              className="text-sm"
              data-testid="input-date-to"
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Competición / liga</Label>
        <div className="flex flex-wrap gap-1.5">
          {uniqueLeagues.length === 0 ? (
            <p className="text-xs text-muted-foreground">No hay ligas disponibles</p>
          ) : (
            uniqueLeagues.map((league) => (
              <Badge
                key={league}
                variant={localFilters.leagues.includes(league) ? "default" : "outline"}
                className={cn(
                  "cursor-pointer px-2.5 py-1 text-xs",
                  localFilters.leagues.includes(league) && "bg-primary",
                )}
                onClick={() => toggleLeague(league)}
                data-testid={`badge-league-${league}`}
              >
                {league}
              </Badge>
            ))
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Estado</Label>
        <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap">
          {statusOptions.map((status) => (
            <Badge
              key={status.value}
              variant={localFilters.statuses.includes(status.value) ? "default" : "outline"}
              className={cn(
                "cursor-pointer justify-center px-3 py-1 text-xs font-medium",
                localFilters.statuses.includes(status.value) && (
                  status.value === "won" ? "bg-win text-win-foreground" :
                  status.value === "lost" ? "bg-loss text-loss-foreground" :
                  status.value === "pending" ? "bg-pending text-pending-foreground" :
                  "bg-muted"
                ),
              )}
              onClick={() => toggleStatus(status.value)}
              data-testid={`badge-status-${status.value}`}
            >
              {status.label}
            </Badge>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Tipo de apuesta</Label>
        <div className="grid gap-1.5 sm:flex sm:flex-wrap">
          <Badge
            variant={localFilters.betType === "pre" ? "default" : "outline"}
            className={cn("cursor-pointer justify-center px-2.5 py-1 text-xs", localFilters.betType === "pre" && "bg-primary")}
            onClick={() => setLocalFilters((prev) => ({ ...prev, betType: prev.betType === "pre" ? "" : "pre" }))}
            data-testid="badge-bettype-pre"
          >
            Pre-match
          </Badge>
          <Badge
            variant={localFilters.betType === "live" ? "default" : "outline"}
            className={cn("cursor-pointer justify-center px-2.5 py-1 text-xs", localFilters.betType === "live" && "bg-orange-500 border-orange-500")}
            onClick={() => setLocalFilters((prev) => ({ ...prev, betType: prev.betType === "live" ? "" : "live" }))}
            data-testid="badge-bettype-live"
          >
            En vivo
          </Badge>
          <Badge
            variant={localFilters.betType === "longterm" ? "default" : "outline"}
            className={cn("cursor-pointer justify-center px-2.5 py-1 text-xs", localFilters.betType === "longterm" && "bg-primary border-primary")}
            onClick={() => setLocalFilters((prev) => ({ ...prev, betType: prev.betType === "longterm" ? "" : "longterm" }))}
            data-testid="badge-bettype-longterm"
          >
            Largo plazo
          </Badge>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Cashout</Label>
        <div className="grid gap-1.5 sm:flex sm:flex-wrap">
          <Badge
            variant={localFilters.cashoutType === "no_cashout" ? "default" : "outline"}
            className={cn("cursor-pointer justify-center px-2.5 py-1 text-xs", localFilters.cashoutType === "no_cashout" && "bg-muted")}
            onClick={() => setLocalFilters((prev) => ({ ...prev, cashoutType: prev.cashoutType === "no_cashout" ? "" : "no_cashout" }))}
            data-testid="badge-cashout-none"
          >
            Sin cashout
          </Badge>
          <Badge
            variant={localFilters.cashoutType === "cashout_profit" ? "default" : "outline"}
            className={cn("cursor-pointer justify-center px-2.5 py-1 text-xs", localFilters.cashoutType === "cashout_profit" && "bg-win text-win-foreground")}
            onClick={() => setLocalFilters((prev) => ({ ...prev, cashoutType: prev.cashoutType === "cashout_profit" ? "" : "cashout_profit" }))}
            data-testid="badge-cashout-profit"
          >
            Cashout positivo
          </Badge>
          <Badge
            variant={localFilters.cashoutType === "cashout_loss" ? "default" : "outline"}
            className={cn("cursor-pointer justify-center px-2.5 py-1 text-xs", localFilters.cashoutType === "cashout_loss" && "bg-loss text-loss-foreground")}
            onClick={() => setLocalFilters((prev) => ({ ...prev, cashoutType: prev.cashoutType === "cashout_loss" ? "" : "cashout_loss" }))}
            data-testid="badge-cashout-loss"
          >
            Cashout negativo
          </Badge>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Rango de cuota</Label>
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <Label className="mb-1 block text-xs">Min</Label>
            <Input
              type="number"
              step="0.01"
              min="1"
              placeholder="1.00"
              value={localFilters.oddsMin}
              onChange={(e) => setLocalFilters((prev) => ({ ...prev, oddsMin: e.target.value }))}
              className="text-sm font-mono"
              data-testid="input-odds-min"
            />
          </div>
          <div>
            <Label className="mb-1 block text-xs">Max</Label>
            <Input
              type="number"
              step="0.01"
              min="1"
              placeholder="10.00"
              value={localFilters.oddsMax}
              onChange={(e) => setLocalFilters((prev) => ({ ...prev, oddsMax: e.target.value }))}
              className="text-sm font-mono"
              data-testid="input-odds-max"
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Rango de stake (unidades)</Label>
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <Label className="mb-1 block text-xs">Min</Label>
            <Input
              type="number"
              step="0.5"
              min="0"
              placeholder="1"
              value={localFilters.stakeMin}
              onChange={(e) => setLocalFilters((prev) => ({ ...prev, stakeMin: e.target.value }))}
              className="text-sm font-mono"
              data-testid="input-stake-min"
            />
          </div>
          <div>
            <Label className="mb-1 block text-xs">Max</Label>
            <Input
              type="number"
              step="0.5"
              min="0"
              placeholder="10"
              value={localFilters.stakeMax}
              onChange={(e) => setLocalFilters((prev) => ({ ...prev, stakeMax: e.target.value }))}
              className="text-sm font-mono"
              data-testid="input-stake-max"
            />
          </div>
        </div>
      </div>
    </div>
  );

  const actions = (
    <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
      <Button
        variant="outline"
        onClick={handleReset}
        className="gap-1"
        data-testid="button-reset-filters"
      >
        <RotateCcw className="h-3 w-3" />
        Restablecer
      </Button>
      <Button
        onClick={handleApply}
        data-testid="button-apply-filters"
      >
        Ver {filteredCount} apuestas
      </Button>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
        <DrawerContent className="max-h-[92dvh] overflow-hidden">
          <DrawerHeader className="shrink-0 text-left">
            <DrawerTitle>Filtros avanzados</DrawerTitle>
            <DrawerDescription>
              Ajusta filtros de fecha, liga, estado, cuota y stake para analizar el historial.
            </DrawerDescription>
          </DrawerHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3">
            {content}
          </div>
          <DrawerFooter className="shrink-0 border-t border-border bg-background/95 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] backdrop-blur">
            {actions}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[88vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Filtros avanzados</DialogTitle>
          <DialogDescription>
            Ajusta filtros de fecha, liga, estado, cuota y stake para analizar el historial.
          </DialogDescription>
        </DialogHeader>
        {content}
        {actions}
      </DialogContent>
    </Dialog>
  );
}
