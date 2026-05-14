-- Safe additive schema patch for a legacy/dev Supabase DB.
-- No DROP, no RENAME, no destructive statements.

CREATE TABLE IF NOT EXISTS strategies (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id varchar NOT NULL,
  name text NOT NULL,
  created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_configs (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id varchar NOT NULL UNIQUE,
  unit_value real DEFAULT 10,
  initial_capital real DEFAULT 0,
  target_bankroll real DEFAULT 0,
  currency text DEFAULT 'units',
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transactions (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id varchar NOT NULL,
  type text NOT NULL,
  amount real NOT NULL,
  date text NOT NULL,
  note text,
  created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tipster_profiles (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id varchar NOT NULL UNIQUE,
  username varchar(30) NOT NULL UNIQUE,
  display_name text NOT NULL,
  bio text,
  avatar_url text,
  is_verified boolean DEFAULT false,
  is_public boolean DEFAULT true,
  telegram_url text,
  twitter_url text,
  instagram_url text,
  youtube_url text,
  main_sport text,
  specialties text,
  total_bets integer DEFAULT 0,
  win_rate real DEFAULT 0,
  yield real DEFAULT 0,
  profit_units real DEFAULT 0,
  avg_odds real DEFAULT 0,
  current_streak integer DEFAULT 0,
  best_streak integer DEFAULT 0,
  monthly_profit real DEFAULT 0,
  followers integer DEFAULT 0,
  verified_since timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tipster_follows (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  follower_id varchar NOT NULL,
  tipster_id varchar NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id varchar NOT NULL,
  action text NOT NULL,
  resource text NOT NULL,
  resource_id varchar,
  ip text NOT NULL DEFAULT 'unknown',
  details text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS telegram_configs (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id varchar NOT NULL UNIQUE,
  bot_token_encrypted text NOT NULL,
  chat_id text NOT NULL,
  channel_name text,
  bot_username text,
  auto_publish boolean DEFAULT false,
  publish_pending boolean DEFAULT true,
  publish_results boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE bets ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;
ALTER TABLE bets ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE bets ADD COLUMN IF NOT EXISTS strategy_id integer;
ALTER TABLE bets ADD COLUMN IF NOT EXISTS event text;
ALTER TABLE bets ADD COLUMN IF NOT EXISTS market text;
ALTER TABLE bets ADD COLUMN IF NOT EXISTS odds real;
ALTER TABLE bets ADD COLUMN IF NOT EXISTS stake real;
ALTER TABLE bets ADD COLUMN IF NOT EXISTS profit real DEFAULT 0;
ALTER TABLE bets ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';
ALTER TABLE bets ADD COLUMN IF NOT EXISTS sport text DEFAULT 'Fútbol';
ALTER TABLE bets ADD COLUMN IF NOT EXISTS league text;
ALTER TABLE bets ADD COLUMN IF NOT EXISTS date text;
ALTER TABLE bets ADD COLUMN IF NOT EXISTS time text;
ALTER TABLE bets ADD COLUMN IF NOT EXISTS bookie text;
ALTER TABLE bets ADD COLUMN IF NOT EXISTS tipster text;
ALTER TABLE bets ADD COLUMN IF NOT EXISTS bet_type text DEFAULT 'simple';
ALTER TABLE bets ADD COLUMN IF NOT EXISTS selections jsonb;
ALTER TABLE bets ADD COLUMN IF NOT EXISTS is_live boolean DEFAULT false;
ALTER TABLE bets ADD COLUMN IF NOT EXISTS is_cashout boolean DEFAULT false;
ALTER TABLE bets ADD COLUMN IF NOT EXISTS cashout_val real;
ALTER TABLE bets ADD COLUMN IF NOT EXISTS current_cashout real;
ALTER TABLE bets ADD COLUMN IF NOT EXISTS is_value boolean DEFAULT false;
ALTER TABLE bets ADD COLUMN IF NOT EXISTS is_parlay boolean DEFAULT false;
ALTER TABLE bets ADD COLUMN IF NOT EXISTS comment text;
ALTER TABLE bets ADD COLUMN IF NOT EXISTS position text;
ALTER TABLE bets ADD COLUMN IF NOT EXISTS formation text;
ALTER TABLE bets ADD COLUMN IF NOT EXISTS player text;
ALTER TABLE bets ADD COLUMN IF NOT EXISTS is_substitute boolean DEFAULT false;
ALTER TABLE bets ADD COLUMN IF NOT EXISTS tactic text;
ALTER TABLE bets ADD COLUMN IF NOT EXISTS tags text;
ALTER TABLE bets ADD COLUMN IF NOT EXISTS market_type text;
ALTER TABLE bets ADD COLUMN IF NOT EXISTS match_side text;
ALTER TABLE bets ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE bets ADD COLUMN IF NOT EXISTS verified boolean DEFAULT false;
ALTER TABLE bets ADD COLUMN IF NOT EXISTS closing_odds real;
ALTER TABLE bets ADD COLUMN IF NOT EXISTS is_long_term boolean DEFAULT false;
ALTER TABLE bets ADD COLUMN IF NOT EXISTS resolution_date text;

CREATE TABLE IF NOT EXISTS bet_verifications (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bet_id varchar NOT NULL UNIQUE,
  user_id varchar NOT NULL,
  verification_hash text NOT NULL UNIQUE,
  bet_data_snapshot text NOT NULL,
  timestamp timestamp with time zone DEFAULT now(),
  event_date text NOT NULL,
  event_timestamp_utc timestamp with time zone,
  is_pre_event boolean DEFAULT true,
  edited_after_creation boolean DEFAULT false,
  original_hash text,
  status text DEFAULT 'verified',
  is_retroactive boolean DEFAULT false,
  retro_evidence_url text,
  ots_proof bytea,
  ots_anchored_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS bet_verification_events (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bet_id varchar NOT NULL,
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

CREATE INDEX IF NOT EXISTS bets_user_id_idx ON bets(user_id);
CREATE INDEX IF NOT EXISTS bets_user_date_idx ON bets(user_id, date);
CREATE INDEX IF NOT EXISTS audit_user_id_idx ON audit_logs(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS follows_unique_idx ON tipster_follows(follower_id, tipster_id);
CREATE INDEX IF NOT EXISTS follows_tipster_idx ON tipster_follows(tipster_id);
CREATE INDEX IF NOT EXISTS verifications_user_id_idx ON bet_verifications(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS verification_events_bet_version_idx ON bet_verification_events(bet_id, version);
CREATE INDEX IF NOT EXISTS verification_events_bet_id_idx ON bet_verification_events(bet_id);
CREATE INDEX IF NOT EXISTS verification_events_user_id_idx ON bet_verification_events(user_id);
