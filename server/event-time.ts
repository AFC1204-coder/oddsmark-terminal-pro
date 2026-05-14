export type RouteError = Error & { status?: number; code?: string };

const DEFAULT_EVENT_TIME_ZONE = process.env.EVENT_TIME_ZONE || "Europe/Madrid";

export function createRouteError(message: string, status: number, code: string): RouteError {
  const error = new Error(message) as RouteError;
  error.status = status;
  error.code = code;
  return error;
}

function getZonedParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date)
      .filter(part => part.type !== "literal")
      .map(part => [part.type, Number(part.value)]),
  );
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  };
}

function assertValidCalendarDate(year: number, month: number, day: number) {
  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  if (
    calendarDate.getUTCFullYear() !== year ||
    calendarDate.getUTCMonth() + 1 !== month ||
    calendarDate.getUTCDate() !== day
  ) {
    throw createRouteError("Fecha de evento invalida", 400, "INVALID_EVENT_DATE");
  }
}

export function parseEventUtc(
  dateStr: string,
  timeStr: string | null,
  timeZone = DEFAULT_EVENT_TIME_ZONE,
): Date {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!dateMatch) {
    throw createRouteError("Fecha de evento invalida", 400, "INVALID_EVENT_DATE");
  }
  if (timeStr == null || timeStr === "") {
    throw createRouteError("Hora de evento requerida", 400, "MISSING_EVENT_TIME");
  }
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(timeStr)) {
    throw createRouteError("Hora de evento invalida", 400, "INVALID_EVENT_TIME");
  }

  const [, yearText, monthText, dayText] = dateMatch;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const [hour, minute] = timeStr.split(":").map(Number);
  assertValidCalendarDate(year, month, day);

  const targetAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  let utcMs = targetAsUtc;
  for (let i = 0; i < 3; i += 1) {
    const parts = getZonedParts(new Date(utcMs), timeZone);
    const zonedAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    const delta = targetAsUtc - zonedAsUtc;
    if (delta === 0) break;
    utcMs += delta;
  }

  const parsed = new Date(utcMs);
  const finalParts = getZonedParts(parsed, timeZone);
  if (
    finalParts.year !== year ||
    finalParts.month !== month ||
    finalParts.day !== day ||
    finalParts.hour !== hour ||
    finalParts.minute !== minute
  ) {
    throw createRouteError("Hora de evento invalida", 400, "INVALID_EVENT_TIME");
  }

  return parsed;
}
