export type ChartShareTimePeriod = "1D" | "1W" | "1M" | "3M" | "6M" | "1Y" | "ALL";

const monthLabels = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];

const periodLabels: Record<ChartShareTimePeriod, string> = {
  "1D": "ÚLTIMO DÍA",
  "1W": "ÚLTIMOS 7 DÍAS",
  "1M": "ÚLTIMOS 30 DÍAS",
  "3M": "ÚLTIMOS 3 MESES",
  "6M": "ÚLTIMOS 6 MESES",
  "1Y": "ÚLTIMO AÑO",
  ALL: "HISTÓRICO TOTAL",
};

function parseShareDate(input: Date | string | undefined): Date | null {
  if (!input) return null;
  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? null : new Date(input.getFullYear(), input.getMonth(), input.getDate());
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const [year, month, day] = input.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  const parsed = new Date(input);
  return Number.isNaN(parsed.getTime()) ? null : new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function addYears(date: Date, years: number): Date {
  const next = new Date(date);
  next.setFullYear(next.getFullYear() + years);
  return next;
}

export function getChartSharePeriodLabel(period: ChartShareTimePeriod): string {
  return periodLabels[period];
}

export function getChartSharePeriodBadge(period: ChartShareTimePeriod): string {
  return period === "ALL" ? "ALL" : period;
}

export function formatChartShareDate(input: Date | string, options: { includeYear?: boolean } = {}): string {
  const date = parseShareDate(input);
  if (!date) return String(input);

  const year = options.includeYear ? ` ${date.getFullYear()}` : "";
  return `${date.getDate()} ${monthLabels[date.getMonth()] ?? ""}${year}`.trim();
}

function formatChartShareDateRange(startDate: Date, endDate: Date): string {
  const includeYear = startDate.getFullYear() !== endDate.getFullYear();
  return `${formatChartShareDate(startDate, { includeYear })} - ${formatChartShareDate(endDate, { includeYear })}`;
}

export function getChartSharePeriodRange(
  period: ChartShareTimePeriod,
  options: {
    now?: Date;
    firstDataDate?: string;
    lastDataDate?: string;
  } = {},
): string {
  const today = parseShareDate(options.now ?? new Date()) ?? new Date();
  const firstDataDate = parseShareDate(options.firstDataDate);
  const lastDataDate = parseShareDate(options.lastDataDate);

  if (period === "ALL") {
    if (firstDataDate && lastDataDate) {
      return formatChartShareDateRange(firstDataDate, lastDataDate);
    }
    return "Sin periodo";
  }

  if (period === "1D") {
    return formatChartShareDate(today);
  }

  const startDate =
    period === "1W" ? addDays(today, -6)
    : period === "1M" ? addDays(today, -29)
    : period === "3M" ? addMonths(today, -3)
    : period === "6M" ? addMonths(today, -6)
    : addYears(today, -1);

  return formatChartShareDateRange(startDate, today);
}
