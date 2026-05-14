/**
 * Server-side security utilities
 */
import crypto from "crypto";
import { db } from "./db";
import { auditLogs } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

// ─── Input Sanitization ───
const DANGEROUS_PATTERNS = [
  /<script\b[^>]*>[\s\S]*?<\/script>/gi,
  /on\w+\s*=\s*["'][^"']*["']/gi,
  /javascript\s*:/gi,
  /data\s*:\s*text\/html/gi,
];

/** Strip dangerous HTML/JS from user input */
export function sanitizeInput(input: string): string {
  let clean = input;
  for (const pattern of DANGEROUS_PATTERNS) {
    clean = clean.replace(pattern, "");
  }
  clean = clean.replace(/</g, "").replace(/>/g, "");
  return clean.trim();
}

/** Sanitize an object's string fields recursively */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const result = { ...obj };
  for (const [key, value] of Object.entries(result)) {
    if (typeof value === "string") {
      (result as Record<string, unknown>)[key] = sanitizeInput(value);
    } else if (Array.isArray(value)) {
      (result as Record<string, unknown>)[key] = value.map((item) => {
        if (typeof item === "string") return sanitizeInput(item);
        if (item && typeof item === "object" && !Array.isArray(item)) {
          return sanitizeObject(item as Record<string, unknown>);
        }
        return item;
      });
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      (result as Record<string, unknown>)[key] = sanitizeObject(value as Record<string, unknown>);
    }
  }
  return result;
}

// ─── Encryption for sensitive data (Telegram tokens etc.) ───
const ALGORITHM = "aes-256-gcm";
let _encryptionKey: Buffer | null = null;
const getEncryptionKey = (): Buffer => {
  if (!_encryptionKey) {
    const secret = process.env.SESSION_SECRET || "default-dev-secret-change-in-prod";
    _encryptionKey = crypto.createHash("sha256").update(secret).digest();
  }
  return _encryptionKey;
};

export function encrypt(text: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

export function decrypt(encrypted: string): string {
  const [ivHex, authTagHex, encryptedText] = encrypted.split(":");
  if (!ivHex || !authTagHex || !encryptedText) throw new Error("Invalid encrypted data");
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encryptedText, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

// ─── Persistent Audit Logger (writes to DB) ───

export interface AuditEntry {
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  ip: string;
  details?: string;
}

/** Log an action to the persistent audit_logs table */
export function logAudit(entry: AuditEntry) {
  // Fire-and-forget: don't block the request, but persist to DB
  db.insert(auditLogs).values({
    userId: entry.userId,
    action: entry.action,
    resource: entry.resource,
    resourceId: entry.resourceId || null,
    ip: entry.ip,
    details: entry.details || null,
  }).catch(err => {
    console.error("Failed to persist audit log:", err);
  });
}

/** Retrieve audit logs from DB */
export async function getAuditLog(userId?: string, limit = 100) {
  if (userId) {
    return db.select().from(auditLogs)
      .where(eq(auditLogs.userId, userId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);
  }
  return db.select().from(auditLogs)
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);
}

/** Extract client IP from request */
export function getClientIp(req: any): string {
  return req.headers["x-forwarded-for"]?.split(",")[0]?.trim()
    || req.connection?.remoteAddress
    || req.ip
    || "unknown";
}
