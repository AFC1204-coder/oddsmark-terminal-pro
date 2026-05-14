/**
 * OpenTimestamps anchoring helper.
 *
 * Takes a SHA-256 bet verification hash and asks a public OTS calendar server
 * to stamp it, returning the binary `.ots` proof file (bytes) so we can
 * persist it next to the verification row.
 *
 * Design notes:
 * - Bet creation MUST NOT fail if the calendar is offline. If the stamp call
 *   fails or times out, `anchorHashToOts` resolves to `null`, and the caller
 *   persists the verification without a proof (to be back-filled later).
 * - The hash fed to OTS is deterministic: it is exactly the same SHA-256 we
 *   already compute for `verification_hash`, so anyone can independently
 *   re-derive it from the public snapshot and verify the anchor.
 * - The opentimestamps lib is CJS. Runtime can be ESM (`tsx` in dev) or CJS
 *   (production bundle), so module loading must support both.
 */

/* eslint-disable @typescript-eslint/no-var-requires, @typescript-eslint/no-explicit-any */
import { createRequire } from "node:module";

const runtimeRequire: NodeRequire = typeof require === "function"
  ? require
  : createRequire(import.meta.url);

let OpenTimestamps: any;
let DetachedTimestampFile: any;
let Ops: any;
try {
  OpenTimestamps = runtimeRequire("opentimestamps");
  DetachedTimestampFile = runtimeRequire("opentimestamps/src/detached-timestamp-file.js");
  Ops = runtimeRequire("opentimestamps/src/ops.js");
} catch (err) {
  console.warn("[ots] opentimestamps lib unavailable:", (err as Error).message);
}
/* eslint-enable @typescript-eslint/no-var-requires, @typescript-eslint/no-explicit-any */

export interface OtsAnchorResult {
  /** Raw `.ots` proof bytes (binary). `null` when the calendar was unreachable. */
  proof: Buffer | null;
  /** `true` if we got a proof, `false` if we fell back. */
  ok: boolean;
  /** Error message if anchoring failed. */
  error?: string;
}

const DEFAULT_TIMEOUT_MS = 5000;

/**
 * Ask public OpenTimestamps calendars to anchor a SHA-256 hash.
 *
 * @param hashHex  Lowercase hex SHA-256 digest (64 chars). This is the bet's
 *                 `verificationHash` — the same value used for the short code.
 * @param opts.timeoutMs  Abort the calendar call after this many ms (default 5000).
 * @param opts.calendars  Override the calendar URL list (useful for tests).
 * @param opts.minAttestations  Minimum attestations required to consider the
 *   proof valid (default 1). Set to 2+ to require a quorum across independent
 *   operators (defends against a single calendar colluding with the user).
 */
export async function anchorHashToOts(
  hashHex: string,
  opts: { timeoutMs?: number; calendars?: string[]; minAttestations?: number } = {},
): Promise<OtsAnchorResult> {
  if (!/^[a-f0-9]{64}$/i.test(hashHex)) {
    return { proof: null, ok: false, error: "invalid sha256 hex" };
  }
  if (!OpenTimestamps || !DetachedTimestampFile || !Ops) {
    return { proof: null, ok: false, error: "opentimestamps lib unavailable" };
  }

  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const hashBytes = Buffer.from(hashHex.toLowerCase(), "hex");

  try {
    const detached = DetachedTimestampFile.fromHash(new Ops.OpSHA256(), hashBytes);

    // Race the stamp operation against a timeout so a dead calendar never
    // blocks bet creation.
    const stampPromise: Promise<void> = OpenTimestamps.stamp(
      detached,
      opts.calendars ? { calendars: opts.calendars, m: 1 } : {},
    );

    let timer: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("ots calendar timeout")), timeoutMs);
    });

    try {
      await Promise.race([stampPromise, timeoutPromise]);
    } finally {
      if (timer) clearTimeout(timer);
    }

    // The library's `stamp()` swallows individual calendar failures via
    // `softFail`, so it can resolve successfully even when every calendar was
    // unreachable. In that case no PendingAttestation is attached to the
    // timestamp tree, and the resulting bytes do not constitute a real proof.
    // Treat that as a failure so the caller can persist NULL and back-fill later.
    const attestations = detached.timestamp?.getAttestations?.();
    const minAttestations = Math.max(1, opts.minAttestations ?? 1);
    if (!attestations || attestations.size < minAttestations) {
      return {
        proof: null,
        ok: false,
        error: `insufficient calendar attestations: got ${attestations?.size ?? 0}, need ${minAttestations}`,
      };
    }

    const bytes: Uint8Array | number[] = detached.serializeToBytes();
    const proof = Buffer.from(bytes as Uint8Array);
    if (proof.length === 0) {
      return { proof: null, ok: false, error: "empty proof" };
    }
    return { proof, ok: true };
  } catch (err) {
    return { proof: null, ok: false, error: (err as Error).message || "ots stamp failed" };
  }
}
