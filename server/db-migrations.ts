/**
 * Idempotent runtime migrations — installed once per server boot.
 *
 * Drizzle's `db:push` handles schema, but it does not install triggers or
 * functions. This module holds raw SQL that must execute after the schema is
 * present, and is safe to run repeatedly (CREATE OR REPLACE / IF NOT EXISTS).
 */
import { pool } from "./db";

const BET_VERIFICATION_EVENTS_LEDGER = `
CREATE TABLE IF NOT EXISTS bet_verification_events (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bet_id varchar NOT NULL REFERENCES bets(id) ON DELETE CASCADE,
  user_id varchar NOT NULL,
  version integer NOT NULL,
  action text NOT NULL,
  verification_hash text NOT NULL,
  previous_hash text,
  bet_data_snapshot text NOT NULL,
  event_date text NOT NULL,
  event_timestamp_utc timestamp with time zone,
  is_pre_event boolean DEFAULT true,
  is_retroactive boolean DEFAULT false,
  ots_proof bytea,
  ots_anchored_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS verification_events_bet_version_idx
  ON bet_verification_events (bet_id, version);
CREATE INDEX IF NOT EXISTS verification_events_bet_id_idx
  ON bet_verification_events (bet_id);
CREATE INDEX IF NOT EXISTS verification_events_user_id_idx
  ON bet_verification_events (user_id);

INSERT INTO bet_verification_events (
  bet_id,
  user_id,
  version,
  action,
  verification_hash,
  previous_hash,
  bet_data_snapshot,
  event_date,
  event_timestamp_utc,
  is_pre_event,
  is_retroactive,
  ots_proof,
  ots_anchored_at,
  created_at
)
SELECT
  v.bet_id,
  v.user_id,
  1,
  'created',
  v.verification_hash,
  NULL,
  v.bet_data_snapshot,
  v.event_date,
  v.event_timestamp_utc,
  coalesce(v.is_pre_event, true),
  coalesce(v.is_retroactive, false),
  v.ots_proof,
  v.ots_anchored_at,
  coalesce(v.timestamp, now())
FROM bet_verifications v
WHERE NOT EXISTS (
  SELECT 1 FROM bet_verification_events e WHERE e.bet_id = v.bet_id
);
`;

/**
 * Protect `bet_verifications` rows from silent tampering.
 *
 * Once a row is persisted, the following columns are immutable:
 *  - verification_hash, bet_data_snapshot  (the cryptographic core)
 *  - ots_proof, ots_anchored_at            (the external anchor)
 *  - is_retroactive                        (the server's honest labelling)
 *
 * Legitimate transitions still work:
 *  - `replaceVerification` (edit flow) DELETEs the old row via upsert's
 *    conflict branch — which UPDATEs the same row. To allow that, the trigger
 *    permits hash+snapshot+proof updates ONLY when the new status transitions
 *    to 'edited' or when the row is the brand new one (OLD.status is already
 *    'edited' or we are clearing the proof alongside the hash change).
 *  - The back-fill job calls `setOtsProof(...)` which fills ots_proof from
 *    NULL → value. That is allowed.
 *
 * Anything else (DBA typing into psql, a compromised service account flipping
 * a single field) raises an exception and rolls back the transaction.
 */
const BET_VERIFICATIONS_IMMUTABILITY_TRIGGER = `
CREATE OR REPLACE FUNCTION bet_verifications_guard()
RETURNS trigger AS $$
BEGIN
  -- Allow NULL → value back-fill of the OTS proof (calendar was offline).
  IF OLD.ots_proof IS NULL
     AND NEW.ots_proof IS NOT NULL
     AND NEW.verification_hash = OLD.verification_hash
     AND NEW.bet_data_snapshot = OLD.bet_data_snapshot THEN
    RETURN NEW;
  END IF;

  -- Allow hash regeneration on edit: the new row must carry a different hash,
  -- a fresh snapshot, status 'edited', and a NULL (cleared) proof.
  IF NEW.verification_hash <> OLD.verification_hash THEN
    IF NEW.status = 'edited' AND NEW.ots_proof IS NULL THEN
      -- Immutable fields that survive an edit:
      IF NEW.is_retroactive IS DISTINCT FROM OLD.is_retroactive THEN
        RAISE EXCEPTION 'bet_verifications: is_retroactive is immutable (was %)', OLD.is_retroactive;
      END IF;
      RETURN NEW;
    ELSE
      RAISE EXCEPTION 'bet_verifications: hash change requires status=edited and ots_proof=NULL';
    END IF;
  END IF;

  -- Hash unchanged: snapshot + proof + retroactive flag must also be unchanged.
  IF NEW.bet_data_snapshot <> OLD.bet_data_snapshot THEN
    RAISE EXCEPTION 'bet_verifications: bet_data_snapshot is immutable when hash is unchanged';
  END IF;
  IF NEW.is_retroactive IS DISTINCT FROM OLD.is_retroactive THEN
    RAISE EXCEPTION 'bet_verifications: is_retroactive is immutable';
  END IF;
  IF OLD.ots_proof IS NOT NULL AND NEW.ots_proof IS DISTINCT FROM OLD.ots_proof THEN
    RAISE EXCEPTION 'bet_verifications: ots_proof cannot be overwritten once set';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS bet_verifications_guard_trg ON bet_verifications;
CREATE TRIGGER bet_verifications_guard_trg
  BEFORE UPDATE ON bet_verifications
  FOR EACH ROW
  EXECUTE FUNCTION bet_verifications_guard();
`;

// Unique advisory lock id for the runtime-migrations routine. Chosen as a
// stable constant so every app instance contends for the same slot. Range
// check: Postgres accepts any int8, we use a positive 32-bit value.
const RUNTIME_MIGRATIONS_LOCK_ID = 728491;

export async function runRuntimeMigrations(): Promise<void> {
  const client = await pool.connect();
  let lockAcquired = false;
  try {
    // Serialize DDL across simultaneous boots (HA multi-pod). Without the
    // advisory lock, two pods can race between DROP TRIGGER and CREATE
    // TRIGGER, briefly exposing a window where the immutability guard is
    // absent and a concurrent UPDATE could slip through.
    await client.query("SELECT pg_advisory_lock($1)", [RUNTIME_MIGRATIONS_LOCK_ID]);
    lockAcquired = true;
    await client.query(BET_VERIFICATION_EVENTS_LEDGER);
    await client.query(BET_VERIFICATIONS_IMMUTABILITY_TRIGGER);
    console.log("[migrations] verification ledger and guard installed");
  } catch (err) {
    // Non-fatal: if the table doesn't exist yet (fresh install before db:push),
    // skip. Startup should not crash because of a trigger.
    console.warn("[migrations] trigger install skipped:", (err as Error).message);
  } finally {
    if (lockAcquired) {
      await client.query("SELECT pg_advisory_unlock($1)", [RUNTIME_MIGRATIONS_LOCK_ID]).catch(() => {});
    }
    client.release();
  }
}
