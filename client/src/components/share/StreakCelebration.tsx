/**
 * StreakCelebration - Auto-prompt to share when user hits a win streak milestone.
 * Minimal, on-brand toast that nudges sharing without being intrusive.
 */
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, Share2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StreakCelebrationProps {
  streak: number;
  onShare: () => void;
  onDismiss: () => void;
}

const STREAK_MILESTONES = [3, 5, 7, 10, 15, 20];

function getStreakMessage(streak: number): { title: string; subtitle: string } {
  if (streak >= 20) return { title: "LEYENDA", subtitle: `${streak} victorias seguidas` };
  if (streak >= 15) return { title: "IMPARABLE", subtitle: `${streak} victorias seguidas` };
  if (streak >= 10) return { title: "EN RACHA", subtitle: `${streak} victorias consecutivas` };
  if (streak >= 7) return { title: "RACHA BRUTAL", subtitle: `${streak} victorias seguidas` };
  if (streak >= 5) return { title: "GRAN RACHA", subtitle: `${streak} victorias seguidas` };
  return { title: "RACHA ACTIVA", subtitle: `${streak} victorias consecutivas` };
}

export function StreakCelebration({ streak, onShare, onDismiss }: StreakCelebrationProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!STREAK_MILESTONES.includes(streak)) return;

    const celebrated = localStorage.getItem("lastCelebratedStreak");
    if (celebrated === String(streak)) return;

    setVisible(true);
    localStorage.setItem("lastCelebratedStreak", String(streak));

    const timer = setTimeout(() => setVisible(false), 8000);
    return () => clearTimeout(timer);
  }, [streak]);

  const handleShare = () => {
    setVisible(false);
    onShare();
  };

  const handleDismiss = () => {
    setVisible(false);
    onDismiss();
  };

  if (streak < 3) return null;

  const msg = getStreakMessage(streak);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 80 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ type: "spring", damping: 28, stiffness: 320 }}
          className="fixed bottom-28 left-4 right-4 z-40 max-w-sm mx-auto"
        >
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl overflow-hidden">
            <div className="h-1 bg-amber-500" />

            <div className="p-3.5 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0">
                <Flame className="w-4 h-4 text-amber-400" />
              </div>

              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-bold text-amber-400">
                  {msg.title}
                </span>
                <p className="text-xs text-zinc-400">{msg.subtitle}</p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  onClick={handleShare}
                  size="sm"
                  className="h-8 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold border border-zinc-700"
                >
                  <Share2 className="w-3 h-3 mr-1.5" />
                  Compartir
                </Button>
                <button onClick={handleDismiss} className="p-1 text-zinc-600 hover:text-zinc-400">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
