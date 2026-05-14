import { describe, expect, it } from "vitest";
import { getShareVerificationState } from "../share-verification";

describe("getShareVerificationState", () => {
  it("builds a public QR target from a stored verification hash", () => {
    const state = getShareVerificationState({
      verificationHash: "abcdef1234567890abcdef1234567890",
      verificationRecordedAt: "2026-05-01T12:30:00.000Z",
      verificationIsPreEvent: true,
      baseUrl: "http://127.0.0.1:5173/",
    });

    expect(state.hasPublicProof).toBe(true);
    expect(state.proofKind).toBe("pre_event");
    expect(state.proofLabel).toBe("Verificación pre-evento");
    expect(state.verificationCode).toBe("ABCDEF12");
    expect(state.verifyUrl).toBe("http://127.0.0.1:5173/verify?code=ABCDEF12");
    expect(state.verification).toEqual({
      hash: "abcdef1234567890abcdef1234567890",
      timestamp: "2026-05-01T12:30:00.000Z",
      betSnapshot: "",
      isPreEvent: true,
    });
  });

  it("does not mint a fake QR or hash label when the server has no stored proof", () => {
    const state = getShareVerificationState({
      createdAt: "2026-05-01T12:30:00.000Z",
      baseUrl: "http://127.0.0.1:5173",
    });

    expect(state.hasPublicProof).toBe(false);
    expect(state.proofKind).toBe("none");
    expect(state.verification).toBeNull();
    expect(state.verificationCode).toBe("SIN PRUEBA");
    expect(state.verifyUrl).toBe("");
  });

  it("uses the bet creation date as timestamp fallback for real stored hashes", () => {
    const state = getShareVerificationState({
      verificationHash: "1111222233334444",
      verificationIsPreEvent: false,
      createdAt: new Date("2026-04-30T08:15:00.000Z"),
    });

    expect(state.verification?.timestamp).toBe("2026-04-30T08:15:00.000Z");
    expect(state.verification?.isPreEvent).toBe(false);
    expect(state.verificationCode).toBe("11112222");
    expect(state.proofKind).toBe("post_event");
    expect(state.proofLabel).toBe("Registro post-evento");
    expect(state.proofDescription).toContain("no prueba");
  });
});
