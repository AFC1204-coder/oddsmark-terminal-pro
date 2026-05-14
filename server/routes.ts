import type { Express } from "express";
import { createServer, type Server } from "http";
import crypto from "crypto";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { storage } from "./storage";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./supabase-auth";
import { registerScanTicketRoutes } from "./scan-ticket";
import { registerTelegramRoutes, autoPublishNewPick, autoPublishResult } from "./telegram";
import { insertBetSchema, insertStrategySchema, insertUserConfigSchema, insertTransactionSchema } from "@shared/schema";
import { z } from "zod";
import { sanitizeObject, logAudit, getClientIp, getAuditLog } from "./security";
import { anchorHashToOts } from "./ots";
import { calcSimpleBetProfit, calculateBetProfit } from "@shared/calc-profit";
import { createRouteError, parseEventUtc, type RouteError } from "./event-time";
import { hasVerificationCoreChanges } from "@shared/verification-core";

const createBetSchema = insertBetSchema.omit({ id: true, createdAt: true });
const updateBetSchema = createBetSchema.partial().omit({ userId: true });

function isEventInputError(error: unknown): error is RouteError {
  return error instanceof Error
    && ["INVALID_EVENT_DATE", "INVALID_EVENT_TIME", "MISSING_EVENT_TIME"].includes((error as RouteError).code || "");
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  return value == null || value === "" ? null : value;
}

