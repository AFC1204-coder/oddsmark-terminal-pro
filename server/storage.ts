import {
  bets, strategies, userConfigs, transactions, betVerifications, betVerificationEvents, tipsterProfiles, tipsterFollows, telegramConfigs,
  type Bet, type InsertBet,
  type Strategy, type InsertStrategy,
  type UserConfig, type InsertUserConfig,
  type Transaction, type InsertTransaction,
  type BetVerification, type BetVerificationEvent, type TipsterProfile, type InsertTipsterProfile,
  type TelegramConfig, type InsertTelegramConfig
} from "@shared/schema";
import { db } from "./db";
import { pool } from "./db";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and, desc, sql } from "drizzle-orm";
import crypto from "crypto";
import { calculateBetProfit } from "@shared/calc-profit";

export interface BetStats {
  totalBets: number;
  pendingBets: number;
  settledBets: number;
  wonBets: number;
  lostBets: number;
  voidBets: number;
  totalStaked: number;
  totalProfit: number;
  winRate: number;
  yield: number;
  avgOdds: number;
  currentStreak: number;
  bestStreak: number;
  tipsters: string[];
}

export interface LedgerCompleteness {
  currentVerifiedBets: number;
  createdEvents: number;
  completenessPct: number;
  deletedVerifiedBets: number;
  editedVerifiedBets: number;
  otsAnchoredPct: number;
}

export interface IStorage {
  getBets(userId: string): Promise<Bet[]>;
  getBetsPaginated(userId: string, limit: number, offset: number): Promise<{ bets: Bet[]; total: number }>;
  getBetStats(userId: string): Promise<BetStats>;
  getBet(id: string): Promise<Bet | undefined>;
  createBet(bet: InsertBet & { id?: string }): Promise<Bet>;
  updateBet(id: string, bet: Partial<InsertBet>): Promise<Bet | undefined>;
  deleteBet(id: string): Promise<void>;
  softDeleteBet(id: string): Promise<void>;
  deleteAllBets(userId: string): Promise<void>;
  
  getStrategies(userId: string): Promise<Strategy[]>;
  createStrategy(strategy: InsertStrategy): Promise<Strategy>;
  deleteStrategy(id: number): Promise<void>;
  
  getConfig(userId: string): Promise<UserConfig | undefined>;
  upsertConfig(config: InsertUserConfig): Promise<UserConfig>;
  
  getTransactions(userId: string): Promise<Transaction[]>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  deleteTransaction(id: number, userId: string): Promise<void>;

  followTipster(followerId: string, tipsterId: string): Promise<void>;
  unfollowTipster(followerId: string, tipsterId: string): Promise<void>;
  isFollowing(followerId: string, tipsterId: string): Promise<boolean>;
  getFollowerCount(tipsterId: string): Promise<number>;

  getTipsterByUsername(username: string): Promise<TipsterProfile | undefined>;
  getTipsterByUserId(userId: string): Promise<TipsterProfile | undefined>;
  upsertTipsterProfile(profile: InsertTipsterProfile & { username: string }): Promise<TipsterProfile>;
  getPublicTipsters(limit?: number): Promise<TipsterProfile[]>;
  getTipsterBets(userId: string): Promise<Bet[]>;
  getTipsterLedgerCompleteness(userId: string): Promise<LedgerCompleteness>;

  replaceVerification(betId: string, data: {
    betId: string;
    userId: string;
    verificationHash: string;
    betDataSnapshot: string;
    eventDate: string;
    eventTimestampUtc?: Date | null;
    isPreEvent: boolean;
  }): Promise<BetVerification>;
  getVerificationByHash(hashPrefix: string): Promise<BetVerification | undefined>;
  getVerificationByBetId(betId: string): Promise<BetVerification | undefined>;
  markVerificationEdited(betId: string, originalHash: string): Promise<void>;

