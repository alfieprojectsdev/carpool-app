-- db/schema.sql
-- Carpool App Database Schema (PostgreSQL)
-- Enhanced with multi-community support

-- ============================================
-- COMMUNITIES TABLE (NEW)
-- ============================================
CREATE TABLE communities (
    community_code VARCHAR(20) PRIMARY KEY,
    community_name VARCHAR(100) NOT NULL,
    location VARCHAR(100),
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- USERS TABLE (MODIFIED)
-- ============================================
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    community_code VARCHAR(20) NOT NULL REFERENCES communities(community_code) ON DELETE RESTRICT,
    name VARCHAR(100) NOT NULL,
    contact_method VARCHAR(20) CHECK (contact_method IN ('messenger', 'viber', 'phone', 'telegram')),
    contact_info VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure one user per contact_info per community
    CONSTRAINT unique_user_per_community UNIQUE (community_code, contact_info)
);

-- ============================================
-- LOCATIONS TABLE (MODIFIED)
-- ============================================
-- Locations are now community-specific
CREATE TABLE locations (
    location_id SERIAL PRIMARY KEY,
    community_code VARCHAR(20) NOT NULL REFERENCES communities(community_code) ON DELETE CASCADE,
    location_name VARCHAR(100) NOT NULL,
    location_type VARCHAR(20) CHECK (location_type IN ('residential', 'commercial', 'terminal')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure unique location names within each community
    CONSTRAINT unique_location_per_community UNIQUE (community_code, location_name)
);

-- ============================================
-- RIDE POSTS TABLE (MODIFIED)
-- ============================================
CREATE TABLE ride_posts (
    post_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    community_code VARCHAR(20) NOT NULL REFERENCES communities(community_code) ON DELETE RESTRICT,
    post_type VARCHAR(10) CHECK (post_type IN ('offer', 'request')) NOT NULL,
    origin_id INTEGER REFERENCES locations(location_id),
    destination_id INTEGER REFERENCES locations(location_id),
    
    -- Schedule fields
    days_of_week VARCHAR(50)[], -- Array: {'monday', 'tuesday', 'wednesday'}
    departure_time TIME,
    is_recurring BOOLEAN DEFAULT false,
    
    -- Additional info
    notes TEXT,
    vehicle_model VARCHAR(100),
    available_seats INTEGER CHECK (available_seats BETWEEN 1 AND 10),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure ride's community matches user's community
    CONSTRAINT ride_matches_user_community 
        CHECK (community_code = (SELECT community_code FROM users WHERE user_id = ride_posts.user_id))
);

-- ============================================
-- RIDE INTERESTS TABLE (MODIFIED)
-- ============================================
CREATE TABLE ride_interests (
    interest_id SERIAL PRIMARY KEY,
    ride_id INTEGER REFERENCES ride_posts(post_id) ON DELETE CASCADE,
    community_code VARCHAR(20) NOT NULL REFERENCES communities(community_code) ON DELETE RESTRICT,
    interested_name VARCHAR(100) NOT NULL,
    contact_method VARCHAR(20) CHECK (contact_method IN ('messenger', 'viber', 'phone', 'telegram')),
    contact_info VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Prevent duplicate interests from same person on same ride
    CONSTRAINT unique_interest_per_ride UNIQUE (ride_id, contact_info)
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX idx_users_community ON users(community_code);
CREATE INDEX idx_locations_community ON locations(community_code);
CREATE INDEX idx_rides_community ON ride_posts(community_code);
CREATE INDEX idx_rides_active ON ride_posts(is_active) WHERE is_active = true;
CREATE INDEX idx_rides_community_active ON ride_posts(community_code, is_active) WHERE is_active = true;
CREATE INDEX idx_interests_ride ON ride_interests(ride_id);

-- ============================================
-- VIEWS (UPDATED)
-- ============================================
-- Active rides with full details (community-aware)
CREATE OR REPLACE VIEW active_rides AS
SELECT 
    rp.post_id,
    rp.community_code,
    rp.post_type,
    rp.days_of_week,
    rp.departure_time,
    rp.notes,
    rp.vehicle_model,
    rp.available_seats,
    rp.created_at,
    u.name,
    u.contact_method,
    u.contact_info,
    origin.location_name AS origin,
    dest.location_name AS destination
FROM ride_posts rp
JOIN users u ON rp.user_id = u.user_id
JOIN locations origin ON rp.origin_id = origin.location_id
JOIN locations dest ON rp.destination_id = dest.location_id
WHERE rp.is_active = true
ORDER BY rp.created_at DESC;

-- ============================================
-- SEED DATA
-- ============================================
-- Insert default communities
INSERT INTO communities (community_code, community_name, location, description) VALUES
    ('PHIRST2024', 'Phirst Park Homes Magalang', 'Magalang, Pampanga', 'Subdivision community carpool'),
    ('PASIG2024', 'Sample Condo Pasig', 'Pasig City, Metro Manila', 'High-rise condo carpool');

-- Magalang locations
INSERT INTO locations (community_code, location_name, location_type) VALUES
    ('PHIRST2024', 'Phirst Park Homes', 'residential'),
    ('PHIRST2024', 'Angeles City', 'commercial'),
    ('PHIRST2024', 'Clark Freeport', 'commercial'),
    ('PHIRST2024', 'SM City Clark', 'commercial'),
    ('PHIRST2024', 'Dau Terminal', 'terminal');

-- Pasig locations  
INSERT INTO locations (community_code, location_name, location_type) VALUES
    ('PASIG2024', 'Ortigas Center', 'commercial'),
    ('PASIG2024', 'BGC', 'commercial'),
    ('PASIG2024', 'Makati CBD', 'commercial'),
    ('PASIG2024', 'Shaw Boulevard', 'commercial'),
    ('PASIG2024', 'Pasig Condo (Home)', 'residential');

-- ============================================
-- HELPER FUNCTIONS
-- ============================================
-- Function to validate community code on signup
CREATE OR REPLACE FUNCTION validate_community_code(code VARCHAR(20))
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM communities 
        WHERE community_code = UPPER(code) 
        AND is_active = true
    );
END;
$$ LANGUAGE plpgsql;

-- Function to get community info
CREATE OR REPLACE FUNCTION get_community_info(code VARCHAR(20))
RETURNS TABLE (
    community_code VARCHAR(20),
    community_name VARCHAR(100),
    location VARCHAR(100),
    user_count BIGINT,
    active_rides_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.community_code,
        c.community_name,
        c.location,
        COUNT(DISTINCT u.user_id) AS user_count,
        COUNT(DISTINCT rp.post_id) FILTER (WHERE rp.is_active = true) AS active_rides_count
    FROM communities c
    LEFT JOIN users u ON c.community_code = u.community_code
    LEFT JOIN ride_posts rp ON c.community_code = rp.community_code
    WHERE c.community_code = UPPER(code)
    GROUP BY c.community_code, c.community_name, c.location;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- MIGRATION NOTES
-- ============================================
-- If migrating from existing schema without community_code:
-- 
-- 1. Create communities table first
-- 2. Insert default community (e.g., 'PHIRST2024')
-- 3. Add community_code columns to existing tables
-- 4. Update existing records:
--    UPDATE users SET community_code = 'PHIRST2024';
--    UPDATE locations SET community_code = 'PHIRST2024';
--    UPDATE ride_posts SET community_code = 'PHIRST2024';
-- 5. Add constraints and indexes
-- 6. Update application code to include community_code in queries