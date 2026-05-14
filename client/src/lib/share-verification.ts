import { getShortVerificationCode, type VerificationProof } from "./bet-verification";

export interface ShareVerificationInput {
  verificationHash?: string | null;
  verificationRecordedAt?: string | Date | null;
  verificationIsPreEvent?: boolean | null;
  createdAt?: string | Date | null;
  baseUrl?: string | null;
}

export interface ShareVerificationState {
  verification: VerificationProof | null;
  verificationCode: string;
  verifyUrl: string;
  hasPublicProof: boolean;
  proofKind: "none" | "pre_event" | "post_event";
  proofLabel: string;
  proofShortLabel: string;
  proofDescription: string;
}

function getPublicBaseUrl(baseUrl?: string | null): string {
  const resolvedBaseUrl = baseUrl
    || (typeof window !== "undefined" && window.location.origin)
    || "https://oddsmark.app";

  return resolvedBaseUrl.replace(/\/$/, "");
}

function toIsoTimestamp(value?: string | Date | null): string {
  if (!value) return new Date().toISOString();

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString();

  return date.toISOString();
}

export function getShareVerificationState(input: ShareVerificationInput): ShareVerificationState {
  if (!input.verificationHash) {
    return {
      verification: null,
      verificationCode: "SIN PRUEBA",
      verifyUrl: "",
      hasPublicProof: false,
      proofKind: "none",
      proofLabel: "Sin prueba pública",
      proofShortLabel: "SIN PRUEBA PÚBLICA",
      proofDescription: "Este ticket no tiene un hash público guardado en Oddsmark.",
    };
  }

  const verificationCode = getShortVerificationCode(input.verificationHash);
  const isPreEvent = Boolean(input.verificationIsPreEvent);

  return {
    verification: {
      hash: input.verificationHash,
      timestamp: toIsoTimestamp(input.verificationRecordedAt ?? input.createdAt),
      betSnapshot: "",
      isPreEvent,
    },
    verificationCode,
    verifyUrl: `${getPublicBaseUrl(input.baseUrl)}/verify?code=${verificationCode}`,
    hasPublicProof: true,
    proofKind: isPreEvent ? "pre_event" : "post_event",
    proofLabel: isPreEvent ? "Verificación pre-evento" : "Registro post-evento",
    proofShortLabel: isPreEvent ? "PRUEBA PRE-EVENTO" : "REGISTRO POST-EVENTO",
    proofDescription: isPreEvent
      ? "El hash público indica que el ticket fue registrado antes del evento."
      : "Existe registro público de subida, pero no prueba que el pick fuera previo al evento.",
  };
}