  /** Atomic: create bet + verification in a single transaction */
  createBetWithVerification(
    bet: InsertBet & { id?: string },
    verification: {
      verificationHash: string;
      betDataSnapshot: string;
      eventDate: string;
      eventTimestampUtc: Date | null;
      isPreEvent: boolean;
      isRetroactive?: boolean;
      retroEvidenceUrl?: string | null;
      otsProof?: Buffer | null;
      otsAnchoredAt?: Date | null;
    }
  ): Promise<{ bet: Bet; verification: BetVerification }>;

  /** Back-fill the OTS proof for an already-created verification (e.g. when the calendar was offline). */
  setOtsProof(betId: string, proof: Buffer, anchoredAt: Date): Promise<void>;

  /** List verifications that still need an OTS proof (NULL ots_proof) — for back-fill jobs. */
  getUnanchoredVerifications(limit: number): Promise<Array<{ betId: string; verificationHash: string }>>;

  getVerificationEventsByBetId(betId: string): Promise<BetVerificationEvent[]>;

  getTelegramConfig(userId: string): Promise<TelegramConfig | undefined>;
  upsertTelegramConfig(config: InsertTelegramConfig): Promise<TelegramConfig>;
  deleteTelegramConfig(userId: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getBets(userId: string): Promise<Bet[]> {
    const rows = await db.select({
      bet: bets,
      verificationHash: betVerifications.verificationHash,
      verificationTimestamp: betVerifications.timestamp,
      isPreEvent: betVerifications.isPreEvent,
      isRetroactive: betVerifications.isRetroactive,
    }).from(bets)
      .leftJoin(betVerifications, sql`${betVerifications.betId}::text = ${bets.id}::text`)
      .where(and(eq(bets.userId, userId), sql`${bets.deletedAt} IS NULL`))
      .orderBy(desc(bets.date));
    return rows.map(({ bet, verificationHash, verificationTimestamp, isPreEvent, isRetroactive }) => ({
      ...bet,
      verified: Boolean(verificationHash && isPreEvent && !isRetroactive),
      verificationHash,
      verificationRecordedAt: verificationTimestamp,
      verificationIsPreEvent: isPreEvent,
    }));
  }

  async getBetStats(userId: string): Promise<BetStats> {
    const notDeleted = sql`${bets.deletedAt} IS NULL`;

    const rows = await db.select().from(bets)
      .where(and(eq(bets.userId, userId), notDeleted))
      .orderBy(desc(bets.date));

    let pendingBets = 0;
    let settledBets = 0;
    let wonBets = 0;
    let lostBets = 0;
    let voidBets = 0;
    let totalStaked = 0;
    let totalProfit = 0;
    let oddsSum = 0;
    const settledRows: Array<{ status: "won" | "lost"; date: string }> = [];

    for (const bet of rows) {
      if (bet.status === "void") {
        voidBets++;
        continue;
      }

      const result = calculateBetProfit(bet);
      if (result.isPending) {
        pendingBets++;
        continue;
      }
      if (!result.isSettled) continue;

      settledBets++;
      totalStaked += result.totalStake;
      totalProfit += result.profit;
      oddsSum += result.weightedOdds;
      if (result.profit > 0) {
        wonBets++;
        settledRows.push({ status: "won", date: bet.date });
      } else if (result.profit < 0) {
        lostBets++;
        settledRows.push({ status: "lost", date: bet.date });
      }
    }

    const winRate = settledBets > 0 ? (wonBets / settledBets) * 100 : 0;
    const yieldPct = totalStaked > 0 ? (totalProfit / totalStaked) * 100 : 0;
    const avgOdds = settledBets > 0 ? oddsSum / settledBets : 0;

    let currentStreak = 0;
    if (settledRows.length > 0) {
      const firstStatus = settledRows[0].status;
      for (const row of settledRows) {
        if (row.status === firstStatus) {
          currentStreak += firstStatus === "won" ? 1 : -1;
        } else break;
      }
    }

    let bestStreak = 0;
    let tempStreak = 0;
    for (let i = settledRows.length - 1; i >= 0; i--) {
      if (settledRows[i].status === "won") {
        tempStreak++;
        if (tempStreak > bestStreak) bestStreak = tempStreak;
      } else {
        tempStreak = 0;
      }
    }

    // Tipsters — lightweight distinct query
    const tipsterRows = await db.selectDistinct({ tipster: bets.tipster })
      .from(bets)
      .where(and(eq(bets.userId, userId), notDeleted, sql`${bets.tipster} is not null and ${bets.tipster} != ''`));
    const tipsters = tipsterRows.map(r => r.tipster!);

    return {
      totalBets: rows.length,
      pendingBets,
      settledBets,
      wonBets,
      lostBets,
      voidBets,
      totalStaked: Math.round(totalStaked * 100) / 100,
      totalProfit: Math.round(totalProfit * 100) / 100,
      winRate: Math.round(winRate * 10) / 10,
      yield: Math.round(yieldPct * 100) / 100,
      avgOdds: Math.round(avgOdds * 100) / 100,
      currentStreak,
      bestStreak,
      tipsters,
    };
  }

  async getBetsPaginated(userId: string, limit: number, offset: number): Promise<{ bets: Bet[]; total: number }> {
    const whereClause = and(eq(bets.userId, userId), sql`${bets.deletedAt} IS NULL`);
    const [countResult] = await db.select({ count: sql<number>`count(*)::int` })
      .from(bets)
      .where(whereClause);
    const total = countResult?.count ?? 0;
    const rows = await db.select({
      bet: bets,
      verificationHash: betVerifications.verificationHash,
      verificationTimestamp: betVerifications.timestamp,
      isPreEvent: betVerifications.isPreEvent,
      isRetroactive: betVerifications.isRetroactive,
    }).from(bets)
      .leftJoin(betVerifications, sql`${betVerifications.betId}::text = ${bets.id}::text`)
      .where(whereClause)
      .orderBy(desc(bets.date))
      .limit(limit)
      .offset(offset);
    return {
      bets: rows.map(({ bet, verificationHash, verificationTimestamp, isPreEvent, isRetroactive }) => ({
        ...bet,
        verified: Boolean(verificationHash && isPreEvent && !isRetroactive),
        verificationHash,
        verificationRecordedAt: verificationTimestamp,
        verificationIsPreEvent: isPreEvent,
      })),
      total,
    };
  }

  async getBet(id: string): Promise<Bet | undefined> {
    const [row] = await db.select({
      bet: bets,
      verificationHash: betVerifications.verificationHash,
      verificationTimestamp: betVerifications.timestamp,
      isPreEvent: betVerifications.isPreEvent,
      isRetroactive: betVerifications.isRetroactive,
    }).from(bets)
      .leftJoin(betVerifications, sql`${betVerifications.betId}::text = ${bets.id}::text`)
      .where(eq(bets.id, id));
    if (!row) return undefined;
    return {
      ...row.bet,
      verified: Boolean(row.verificationHash && row.isPreEvent && !row.isRetroactive),
      verificationHash: row.verificationHash,
      verificationRecordedAt: row.verificationTimestamp,
      verificationIsPreEvent: row.isPreEvent,
    } as Bet;
  }

  async createBet(bet: InsertBet & { id?: string }): Promise<Bet> {
    const id = bet.id || crypto.randomUUID();
    const [newBet] = await db.insert(bets).values({ ...bet, id }).returning();
    return newBet;
  }

  async updateBet(id: string, bet: Partial<InsertBet>): Promise<Bet | undefined> {
    const [updated] = await db.update(bets).set(bet).where(eq(bets.id, id)).returning();
    return updated;
  }

  async deleteBet(id: string): Promise<void> {
    await db.delete(bets).where(eq(bets.id, id));
  }

  async softDeleteBet(id: string): Promise<void> {
    await db.transaction(async (tx) => {
      const [existingBet] = await tx.select().from(bets).where(eq(bets.id, id)).limit(1);
      if (!existingBet || existingBet.deletedAt) return;

      await tx.update(bets).set({ deletedAt: new Date() }).where(eq(bets.id, id));
      const [verification] = await tx.select().from(betVerifications)
        .where(sql`${betVerifications.betId}::text = ${id}`)
        .limit(1);
      if (!verification) return;
      const [versionRow] = await tx.select({
        nextVersion: sql<number>`coalesce(max(${betVerificationEvents.version}), 0) + 1`,
      })
        .from(betVerificationEvents)
        .where(sql`${betVerificationEvents.betId}::text = ${id}`);

      await tx.insert(betVerificationEvents).values({
        betId: id,
        userId: verification.userId,
        version: Number(versionRow?.nextVersion ?? 1),
        action: "soft_deleted",
        verificationHash: verification.verificationHash,
        previousHash: null,
        betDataSnapshot: verification.betDataSnapshot,
        eventDate: verification.eventDate,
        eventTimestampUtc: verification.eventTimestampUtc,
        isPreEvent: verification.isPreEvent ?? false,
        isRetroactive: verification.isRetroactive ?? false,
        otsProof: verification.otsProof,
        otsAnchoredAt: verification.otsAnchoredAt,
      });
    });
  }

  async deleteAllBets(userId: string): Promise<void> {
    await db.transaction(async (tx) => {
      const rows = await tx.select({
        betId: bets.id,
        verificationHash: betVerifications.verificationHash,
        betDataSnapshot: betVerifications.betDataSnapshot,
        eventDate: betVerifications.eventDate,
        eventTimestampUtc: betVerifications.eventTimestampUtc,
        isPreEvent: betVerifications.isPreEvent,
        isRetroactive: betVerifications.isRetroactive,
        otsProof: betVerifications.otsProof,
        otsAnchoredAt: betVerifications.otsAnchoredAt,
      })
        .from(bets)
        .innerJoin(betVerifications, sql`${betVerifications.betId}::text = ${bets.id}::text`)
        .where(and(eq(bets.userId, userId), sql`${bets.deletedAt} IS NULL`));

      await tx.update(bets).set({ deletedAt: new Date() }).where(
        and(eq(bets.userId, userId), sql`${bets.deletedAt} IS NULL`)
      );

      for (const row of rows) {
        const [versionRow] = await tx.select({
          nextVersion: sql<number>`coalesce(max(${betVerificationEvents.version}), 0) + 1`,
        })
          .from(betVerificationEvents)
          .where(sql`${betVerificationEvents.betId}::text = ${row.betId}`);

        await tx.insert(betVerificationEvents).values({
          betId: row.betId,
          userId,
          version: Number(versionRow?.nextVersion ?? 1),
          action: "soft_deleted",
          verificationHash: row.verificationHash,
          previousHash: null,
          betDataSnapshot: row.betDataSnapshot,
          eventDate: row.eventDate,
          eventTimestampUtc: row.eventTimestampUtc,
          isPreEvent: row.isPreEvent ?? false,
          isRetroactive: row.isRetroactive ?? false,
          otsProof: row.otsProof,
          otsAnchoredAt: row.otsAnchoredAt,
        });
      }
    });
  }

  async getStrategies(userId: string): Promise<Strategy[]> {
    return await db.select().from(strategies).where(eq(strategies.userId, userId));
  }

  async createStrategy(strategy: InsertStrategy): Promise<Strategy> {
    const [newStrategy] = await db.insert(strategies).values(strategy).returning();
    return newStrategy;
  }

  async deleteStrategy(id: number): Promise<void> {
    await db.delete(strategies).where(eq(strategies.id, id));
  }

  async getConfig(userId: string): Promise<UserConfig | undefined> {
    const [config] = await db.select().from(userConfigs).where(eq(userConfigs.userId, userId));
    return config;
  }

  async upsertConfig(config: InsertUserConfig): Promise<UserConfig> {
    const [upserted] = await db
      .insert(userConfigs)
      .values(config)
      .onConflictDoUpdate({
        target: userConfigs.userId,
        set: {
          unitValue: config.unitValue,
          initialCapital: config.initialCapital,
          targetBankroll: config.targetBankroll,
          currency: config.currency,
          updatedAt: new Date(),
        },
      })
      .returning();
    return upserted;
  }

  async getTransactions(userId: string): Promise<Transaction[]> {
    return await db.select().from(transactions).where(eq(transactions.userId, userId)).orderBy(desc(transactions.date));
  }

  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    const [newTransaction] = await db.insert(transactions).values(transaction).returning();
    return newTransaction;
  }

