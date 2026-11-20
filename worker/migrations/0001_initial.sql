CREATE TABLE IF NOT EXISTS users (
  user_sub TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_state (
  user_sub TEXT PRIMARY KEY REFERENCES users(user_sub) ON DELETE CASCADE,
  revision INTEGER NOT NULL DEFAULT 0,
  payload_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_usage (
  user_sub TEXT NOT NULL REFERENCES users(user_sub) ON DELETE CASCADE,
  usage_date TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_sub, usage_date)
);

CREATE TABLE IF NOT EXISTS place_watches (
  id TEXT PRIMARY KEY,
  user_sub TEXT NOT NULL REFERENCES users(user_sub) ON DELETE CASCADE,
  place_id TEXT NOT NULL,
  place_name TEXT NOT NULL,
  snapshot_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  last_change INTEGER,
  UNIQUE (user_sub, place_id)
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  user_sub TEXT NOT NULL REFERENCES users(user_sub) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sent_reminders (
  reminder_key TEXT PRIMARY KEY,
  sent_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_watches_user ON place_watches(user_sub);
CREATE INDEX IF NOT EXISTS idx_watches_created ON place_watches(created_at);
CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions(user_sub);
CREATE INDEX IF NOT EXISTS idx_sync_updated ON sync_state(updated_at);