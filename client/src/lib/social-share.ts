/**
 * Social media sharing utilities for bets and tipster profiles
 */
import type { Bet } from "@shared/schema";
import { getShortVerificationCode } from "./bet-verification";
import { calculateBetProfit } from "./bet-calculations";
import { apiRequest } from "./queryClient";

export type PublicProofKind = "none" | "pre_event" | "post_event";

function getPublicBaseUrl(baseUrl?: string): string {
  if (baseUrl) return baseUrl.replace(/\/$/, "");
  if (typeof window !== "undefined" && window.location.origin) return window.location.origin;
  return "https://oddsmark.app";
}

function getStatusEmoji(status: string): string {
  if (status === "won") return "✅";
  if (status === "lost") return "❌";
  if (status === "void") return "➖";
  return "⏳";
}

function escapeTelegramHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function getProofLine(verifyCode?: string, baseUrl?: string, proofKind: PublicProofKind = "none"): string {
  if (!verifyCode) return "Sin prueba pública";
  const url = `${getPublicBaseUrl(baseUrl)}/verify?code=${verifyCode}`;
  if (proofKind === "pre_event") return `Prueba pre-evento → ${url}`;
  return `Registro post-evento → ${url}`;
}

/** Generate tweet text for a bet */
export function generateTweetText(
  bet: Bet,
  result?: number,
  verifyCode?: string,
  baseUrl?: string,
  profitSymbol = "u",
  proofKind: PublicProofKind = verifyCode ? "pre_event" : "none",
): string {
  const statusEmoji = getStatusEmoji(bet.status);
  const profitText = result !== undefined && result !== 0
    ? `${result >= 0 ? "+" : ""}${result.toFixed(2)}${profitSymbol}`
    : "";
  const proofLine = getProofLine(verifyCode, baseUrl, proofKind);

  const lines = [
    `${statusEmoji} ${bet.event}`,
    `${bet.market} @${bet.odds.toFixed(2)}`,
    profitText ? `P&L: ${profitText}` : "",
    ``,
    proofLine,
    `#Oddsmark #${bet.sport.replace(/\s/g, "")}`,
  ].filter(Boolean);

  return lines.join("\n");
}

/** Open Twitter/X share dialog with pre-filled tweet */
export function shareToTwitter(text: string, url?: string) {
  const params = new URLSearchParams({ text });
  if (url) params.set("url", url);
  window.open(`https://twitter.com/intent/tweet?${params.toString()}`, "_blank", "noopener,noreferrer,width=550,height=420");
}

/** Generate Telegram message (HTML format) for a bet */
export function generateTelegramMessage(
  bet: Bet,
  result?: number,
  verificationHash?: string,
  baseUrl?: string,
  profitSymbol = "u",
  proofKind: PublicProofKind = verificationHash ? "pre_event" : "none",
): string {
  const statusEmoji = getStatusEmoji(bet.status);
  const profitText = result !== undefined && result !== 0
    ? `${result >= 0 ? "+" : ""}${result.toFixed(2)}${profitSymbol}`
    : "";

  const hashCode = verificationHash ? getShortVerificationCode(verificationHash) : "";
  const proofLine = getProofLine(hashCode, baseUrl, proofKind);

  return [
    `${statusEmoji} <b>${escapeTelegramHtml(bet.event)}</b>`,
    ``,
    `${escapeTelegramHtml(bet.market)} · <b>@${bet.odds.toFixed(2)}</b>`,
    profitText ? `P&L: <b>${profitText}</b>` : "",
    `${escapeTelegramHtml(bet.sport)} - ${escapeTelegramHtml(bet.league)}`,
    ``,
    escapeTelegramHtml(proofLine),
  ].filter(Boolean).join("\n");
}

/** Generate Instagram-friendly caption */
export function generateInstagramCaption(
  bet: Bet,
  result?: number,
  profitSymbol = "u",
  proofKind: PublicProofKind | boolean = "none",
): string {
  const statusEmoji = getStatusEmoji(bet.status);
  const profitText = result !== undefined && result !== 0
    ? `${result >= 0 ? "+" : ""}${result.toFixed(2)}${profitSymbol}`
    : "";
  const normalizedProofKind: PublicProofKind = typeof proofKind === "boolean"
    ? (proofKind ? "pre_event" : "none")
    : proofKind;
  const proofText = normalizedProofKind === "pre_event"
    ? "Apuesta con prueba pública pre-evento"
    : normalizedProofKind === "post_event"
      ? "Registro público post-evento, sin prueba previa"
      : "Apuesta sin prueba pública";

  return [
    `${statusEmoji} ${bet.event}`,
    ``,
    `${bet.market} @${bet.odds.toFixed(2)}`,
    profitText ? `P&L: ${profitText}` : "",
    ``,
    proofText,
    ``,
    `#Oddsmark #TipsterVerificado #${bet.sport.replace(/\s/g, "")}`,
  ].filter(Boolean).join("\n");
}

/** Send bet to connected Telegram channel */
export async function sendToTelegram(text: string): Promise<boolean> {
  try {
    await apiRequest("POST", "/api/telegram/send", { text, parseMode: "HTML" });
    return true;
  } catch {
    return false;
  }
}

/** Check Telegram connection status */
export async function getTelegramStatus(): Promise<{
  connected: boolean;
  channelName: string | null;
  botUsername: string | null;
}> {
  try {
    const res = await apiRequest("GET", "/api/telegram/status");
    return await res.json();
  } catch {
    return { connected: false, channelName: null, botUsername: null };
  }
}

/** Calculate bet result */
export function calculateBetResult(bet: Bet): number {
  return calculateBetProfit(bet).profit;
}
