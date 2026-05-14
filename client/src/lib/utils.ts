import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Smart number formatting: removes unnecessary decimal zeros
 * 15.00 -> "15", 2.50 -> "2.5", 1.33 -> "1.33", 1.0 -> "1"
 */
export function formatNumber(value: number, maxDecimals: number = 2): string {
  if (isNaN(value) || !isFinite(value)) return "0";
  const fixed = value.toFixed(maxDecimals);
  return parseFloat(fixed).toString();
}
