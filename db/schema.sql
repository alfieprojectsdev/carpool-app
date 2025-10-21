-- Carpool App Database Schema (PostgreSQL)

-- Users table
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    contact_method VARCHAR(20) CHECK (contact_method IN ('messenger', 'viber', 'phone', 'telegram')),
    contact_info VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Common locations (makes filtering easier)
CREATE TABLE locations (
    location_id SERIAL PRIMARY KEY,
    location_name VARCHAR(100) UNIQUE NOT NULL,
    location_type VARCHAR(20) CHECK (location_type IN ('residential', 'commercial', 'terminal'))
);

-- Insert common locations from the chat
INSERT INTO locations (location_name, location_type) VALUES
    ('SMDC Phirst Park Homes', 'residential'),
    ('Dau Terminal', 'terminal'),
    ('Cubao', 'terminal'),
    ('BGC', 'commercial'),
    ('Manila', 'commercial'),
    ('AUF/Astro', 'commercial'),
    ('SMDC Cheerful Homes', 'residential');

-- Ride posts (the core feature)
CREATE TABLE ride_posts (
    post_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    post_type VARCHAR(10) CHECK (post_type IN ('offer', 'request')) NOT NULL,
    origin_id INTEGER REFERENCES locations(location_id),
    destination_id INTEGER REFERENCES locations(location_id),
    
    -- Schedule fields
    days_of_week VARCHAR(50)[], -- Array: {'monday', 'tuesday', 'wednesday'}
    departure_time TIME,
    is_recurring BOOLEAN DEFAULT false,
    
    -- Additional info
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for common queries
CREATE INDEX idx_ride_origin ON ride_posts(origin_id);
CREATE INDEX idx_ride_destination ON ride_posts(destination_id);
CREATE INDEX idx_ride_active ON ride_posts(is_active);

-- View: Active rides with readable location names
CREATE VIEW active_rides AS
SELECT 
    rp.post_id,
    u.name,
    u.contact_method,
    u.contact_info,
    rp.post_type,
    loc_origin.location_name AS origin,
    loc_dest.location_name AS destination,
    rp.days_of_week,
    TO_CHAR(rp.departure_time, 'HH12:MI AM') AS departure_time,
    rp.notes,
    rp.created_at
FROM ride_posts rp
JOIN users u ON rp.user_id = u.user_id
LEFT JOIN locations loc_origin ON rp.origin_id = loc_origin.location_id
LEFT JOIN locations loc_dest ON rp.destination_id = loc_dest.location_id
WHERE rp.is_active = true
ORDER BY rp.created_at DESC;

-- Example query: Find rides from Dau to Phirst on Mondays
-- SELECT * FROM active_rides 
-- WHERE origin ILIKE '%dau%' 
--   AND destination ILIKE '%phirst%'
--   AND 'monday' = ANY(days_of_week);