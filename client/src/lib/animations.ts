/**
 * Framer Motion animation presets for consistent app-wide animations.
 */
import { useState, useEffect, useRef } from "react";
import { type Variants } from "framer-motion";

// Page transition
export const pageTransition: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.15 } },
};

// Staggered children (for lists)
export const staggerContainer: Variants = {
  animate: { transition: { staggerChildren: 0.04 } },
};

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" } },
};

// Fade in
export const fadeIn: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.3 } },
};

// Scale up (for modals, cards)
export const scaleIn: Variants = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1, transition: { duration: 0.2, ease: "easeOut" } },
  exit: { opacity: 0, scale: 0.97, transition: { duration: 0.1 } },
};

// Slide from right
export const slideFromRight: Variants = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.25, ease: "easeOut" } },
  exit: { opacity: 0, x: -10, transition: { duration: 0.1 } },
};

// Count-up number animation helper
export function useCountUp(target: number, duration: number = 600): number {
  const [current, setCurrent] = useState(0);
  const prevTarget = useRef(target);

  useEffect(() => {
    const start = prevTarget.current;
    prevTarget.current = target;
    const diff = target - start;
    if (Math.abs(diff) < 0.01) { setCurrent(target); return; }

    const startTime = performance.now();
    let raf: number;
    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      setCurrent(start + diff * eased);
      if (progress < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return current;
}
