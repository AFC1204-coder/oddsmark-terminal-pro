/**
 * Export utilities for CSV data export
 */
import type { Bet } from "@shared/schema";
import { calculateBetProfit } from "@/lib/bet-calculations";

export function exportBetsToCSV(bets: Bet[], unitValue: number): void {
  const headers = [
    "Fecha", "Hora", "Deporte", "Liga", "Evento", "Mercado",
    "Cuota", "Stake (U)", "Stake (EUR)", "Estado", "Profit (U)", "Profit (EUR)",
    "Tipo", "Bookie", "Tipster", "Tags", "Cuota Cierre", "Comentario",
  ];

  const rows = bets.map(bet => {
    const result = calculateBetProfit(bet);
    const profit = result.profit;
    const stake = result.totalStake || bet.stake;

    return [
      bet.date,
      bet.time || "",
      bet.sport,
      bet.league,
      `"${bet.event.replace(/"/g, '""')}"`,
      `"${bet.market.replace(/"/g, '""')}"`,
      bet.odds.toFixed(2),
      stake.toFixed(2),
      (stake * unitValue).toFixed(2),
      bet.status,
      profit.toFixed(2),
      (profit * unitValue).toFixed(2),
      bet.betType,
      bet.bookie || "",
      bet.tipster || "",
      bet.tags || "",
      bet.closingOdds?.toFixed(2) || "",
      `"${(bet.comment || "").replace(/"/g, '""')}"`,
    ].join(",");
  });

  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `terminal-pro-export-${new Date().toISOString().split("T")[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportMonthlyReport(bets: Bet[], unitValue: number): void {
  const now = new Date();
  const month = now.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  const monthBets = bets.filter(b => {
    const d = new Date(b.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  exportBetsToCSV(monthBets, unitValue);
}