  async deleteTransaction(id: number, userId: string): Promise<void> {
    await db.delete(transactions).where(
      and(eq(transactions.id, id), eq(transactions.userId, userId))
    );
  }

  async followTipster(followerId: string, tipsterId: string): Promise<void> {
    // Use try/catch to handle duplicate — no race condition
    try {
      await db.insert(tipsterFollows).values({ followerId, tipsterId });
    } catch {
      // Already following — ignore duplicate
    }
  }

  async unfollowTipster(followerId: string, tipsterId: string): Promise<void> {
    await db.delete(tipsterFollows).where(
      and(eq(tipsterFollows.followerId, followerId), eq(tipsterFollows.tipsterId, tipsterId))
    );
  }

  async isFollowing(followerId: string, tipsterId: string): Promise<boolean> {
    const [row] = await db.select({ id: tipsterFollows.id }).from(tipsterFollows)
      .where(and(eq(tipsterFollows.followerId, followerId), eq(tipsterFollows.tipsterId, tipsterId)))
      .limit(1);
    return !!row;
  }

  async getFollowerCount(tipsterId: string): Promise<number> {
    const [result] = await db.select({ count: sql<number>`count(*)` }).from(tipsterFollows)
      .where(eq(tipsterFollows.tipsterId, tipsterId));
    return Number(result?.count) || 0;
  }

