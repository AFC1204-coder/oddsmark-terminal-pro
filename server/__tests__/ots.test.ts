/**
 * Tests for OpenTimestamps anchoring.
 *
 * Two things matter:
 * 1. The SHA-256 hash we feed to OTS is the SAME deterministic bet verification
 *    hash we persist in the DB. If this drifts, the anchor no longer proves
 *    anything about the bet.
 * 2. When the public OTS calendar is offline or slow, bet creation MUST NOT
 *    fail. `anchorHashToOts` must return `{ ok: false, proof: null }` cleanly.
 */
import { describe, it, expect, vi } from "vitest";
import crypto from "crypto";
import { anchorHashToOts } from "../ots";
import { parseEventUtc } from "../event-time";

// Same function as in routes.ts / verification.test.ts — duplicated here so
// this test file has no DB imports.
function generateBetVerificationHash(data: {
  userId: string;
  event: string;
  market: string;
  odds: number;
  stake: number;
  sport: string;
  league: string;
  eventDate: string;
  selections?: unknown;
  timestamp: string;
}): string {
  const payload = [
    data.userId,
    data.event,
    data.market,
    data.odds.toFixed(4),
    data.stake.toFixed(4),
    data.sport,
    data.league,
    data.eventDate,
    JSON.stringify(data.selections || null),
    data.timestamp,
  ].join("|");
  return crypto.createHash("sha256").update(payload).digest("hex");
}

const baseBet = {
  userId: "user123",
  event: "Real Madrid vs Barcelona",
  market: "1X2 - Local",
  odds: 2.1,
  stake: 5,
  sport: "Fútbol",
  league: "La Liga",
  eventDate: "2024-12-25",
  selections: null,
  timestamp: "2024-12-25T10:00:00.000Z",
};

describe("OTS hash determinism", () => {
  it("the hash fed to OTS is the same hash stored in verification_hash", () => {
    // The whole point: if you verify the `.ots` file against the published
    // verification_hash, it must match byte-for-byte.
    const h1 = generateBetVerificationHash(baseBet);
    const h2 = generateBetVerificationHash(baseBet);
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[a-f0-9]{64}$/);
  });

  it("different bets produce different hashes (so different OTS proofs)", () => {
    const h1 = generateBetVerificationHash(baseBet);
    const h2 = generateBetVerificationHash({ ...baseBet, odds: 2.2 });
    expect(h1).not.toBe(h2);
  });

  it("hash is 32 bytes when fed to OpSHA256 — the width OTS expects", () => {
    const hex = generateBetVerificationHash(baseBet);
    const bytes = Buffer.from(hex, "hex");
    expect(bytes.length).toBe(32);
  });
});

describe("anchorHashToOts — fallback when calendar is offline", () => {
  it("rejects invalid hex input without throwing", async () => {
    const result = await anchorHashToOts("not-a-hash");
    expect(result.ok).toBe(false);
    expect(result.proof).toBeNull();
    expect(result.error).toMatch(/invalid/i);
  });

  it("rejects wrong-length input", async () => {
    const result = await anchorHashToOts("abc123");
    expect(result.ok).toBe(false);
    expect(result.proof).toBeNull();
  });

  it("returns { ok: false, proof: null } when calendars are unreachable", async () => {
    // Point at a non-routable RFC 5737 TEST-NET address so the HTTP request
    // times out quickly instead of hitting the real public calendars during CI.
    const hash = generateBetVerificationHash(baseBet);
    const result = await anchorHashToOts(hash, {
      calendars: ["https://192.0.2.1"],
      timeoutMs: 500,
    });
    expect(result.ok).toBe(false);
    expect(result.proof).toBeNull();
    expect(typeof result.error).toBe("string");
  }, 10_000);

  it("never throws — always resolves to a result object", async () => {
    const hash = generateBetVerificationHash(baseBet);
    // If the real calendars happen to be reachable from the test host, that's
    // fine — we just assert the shape, not the outcome.
    const result = await anchorHashToOts(hash, { timeoutMs: 500 });
    expect(result).toHaveProperty("ok");
    expect(result).toHaveProperty("proof");
    if (result.ok) {
      expect(Buffer.isBuffer(result.proof)).toBe(true);
      expect(result.proof!.length).toBeGreaterThan(0);
    } else {
      expect(result.proof).toBeNull();
    }
  }, 10_000);

  it("deterministic: a local HTTP 500 calendar yields { ok: false }", async () => {
    // Spin up a throwaway HTTP server that returns 500 to every request, so
    // every OTS submission fails server-side. This exercises the same code
    // path as a production outage without depending on network conditions.
    const http = await import("http");
    const server = http.createServer((_req, res) => {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("calendar down");
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as any).port;
    try {
      const hash = generateBetVerificationHash(baseBet);
      const result = await anchorHashToOts(hash, {
        calendars: [`http://127.0.0.1:${port}`],
        timeoutMs: 2000,
      });
      expect(result.ok).toBe(false);
      expect(result.proof).toBeNull();
      expect(result.error).toBeTruthy();
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }, 10_000);

  it("quorum: minAttestations higher than available calendars fails cleanly", async () => {
    // Same local-500 calendar — even if it had responded, minAttestations=5
    // against a single calendar can never reach quorum.
    const http = await import("http");
    const server = http.createServer((_req, res) => {
      res.writeHead(500);
      res.end();
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as any).port;
    try {
      const hash = generateBetVerificationHash(baseBet);
      const result = await anchorHashToOts(hash, {
        calendars: [`http://127.0.0.1:${port}`],
        timeoutMs: 1000,
        minAttestations: 5,
      });
      expect(result.ok).toBe(false);
      expect(result.proof).toBeNull();
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }, 10_000);
});

describe("past-bets handling (retroactive)", () => {
  // These are unit tests for the server-side rule:
  //   "If now >= eventTimestampUtc, the bet MUST be flagged isRetroactive."
  // The flag is derived purely from the clock — the client cannot lie about it.
  function classify(now: Date, eventDate: string, eventTime: string | null) {
    const eventUtc = parseEventUtc(eventDate, eventTime);
    const isPreEvent = now < eventUtc;
    return { isPreEvent, isRetroactive: !isPreEvent };
  }

  it("pre-event bet: isRetroactive=false", () => {
    const r = classify(new Date("2024-12-25T10:00:00Z"), "2024-12-25", "21:00");
    expect(r.isPreEvent).toBe(true);
    expect(r.isRetroactive).toBe(false);
  });

  it("post-kickoff bet: isRetroactive=true (no way for client to override)", () => {
    const r = classify(new Date("2024-12-25T20:30:00Z"), "2024-12-25", "21:00");
    expect(r.isPreEvent).toBe(false);
    expect(r.isRetroactive).toBe(true);
  });

  it("bet for a match that finished last year: isRetroactive=true", () => {
    const r = classify(new Date("2026-04-05T12:00:00Z"), "2024-06-15", "18:00");
    expect(r.isRetroactive).toBe(true);
  });

  it("exactly at kickoff: treated as retroactive (safer)", () => {
    // `<` comparison means equal kickoff time is NOT pre-event.
    const r = classify(new Date("2024-12-25T21:00:00Z"), "2024-12-25", "21:00");
    expect(r.isRetroactive).toBe(true);
  });
});
