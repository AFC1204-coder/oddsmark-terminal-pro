import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export type WidgetId = "goal" | "profit" | "yield" | "winrate" | "record" | "exposure" | "avgExposure" | "streak" | "calendar" | "chart";

interface WidgetConfig {
  id: WidgetId;
  label: string;
  defaultVisible: boolean;
  span?: "full" | "half";
}

export const WIDGET_REGISTRY: WidgetConfig[] = [
  { id: "goal", label: "Goal Tracker", defaultVisible: true, span: "full" },
  { id: "profit", label: "Profit", defaultVisible: true, span: "half" },
  { id: "yield", label: "Yield", defaultVisible: true, span: "half" },
  { id: "winrate", label: "Acierto", defaultVisible: true, span: "half" },
  { id: "record", label: "Record", defaultVisible: true, span: "half" },
  { id: "streak", label: "Racha", defaultVisible: true, span: "half" },
  { id: "exposure", label: "Exposicion", defaultVisible: true, span: "half" },
  { id: "avgExposure", label: "Exp. Media", defaultVisible: true, span: "half" },
  { id: "calendar", label: "Calendario P&L", defaultVisible: true, span: "full" },
  { id: "chart", label: "Grafico Bankroll", defaultVisible: true, span: "full" },
];

interface WidgetContextType {
  visibleWidgets: Set<WidgetId>;
  toggleWidget: (id: WidgetId) => void;
  hideWidget: (id: WidgetId) => void;
  showWidget: (id: WidgetId) => void;
  isVisible: (id: WidgetId) => boolean;
  hiddenWidgets: WidgetId[];
  collapsedWidgets: Set<WidgetId>;
  toggleCollapse: (id: WidgetId) => void;
  isCollapsed: (id: WidgetId) => boolean;
}

const WidgetContext = createContext<WidgetContextType | null>(null);

const STORAGE_KEY = "terminal-quant-widgets";
const COLLAPSED_STORAGE_KEY = "terminal-quant-collapsed";

export function WidgetProvider({ children }: { children: ReactNode }) {
  const [visibleWidgets, setVisibleWidgets] = useState<Set<WidgetId>>(() => {
    if (typeof window === "undefined") {
      return new Set(WIDGET_REGISTRY.filter(w => w.defaultVisible).map(w => w.id));
    }
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as WidgetId[];
        return new Set(parsed);
      }
    } catch {}
    return new Set(WIDGET_REGISTRY.filter(w => w.defaultVisible).map(w => w.id));
  });

  const [collapsedWidgets, setCollapsedWidgets] = useState<Set<WidgetId>>(() => {
    if (typeof window === "undefined") {
      return new Set();
    }
    try {
      const stored = localStorage.getItem(COLLAPSED_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as WidgetId[];
        return new Set(parsed);
      }
    } catch {}
    return new Set();
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(visibleWidgets)));
  }, [visibleWidgets]);

  useEffect(() => {
    localStorage.setItem(COLLAPSED_STORAGE_KEY, JSON.stringify(Array.from(collapsedWidgets)));
  }, [collapsedWidgets]);

  const toggleWidget = (id: WidgetId) => {
    setVisibleWidgets(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const hideWidget = (id: WidgetId) => {
    setVisibleWidgets(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const showWidget = (id: WidgetId) => {
    setVisibleWidgets(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const isVisible = (id: WidgetId) => visibleWidgets.has(id);

  const hiddenWidgets = WIDGET_REGISTRY
    .filter(w => !visibleWidgets.has(w.id))
    .map(w => w.id);

  const toggleCollapse = (id: WidgetId) => {
    setCollapsedWidgets(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const isCollapsed = (id: WidgetId) => collapsedWidgets.has(id);

  return (
    <WidgetContext.Provider value={{ visibleWidgets, toggleWidget, hideWidget, showWidget, isVisible, hiddenWidgets, collapsedWidgets, toggleCollapse, isCollapsed }}>
      {children}
    </WidgetContext.Provider>
  );
}

export function useWidgets() {
  const context = useContext(WidgetContext);
  if (!context) {
    throw new Error("useWidgets must be used within a WidgetProvider");
  }
  return context;
}
