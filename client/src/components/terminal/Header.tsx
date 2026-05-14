import {
  BarChart3,
  Calculator,
  Home,
  Plus,
  Settings,
  User,
  Users,
  Layers,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";
import { BrandLogo } from "@/components/brand/BrandLogo";

interface HeaderProps {
  onOpenTools: () => void;
  onOpenStrategies: () => void;
  onOpenAnalytics: () => void;
  onOpenNewBet: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
}

export function Header({
  onOpenTools,
  onOpenStrategies,
  onOpenAnalytics,
  onOpenNewBet,
  onOpenSettings,
  onLogout,
}: HeaderProps) {
  const [location, setLocation] = useLocation();

  const desktopNavActions: Array<{
    label: string;
    icon: LucideIcon;
    onClick: () => void;
    active?: boolean;
    testId: string;
  }> = [
    {
      label: "Dashboard",
      icon: Home,
      onClick: () => setLocation("/"),
      active: location === "/",
      testId: "button-dashboard-desktop",
    },
    {
      label: "Comunidad",
      icon: Users,
      onClick: () => setLocation("/tipsters"),
      active: location === "/tipsters",
      testId: "button-tipsters-desktop",
    },
    {
      label: "Estrategias",
      icon: Layers,
      onClick: onOpenStrategies,
      testId: "button-strategies-desktop",
    },
    {
      label: "Herramientas",
      icon: Calculator,
      onClick: onOpenTools,
      testId: "button-tools-desktop",
    },
  ];

  const secondaryActions: Array<{
    label: string;
    icon: LucideIcon;
    onClick: () => void;
    active?: boolean;
    testId: string;
  }> = [
    {
      label: "Herramientas",
      icon: Calculator,
      onClick: onOpenTools,
      testId: "button-tools",
    },
    {
      label: "Estrategias",
      icon: Layers,
      onClick: onOpenStrategies,
      testId: "button-strategies",
    },
    {
      label: "Perfil",
      icon: User,
      onClick: () => setLocation("/profile"),
      active: location === "/profile",
      testId: "button-profile",
    },
  ];

  secondaryActions.push({
    label: "Ajustes",
    icon: Settings,
    onClick: onOpenSettings,
    testId: "button-settings",
  });

  secondaryActions.push({
    label: "Cerrar sesión",
    icon: LogOut,
    onClick: onLogout,
    testId: "button-logout",
  });

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/88 shadow-[0_1px_0_hsl(var(--foreground)/0.04)] backdrop-blur-2xl">
      <div className="app-container app-section py-2 lg:py-3">
        <div className="flex items-center justify-between gap-3 px-0.5">
          <button
            type="button"
            onClick={() => setLocation("/")}
            className="flex min-w-0 items-center rounded-md text-left lg:shrink-0"
            aria-label="Ir al dashboard"
          >
            <BrandLogo className="h-8 w-36 max-w-[42vw] sm:h-9 sm:w-44 lg:w-48" imageClassName="max-h-full" />
          </button>

          <nav
            className="hidden min-w-0 flex-1 items-center justify-center gap-1 lg:flex"
            aria-label="Navegación de escritorio"
          >
            {desktopNavActions.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.testId}
                  type="button"
                  onClick={item.onClick}
                  data-testid={item.testId}
                  data-active={item.active ? "true" : "false"}
                  className={cn(
                    "mono-nav-item inline-flex h-9 items-center gap-2 px-3 text-xs font-bold",
                    item.active && "border-foreground/18 bg-foreground/[0.07] text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="hidden shrink-0 items-center gap-2 lg:flex">
            <button
              type="button"
              onClick={onOpenAnalytics}
              data-testid="button-analytics-desktop"
              className="mono-nav-item inline-flex h-9 items-center gap-2 px-3 text-xs font-bold"
            >
              <BarChart3 className="h-4 w-4" />
              <span>Analítica</span>
            </button>
            <button
              type="button"
              onClick={onOpenNewBet}
              data-testid="button-new-bet-desktop"
              className="inline-flex h-9 items-center gap-2 rounded-full bg-primary px-4 text-xs font-black text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              <span>Nueva apuesta</span>
            </button>
          </div>

          <nav
            className="flex shrink-0 items-center justify-end gap-1 overflow-x-auto lg:hidden"
            aria-label="Acciones secundarias"
          >
            {secondaryActions.map((item) => {
              const Icon = item.icon;
              return (
              <button
                key={item.testId}
                type="button"
                onClick={item.onClick}
                data-testid={item.testId}
                data-active={item.active ? "true" : "false"}
                className={cn(
                  "mono-nav-item grid h-8 w-8 shrink-0 place-items-center px-0 py-0 sm:h-9 sm:w-9",
                )}
                aria-label={item.label}
                title={item.label}
              >
                <Icon className="h-4 w-4" />
                <span className="sr-only">{item.label}</span>
              </button>
              );
            })}
          </nav>

          <nav
            className="hidden shrink-0 items-center justify-end gap-1 lg:flex"
            aria-label="Cuenta y ajustes"
          >
            {secondaryActions.filter((item) => item.testId !== "button-tools" && item.testId !== "button-strategies").map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.testId}
                  type="button"
                  onClick={item.onClick}
                  data-testid={`${item.testId}-desktop`}
                  data-active={item.active ? "true" : "false"}
                  className="mono-nav-item grid h-9 w-9 shrink-0 place-items-center px-0 py-0"
                  aria-label={item.label}
                  title={item.label}
                >
                  <Icon className="h-4 w-4" />
                  <span className="sr-only">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