  async getTipsterByUsername(username: string): Promise<TipsterProfile | undefined> {
    const [profile] = await db.select().from(tipsterProfiles)
      .where(eq(tipsterProfiles.username, username.toLowerCase()));
    return profile;
  }

  async getTipsterByUserId(userId: string): Promise<TipsterProfile | undefined> {
    const [profile] = await db.select().from(tipsterProfiles)
      .where(eq(tipsterProfiles.userId, userId));
    return profile;
  }

  async upsertTipsterProfile(profile: InsertTipsterProfile & { username: string }): Promise<TipsterProfile> {
    const [upserted] = await db
      .insert(tipsterProfiles)
      .values({ ...profile, username: profile.username.toLowerCase() })
      .onConflictDoUpdate({
        target: tipsterProfiles.userId,
        set: {
          displayName: profile.displayName,
          username: profile.username.toLowerCase(),
          bio: profile.bio,
          avatarUrl: profile.avatarUrl,
          telegramUrl: profile.telegramUrl,
          twitterUrl: profile.twitterUrl,
          instagramUrl: profile.instagramUrl,
          youtubeUrl: profile.youtubeUrl,
          mainSport: profile.mainSport,
          specialties: profile.specialties,
          isPublic: profile.isPublic,
          updatedAt: new Date(),
        },
      })
      .returning();
    return upserted;
  }

