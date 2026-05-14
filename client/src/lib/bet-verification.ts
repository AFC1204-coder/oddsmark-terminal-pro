/**
 * Bet Verification System
 *
 * Generates a cryptographic hash when a bet is recorded to prove it was
 * created BEFORE the event result. This prevents retroactive claim of wins.
 *
 * The hash includes: userId + betDetails + timestamp + eventDate
 * Anyone can verify: the hash matches the bet data = not tampered.
 * Timestamp < eventDate = recorded before the event.
 */

export interface VerificationProof {
  hash: string;
  timestamp: string;
  betSnapshot: string;
  isPreEvent: boolean;
}

/**
 * Generate a SHA-256 verification hash for a bet
 */
function normalizeOptionalText(value: string | null | undefined): string | null {
  return value == null || value === "" ? null : value;
}

function normalizeHashNumber(value: number): string {
  if (!Number.isFinite(value)) {
    throw new Error("Invalid bet number");
  }
  return value.toFixed(4);
}

function canonicalize(value: unknown): unknown {
  if (value === undefined) return null;
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === "object") {
    const input = value as Record<string, unknown>;
    return Object.keys(input).sort().reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = canonicalize(input[key]);
      return acc;
    }, {});
  }
  return value;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export async function generateBetHash(data: {
  userId: string;
  event: string;
  market: string;
  odds: number;
  stake: number;
  sport: string;
  league: string;
  eventDate: string;
  eventTime?: string | null;
  selections?: unknown;
  timestamp?: string;
}): Promise<string> {
  const payload = stableStringify({
    version: 1,
    userId: data.userId,
    event: data.event,
    market: data.market,
    odds: normalizeHashNumber(data.odds),
    stake: normalizeHashNumber(data.stake),
    sport: data.sport,
    league: data.league,
    eventDate: data.eventDate,
    eventTime: normalizeOptionalText(data.eventTime),
    selections: canonicalize(data.selections),
    recordedAt: data.timestamp || new Date().toISOString(),
  });

  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(payload);
  const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Create a full verification proof for a bet
 */
export async function createVerificationProof(bet: {
  userId: string;
  event: string;
  market: string;
  odds: number;
  stake: number;
  sport: string;
  league: string;
  date: string;
  time?: string | null;
  selections?: unknown;
  createdAt?: Date | string | null;
}): Promise<VerificationProof> {
  // Use the bet's original creation time, not the current share time
  const recordedAt = bet.createdAt ? new Date(bet.createdAt) : new Date();
  const eventDateTime = bet.time ? new Date(`${bet.date}T${bet.time}:00`) : null;
  const isPreEvent = eventDateTime ? recordedAt < eventDateTime : false;

  const snapshot = JSON.stringify({
    event: bet.event,
    market: bet.market,
    odds: bet.odds,
    stake: bet.stake,
    sport: bet.sport,
    league: bet.league,
    eventDate: bet.date,
    eventTime: bet.time || null,
    selections: bet.selections || null,
    recordedAt: recordedAt.toISOString(),
  });

  const hash = await generateBetHash({
    userId: bet.userId,
    event: bet.event,
    market: bet.market,
    odds: bet.odds,
    stake: bet.stake,
    sport: bet.sport,
    league: bet.league,
    eventDate: bet.date,
    eventTime: bet.time || null,
    selections: bet.selections,
    timestamp: recordedAt.toISOString(),
  });

  return {
    hash,
    timestamp: recordedAt.toISOString(),
    betSnapshot: snapshot,
    isPreEvent,
  };
}

/**
 * Format a short verification code from the full hash
 */
export function getShortVerificationCode(hash: string): string {
  return hash.substring(0, 8).toUpperCase();
}

/**
 * Get verification status label
 */
export function getVerificationStatus(isPreEvent: boolean, status?: string): {
  label: string;
  color: string;
  icon: "shield-check" | "shield-alert" | "shield-x";
} {
  if (status === "revoked") {
    return { label: "Revocado", color: "text-red-400", icon: "shield-x" };
  }
  if (status === "suspicious") {
    return { label: "Sospechoso", color: "text-amber-400", icon: "shield-alert" };
  }
  if (isPreEvent) {
    return { label: "Verificado Pre-Evento", color: "text-emerald-400", icon: "shield-check" };
  }
  return { label: "Post-Evento", color: "text-zinc-400", icon: "shield-alert" };
}

/**
 * Calculate time difference between bet registration and event
 */
export function getTimeDifference(registeredAt: string, eventDate: string, eventTime?: string | null): string {
  if (!eventTime) return "Hora no disponible";

  const normalizedEventTime = eventTime.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!normalizedEventTime) return "Hora no disponible";

  const eventDateMatch = eventDate.trim().match(/^(\d{4}-\d{2}-\d{2})/);
  if (!eventDateMatch) return "Hora no disponible";

  const [, rawHours, rawMinutes, rawSeconds = "00"] = normalizedEventTime;
  const hoursPart = rawHours.padStart(2, "0");
  const eventTimestamp = `${eventDateMatch[1]}T${hoursPart}:${rawMinutes}:${rawSeconds}`;
  const registered = new Date(registeredAt);
  const event = new Date(eventTimestamp);
  if (Number.isNaN(registered.getTime()) || Number.isNaN(event.getTime())) {
    return "Hora no disponible";
  }

  const diffMs = event.getTime() - registered.getTime();

  if (diffMs < 0) return "Post-evento";

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d antes`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m antes`;
  }
  return minutes > 0 ? `${minutes}m antes` : "<1m antes";
}
