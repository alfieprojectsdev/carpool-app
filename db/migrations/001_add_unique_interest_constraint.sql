-- Prevent duplicate interests (case-insensitive)
-- This helps prevent race conditions where the same person
-- submits interest multiple times in quick succession

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_interest
ON ride_interests(ride_id, LOWER(interested_name));