  async getPublicTipsters(limit = 50): Promise<TipsterProfile[]> {
    return await db.select().from(tipsterProfiles)
      .where(eq(tipsterProfiles.isPublic, true))
      .orderBy(desc(tipsterProfiles.profitUnits))
      .limit(limit);
  }

  async getTipsterBets(userId: string): Promise<Bet[]> {
    // Public stats include ONLY pre-event, NON-retroactive verified bets.
    // Belt-and-suspenders on isRetroactive matches getTipsterVerifiedSnapshots —
    // without this, a tipster could upload past winners via /api/bets/retroactive
    // and pollute their public profile.
    const verifiedBetIds = db.select({ betId: sql<string>`${betVerifications.betId}::text` })
      .from(betVerifications)
      .where(and(
        eq(betVerifications.userId, userId),
        eq(betVerifications.isPreEvent, true),
        sql`(${betVerifications.isRetroactive} is null or ${betVerifications.isRetroactive} = false)`,
      ));
    return await db.select().from(bets)
      .where(and(
        eq(bets.userId, userId),
        sql`${bets.deletedAt} IS NULL`,
        sql`${bets.id}::text IN (${verifiedBetIds})`,
      ))
      .orderBy(desc(bets.date))
      .limit(200);
  }

  async getTipsterVerifiedSnapshots(userId: string): Promise<Array<{
    betId: string;
    status: string;
    isLive: boolean;
    snapshot: string;
    isPreEvent: boolean;
  }>> {
    const rows = await db.select({
      betId: bets.id,
      status: bets.status,
      isLive: bets.isLive,
      snapshot: betVerifications.betDataSnapshot,
      isPreEvent: betVerifications.isPreEvent,
    })
      .from(betVerifications)
      .innerJoin(bets, sql`${bets.id}::text = ${betVerifications.betId}::text`)
      .where(and(
        eq(betVerifications.userId, userId),
        sql`${bets.deletedAt} IS NULL`,
        eq(betVerifications.isPreEvent, true),
        // Explicit belt-and-suspenders: retroactive bets must never surface
        // in a public tipster profile, even if isPreEvent somehow drifted.
        sql`(${betVerifications.isRetroactive} is null or ${betVerifications.isRetroactive} = false)`,
      ))
      .orderBy(desc(bets.date))
      .limit(200);
    return rows.map(r => ({
      betId: r.betId,
      status: r.status,
      isLive: r.isLive ?? false,
      snapshot: r.snapshot,
      isPreEvent: r.isPreEvent ?? true,
    }));
  }

