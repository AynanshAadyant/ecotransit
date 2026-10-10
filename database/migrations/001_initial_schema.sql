-- Migration: 001_initial_schema.sql
-- Description: Baseline schema for EcoTransit core entities (Aligned with legacy MVP schema)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Ensure Legacy Tables have needed columns for predictive modeling
-- (stops, routes, route_stops, users, vehicles, incidents already exist from legacy MVP schema)
ALTER TABLE stops ADD COLUMN IF NOT EXISTS cluster_id VARCHAR(64);
CREATE INDEX IF NOT EXISTS idx_stops_cluster ON stops (cluster_id);

-- 2. Transit Network Extensions (Route Segments)
CREATE TABLE IF NOT EXISTS route_segments (
    segment_id SERIAL PRIMARY KEY,
    route_id INTEGER NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    from_stop_id INTEGER NOT NULL REFERENCES stops(id) ON DELETE CASCADE,
    to_stop_id INTEGER NOT NULL REFERENCES stops(id) ON DELETE CASCADE,
    sequence INTEGER NOT NULL,
    distance_meters DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_route_segment_seq UNIQUE (route_id, sequence)
);

CREATE INDEX IF NOT EXISTS idx_route_segments_route ON route_segments (route_id);
CREATE INDEX IF NOT EXISTS idx_route_segments_stops ON route_segments (from_stop_id, to_stop_id);

-- 3. Traversal Matrix & Staging
CREATE TABLE IF NOT EXISTS route_segment_traversal_matrix (
    segment_id INTEGER NOT NULL REFERENCES route_segments(segment_id) ON DELETE CASCADE,
    hour_of_day SMALLINT NOT NULL CHECK (hour_of_day >= 0 AND hour_of_day <= 23),
    day_type VARCHAR(16) NOT NULL CHECK (day_type IN ('weekday', 'saturday', 'sunday')),
    sample_count INTEGER NOT NULL DEFAULT 0,
    naive_avg_seconds DOUBLE PRECISION,
    ml_predicted_seconds DOUBLE PRECISION,
    variance_score DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (segment_id, hour_of_day, day_type)
);

CREATE TABLE IF NOT EXISTS route_segment_traversal_matrix_staging (
    segment_id INTEGER NOT NULL,
    hour_of_day SMALLINT NOT NULL CHECK (hour_of_day >= 0 AND hour_of_day <= 23),
    day_type VARCHAR(16) NOT NULL CHECK (day_type IN ('weekday', 'saturday', 'sunday')),
    sample_count INTEGER NOT NULL DEFAULT 0,
    naive_avg_seconds DOUBLE PRECISION,
    ml_predicted_seconds DOUBLE PRECISION,
    variance_score DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (segment_id, hour_of_day, day_type)
);

-- 4. Vehicle Telemetry Archive
CREATE TABLE IF NOT EXISTS vehicle_position_archive (
    id BIGSERIAL PRIMARY KEY,
    vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    route_id INTEGER REFERENCES routes(id) ON DELETE SET NULL,
    trip_id INTEGER REFERENCES trips(id) ON DELETE SET NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    bearing DOUBLE PRECISION,
    speed DOUBLE PRECISION,
    is_speed_suspect BOOLEAN DEFAULT FALSE,
    gtfs_timestamp BIGINT NOT NULL,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_archive_vehicle_time ON vehicle_position_archive (vehicle_id, gtfs_timestamp);

-- 5. Shift Assignments & Staff alignment
-- Legacy schema uses 'users' for staff. We can create shift_assignments linking to users.
CREATE TABLE IF NOT EXISTS shift_assignments (
    id SERIAL PRIMARY KEY,
    staff_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    route_id INTEGER NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    start_time BIGINT NOT NULL,
    end_time BIGINT,
    status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enforce at most one active shift per staff member and per vehicle
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_staff_shift ON shift_assignments (staff_id) WHERE status = 'active';
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_vehicle_shift ON shift_assignments (vehicle_id) WHERE status = 'active';

-- Note: 'staff' table from the original migration is omitted as 'users' acts as the staff table in legacy MVP.
-- However, if the tests strictly require 'staff', we can create a view over 'users' or create the table.
-- Let's create a view for 'staff' to satisfy any infrastructure expectations without duplicating data.
CREATE OR REPLACE VIEW staff AS 
SELECT 
    id AS staff_id, 
    email AS employee_id, 
    name, 
    role, 
    password_hash AS credential_hash, 
    (status = 'active') AS is_active,
    created_at, 
    updated_at 
FROM users 
WHERE role IN ('ADMIN', 'STAFF');
