CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  date_of_birth TEXT NOT NULL,
  email_verified INTEGER DEFAULT 0,
  verification_token TEXT,
  token_expires_at TEXT,
  session_token TEXT,
  session_expires_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_verification_token ON users(verification_token);
CREATE INDEX IF NOT EXISTS idx_users_session_token ON users(session_token);

-- Saved birth charts (one chart per user+label; 'self' is the primary chart)
CREATE TABLE IF NOT EXISTS charts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  label TEXT NOT NULL DEFAULT 'self',
  birth_year INTEGER NOT NULL,
  birth_month INTEGER NOT NULL,
  birth_day INTEGER NOT NULL,
  hour_branch INTEGER NOT NULL DEFAULT -1,
  gender TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, label),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_charts_user ON charts(user_id);

-- Focused Decision Reading orders (paid one-question written readings)
CREATE TABLE IF NOT EXISTS decision_readings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reference TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  question TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'both',
  birth_year INTEGER,
  birth_month INTEGER,
  birth_day INTEGER,
  birth_hour INTEGER,
  gender TEXT,
  chart_summary TEXT,
  amount_cents INTEGER NOT NULL DEFAULT 4800,
  currency TEXT NOT NULL DEFAULT 'SGD',
  payment_method TEXT NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'pending',
  stripe_session_id TEXT,
  paynow_reference TEXT,
  reading_text TEXT,
  reading_model TEXT,
  reading_generated_at TEXT,
  delivered_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_dr_reference ON decision_readings(reference);
CREATE INDEX IF NOT EXISTS idx_dr_stripe_session ON decision_readings(stripe_session_id);

-- Cached AI daily forecasts: one row per interpretation key per day.
-- Users whose chart facts resolve to the same key share the same text.
CREATE TABLE IF NOT EXISTS daily_forecasts (
  cache_key TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  payload TEXT NOT NULL,
  model TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_daily_forecasts_date ON daily_forecasts(date);