  async getTipsterLedgerCompleteness(userId: string): Promise<LedgerCompleteness> {
    const currentWhere = and(
      eq(betVerifications.userId, userId),
      eq(betVerifications.isPreEvent, true),
      sql`${bets.deletedAt} IS NULL`,
      sql`(${betVerifications.isRetroactive} is null or ${betVerifications.isRetroactive} = false)`,
    );

    const [current] = await db.select({
      count: sql<number>`count(*)::int`,
      otsAnchored: sql<number>`count(*) filter (where ${betVerifications.otsProof} is not null)::int`,
    })
      .from(betVerifications)
      .innerJoin(bets, sql`${bets.id}::text = ${betVerifications.betId}::text`)
      .where(currentWhere);

    const [created] = await db.select({
      count: sql<number>`count(distinct ${betVerificationEvents.betId})::int`,
    })
      .from(betVerificationEvents)
      .innerJoin(betVerifications, sql`${betVerifications.betId}::text = ${betVerificationEvents.betId}::text`)
      .innerJoin(bets, sql`${bets.id}::text = ${betVerifications.betId}::text`)
      .where(and(
        currentWhere,
        eq(betVerificationEvents.action, "created"),
      ));

    const [eventCounts] = await db.select({
      deleted: sql<number>`count(distinct ${betVerificationEvents.betId}) filter (where ${betVerificationEvents.action} = 'soft_deleted')::int`,
      edited: sql<number>`count(distinct ${betVerificationEvents.betId}) filter (where ${betVerificationEvents.action} = 'edited')::int`,
    })
      .from(betVerificationEvents)
      .where(eq(betVerificationEvents.userId, userId));

    const currentVerifiedBets = Number(current?.count ?? 0);
    const createdEvents = Number(created?.count ?? 0);
    const otsAnchored = Number(current?.otsAnchored ?? 0);
    return {
      currentVerifiedBets,
      createdEvents,
      completenessPct: currentVerifiedBets > 0 ? Math.round((createdEvents / currentVerifiedBets) * 1000) / 10 : 100,
      deletedVerifiedBets: Number(eventCounts?.deleted ?? 0),
      editedVerifiedBets: Number(eventCounts?.edited ?? 0),
      otsAnchoredPct: currentVerifiedBets > 0 ? Math.round((otsAnchored / currentVerifiedBets) * 1000) / 10 : 0,
    };
  }

