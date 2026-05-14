import { useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme-provider";
import { WidgetProvider } from "@/contexts/WidgetContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { useAuth } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth";
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import ProfilePage from "@/pages/profile";
import TipsterHub from "@/pages/tipster-hub";
import VerifyPage from "@/pages/verify";
import TipsterPublicPage from "@/pages/tipster-public";
import LeaderboardPage from "@/pages/leaderboard";
import EmbedPage from "@/pages/embed";
import LegalPage, { getLegalPageType } from "@/pages/legal";
import { isPublicRoute } from "@/lib/routes";
import { BrandLogo } from "@/components/brand/BrandLogo";

function isFramed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function FramedRouteBlocked() {
  return (
    <div className="terminal-shell flex min-h-screen items-center justify-center p-6 text-foreground">
      <div className="surface-panel max-w-sm rounded-lg p-6 text-center">
        <BrandLogo className="mx-auto h-10 w-44" imageClassName="max-h-full" />
        <h1 className="mt-5 text-lg font-black">Vista protegida</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Esta pantalla no se puede incrustar. Solo los widgets públicos de Oddsmark usan embed.
        </p>
      </div>
    </div>
  );
}

function Router() {
  const { user, isLoading } = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && user && location === "/auth") {
      setLocation("/");
    }
  }, [isLoading, location, setLocation, user]);

  if (isFramed() && !location.startsWith("/embed/")) {
    return <FramedRouteBlocked />;
  }

  // Public routes render immediately; they should never wait for private auth.
  if (isPublicRoute(location)) {
    if (location.startsWith("/embed/")) {
      return <EmbedPage />;
    }
    if (location === "/verify" || location.startsWith("/verify?")) {
      return <VerifyPage />;
    }
    if (location.startsWith("/tipster/")) {
      return <TipsterPublicPage />;
    }
    const legalPageType = getLegalPageType(location);
    if (legalPageType) {
      return <LegalPage type={legalPageType} />;
    }
    return <LeaderboardPage />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <BrandLogo className="h-10 w-48" imageClassName="max-h-full" />
          <div className="animate-pulse text-muted-foreground">Cargando...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    if (location === "/auth") {
      return <AuthPage />;
    }
    return <Landing onGetStarted={() => setLocation("/auth")} />;
  }

  if (location === "/auth") {
    return <Dashboard />;
  }

  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/profile" component={ProfilePage} />
      <Route path="/tipsters" component={TipsterHub} />
      <Route path="/verify" component={VerifyPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider defaultTheme="dark">
          <WidgetProvider>
            <TooltipProvider>
              <Toaster />
              <Router />
            </TooltipProvider>
          </WidgetProvider>
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
