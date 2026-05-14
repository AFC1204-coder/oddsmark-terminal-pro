/**
 * Shared dimensions for segmenting a bet list + the pure bucket helpers
 * they rely on. Both SegmentBreakdown and SegmentComparator reference this
 * file so a new dimension (e.g. sport) lights up in both features at once
 * instead of drifting out of sync.
 */
import type { Bet } from "@shared/schema";
import { getBetStakeUnits } from "./bet-analysis";

// ────────────────────────────────────────────────────────────────────────────
// Bucket helpers — pure, testable.
// ────────────────────────────────────────────────────────────────────────────

/** Group odds into coarse ranges that are meaningful for a bettor. */
export function oddsBucket(odds: number): string | null {
  if (!Number.isFinite(odds) || odds <= 1) return null;
  if (odds < 1.5) return "1.01 – 1.50";
  if (odds < 2.0) return "1.50 – 2.00";
  if (odds < 2.5) return "2.00 – 2.50";
  if (odds < 3.5) return "2.50 – 3.50";
  if (odds < 5.0) return "3.50 – 5.00";
  return "5.00+";
}

/** Group stakes (in bankroll units) into coarse ranges. */
export function stakeBucket(stake: number): string | null {
  if (!Number.isFinite(stake) || stake <= 0) return null;
  if (stake < 0.5) return "< 0.5 U";
  if (stake < 1) return "0.5 – 1 U";
  if (stake < 2) return "1 – 2 U";
  if (stake < 3) return "2 – 3 U";
  if (stake < 5) return "3 – 5 U";
  return "5+ U";
}

/** Normalize bet type labels for display. */
export function betTypeLabel(bet: Bet): string | null {
  if (bet.isLongTerm) return "Largo plazo";
  if (bet.isLive) return "En vivo";
  return "Pre-match";
}

// ────────────────────────────────────────────────────────────────────────────
// Dimensions
// ────────────────────────────────────────────────────────────────────────────

export type SegmentDimensionId =
  | "league"
  | "market"
  | "bookie"
  | "tipster"
  | "betType"
  | "odds"
  | "stake";

export interface SegmentDimension {
  id: SegmentDimensionId;
  label: string;
  keyOf: (bet: Bet) => string | null;
}

export const SEGMENT_DIMENSIONS: readonly SegmentDimension[] = [
  { id: "league",  label: "Liga",              keyOf: (b) => b.league || null },
  { id: "market",  label: "Mercado",           keyOf: (b) => b.marketType || b.market || null },
  { id: "bookie",  label: "Casa de apuestas",  keyOf: (b) => b.bookie || null },
  { id: "tipster", label: "Tipster",           keyOf: (b) => b.tipster || null },
  { id: "betType", label: "Tipo de apuesta",   keyOf: betTypeLabel },
  { id: "odds",    label: "Rango de cuota",    keyOf: (b) => oddsBucket(b.odds) },
  { id: "stake",   label: "Rango de stake",    keyOf: (b) => stakeBucket(getBetStakeUnits(b)) },
];

export function getDimension(id: SegmentDimensionId): SegmentDimension {
  return SEGMENT_DIMENSIONS.find(d => d.id === id) ?? SEGMENT_DIMENSIONS[0];
}
