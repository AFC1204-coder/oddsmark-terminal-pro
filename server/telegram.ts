/**
 * Telegram Bot Integration
 *
 * Oddsmark acts as the verification layer for Telegram tipster channels.
 * - Tipsters connect their bot + channel
 * - Picks get auto-published with verification links
 * - Results get auto-published when bets resolve
 */
import type { Express } from "express";
import type { Bet } from "@shared/schema";
import { z } from "zod";
import { encrypt, decrypt, logAudit, getClientIp, sanitizeObject } from "./security";
import { storage } from "./storage";

const telegramConfigSchema = z.object({
  botToken: z.string()
    .trim()
    .min(20, "Token de Telegram demasiado corto")
    .max(120, "Token de Telegram demasiado largo")
    .regex(/^\d+:[A-Za-z0-9_-]+$/, "Formato de token de Telegram no válido"),
  chatId: z.string()
    .trim()
    .min(1, "Chat ID requerido")
    .max(80, "Chat ID demasiado largo")
    .regex(/^-?\d+$|^@[A-Za-z0-9_]{5,}$/, "Formato de Chat ID no válido"),
  channelName: z.string().trim().max(80, "Nombre de canal demasiado largo").optional().nullable(),
  autoPublish: z.boolean().optional(),
  publishPending: z.boolean().optional(),
  publishResults: z.boolean().optional(),
});

const telegramSettingsSchema = z.object({
  autoPublish: z.boolean().optional(),
  publishPending: z.boolean().optional(),
  publishResults: z.boolean().optional(),
});

const telegramSendSchema = z.object({
  text: z.string().trim().min(1, "Mensaje vacío").max(4096, "Mensaje demasiado largo"),
  parseMode: z.enum(["HTML", "MarkdownV2"]).optional().default("HTML"),
});

export function registerTelegramRoutes(app: Express, isAuthenticated: any) {
  // Save / update Telegram config
  app.post("/api/telegram/config", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { botToken, chatId, channelName, autoPublish, publishPending, publishResults } =
        telegramConfigSchema.parse(sanitizeObject(req.body));

      // Verify the bot token works
      const verifyController = new AbortController();
      const verifyTimeout = setTimeout(() => verifyController.abort(), 10_000);
      const verifyRes = await fetch(`https://api.telegram.org/bot${botToken}/getMe`, { signal: verifyController.signal });
      clearTimeout(verifyTimeout);
      const verifyData = await verifyRes.json() as { ok: boolean; result?: { username: string } };

      if (!verifyData.ok) {
        return res.status(400).json({ message: "Invalid bot token" });
      }

      await storage.upsertTelegramConfig({
        userId,
        botTokenEncrypted: encrypt(botToken),
        chatId,
        channelName: channelName || null,
        botUsername: verifyData.result?.username || null,
        autoPublish: autoPublish ?? false,
        publishPending: publishPending ?? true,
        publishResults: publishResults ?? true,
      });

      logAudit({ userId, action: "CONNECT", resource: "telegram", ip: getClientIp(req) });

      res.json({
        success: true,
        botUsername: verifyData.result?.username,
        channelName,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0]?.message || "Configuración de Telegram no válida", errors: error.errors });
      }
      console.error("Telegram config error:", error);
      res.status(500).json({ message: "Failed to configure Telegram" });
    }
  });

  // Update auto-publish settings only (no token re-validation)
  app.patch("/api/telegram/config", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const config = await storage.getTelegramConfig(userId);
      if (!config) {
        return res.status(404).json({ message: "Telegram not configured" });
      }

      const { autoPublish, publishPending, publishResults } = telegramSettingsSchema.parse(req.body);
      await storage.upsertTelegramConfig({
        userId,
        botTokenEncrypted: config.botTokenEncrypted,
        chatId: config.chatId,
        channelName: config.channelName,
        botUsername: config.botUsername,
        autoPublish: autoPublish ?? config.autoPublish,
        publishPending: publishPending ?? config.publishPending,
        publishResults: publishResults ?? config.publishResults,
      });

      res.json({ success: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0]?.message || "Ajustes de Telegram no válidos", errors: error.errors });
      }
      console.error("Telegram config update error:", error);
      res.status(500).json({ message: "Failed to update config" });
    }
  });

  // Send a message to Telegram channel
  app.post("/api/telegram/send", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const config = await storage.getTelegramConfig(userId);

      if (!config) {
        return res.status(400).json({ message: "Telegram not configured. Go to Settings to connect." });
      }

      const { text, parseMode } = telegramSendSchema.parse(req.body);
      const decryptedToken = decrypt(config.botTokenEncrypted);

      const ok = await sendTelegramMessage(decryptedToken, config.chatId, text, parseMode);
      if (!ok) {
        return res.status(400).json({ message: "Failed to send to Telegram" });
      }

      res.json({ success: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0]?.message || "Mensaje de Telegram no válido", errors: error.errors });
      }
      console.error("Telegram send error:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  // Check connection status
  app.get("/api/telegram/status", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const config = await storage.getTelegramConfig(userId);
    res.json({
      connected: !!config,
      channelName: config?.channelName || null,
      botUsername: config?.botUsername || null,
      autoPublish: config?.autoPublish || false,
      publishPending: config?.publishPending ?? true,
      publishResults: config?.publishResults ?? true,
    });
  });

  // Disconnect Telegram
  app.delete("/api/telegram/config", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      if (req.header("X-Confirm-Action") !== "disconnect-telegram") {
        return res.status(428).json({
          message: "Explicit confirmation required to disconnect Telegram",
        });
      }
      await storage.deleteTelegramConfig(userId);
      logAudit({ userId, action: "DISCONNECT", resource: "telegram", ip: getClientIp(req) });
      res.json({ success: true });
    } catch (error) {
      console.error("Telegram disconnect error:", error);
      res.status(500).json({ message: "Failed to disconnect" });
    }
  });
}

