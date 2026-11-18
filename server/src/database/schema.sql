-- Hue & Seek database schema (PostgreSQL 14+). Applied idempotently at server start.

CREATE TABLE IF NOT EXISTS players (
  id              TEXT PRIMARY KEY,
  display_name    TEXT NOT NULL,
  tag             TEXT NOT NULL,
  username        TEXT UNIQUE,
  password_hash   TEXT,
  xp              INTEGER NOT NULL DEFAULT 0,
  coins           INTEGER NOT NULL DEFAULT 150,
  cosmetics       JSONB NOT NULL DEFAULT '{}'::jsonb,
  owned_items     JSONB NOT NULL DEFAULT '[]'::jsonb,
  matches_played  INTEGER NOT NULL DEFAULT 0,
  wins            INTEGER NOT NULL DEFAULT 0,
  finds           INTEGER NOT NULL DEFAULT 0,
  escapes         INTEGER NOT NULL DEFAULT 0,
  escape_streak   INTEGER NOT NULL DEFAULT 0,
  times_caught    INTEGER NOT NULL DEFAULT 0,
  rounds_hider    INTEGER NOT NULL DEFAULT 0,
  rounds_seeker   INTEGER NOT NULL DEFAULT 0,
  best_survival_ms INTEGER NOT NULL DEFAULT 0,
  decoys_fooled   INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS players_name_tag ON players (lower(display_name), tag);
CREATE INDEX IF NOT EXISTS players_xp ON players (xp DESC);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash  TEXT PRIMARY KEY,
  player_id   TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_player ON sessions (player_id);

CREATE TABLE IF NOT EXISTS matches (
  id          TEXT PRIMARY KEY,
  room_code   TEXT NOT NULL,
  map_id      TEXT NOT NULL,
  mode        TEXT NOT NULL,
  winner      TEXT NOT NULL,
  started_at  TIMESTAMPTZ NOT NULL,
  ended_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  summary     JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- One row per (match, player): the primary key prevents duplicate rewards.
CREATE TABLE IF NOT EXISTS match_players (
  match_id     TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id    TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  team         TEXT NOT NULL,
  score        INTEGER NOT NULL DEFAULT 0,
  finds        INTEGER NOT NULL DEFAULT 0,
  survived_ms  INTEGER NOT NULL DEFAULT 0,
  caught       BOOLEAN NOT NULL DEFAULT false,
  won          BOOLEAN NOT NULL DEFAULT false,
  xp_earned    INTEGER NOT NULL DEFAULT 0,
  coins_earned INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (match_id, player_id)
);
CREATE INDEX IF NOT EXISTS match_players_player ON match_players (player_id, created_at DESC);

CREATE TABLE IF NOT EXISTS player_achievements (
  player_id      TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL,
  unlocked_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, achievement_id)
);

CREATE TABLE IF NOT EXISTS daily_missions (
  player_id  TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  day        TEXT NOT NULL,
  mission_id TEXT NOT NULL,
  progress   INTEGER NOT NULL DEFAULT 0,
  completed  BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (player_id, day, mission_id)
);

CREATE TABLE IF NOT EXISTS friendships (
  requester  TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  addressee  TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  status     TEXT NOT NULL CHECK (status IN ('pending', 'accepted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (requester, addressee)
);
CREATE INDEX IF NOT EXISTS friendships_addressee ON friendships (addressee);
