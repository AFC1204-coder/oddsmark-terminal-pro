import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, FileText, BarChart3, Wallet, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FloatingActionButtonProps {
  onClick: () => void;
  onOpenAnalytics?: () => void;
  onOpenWallet?: () => void;
  onShareSummary?: () => void;
}

export function FloatingActionButton({ onClick, onOpenAnalytics, onOpenWallet, onShareSummary }: FloatingActionButtonProps) {
  const [expanded, setExpanded] = useState(false);

  const actions = [
    { icon: <FileText className="h-4 w-4" />, label: "Nueva apuesta", action: onClick },
    ...(onOpenAnalytics ? [{ icon: <BarChart3 className="h-4 w-4" />, label: "Analítica", action: onOpenAnalytics }] : []),
    ...(onOpenWallet ? [{ icon: <Wallet className="h-4 w-4" />, label: "Wallet", action: onOpenWallet }] : []),
    ...(onShareSummary ? [{ icon: <Share2 className="h-4 w-4" />, label: "Compartir resumen", action: onShareSummary }] : []),
  ];

  const handleAction = (action: () => void) => {
    setExpanded(false);
    action();
  };

  return (
    <>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-background/45 backdrop-blur-[2px] lg:hidden"
            onClick={() => setExpanded(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            className="surface-panel fixed bottom-24 left-4 right-4 z-50 rounded-lg p-2 shadow-2xl sm:left-auto sm:w-72 lg:hidden"
          >
            <div className="grid gap-1.5">
              {actions.map((item) => (
                <button
                  key={item.label}
                  onClick={() => handleAction(item.action)}
                  className="flex h-11 w-full items-center gap-2 rounded-full border border-border/70 bg-foreground/5 px-3 text-left text-xs font-bold text-foreground transition-colors hover:bg-muted/70"
                >
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-background/70">
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        className="fixed bottom-4 right-4 z-50 lg:hidden"
      >
        <Button
          onClick={() => actions.length > 1 ? setExpanded(!expanded) : onClick()}
          size="icon-lg"
          className="h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-xl shadow-black/25 hover:bg-primary/90"
          data-testid="button-add-bet"
          aria-label={expanded ? "Cerrar acciones" : "Añadir apuesta"}
        >
          {expanded ? <X className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
        </Button>
      </motion.div>
    </>
  );
}
