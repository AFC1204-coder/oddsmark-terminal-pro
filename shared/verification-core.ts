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

function normalizeNumber(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(4) : null;
}

function normalizeText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text === "" ? null : text;
}

export function normalizeVerificationSelections(selections: unknown): unknown {
  if (!Array.isArray(selections)) return null;

  return selections.map((selection) => {
    if (!selection || typeof selection !== "object") return null;
    const input = selection as Record<string, unknown>;
    return {
      event: normalizeText(input.event),
      market: normalizeText(input.market),
      selection: normalizeText(input.selection),
      odds: normalizeNumber(input.odds),
      line: normalizeNumber(input.line),
      stake: normalizeNumber(input.stake),
      sport: normalizeText(input.sport),
      league: normalizeText(input.league),
    };
  });
}

export function sameVerificationSelections(a: unknown, b: unknown): boolean {
  return stableStringify(normalizeVerificationSelections(a)) === stableStringify(normalizeVerificationSelections(b));
}

export function hasVerificationCoreChanges(
  existing: Record<string, unknown>,
  updates: Record<string, unknown>,
): boolean {
  const scalarFields = ["odds", "stake", "event", "market", "league", "sport", "date", "time", "betType"] as const;

  for (const field of scalarFields) {
    if (updates[field] !== undefined && stableStringify(updates[field]) !== stableStringify(existing[field])) {
      return true;
    }
  }

  if (updates.selections !== undefined && !sameVerificationSelections(existing.selections, updates.selections)) {
    return true;
  }

  return false;
}
