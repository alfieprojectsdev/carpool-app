-- Carpool board schema (Neon / PostgreSQL). Greenfield as of 2026-09-26:
-- the previous database was a Render free-tier instance, which Render deletes
-- 30 days after creation, so there is no data to migrate.
-- Safe to re-run: every statement is IF NOT EXISTS / OR REPLACE / ON CONFLICT.

-- People who post rides. One row per post; there are no accounts.
CREATE TABLE IF NOT EXISTS users (
  user_id        SERIAL PRIMARY KEY,
  name           VARCHAR(100) NOT NULL CHECK (char_length(btrim(name)) > 0),
  contact_method VARCHAR(20)  NOT NULL CHECK (contact_method IN ('messenger', 'viber', 'phone', 'telegram')),
  contact_info   VARCHAR(100) NOT NULL CHECK (char_length(btrim(contact_info)) > 0),
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS locations (
  location_id   SERIAL PRIMARY KEY,
  location_name VARCHAR(100) NOT NULL CHECK (char_length(btrim(location_name)) > 0),
  location_type VARCHAR(20)  NOT NULL DEFAULT 'commercial'
                CHECK (location_type IN ('residential', 'commercial', 'terminal')),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Case-insensitive uniqueness ("Dau Terminal" = "dau terminal").
CREATE UNIQUE INDEX IF NOT EXISTS idx_locations_name_lower ON locations (LOWER(location_name));

INSERT INTO locations (location_name, location_type) VALUES
  ('Phirst Park Homes', 'residential'),
  ('Dau Terminal', 'terminal'),
  ('Cubao', 'terminal'),
  ('BGC', 'commercial'),
  ('Manila', 'commercial'),
  ('AUF', 'commercial'),
  ('Astro', 'commercial'),
  ('SMDC Cheerful Homes', 'residential')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS ride_posts (
  post_id           SERIAL PRIMARY KEY,
  user_id           INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  post_type         VARCHAR(10) NOT NULL CHECK (post_type IN ('offer', 'request')),
  origin_id         INTEGER NOT NULL REFERENCES locations(location_id),
  destination_id    INTEGER NOT NULL REFERENCES locations(location_id),
  days_of_week      VARCHAR(10)[] NOT NULL,
  departure_time    TIME,
  notes             VARCHAR(500),
  vehicle_model     VARCHAR(100),
  available_seats   INTEGER CHECK (available_seats BETWEEN 1 AND 10),
  -- sha256 of the poster's manage token; the token itself is never stored.
  manage_token_hash CHAR(64) NOT NULL,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  -- Posts drop off the board after 60 days unless the poster renews them.
  expires_at        TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '60 days',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT different_endpoints CHECK (origin_id <> destination_id),
  CONSTRAINT valid_days CHECK (
    cardinality(days_of_week) BETWEEN 1 AND 7
    AND days_of_week <@ ARRAY['monday','tuesday','wednesday','thursday','friday','saturday','sunday']::VARCHAR(10)[]
  )
);

CREATE INDEX IF NOT EXISTS idx_rides_active ON ride_posts (expires_at) WHERE is_active;

CREATE TABLE IF NOT EXISTS ride_interests (
  interest_id     SERIAL PRIMARY KEY,
  ride_id         INTEGER NOT NULL REFERENCES ride_posts(post_id) ON DELETE CASCADE,
  interested_name VARCHAR(100) NOT NULL CHECK (char_length(btrim(interested_name)) > 0),
  contact_method  VARCHAR(20)  NOT NULL CHECK (contact_method IN ('messenger', 'viber', 'phone', 'telegram')),
  contact_info    VARCHAR(100) NOT NULL CHECK (char_length(btrim(contact_info)) > 0),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_interest ON ride_interests (ride_id, LOWER(interested_name));

CREATE OR REPLACE VIEW active_rides AS
SELECT
  rp.post_id,
  rp.post_type,
  u.name,
  u.contact_method,
  u.contact_info,
  o.location_name AS origin,
  d.location_name AS destination,
  rp.days_of_week,
  TO_CHAR(rp.departure_time, 'HH24:MI') AS departure_time,
  rp.notes,
  rp.vehicle_model,
  rp.available_seats,
  rp.created_at,
  rp.expires_at
FROM ride_posts rp
JOIN users u ON u.user_id = rp.user_id
JOIN locations o ON o.location_id = rp.origin_id
JOIN locations d ON d.location_id = rp.destination_id
WHERE rp.is_active AND rp.expires_at > NOW();

-- Per-IP counters for posting, interest, passcode attempts and feedback.
-- Stored in Postgres because serverless instances share nothing in memory.
CREATE TABLE IF NOT EXISTS rate_limits (
  key          VARCHAR(200) PRIMARY KEY,
  count        INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- "Feedback" button submissions.
CREATE TABLE IF NOT EXISTS feedback (
  id         BIGSERIAL PRIMARY KEY,
  kind       VARCHAR(20) NOT NULL DEFAULT 'other' CHECK (kind IN ('problem', 'idea', 'other')),
  message    TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 2000),
  contact    VARCHAR(200),
  page       VARCHAR(300),
  user_agent VARCHAR(300),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
