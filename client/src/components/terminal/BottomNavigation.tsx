import { BarChart3, Plus, Users } from "lucide-react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

interface BottomNavigationProps {
  onOpenAnalytics: () => void;
  onOpenNewBet: () => void;
}

export function BottomNavigation({ onOpenAnalytics, onOpenNewBet }: BottomNavigationProps) {
  const [location, setLocation] = useLocation();

  const sideButtonClass =
    "grid h-12 w-12 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground";

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/92 px-4 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 shadow-[0_-14px_30px_hsl(0_0%_0%/0.18)] backdrop-blur-2xl lg:hidden"
      aria-label="Navegación principal"
      data-testid="bottom-navigation"
    >
      <div className="mx-auto grid h-16 w-full max-w-sm grid-cols-[1fr_5rem_1fr] items-center justify-items-center">
        <button
          type="button"
          onClick={() => setLocation("/tipsters")}
          data-testid="button-tipsters"
          data-active={location === "/tipsters" ? "true" : "false"}
          className={cn(
            sideButtonClass,
            location === "/tipsters" && "bg-foreground/[0.08] text-foreground",
          )}
          aria-label="Tipster Hub"
          title="Tipster Hub"
        >
          <Users className="h-5 w-5" />
          <span className="sr-only">Tipster Hub</span>
        </button>

        <button
          type="button"
          onClick={onOpenNewBet}
          data-testid="button-add-bet"
          className="grid h-14 w-14 -translate-y-3 place-items-center rounded-full border border-foreground/20 bg-foreground text-background shadow-lg shadow-black/25 transition-transform active:translate-y-[-0.55rem]"
          aria-label="Añadir apuesta"
          title="Añadir apuesta"
        >
          <Plus className="h-5 w-5" />
          <span className="sr-only">Añadir apuesta</span>
        </button>

        <button
          type="button"
          onClick={onOpenAnalytics}
          data-testid="button-analytics"
          className={sideButtonClass}
          aria-label="Analítica"
          title="Analítica"
        >
          <BarChart3 className="h-5 w-5" />
          <span className="sr-only">Analítica</span>
        </button>
      </div>
    </nav>
  );
}