  async replaceVerification(betId: string, data: {
    betId: string;
    userId: string;
    verificationHash: string;
    betDataSnapshot: string;
    eventDate: string;
    eventTimestampUtc?: Date | null;
    isPreEvent: boolean;
  }): Promise<BetVerification> {
    // Atomic upsert — never leaves a gap where verification is deleted but not re-created.
    // When the hash changes (bet edited), the old OTS proof no longer matches, so we
    // clear it and transition status to 'edited' in the SAME update so the
    // bet_verifications_guard trigger sees a coherent edit transition.
    return await db.transaction(async (tx) => {
      const [previous] = await tx.select().from(betVerifications)
        .where(sql`${betVerifications.betId}::text = ${betId}`)
        .limit(1);
      const [v] = await tx.insert(betVerifications)
        .values(data)
        .onConflictDoUpdate({
          target: betVerifications.betId,
          set: {
            verificationHash: data.verificationHash,
            betDataSnapshot: data.betDataSnapshot,
            eventDate: data.eventDate,
            eventTimestampUtc: data.eventTimestampUtc ?? null,
            isPreEvent: data.isPreEvent,
            timestamp: new Date(),
            status: "edited",
            otsProof: null,
            otsAnchoredAt: null,
          },
        })
        .returning();
      const [versionRow] = await tx.select({
        nextVersion: sql<number>`coalesce(max(${betVerificationEvents.version}), 0) + 1`,
      })
        .from(betVerificationEvents)
        .where(sql`${betVerificationEvents.betId}::text = ${betId}`);

      await tx.insert(betVerificationEvents).values({
        betId,
        userId: data.userId,
        version: Number(versionRow?.nextVersion ?? 1),
        action: "edited",
        verificationHash: data.verificationHash,
        previousHash: previous?.verificationHash || null,
        betDataSnapshot: data.betDataSnapshot,
        eventDate: data.eventDate,
        eventTimestampUtc: data.eventTimestampUtc ?? null,
        isPreEvent: data.isPreEvent,
        isRetroactive: previous?.isRetroactive ?? false,
        otsProof: null,
        otsAnchoredAt: null,
      });

      return v;
    });
  }

  async getVerificationByHash(hashPrefix: string): Promise<BetVerification | undefined> {
    // Support both full hash and 8-char short code
    const normalized = hashPrefix.toLowerCase();
    const [v] = await db.select().from(betVerifications)
      .where(
        normalized.length <= 16
          ? sql`lower(left(${betVerifications.verificationHash}, ${normalized.length})) = ${normalized}`
          : eq(betVerifications.verificationHash, normalized)
      )
      .limit(1);
    return v;
  }
  async getVerificationByBetId(betId: string): Promise<BetVerification | undefined> {
    const [v] = await db.select().from(betVerifications).where(sql`${betVerifications.betId}::text = ${betId}`).limit(1);
    return v;
  }

  async markVerificationEdited(betId: string, originalHash: string): Promise<void> {
    await db.update(betVerifications)
      .set({ editedAfterCreation: true, originalHash, status: "edited" })
      .where(sql`${betVerifications.betId}::text = ${betId}`);
  }

