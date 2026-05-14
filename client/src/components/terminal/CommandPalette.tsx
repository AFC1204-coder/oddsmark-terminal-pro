import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Plus, BarChart3, Users, User, Settings, Calculator,
  Layers, Wallet, ShieldCheck, TrendingUp, Target, Flame,
  ArrowRight, Hash, Command, Share2,
} from "lucide-react";

interface CommandItem {
  id: string;
  label: string;
  sublabel?: string;
  icon: React.ReactNode;
  action: () => void;
  keywords: string[];
  category: "navigation" | "action" | "tool";
}

interface CommandPaletteProps {
  onNewBet: () => void;
  onOpenAnalytics: () => void;
  onOpenTools: () => void;
  onOpenStrategies: () => void;
  onOpenSettings: () => void;
  onOpenWallet: () => void;
  onShareSummary?: () => void;
}

export function CommandPalette({
  onNewBet,
  onOpenAnalytics,
  onOpenTools,
  onOpenStrategies,
  onOpenSettings,
  onOpenWallet,
  onShareSummary,
}: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [, setLocation] = useLocation();

  const commands = useMemo<CommandItem[]>(() => [
    { id: "new-bet", label: "Nueva apuesta", sublabel: "Registrar una apuesta", icon: <Plus className="w-4 h-4 text-emerald-400" />, action: () => { onNewBet(); setOpen(false); }, keywords: ["crear", "nueva", "apuesta", "bet", "add"], category: "action" },
    { id: "analytics", label: "Analítica", sublabel: "Gráficos y estadísticas", icon: <BarChart3 className="w-4 h-4 text-blue-400" />, action: () => { onOpenAnalytics(); setOpen(false); }, keywords: ["analytics", "graficos", "charts", "estadisticas"], category: "navigation" },
    { id: "tipsters", label: "Tipster Hub", sublabel: "Red social de tipsters", icon: <Users className="w-4 h-4 text-emerald-400" />, action: () => { setLocation("/tipsters"); setOpen(false); }, keywords: ["tipster", "hub", "social", "ranking"], category: "navigation" },
    { id: "profile", label: "Mi perfil", sublabel: "XP, nivel y estadísticas", icon: <User className="w-4 h-4 text-violet-400" />, action: () => { setLocation("/profile"); setOpen(false); }, keywords: ["perfil", "profile", "xp", "nivel"], category: "navigation" },
    { id: "verify", label: "Verificar apuesta", sublabel: "Comprobar hash de verificación", icon: <ShieldCheck className="w-4 h-4 text-emerald-400" />, action: () => { setLocation("/verify"); setOpen(false); }, keywords: ["verificar", "verify", "hash", "comprobar"], category: "navigation" },
    { id: "strategies", label: "Estrategias", sublabel: "Gestionar estrategias", icon: <Layers className="w-4 h-4 text-amber-400" />, action: () => { onOpenStrategies(); setOpen(false); }, keywords: ["estrategia", "strategy"], category: "navigation" },
    { id: "wallet", label: "Cartera", sublabel: "Depósitos y retiradas", icon: <Wallet className="w-4 h-4 text-cyan-400" />, action: () => { onOpenWallet(); setOpen(false); }, keywords: ["cartera", "wallet", "deposito", "retirada", "dinero"], category: "navigation" },
    { id: "tools", label: "Herramientas", sublabel: "Poisson, calculadoras", icon: <Calculator className="w-4 h-4 text-orange-400" />, action: () => { onOpenTools(); setOpen(false); }, keywords: ["herramientas", "tools", "poisson", "calculadora"], category: "tool" },
    { id: "settings", label: "Configuración", sublabel: "Unidades, capital, tema", icon: <Settings className="w-4 h-4 text-zinc-400" />, action: () => { onOpenSettings(); setOpen(false); }, keywords: ["configuracion", "settings", "ajustes", "tema", "unidades"], category: "navigation" },
    { id: "dashboard", label: "Dashboard", sublabel: "Pantalla principal", icon: <TrendingUp className="w-4 h-4 text-emerald-400" />, action: () => { setLocation("/"); setOpen(false); }, keywords: ["dashboard", "inicio", "home", "principal"], category: "navigation" },
    ...(onShareSummary ? [{ id: "share-summary", label: "Compartir resumen", sublabel: "Ticket semanal/mensual para redes", icon: <Share2 className="w-4 h-4 text-amber-400" />, action: () => { onShareSummary(); setOpen(false); }, keywords: ["compartir", "share", "resumen", "summary", "viral", "redes", "social"], category: "action" as const }] : []),
  ], [onNewBet, onOpenAnalytics, onOpenTools, onOpenStrategies, onOpenSettings, onOpenWallet, onShareSummary, setLocation]);

  const filtered = useMemo(() => {
    if (!query) return commands;
    const q = query.toLowerCase();
    return commands.filter(cmd =>
      cmd.label.toLowerCase().includes(q) ||
      cmd.sublabel?.toLowerCase().includes(q) ||
      cmd.keywords.some(k => k.includes(q))
    );
  }, [commands, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      setOpen(prev => !prev);
      setQuery("");
    }
    if (e.key === "Escape" && open) {
      setOpen(false);
    }
  }, [open]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const handleListKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && filtered[selectedIndex]) {
      filtered[selectedIndex].action();
    }
  };

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.children[selectedIndex] as HTMLElement;
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const categoryLabels = { navigation: "Navegación", action: "Acciones", tool: "Herramientas" };

  // Group by category
  const grouped = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {};
    filtered.forEach(cmd => {
      if (!groups[cmd.category]) groups[cmd.category] = [];
      groups[cmd.category].push(cmd);
    });
    return groups;
  }, [filtered]);

  // Compute flat index map for keyboard navigation across grouped items
  const flatIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    let idx = 0;
    Object.values(grouped).forEach(items => {
      items.forEach(cmd => {
        map.set(cmd.id, idx++);
      });
    });
    return map;
  }, [grouped]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Palette */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -5 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="fixed top-[15%] left-1/2 -translate-x-1/2 z-[101] w-[90%] max-w-md"
          >
            <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl shadow-black/40 overflow-hidden">
              {/* Search Input */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800">
                <Search className="w-4 h-4 text-zinc-500 shrink-0" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleListKeyDown}
                  placeholder="Buscar comando..."
                  className="flex-1 bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 outline-none"
                />
                <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-mono text-zinc-500 bg-zinc-800 border border-zinc-700 rounded">
                  ESC
                </kbd>
              </div>

              {/* Results */}
              <div ref={listRef} className="max-h-[50vh] overflow-y-auto py-1">
                {filtered.length === 0 ? (
                  <div className="text-center py-8 text-zinc-500 text-sm">
                    No se encontraron comandos
                  </div>
                ) : (
                  Object.entries(grouped).map(([category, items]) => (
                    <div key={category}>
                      <div className="px-3 py-1.5">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-600">
                          {categoryLabels[category as keyof typeof categoryLabels] || category}
                        </span>
                      </div>
                      {items.map((cmd) => {
                        const idx = flatIndexMap.get(cmd.id) ?? 0;
                        const isSelected = selectedIndex === idx;
                        return (
                          <button
                            key={cmd.id}
                            onClick={cmd.action}
                            onMouseEnter={() => setSelectedIndex(idx)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                              isSelected ? "bg-zinc-800" : "hover:bg-zinc-800/50"
                            }`}
                          >
                            <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0">
                              {cmd.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-zinc-200">{cmd.label}</p>
                              {cmd.sublabel && (
                                <p className="text-[10px] text-zinc-500">{cmd.sublabel}</p>
                              )}
                            </div>
                            {isSelected && (
                              <ArrowRight className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="px-3 py-2 border-t border-zinc-800 flex items-center gap-3 text-[10px] text-zinc-600">
                <span className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[9px]">↑↓</kbd>
                  Navegar
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[9px]">Enter</kbd>
                  Seleccionar
                </span>
                <span className="flex items-center gap-1 ml-auto">
                  <kbd className="px-1 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[9px]">⌘K</kbd>
                  Abrir
                </span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