// ─── Auto-publish helpers (called from routes.ts) ───

/**
 * Auto-publish a new pick to the tipster's Telegram channel.
 * Called after bet creation if autoPublish + publishPending are enabled.
 */
export async function autoPublishNewPick(userId: string, bet: Bet, verificationCode: string) {
  try {
    const config = await storage.getTelegramConfig(userId);
    if (!config?.autoPublish || !config?.publishPending) return;

    const token = decrypt(config.botTokenEncrypted);
    const appUrl = process.env.APP_URL || "https://oddsmark.app";
    const verifyUrl = `${appUrl}/verify?code=${verificationCode}`;

    const lines = [
      `<b>NUEVA APUESTA</b>`,
      ``,
      `<b>${escHtml(bet.event)}</b>`,
      `${escHtml(bet.market)} · <b>@${bet.odds.toFixed(2)}</b>`,
      `Stake: ${bet.stake}u`,
      `${escHtml(bet.sport)} — ${escHtml(bet.league)}`,
      bet.isLive ? `EN VIVO` : ``,
      ``,
      `<a href="${verifyUrl}">Verificar apuesta</a>`,
    ].filter(Boolean).join("\n");

    await sendTelegramMessage(token, config.chatId, lines, "HTML");
  } catch (error) {
    console.error("Auto-publish new pick failed:", error);
  }
}

/**
 * Auto-publish bet result to the tipster's Telegram channel.
 * Called when a bet status changes to won/lost/void.
 */
export async function autoPublishResult(userId: string, bet: Bet, verificationCode: string) {
  try {
    const config = await storage.getTelegramConfig(userId);
    if (!config?.autoPublish || !config?.publishResults) return;

    const token = decrypt(config.botTokenEncrypted);
    const appUrl = process.env.APP_URL || "https://oddsmark.app";
    const verifyUrl = `${appUrl}/verify?code=${verificationCode}`;

    const statusEmoji = bet.status === "won" ? "GREEN" : bet.status === "lost" ? "RED" : "VOID";
    const statusLabel = bet.status === "won" ? "GANADA" : bet.status === "lost" ? "PERDIDA" : "ANULADA";

    let profitText = "";
    if (bet.status === "won") {
      const profit = bet.isCashout && bet.cashoutVal
        ? bet.cashoutVal - bet.stake
        : bet.stake * (bet.odds - 1);
      profitText = `+${profit.toFixed(2)}u`;
    } else if (bet.status === "lost") {
      const loss = bet.isCashout && bet.cashoutVal
        ? bet.cashoutVal - bet.stake
        : -bet.stake;
      profitText = `${loss.toFixed(2)}u`;
    }

    const lines = [
      `${statusEmoji} <b>${statusLabel}</b>`,
      ``,
      `<b>${escHtml(bet.event)}</b>`,
      `${escHtml(bet.market)} · @${bet.odds.toFixed(2)}`,
      profitText ? `P&L: <b>${profitText}</b>` : "",
      ``,
      `<a href="${verifyUrl}">Verificar</a>`,
    ].filter(Boolean).join("\n");

    await sendTelegramMessage(token, config.chatId, lines, "HTML");
  } catch (error) {
    console.error("Auto-publish result failed:", error);
  }
}

// ─── Internal helpers ───

async function sendTelegramMessage(
  token: string,
  chatId: string,
  text: string,
  parseMode: string = "HTML"
): Promise<boolean> {
  try {
    // 10-second timeout to prevent hanging the server
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode,
        disable_web_page_preview: false,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const result = await res.json() as { ok: boolean; error_code?: number; description?: string };
    if (!result.ok) {
      console.error(`Telegram API error ${result.error_code}: ${result.description}`);
      return false;
    }
    return true;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.error("Telegram send timed out (10s)");
    } else {
      console.error("Telegram send error:", error);
    }
    return false;
  }
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