  async createBetWithVerification(
    bet: InsertBet & { id?: string },
    verification: {
      verificationHash: string;
      betDataSnapshot: string;
      eventDate: string;
      eventTimestampUtc: Date | null;
      isPreEvent: boolean;
      isRetroactive?: boolean;
      retroEvidenceUrl?: string | null;
      otsProof?: Buffer | null;
      otsAnchoredAt?: Date | null;
    }
  ): Promise<{ bet: Bet; verification: BetVerification }> {
    const id = bet.id || crypto.randomUUID();
    // Use a raw client transaction for atomicity
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const txDb = drizzle(client);

      const [newBet] = await txDb.insert(bets).values({ ...bet, id }).returning();
      const [newVerif] = await txDb.insert(betVerifications).values({
        betId: id,
        userId: bet.userId,
        verificationHash: verification.verificationHash,
        betDataSnapshot: verification.betDataSnapshot,
        eventDate: verification.eventDate,
        eventTimestampUtc: verification.eventTimestampUtc,
        isPreEvent: verification.isPreEvent,
        isRetroactive: verification.isRetroactive ?? false,
        retroEvidenceUrl: verification.retroEvidenceUrl ?? null,
        editedAfterCreation: false,
        originalHash: null,
        status: verification.isRetroactive ? "retroactive" : "verified",
        otsProof: verification.otsProof ?? null,
        otsAnchoredAt: verification.otsAnchoredAt ?? null,
      }).returning();

      await txDb.insert(betVerificationEvents).values({
        betId: id,
        userId: bet.userId,
        version: 1,
        action: "created",
        verificationHash: verification.verificationHash,
        previousHash: null,
        betDataSnapshot: verification.betDataSnapshot,
        eventDate: verification.eventDate,
        eventTimestampUtc: verification.eventTimestampUtc,
        isPreEvent: verification.isPreEvent,
        isRetroactive: verification.isRetroactive ?? false,
        otsProof: verification.otsProof ?? null,
        otsAnchoredAt: verification.otsAnchoredAt ?? null,
      });

      await client.query("COMMIT");
      return { bet: newBet, verification: newVerif };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async setOtsProof(betId: string, proof: Buffer, anchoredAt: Date): Promise<void> {
    await db.transaction(async (tx) => {
      const [verification] = await tx.update(betVerifications)
        .set({ otsProof: proof, otsAnchoredAt: anchoredAt })
        .where(and(
          sql`${betVerifications.betId}::text = ${betId}`,
          // Only back-fill rows that are currently NULL — never overwrite a proof.
          sql`${betVerifications.otsProof} is null`,
        ))
        .returning();
      if (!verification) return;
      const [versionRow] = await tx.select({
        nextVersion: sql<number>`coalesce(max(${betVerificationEvents.version}), 0) + 1`,
      })
        .from(betVerificationEvents)
        .where(sql`${betVerificationEvents.betId}::text = ${betId}`);

      await tx.insert(betVerificationEvents).values({
        betId,
        userId: verification.userId,
        version: Number(versionRow?.nextVersion ?? 1),
        action: "ots_anchored",
        verificationHash: verification.verificationHash,
        previousHash: null,
        betDataSnapshot: verification.betDataSnapshot,
        eventDate: verification.eventDate,
        eventTimestampUtc: verification.eventTimestampUtc,
        isPreEvent: verification.isPreEvent ?? false,
        isRetroactive: verification.isRetroactive ?? false,
        otsProof: proof,
        otsAnchoredAt: anchoredAt,
      });
    });
  }

  async getUnanchoredVerifications(limit: number): Promise<Array<{ betId: string; verificationHash: string }>> {
    const rows = await db.select({
      betId: betVerifications.betId,
      verificationHash: betVerifications.verificationHash,
    })
      .from(betVerifications)
      .where(sql`${betVerifications.otsProof} is null`)
      .orderBy(desc(betVerifications.timestamp))
      .limit(limit);
    return rows;
  }

  async getVerificationEventsByBetId(betId: string): Promise<BetVerificationEvent[]> {
    return await db.select().from(betVerificationEvents)
      .where(sql`${betVerificationEvents.betId}::text = ${betId}`)
      .orderBy(desc(betVerificationEvents.version));
  }

  async getTelegramConfig(userId: string): Promise<TelegramConfig | undefined> {
    const [config] = await db.select().from(telegramConfigs).where(eq(telegramConfigs.userId, userId)).limit(1);
    return config;
  }

  async upsertTelegramConfig(config: InsertTelegramConfig): Promise<TelegramConfig> {
    const existing = await this.getTelegramConfig(config.userId);
    if (existing) {
      const [updated] = await db.update(telegramConfigs)
        .set({ ...config, updatedAt: new Date() })
        .where(eq(telegramConfigs.userId, config.userId))
        .returning();
      return updated;
    }
    const [created] = await db.insert(telegramConfigs).values(config).returning();
    return created;
  }

  async deleteTelegramConfig(userId: string): Promise<void> {
    await db.delete(telegramConfigs).where(eq(telegramConfigs.userId, userId));
  }
}

export const storage = new DatabaseStorage();