function normalizeHashNumber(value: number): string {
  if (!Number.isFinite(value)) {
    throw createRouteError("Numero de apuesta invalido", 400, "INVALID_BET_NUMBER");
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

/** Generate SHA-256 hash for bet verification (mirrors client-side logic) */
function generateBetVerificationHash(data: {
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
  timestamp: string;
}): string {
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
    recordedAt: data.timestamp,
  });
  return crypto.createHash("sha256").update(payload).digest("hex");
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Security: HTTP headers
  app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === "production" ? {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https://*.supabase.co", "wss://*.supabase.co"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        frameSrc: ["'self'"],
        frameAncestors: ["*"],
        workerSrc: ["'self'"], // service worker
      },
    } : false,
    crossOriginEmbedderPolicy: false,
  }));

  // Security: Rate limiting
  const apiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many requests, try again in a minute" },
  });
  const writeLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many write requests" },
  });
  app.use("/api", apiLimiter);
  app.use("/api/bets", writeLimiter);
  app.use("/api/transactions", writeLimiter);
  app.use("/api/feedback", writeLimiter);

  // Rate limit public endpoints to prevent hash enumeration
  const publicLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many requests" },
  });
  app.use("/api/verify", publicLimiter);
  app.use("/api/tipsters", publicLimiter);

  // Tighter limiter for the binary .ots download endpoint — defends against
  // hash enumeration and bandwidth abuse. 10 req/min/IP is plenty for a
  // human verifier who already knows the code.
  const otsDownloadLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many proof download requests" },
  });
  app.use("/api/verify/:code/ots", otsDownloadLimiter);

  // OTS backfill hammers public calendar servers. Each call processes up to
  // 20 rows; at the public limiter's 30/min that's 600 submissions/min per
  // user, which gets Oddsmark rate-limited upstream. Cap at 5/min so no
  // single user can consume more than 100 submissions/min.
  const otsBackfillLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many back-fill requests" },
  });
  app.use("/api/verify/backfill", otsBackfillLimiter);

  // Brute force protection for auth
  const authLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many login attempts. Wait 5 minutes." },
  });
  app.use("/api/login", authLimiter);
  app.use("/api/callback", authLimiter);

  // Health check (public, no auth)
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

  await setupAuth(app);
  registerAuthRoutes(app);
  registerScanTicketRoutes(app, isAuthenticated);
  registerTelegramRoutes(app, isAuthenticated);

  app.get("/api/bets", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 200, 1), 500);
      const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);
      const all = req.query.all === "true"; // backwards compat: ?all=true returns everything

      if (all) {
        const bets = await storage.getBets(userId);
        return res.json(bets);
      }

      const { bets, total } = await storage.getBetsPaginated(userId, limit, offset);
      res.json({ bets, total, limit, offset, hasMore: offset + bets.length < total });
    } catch (error) {
      console.error("Error fetching bets:", error);
      res.status(500).json({ message: "Failed to fetch bets" });
    }
  });

  // Server-side aggregated stats — no need to download all bets
  app.get("/api/bets/stats", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const stats = await storage.getBetStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching bet stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  app.get("/api/bets/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = req.params.id;
      const userId = req.user.claims.sub;
      const bet = await storage.getBet(id);
      if (!bet || bet.userId !== userId) {
        return res.status(404).json({ message: "Bet not found" });
      }
      res.json(bet);
    } catch (error) {
      console.error("Error fetching bet:", error);
      res.status(500).json({ message: "Failed to fetch bet" });
    }
  });

  /**
   * Shared bet creation: parse → verify → atomic insert → auto-publish.
   *
   * @param opts.allowRetroactive  When true, bets whose event already started
   *   are accepted but flagged `isRetroactive`. They are excluded from
   *   verified stats and tipster rankings. When false (default), post-kickoff
   *   creation is rejected with a 422.
   */
  async function createBetVerified(
    userId: string,
    parsedBetData: any,
    ip: string,
    opts: { allowRetroactive?: boolean; retroEvidenceUrl?: string | null } = {},
  ) {
    const betData = createBetSchema.parse({ ...parsedBetData, userId, profit: 0, status: "pending" });

    const nowUtc = new Date();
    const recordedAt = nowUtc.toISOString();
    const eventTimestampUtc = parseEventUtc(betData.date, betData.time || null);
    const isPreEvent = nowUtc < eventTimestampUtc;
    // Server-enforced: the client cannot lie about when it placed a bet.
    // If the event has already started, the bet is retroactive — period.
    const isRetroactive = !isPreEvent;
    if (isRetroactive && !opts.allowRetroactive) {
      const err: any = new Error("Bet event already started — use /api/bets/retroactive to upload past bets");
      err.status = 422;
      err.code = "POST_KICKOFF";
      throw err;
    }
    const sport = betData.sport || "Fútbol";
    const league = betData.league;

    const verificationHash = generateBetVerificationHash({
      userId, event: betData.event, market: betData.market,
      odds: betData.odds, stake: betData.stake, sport, league,
      eventDate: betData.date, eventTime: betData.time || null, selections: betData.selections,
      timestamp: recordedAt,
    });

    const snapshot = JSON.stringify({
      event: betData.event, market: betData.market, odds: betData.odds, stake: betData.stake,
      sport, league, eventDate: betData.date,
      betType: betData.betType,
      isCashout: betData.isCashout,
      cashoutVal: betData.cashoutVal,
      eventTime: betData.time || null, selections: betData.selections || null,
      recordedAt,
      isRetroactive,
      retroEvidenceUrl: opts.retroEvidenceUrl || null,
    });

    // External anchoring via OpenTimestamps. Time-boxed + try/catch so a dead
    // calendar can never block bet creation — we persist NULL and back-fill later.
    const otsResult = await anchorHashToOts(verificationHash).catch((err) => ({
      proof: null as Buffer | null,
      ok: false,
      error: (err as Error).message,
    }));
    if (!otsResult.ok) {
      console.warn(`[ots] anchor failed for bet hash ${verificationHash.slice(0, 8)}: ${otsResult.error}`);
    }

    const { bet } = await storage.createBetWithVerification({
      ...betData,
      verified: isPreEvent && !isRetroactive,
    }, {
      verificationHash, betDataSnapshot: snapshot,
      eventDate: betData.date, eventTimestampUtc, isPreEvent,
      isRetroactive,
      retroEvidenceUrl: opts.retroEvidenceUrl || null,
      otsProof: otsResult.proof,
      otsAnchoredAt: otsResult.ok ? new Date() : null,
    });

    autoPublishNewPick(userId, bet, verificationHash.substring(0, 8)).catch(() => {});
    logAudit({ userId, action: "CREATE", resource: "bet", resourceId: bet.id, ip });
    return {
      ...bet,
      verificationHash,
      verificationRecordedAt: recordedAt,
      verificationIsPreEvent: isPreEvent,
    };
  }

  app.post("/api/bets", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const sanitizedBody = sanitizeObject(req.body);
      const bet = await createBetVerified(userId, {
        ...sanitizedBody,
        odds: Number(sanitizedBody.odds) || 1,
        stake: Number(sanitizedBody.stake) || 0,
      }, getClientIp(req));
      res.status(201).json(bet);
    } catch (error: any) {
      console.error("Error creating bet:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid bet data", errors: error.errors });
      } else if (isEventInputError(error)) {
        res.status(error.status || 400).json({ message: error.message, code: error.code });
      } else if (error?.code === "POST_KICKOFF") {
        res.status(422).json({ message: error.message, code: "POST_KICKOFF" });
      } else {
        res.status(400).json({ message: "Failed to create bet" });
      }
    }
  });

  // Retroactive bet upload (post-kickoff). Explicitly flagged isRetroactive
  // by the server — these bets are excluded from verified stats, tipster
  // rankings and leaderboards. The OTS proof here only certifies WHEN THE
  // USER UPLOADED IT, not when the bet was placed.
  app.post("/api/bets/retroactive", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const sanitizedBody = sanitizeObject(req.body);
      const evidenceRaw = typeof sanitizedBody.retroEvidenceUrl === "string"
        ? sanitizedBody.retroEvidenceUrl.trim()
        : "";
      // Only accept http/https URLs, max 500 chars — prevents javascript: / data:
      const evidenceUrl = /^https?:\/\/[^\s<>]{4,500}$/.test(evidenceRaw) ? evidenceRaw : null;
      const bet = await createBetVerified(
        userId,
        {
          ...sanitizedBody,
          odds: Number(sanitizedBody.odds) || 1,
          stake: Number(sanitizedBody.stake) || 0,
        },
        getClientIp(req),
        { allowRetroactive: true, retroEvidenceUrl: evidenceUrl },
      );
      res.status(201).json(bet);
    } catch (error: any) {
      console.error("Error creating retroactive bet:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid bet data", errors: error.errors });
      } else if (isEventInputError(error)) {
        res.status(error.status || 400).json({ message: error.message, code: error.code });
      } else {
        res.status(400).json({ message: "Failed to create retroactive bet" });
      }
    }
  });

  app.patch("/api/bets/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = req.params.id;
      const userId = req.user.claims.sub;

      const existingBet = await storage.getBet(id);
      if (!existingBet || existingBet.userId !== userId) {
        return res.status(404).json({ message: "Bet not found" });
      }

      const validatedData = updateBetSchema.parse(sanitizeObject(req.body));
      const isSettled = existingBet.status === "won" || existingBet.status === "lost";

      // Settled bets: only allow status change (to resolve escalera legs, etc.)
      // Core fields (odds, stake, event, market) are locked once settled
      if (isSettled) {
        const lockedFields = ["odds", "stake", "event", "market", "league", "sport", "date", "time", "betType"] as const;
        for (const field of lockedFields) {
          if (validatedData[field] !== undefined && validatedData[field] !== existingBet[field]) {
            return res.status(403).json({ message: `No se puede modificar '${field}' en una apuesta resuelta` });
          }
        }
      }

      // Recalculate profit if relevant fields changed
      const mergedStatus = validatedData.status ?? existingBet.status;
      const mergedOdds = validatedData.odds ?? existingBet.odds;
      const mergedStake = validatedData.stake ?? existingBet.stake;
      const mergedIsCashout = validatedData.isCashout ?? existingBet.isCashout;
      const mergedCashoutVal = validatedData.cashoutVal ?? existingBet.cashoutVal;

      if (
        validatedData.status !== undefined ||
        validatedData.odds !== undefined ||
        validatedData.stake !== undefined ||
        validatedData.isCashout !== undefined ||
        validatedData.cashoutVal !== undefined
      ) {
        (validatedData as any).profit = calcSimpleBetProfit(
          mergedStatus,
          mergedOdds,
          mergedStake,
          mergedIsCashout ?? false,
          mergedCashoutVal,
        );
      }

      const bet = await storage.updateBet(id, validatedData);

      // If core fields changed on a pending bet, regenerate verification
      // No grace period — every edit is recorded honestly with new timestamp
      if (!isSettled && bet) {
        const coreChanged = hasVerificationCoreChanges(existingBet, validatedData);
        if (coreChanged) {
          try {
            const existingVerif = await storage.getVerificationByBetId(id);
            const originalHash = existingVerif?.originalHash || existingVerif?.verificationHash || null;

            // New timestamp = NOW (server UTC). Edit happened now, not when bet was created.
            const nowUtc = new Date();
            const editTimestamp = nowUtc.toISOString();
            const eventTimestampUtc = parseEventUtc(bet.date, bet.time || null);
            const isPreEvent = nowUtc < eventTimestampUtc;

            const newHash = generateBetVerificationHash({
              userId,
              event: bet.event, market: bet.market,
              odds: bet.odds, stake: bet.stake,
              sport: bet.sport, league: bet.league,
              eventDate: bet.date, eventTime: bet.time || null, selections: bet.selections,
              timestamp: editTimestamp,
            });
            const snapshot = JSON.stringify({
              event: bet.event, market: bet.market, odds: bet.odds, stake: bet.stake,
              sport: bet.sport, league: bet.league, eventDate: bet.date,
              betType: bet.betType,
              isCashout: bet.isCashout,
              cashoutVal: bet.cashoutVal,
              eventTime: bet.time || null, selections: bet.selections || null,
              recordedAt: editTimestamp,
              editedAt: editTimestamp,
              previousHash: existingVerif?.verificationHash || null,
            });
            await storage.replaceVerification(id, {
              betId: id, userId, verificationHash: newHash,
              betDataSnapshot: snapshot, eventDate: bet.date,
              eventTimestampUtc, isPreEvent,
            });
            await storage.updateBet(id, { verified: isPreEvent });
            bet.verified = isPreEvent;

            // Re-anchor the NEW hash to OpenTimestamps. The old proof was
            // cleared inside replaceVerification (it no longer matches).
            // We do it in the background so the edit response isn't blocked
            // by the calendar RTT; a failure is non-fatal (back-fill later).
            anchorHashToOts(newHash)
              .then(async (r) => {
                if (r.ok && r.proof) {
                  await storage.setOtsProof(id, r.proof, new Date());
                }
              })
              .catch((err) => {
                console.warn(`[ots] re-anchor failed for edited bet ${id}: ${err?.message}`);
              });

            // Mark verification as edited (preserves original hash for audit)
            if (existingVerif) {
              // Update the new verification to mark it as edited
              const newVerif = await storage.getVerificationByBetId(id);
              if (newVerif) {
                await storage.markVerificationEdited(id, originalHash || "");
              }
            }

            logAudit({
              userId, action: "EDIT_VERIFIED_BET", resource: "bet", resourceId: id,
              ip: getClientIp(req),
              details: `Core fields edited. Pre-event: ${isPreEvent}. Original hash: ${originalHash || "none"}`,
            });
          } catch (err) {
            console.error("Verification re-generation failed:", err);
          }
        }
      }

      // Auto-publish result to Telegram when bet resolves
      if (bet && validatedData.status && ["won", "lost", "void"].includes(validatedData.status) && existingBet.status === "pending") {
        try {
          const verif = await storage.getVerificationByBetId(id);
          const shortCode = verif?.verificationHash?.substring(0, 8) || "";
          if (shortCode) {
            autoPublishResult(userId, bet, shortCode).catch(() => {});
          }
        } catch {}
      }

      logAudit({ userId, action: "UPDATE", resource: "bet", resourceId: id, ip: getClientIp(req) });
      res.json(bet ? await storage.getBet(id) : bet);
    } catch (error) {
      console.error("Error updating bet:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid bet data", errors: error.errors });
      } else if (isEventInputError(error)) {
        res.status(error.status || 400).json({ message: error.message, code: error.code });
      } else {
        res.status(400).json({ message: "Failed to update bet" });
      }
    }
  });

  app.delete("/api/bets/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = req.params.id;
      const userId = req.user.claims.sub;

      const existingBet = await storage.getBet(id);
      if (!existingBet || existingBet.userId !== userId) {
        return res.status(404).json({ message: "Bet not found" });
      }
      if (req.header("X-Confirm-Action") !== "soft-delete-bet") {
        return res.status(428).json({
          message: "Explicit confirmation required to hide this bet",
        });
      }

      // Soft delete: mark as deleted but keep the record for integrity
      await storage.softDeleteBet(id);
      logAudit({ userId, action: "DELETE", resource: "bet", resourceId: id, ip: getClientIp(req) });
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting bet:", error);
      res.status(500).json({ message: "Failed to delete bet" });
    }
  });

  app.delete("/api/bets", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      if (req.header("X-Confirm-Action") !== "soft-delete-visible-bets") {
        return res.status(428).json({
          message: "Explicit confirmation required to clear visible bet history",
        });
      }
      await storage.deleteAllBets(userId);
      logAudit({ userId, action: "DELETE_ALL", resource: "bets", ip: getClientIp(req) });
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting all bets:", error);
      res.status(500).json({ message: "Failed to delete bets" });
    }
  });

  app.get("/api/strategies", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const strategies = await storage.getStrategies(userId);
      res.json(strategies);
    } catch (error) {
      console.error("Error fetching strategies:", error);
      res.status(500).json({ message: "Failed to fetch strategies" });
    }
  });

  app.post("/api/strategies", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const strategyData = insertStrategySchema.parse({ ...req.body, userId });
      const strategy = await storage.createStrategy(strategyData);
      res.status(201).json(strategy);
    } catch (error) {
      console.error("Error creating strategy:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid strategy data", errors: error.errors });
      } else {
        res.status(400).json({ message: "Failed to create strategy" });
      }
    }
  });

  app.delete("/api/strategies/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid strategy ID" });
      const userId = req.user.claims.sub;
      // Verify ownership before deleting
      const strategies = await storage.getStrategies(userId);
      const owns = strategies.some(s => s.id === id);
      if (!owns) {
        return res.status(403).json({ message: "Not authorized" });
      }
      if (req.header("X-Confirm-Action") !== "delete-strategy") {
        return res.status(428).json({
          message: "Explicit confirmation required to delete this strategy",
        });
      }
      await storage.deleteStrategy(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting strategy:", error);
      res.status(500).json({ message: "Failed to delete strategy" });
    }
  });

  app.get("/api/config", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const config = await storage.getConfig(userId);
      res.json(config || { unitValue: 10, initialCapital: 0, targetBankroll: 0, currency: "units" });
    } catch (error) {
      console.error("Error fetching config:", error);
      res.status(500).json({ message: "Failed to fetch config" });
    }
  });

  app.post("/api/config", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const configData = insertUserConfigSchema.parse({ ...req.body, userId });
      const config = await storage.upsertConfig(configData);
      res.json(config);
    } catch (error) {
      console.error("Error updating config:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid config data", errors: error.errors });
      } else {
        res.status(400).json({ message: "Failed to update config" });
      }
    }
  });

  app.get("/api/transactions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const txns = await storage.getTransactions(userId);
      res.json(txns);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  app.post("/api/transactions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const txnData = insertTransactionSchema.parse({ ...req.body, userId });
      const txn = await storage.createTransaction(txnData);
      res.status(201).json(txn);
    } catch (error) {
      console.error("Error creating transaction:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid transaction data", errors: error.errors });
      } else {
        res.status(400).json({ message: "Failed to create transaction" });
      }
    }
  });

  app.delete("/api/transactions/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid transaction ID" });
      const userId = req.user.claims.sub;
      if (req.header("X-Confirm-Action") !== "delete-transaction") {
        return res.status(428).json({
          message: "Explicit confirmation required to delete this transaction",
        });
      }
      await storage.deleteTransaction(id, userId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting transaction:", error);
      res.status(500).json({ message: "Failed to delete transaction" });
    }
  });

  // ──────────────────────────────────────────────
  // REST endpoint: POST /api/rest/bets
  // Acepta campos en español y los mapea al schema interno.
  // ──────────────────────────────────────────────
  const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha invalida");
  const timeOnlySchema = z.string().regex(/^\d{2}:\d{2}$/, "Hora invalida");
  const restBetSchema = z.object({
    evento: z.string().trim().min(1).max(160),
    jugador: z.string().trim().max(120).optional(),
    mercado: z.string().trim().min(1).max(160),
    cuota: z.number().positive(),
    stake: z.number().positive(),
    competicion: z.string().trim().min(1).max(120),
    casa_apuestas: z.string().trim().max(80).optional(),
    posicion: z.string().trim().max(80).optional(),
    tipo_senal: z.string().trim().max(40).optional(),
    confianza: z.string().trim().max(500).optional(),
    fecha: dateOnlySchema, // formato YYYY-MM-DD
    hora: timeOnlySchema.optional(), // formato HH:mm, hora local de evento
  });

  app.post("/api/rest/bets", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const input = restBetSchema.parse(sanitizeObject(req.body));

      const bet = await createBetVerified(userId, {
        event: input.evento,
        market: input.mercado,
        odds: input.cuota,
        stake: input.stake,
        league: input.competicion,
        date: input.fecha,
        time: input.hora || null,
        sport: "Futbol",
        bookie: input.casa_apuestas || null,
        player: input.jugador || null,
        position: input.posicion || null,
        betType: input.tipo_senal || "simple",
        comment: input.confianza || null,
      }, getClientIp(req));
      res.status(201).json(bet);
    } catch (error) {
      console.error("Error creating bet (REST):", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Datos invalidos", errors: error.errors });
      } else if (isEventInputError(error)) {
        res.status(error.status || 400).json({ message: error.message, code: error.code });
      } else {
        res.status(400).json({ message: "Error al crear apuesta" });
      }
    }
  });

  // ──────────────────────────────────────────────
  // PUBLIC: Verify a bet by hash code (no auth required)
  // ──────────────────────────────────────────────
  app.get("/api/verify/:code", async (req, res) => {
    try {
      const code = req.params.code.trim();
      if (!code || code.length < 8 || code.length > 64) {
        return res.status(400).json({ message: "Invalid verification code" });
      }
      const verification = await storage.getVerificationByHash(code);
      if (!verification) {
        return res.status(404).json({ message: "Verification not found" });
      }
      // Return public data only (no userId)
      let snapshot: Record<string, unknown> = {};
      try { snapshot = JSON.parse(verification.betDataSnapshot); } catch {}
      res.json({
        status: verification.status,
        hash: verification.verificationHash,
        isPreEvent: verification.isPreEvent,
        editedAfterCreation: verification.editedAfterCreation || false,
        originalHash: verification.originalHash || null,
        eventDate: verification.eventDate,
        eventTimestampUtc: verification.eventTimestampUtc,
        recordedAt: verification.timestamp,
        event: snapshot.event || null,
        market: snapshot.market || null,
        odds: snapshot.odds || null,
        sport: snapshot.sport || null,
        league: snapshot.league || null,
        eventTime: snapshot.eventTime || null,
        editedAt: snapshot.editedAt || null,
        ots: {
          anchored: !!verification.otsProof,
          anchoredAt: verification.otsAnchoredAt || null,
          downloadUrl: verification.otsProof
            ? `/api/verify/${verification.verificationHash.substring(0, 16)}/ots`
            : null,
        },
      });
    } catch (error) {
      console.error("Error verifying bet:", error);
      res.status(500).json({ message: "Verification lookup failed" });
    }
  });

  // Back-fill OTS proofs for the caller's own verifications that have none
  // (calendar was offline at creation). Rate-limited by the write limiter.
  // Processes up to 20 rows per call so a user re-anchoring manually after a
  // long outage does not hammer the calendars.
  app.post("/api/verify/backfill", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const pending = await storage.getUnanchoredVerifications(20);
      let anchored = 0;
      let failed = 0;
      for (const row of pending) {
        // Verify ownership before re-anchoring: getUnanchoredVerifications is
        // global on purpose (for future cron use) so we filter here.
        const v = await storage.getVerificationByBetId(row.betId);
        if (!v || v.userId !== userId) continue;
        const result = await anchorHashToOts(row.verificationHash);
        if (result.ok && result.proof) {
          await storage.setOtsProof(row.betId, result.proof, new Date());
          anchored++;
        } else {
          failed++;
        }
      }
      logAudit({ userId, action: "OTS_BACKFILL", resource: "verification", resourceId: "batch", ip: getClientIp(req) });
      res.json({ anchored, failed, scanned: pending.length });
    } catch (error) {
      console.error("Error back-filling OTS:", error);
      res.status(500).json({ message: "Back-fill failed" });
    }
  });

  // PUBLIC: Download the OpenTimestamps .ots proof file for a verified bet.
  // Users can then run `ots verify <hash>.ots` locally (or upload to any
  // compatible verifier) to confirm the bet was anchored on Bitcoin before
  // the event took place.
  app.get("/api/verify/:code/ots", async (req, res) => {
    // Uniform 404 for "code does not exist" AND "code exists but proof missing".
    // Leaking the difference would let an attacker enumerate which hashes are
    // pending anchoring. The JSON endpoint (authenticated by knowledge of the
    // code) is where the `ots.anchored` flag lives for legitimate users.
    const notFound = () => res.status(404).json({ message: "Proof not found" });
    try {
      const code = req.params.code.trim();
      if (!code || code.length < 8 || code.length > 64) {
        return notFound();
      }
      const verification = await storage.getVerificationByHash(code);
      if (!verification || !verification.otsProof) {
        return notFound();
      }
      const shortCode = verification.verificationHash.substring(0, 16);
      res.setHeader("Content-Type", "application/vnd.opentimestamps.ots");
      res.setHeader("Content-Disposition", `attachment; filename="oddsmark-${shortCode}.ots"`);
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.send(verification.otsProof);
    } catch (error) {
      console.error("Error serving OTS proof:", error);
      res.status(500).json({ message: "Failed to fetch OTS proof" });
    }
  });

  // ──────────────────────────────────────────────
  // Tipster Profiles
  // ──────────────────────────────────────────────

  // PUBLIC: Get tipster profile by username
  app.get("/api/tipsters/:username", async (req, res) => {
    try {
      const username = req.params.username.toLowerCase().trim();
      if (!username || username.length < 2 || username.length > 30) {
        return res.status(400).json({ message: "Invalid username" });
      }
      const profile = await storage.getTipsterByUsername(username);
      if (!profile || !profile.isPublic) {
        return res.status(404).json({ message: "Tipster not found" });
      }
      // Get verified snapshots — uses SNAPSHOT data for odds/stake (immutable)
      // and CURRENT status for win/loss (so we know the outcome)
      const snapshots = await storage.getTipsterVerifiedSnapshots(profile.userId);

      // Parse snapshots into usable data
      const parsedBets = snapshots.map(s => {
        try {
          const data = JSON.parse(s.snapshot);
          return {
            event: data.event as string,
            market: data.market as string,
            odds: Number(data.odds) || 0,
            stake: Number(data.stake) || 0,
            betType: typeof data.betType === "string" ? data.betType : "simple",
            selections: data.selections ?? null,
            isCashout: Boolean(data.isCashout),
            cashoutVal: data.cashoutVal == null ? null : Number(data.cashoutVal),
            sport: data.sport as string,
            league: data.league as string,
            eventDate: data.eventDate as string,
            status: s.status,
            isLive: s.isLive,
          };
        } catch { return null; }
      }).filter((b): b is NonNullable<typeof b> => b !== null);

      // Helper to calculate stats for a subset
      const calcStats = (bets: typeof parsedBets) => {
        const settled = bets
          .map((b) => ({ bet: b, result: calculateBetProfit(b) }))
          .filter(({ result }) => result.isSettled && !result.isPending);
        const wins = settled.filter(({ result }) => result.profit > 0).length;
        const winRate = settled.length > 0 ? (wins / settled.length) * 100 : 0;
        const totalProfit = settled.reduce((sum, { result }) => sum + result.profit, 0);
        const totalStaked = settled.reduce((sum, { result }) => sum + result.totalStake, 0);
        const yieldPct = totalStaked > 0 ? (totalProfit / totalStaked) * 100 : 0;
        const avgOdds = settled.length > 0
          ? settled.reduce((sum, { result }) => sum + result.weightedOdds, 0) / settled.length : 0;
        const pending = bets.filter(b => b.status === "pending").length;
        const voided = bets.filter(b => b.status === "void").length;
        return {
          totalBets: bets.length, settledBets: settled.length,
          pendingBets: pending, voidedBets: voided,
          winRate: Math.round(winRate * 10) / 10,
          yield: Math.round(yieldPct * 100) / 100,
          profitUnits: Math.round(totalProfit * 100) / 100,
          avgOdds: Math.round(avgOdds * 100) / 100,
        };
      };

      const preMatchBets = parsedBets.filter(b => !b.isLive);
      const liveBets = parsedBets.filter(b => b.isLive);
      const allStats = calcStats(parsedBets);
      const preMatchStats = calcStats(preMatchBets);
      const liveStats = liveBets.length > 0 ? calcStats(liveBets) : null;
      const ledger = await storage.getTipsterLedgerCompleteness(profile.userId);

      const settled = parsedBets.filter(b => {
        const result = calculateBetProfit(b);
        return result.isSettled && !result.isPending;
      });
      const recentForm = settled.slice(0, 10).map(b =>
        calculateBetProfit(b).profit > 0 ? "W" : "L"
      );

      // Recent bets — includes stake in units (not EUR)
      const recentBets = parsedBets.slice(0, 20).map(b => ({
        event: b.event,
        market: b.market,
        odds: b.odds,
        stake: b.stake,
        status: b.status,
        date: b.eventDate,
        sport: b.sport,
        league: b.league,
        isLive: b.isLive,
      }));

      const followers = await storage.getFollowerCount(profile.userId);

      res.json({
        username: profile.username,
        displayName: profile.displayName,
        bio: profile.bio,
        avatarUrl: profile.avatarUrl,
        isVerified: profile.isVerified,
        mainSport: profile.mainSport,
        specialties: profile.specialties?.split(",").map(s => s.trim()).filter(Boolean) || [],
        telegramUrl: profile.telegramUrl,
        twitterUrl: profile.twitterUrl,
        instagramUrl: profile.instagramUrl,
        youtubeUrl: profile.youtubeUrl,
        verifiedSince: profile.verifiedSince,
        followers,
        stats: allStats,
        preMatchStats,
        liveStats,
        ledger,
        recentForm,
        recentBets,
      });
    } catch (error) {
      console.error("Error fetching tipster:", error);
      res.status(500).json({ message: "Failed to fetch tipster profile" });
    }
  });

  // PUBLIC: List top tipsters
  app.get("/api/tipsters", async (req, res) => {
    try {
      const period = typeof req.query.period === "string" && ["7d", "30d", "90d", "all"].includes(req.query.period)
        ? req.query.period
        : "all";
      const cutoff = period === "all"
        ? null
        : new Date(Date.now() - (period === "7d" ? 7 : period === "30d" ? 30 : 90) * 24 * 60 * 60 * 1000);
      const profiles = await storage.getPublicTipsters(50);
      const summaries = await Promise.all(profiles.map(async (p) => {
        const snapshots = await storage.getTipsterVerifiedSnapshots(p.userId);
        const parsedBetsAll = snapshots.map((s) => {
          try {
            const data = JSON.parse(s.snapshot);
            return {
              event: String(data.event || ""),
              market: String(data.market || ""),
              odds: Number(data.odds) || 0,
              stake: Number(data.stake) || 0,
              betType: typeof data.betType === "string" ? data.betType : "simple",
              selections: data.selections ?? null,
              isCashout: Boolean(data.isCashout),
              cashoutVal: data.cashoutVal == null ? null : Number(data.cashoutVal),
              sport: data.sport as string,
              league: data.league as string,
              eventDate: data.eventDate as string,
              status: s.status,
              isLive: s.isLive,
            };
          } catch {
            return null;
          }
        }).filter((b): b is NonNullable<typeof b> => b !== null);
        const parsedBets = cutoff
          ? parsedBetsAll.filter(b => new Date(b.eventDate) >= cutoff)
          : parsedBetsAll;
        const settled = parsedBets
          .map((b) => ({ bet: b, result: calculateBetProfit(b) }))
          .filter(({ result }) => result.isSettled && !result.isPending);
        const wins = settled.filter(({ result }) => result.profit > 0).length;
        const profitUnits = settled.reduce((sum, { result }) => sum + result.profit, 0);
        const totalStaked = settled.reduce((sum, { result }) => sum + result.totalStake, 0);
        const winRate = settled.length > 0 ? (wins / settled.length) * 100 : 0;
        const yieldPct = totalStaked > 0 ? (profitUnits / totalStaked) * 100 : 0;
        const avgOdds = settled.length > 0
          ? settled.reduce((sum, { result }) => sum + result.weightedOdds, 0) / settled.length
          : 0;
        const sortedSettled = [...settled].sort((a, b) =>
          new Date(b.bet.eventDate).getTime() - new Date(a.bet.eventDate).getTime()
        );
        let currentStreak = 0;
        for (const { result } of sortedSettled) {
          if (result.profit > 0) currentStreak += 1;
          else break;
        }
        let bestStreak = 0;
        let runningStreak = 0;
        for (const { result } of [...settled].sort((a, b) =>
          new Date(a.bet.eventDate).getTime() - new Date(b.bet.eventDate).getTime()
        )) {
          if (result.profit > 0) {
            runningStreak += 1;
            bestStreak = Math.max(bestStreak, runningStreak);
          } else {
            runningStreak = 0;
          }
        }
        let cumulative = 0;
        const profitHistory = [...settled].sort((a, b) =>
          new Date(a.bet.eventDate).getTime() - new Date(b.bet.eventDate).getTime()
        ).map(({ result }) => {
          cumulative += result.profit;
          return Math.round(cumulative * 100) / 100;
        });
        const recentForm = sortedSettled.slice(0, 10).map(({ result }) =>
          result.profit > 0 ? "W" : result.profit < 0 ? "L" : "P"
        );
        return {
          username: p.username,
          displayName: p.displayName,
          bio: p.bio,
          avatarUrl: p.avatarUrl,
          isVerified: p.isVerified,
          mainSport: p.mainSport,
          specialties: p.specialties?.split(",").map(s => s.trim()).filter(Boolean) || [],
          totalBets: parsedBets.length,
          winRate: Math.round(winRate * 10) / 10,
          yield: Math.round(yieldPct * 100) / 100,
          profitUnits: Math.round(profitUnits * 100) / 100,
          avgOdds: Math.round(avgOdds * 100) / 100,
          currentStreak,
          bestStreak,
          monthlyProfit: Math.round(profitUnits * 100) / 100,
          telegramUrl: p.telegramUrl,
          twitterUrl: p.twitterUrl,
          instagramUrl: p.instagramUrl,
          youtubeUrl: p.youtubeUrl,
          verifiedSince: p.verifiedSince,
          recentForm,
          profitHistory,
          followers: await storage.getFollowerCount(p.userId),
        };
      }));
      res.json(summaries.sort((a, b) => b.profitUnits - a.profitUnits));
    } catch (error) {
      console.error("Error listing tipsters:", error);
      res.status(500).json({ message: "Failed to list tipsters" });
    }
  });

  // PRIVATE: Create/update my tipster profile
  const usernameRegex = /^[a-z0-9_]{2,30}$/;
  const emptyStringToNull = (value: unknown) =>
    typeof value === "string" && value.trim() === "" ? null : value;
  const optionalText = (max: number) =>
    z.preprocess(emptyStringToNull, z.string().trim().max(max).nullable().optional());
  const socialUrlSchema = z.preprocess(
    emptyStringToNull,
    z.string()
      .trim()
      .max(240)
      .url()
      .refine((value) => {
        try {
          return ["http:", "https:"].includes(new URL(value).protocol);
        } catch {
          return false;
        }
      }, "URL no válida")
      .nullable()
      .optional(),
  );
  const avatarUrlSchema = z.preprocess(
    emptyStringToNull,
    z.string()
      .trim()
      .max(400_000)
      .refine((value) => {
        if (/^https?:\/\//i.test(value)) return true;
        return /^data:image\/(?:png|jpe?g|webp);base64,[a-z0-9+/=\s]+$/i.test(value);
      }, "Avatar no válido")
      .nullable()
      .optional(),
  );
  const tipsterProfileSchema = z.object({
    username: z.string().trim().toLowerCase().regex(usernameRegex, "El nombre de usuario debe tener 2-30 caracteres (letras, números, guion bajo)"),
    displayName: z.string().trim().min(1, "Nombre requerido").max(80),
    bio: optionalText(160),
    avatarUrl: avatarUrlSchema,
    telegramUrl: socialUrlSchema,
    twitterUrl: socialUrlSchema,
    instagramUrl: socialUrlSchema,
    youtubeUrl: socialUrlSchema,
    mainSport: optionalText(40),
    specialties: optionalText(240),
    isPublic: z.boolean().optional().default(true),
  });

  app.post("/api/tipster-profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const parsedProfile = tipsterProfileSchema.parse(sanitizeObject(req.body));
      const { username, displayName, bio, avatarUrl, telegramUrl, twitterUrl, instagramUrl, youtubeUrl, mainSport, specialties, isPublic } = parsedProfile;

      // Check username not taken by another user
      const existing = await storage.getTipsterByUsername(username);
      if (existing && existing.userId !== userId) {
        return res.status(409).json({ message: "Username ya en uso" });
      }

      const profile = await storage.upsertTipsterProfile({
        userId,
        username,
        displayName,
        bio: bio || null,
        avatarUrl: avatarUrl || null,
        telegramUrl: telegramUrl || null,
        twitterUrl: twitterUrl || null,
        instagramUrl: instagramUrl || null,
        youtubeUrl: youtubeUrl || null,
        mainSport: mainSport || null,
        specialties: specialties || null,
        isPublic,
      });

      logAudit({ userId, action: "UPSERT", resource: "tipster_profile", resourceId: String(profile.id), ip: getClientIp(req) });
      res.json(profile);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0]?.message || "Perfil no válido", errors: error.errors });
      }
      console.error("Error saving tipster profile:", error);
      res.status(500).json({ message: "Failed to save profile" });
    }
  });

  // PRIVATE: Get my own tipster profile
  app.get("/api/tipster-profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const profile = await storage.getTipsterByUserId(userId);
      res.json(profile || null);
    } catch (error) {
      console.error("Error fetching own profile:", error);
      res.status(500).json({ message: "Failed to fetch profile" });
    }
  });

  // PRIVATE: Follow/unfollow a tipster
  app.post("/api/tipsters/:username/follow", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const profile = await storage.getTipsterByUsername(req.params.username);
      if (!profile) return res.status(404).json({ message: "Tipster not found" });
      if (profile.userId === userId) return res.status(400).json({ message: "No puedes seguirte a ti mismo" });
      await storage.followTipster(userId, profile.userId);
      const followers = await storage.getFollowerCount(profile.userId);
      res.json({ following: true, followers });
    } catch (error) {
      console.error("Error following tipster:", error);
      res.status(500).json({ message: "Failed to follow" });
    }
  });

  app.delete("/api/tipsters/:username/follow", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const profile = await storage.getTipsterByUsername(req.params.username);
      if (!profile) return res.status(404).json({ message: "Tipster not found" });
      await storage.unfollowTipster(userId, profile.userId);
      const followers = await storage.getFollowerCount(profile.userId);
      res.json({ following: false, followers });
    } catch (error) {
      console.error("Error unfollowing tipster:", error);
      res.status(500).json({ message: "Failed to unfollow" });
    }
  });

  const feedbackSchema = z.object({
    category: z.enum(["bug", "ux", "verification", "idea"]),
    message: z.string().trim().min(8, "Feedback demasiado corto").max(1200, "Feedback demasiado largo"),
    path: z.string().trim().max(180).optional().default("/"),
    viewport: z.string().trim().max(40).optional().default("unknown"),
  });

  app.post("/api/feedback", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const parsed = feedbackSchema.parse(sanitizeObject(req.body));
      const feedbackId = crypto.randomUUID();

      logAudit({
        userId,
        action: "CREATE",
        resource: "feedback",
        resourceId: feedbackId,
        ip: getClientIp(req),
        details: JSON.stringify(parsed),
      });

      res.status(201).json({ ok: true, id: feedbackId });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0]?.message || "Feedback no válido", errors: error.errors });
      }
      console.error("Error saving feedback:", error);
      res.status(500).json({ message: "Failed to save feedback" });
    }
  });

  // Audit log endpoint (user sees their own activity)
  app.get("/api/audit-log", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    res.json(await getAuditLog(userId, limit));
  });

  return httpServer;
}
