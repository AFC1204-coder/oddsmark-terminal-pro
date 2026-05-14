import { sql, relations } from "drizzle-orm";
import { customType, pgTable, text, varchar, integer, real, boolean, timestamp, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

/** Postgres `bytea` column mapped to Node Buffer. */
export const bytea = customType<{ data: Buffer; default: false }>({
  dataType() {
    return "bytea";
  },
});

export * from "./models/auth";
export * from "./models/chat";

export const bets = pgTable("bets", {
  id: varchar("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  sport: text("sport").notNull().default("Fútbol"),
  league: text("league").notNull(),
  event: text("event").notNull(),
  market: text("market").notNull(),
  odds: real("odds").notNull(),
  stake: real("stake").notNull(),
  profit: real("profit").default(0),
  status: text("status").notNull().default("pending"),
  date: text("date").notNull(),
  time: text("time"),
  bookie: text("bookie"),
  tipster: text("tipster"),
  betType: text("bet_type").notNull().default("simple"),
  selections: jsonb("selections"),
  isLive: boolean("is_live").default(false),
  isCashout: boolean("is_cashout").default(false),
  cashoutVal: real("cashout_val"),
  currentCashout: real("current_cashout"),
  isValue: boolean("is_value").default(false),
  isParlay: boolean("is_parlay").default(false),
  comment: text("comment"),
  strategyId: integer("strategy_id").references(() => strategies.id, { onDelete: "set null" }),
  position: text("position"),
  formation: text("formation"),
  player: text("player"),
  isSubstitute: boolean("is_substitute").default(false),
  tactic: text("tactic"),
  tags: text("tags"),
  marketType: text("market_type"),
  matchSide: text("match_side"),
  imageUrl: text("image_url"),
  verified: boolean("verified").default(false),
  closingOdds: real("closing_odds"),
  isLongTerm: boolean("is_long_term").default(false),
  resolutionDate: text("resolution_date"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  index("bets_user_id_idx").on(table.userId),
  index("bets_user_date_idx").on(table.userId, table.date),
]);

export const strategies = pgTable("strategies", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userConfigs = pgTable("user_configs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().unique(),
  unitValue: real("unit_value").default(10),
  initialCapital: real("initial_capital").default(0),
  targetBankroll: real("target_bankroll").default(0),
  currency: text("currency").default("units"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const transactions = pgTable("transactions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull(),
  type: text("type").notNull(), // "deposit" | "withdrawal"
  amount: real("amount").notNull(),
  date: text("date").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Tipster profiles for the verified tipster social network
export const tipsterProfiles = pgTable("tipster_profiles", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().unique(),
  username: varchar("username", { length: 30 }).notNull().unique(),
  displayName: text("display_name").notNull(),
  bio: text("bio"),
  avatarUrl: text("avatar_url"),
  isVerified: boolean("is_verified").default(false),
  isPublic: boolean("is_public").default(true),
  // Social links
  telegramUrl: text("telegram_url"),
  twitterUrl: text("twitter_url"),
  instagramUrl: text("instagram_url"),
  youtubeUrl: text("youtube_url"),
  // Specialization
  mainSport: text("main_sport"),
  specialties: text("specialties"), // comma-separated tags
  // Cached stats (updated periodically)
  totalBets: integer("total_bets").default(0),
  winRate: real("win_rate").default(0),
  yield: real("yield").default(0),
  profitUnits: real("profit_units").default(0),
  avgOdds: real("avg_odds").default(0),
  currentStreak: integer("current_streak").default(0),
  bestStreak: integer("best_streak").default(0),
  monthlyProfit: real("monthly_profit").default(0),
  followers: integer("followers").default(0),
  // Verification
  verifiedSince: timestamp("verified_since", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Followers relationship
export const tipsterFollows = pgTable("tipster_follows", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  followerId: varchar("follower_id").notNull(),
  tipsterId: varchar("tipster_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  uniqueIndex("follows_unique_idx").on(table.followerId, table.tipsterId),
  index("follows_tipster_idx").on(table.tipsterId),
]);

// Persistent audit log
export const auditLogs = pgTable("audit_logs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull(),
  action: text("action").notNull(), // CREATE, UPDATE, DELETE, CONNECT, etc.
  resource: text("resource").notNull(), // bet, telegram, tipster, etc.
  resourceId: varchar("resource_id"),
  ip: text("ip").notNull().default("unknown"),
  details: text("details"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  index("audit_user_id_idx").on(table.userId),
]);

// Telegram bot configuration (persisted, encrypted tokens)
export const telegramConfigs = pgTable("telegram_configs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().unique(),
  botTokenEncrypted: text("bot_token_encrypted").notNull(),
  chatId: text("chat_id").notNull(),
  channelName: text("channel_name"),
  botUsername: text("bot_username"),
  autoPublish: boolean("auto_publish").default(false), // auto-send picks to channel
  publishPending: boolean("publish_pending").default(true), // publish new picks
  publishResults: boolean("publish_results").default(true), // publish when resolved
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Bet verification proofs
export const betVerifications = pgTable("bet_verifications", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  betId: varchar("bet_id").notNull().unique().references(() => bets.id, { onDelete: "cascade" }), // one verification per bet
  userId: varchar("user_id").notNull(),
  verificationHash: text("verification_hash").notNull().unique(),
  betDataSnapshot: text("bet_data_snapshot").notNull(), // JSON snapshot at creation
  timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow(),
  eventDate: text("event_date").notNull(),
  eventTimestampUtc: timestamp("event_timestamp_utc", { withTimezone: true }), // precise UTC event time
  isPreEvent: boolean("is_pre_event").default(true), // was it registered before the event?
  editedAfterCreation: boolean("edited_after_creation").default(false), // was this re-generated after edit?
  originalHash: text("original_hash"), // if edited, the first hash
  status: text("status").default("verified"), // verified | edited | revoked
  // True when the user uploaded the bet AFTER the event started/ended.
  // Server-enforced — the client cannot flip this to false. These rows are
  // excluded from verified stats, leaderboards and tipster rankings.
  isRetroactive: boolean("is_retroactive").default(false),
  // Optional user-supplied external evidence for retroactive bets (bookie URL,
  // ticket photo reference, bank statement id...). Doesn't prove anything by
  // itself — surfaced to viewers so they can judge.
  retroEvidenceUrl: text("retro_evidence_url"),
  // External anchoring (OpenTimestamps) — binary .ots proof file returned by the calendar server.
  // NULL if the calendar was offline at creation time; can be back-filled later.
  otsProof: bytea("ots_proof"),
  otsAnchoredAt: timestamp("ots_anchored_at", { withTimezone: true }),
}, (table) => [
  index("verifications_user_id_idx").on(table.userId),
]);

// Append-only ledger of every verification-relevant state transition.
export const betVerificationEvents = pgTable("bet_verification_events", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  betId: varchar("bet_id").notNull().references(() => bets.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull(),
  version: integer("version").notNull(),
  action: text("action").notNull(), // created | edited | soft_deleted | ots_anchored
  verificationHash: text("verification_hash").notNull(),
  previousHash: text("previous_hash"),
  betDataSnapshot: text("bet_data_snapshot").notNull(),
  eventDate: text("event_date").notNull(),
  eventTimestampUtc: timestamp("event_timestamp_utc", { withTimezone: true }),
  isPreEvent: boolean("is_pre_event").default(true),
  isRetroactive: boolean("is_retroactive").default(false),
  otsProof: bytea("ots_proof"),
  otsAnchoredAt: timestamp("ots_anchored_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  uniqueIndex("verification_events_bet_version_idx").on(table.betId, table.version),
  index("verification_events_bet_id_idx").on(table.betId),
  index("verification_events_user_id_idx").on(table.userId),
]);

export const betsRelations = relations(bets, ({ one }) => ({
  strategy: one(strategies, {
    fields: [bets.strategyId],
    references: [strategies.id],
  }),
}));

export const strategiesRelations = relations(strategies, ({ many }) => ({
  bets: many(bets),
}));

// Validation schemas (for form/API validation)
export const insertBetSchema = createInsertSchema(bets);
export const insertStrategySchema = createInsertSchema(strategies);
export const insertUserConfigSchema = createInsertSchema(userConfigs);
export const insertTransactionSchema = createInsertSchema(transactions);
export const insertTipsterProfileSchema = createInsertSchema(tipsterProfiles);

// Use drizzle's native inferred types for insert operations (avoids drizzle-zod .omit() TS bug)
export type InsertBet = Omit<typeof bets.$inferInsert, "id" | "createdAt">;
export type Bet = typeof bets.$inferSelect;
export type InsertStrategy = Omit<typeof strategies.$inferInsert, "id" | "createdAt">;
export type Strategy = typeof strategies.$inferSelect;
export type InsertUserConfig = Omit<typeof userConfigs.$inferInsert, "id" | "createdAt" | "updatedAt">;
export type UserConfig = typeof userConfigs.$inferSelect;
export type InsertTransaction = Omit<typeof transactions.$inferInsert, "id" | "createdAt">;
export type Transaction = typeof transactions.$inferSelect;
export type InsertTipsterProfile = Omit<typeof tipsterProfiles.$inferInsert, "id" | "createdAt" | "updatedAt">;
export type TipsterProfile = typeof tipsterProfiles.$inferSelect;
export type TipsterFollow = typeof tipsterFollows.$inferSelect;
export type BetVerification = typeof betVerifications.$inferSelect;
export type BetVerificationEvent = typeof betVerificationEvents.$inferSelect;
export type TelegramConfig = typeof telegramConfigs.$inferSelect;
export type InsertTelegramConfig = Omit<typeof telegramConfigs.$inferInsert, "id" | "createdAt" | "updatedAt">;
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = Omit<typeof auditLogs.$inferInsert, "id" | "createdAt">;
