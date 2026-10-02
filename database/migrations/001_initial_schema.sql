-- Migration: 001_initial_schema.sql
-- Description: Baseline schema for EcoTransit core entities

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Transit Network Entities
CREATE TABLE IF NOT EXISTS stops (
    stop_id VARCHAR(64) PRIMARY KEY,
    stop_name VARCHAR(255) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    cluster_id VARCHAR(64),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stops_cluster ON stops (cluster_id);
CREATE INDEX IF NOT EXISTS idx_stops_coords ON stops (latitude, longitude);

CREATE TABLE IF NOT EXISTS routes (
    route_id VARCHAR(64) PRIMARY KEY,
    route_short_name VARCHAR(64) NOT NULL,
    route_long_name VARCHAR(255) NOT NULL,
    route_type INTEGER DEFAULT 3,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS route_stops (
    route_id VARCHAR(64) NOT NULL REFERENCES routes(route_id) ON DELETE CASCADE,
    stop_id VARCHAR(64) NOT NULL REFERENCES stops(stop_id) ON DELETE CASCADE,
    stop_sequence INTEGER NOT NULL,
    PRIMARY KEY (route_id, stop_sequence)
);

CREATE TABLE IF NOT EXISTS route_segments (
    segment_id SERIAL PRIMARY KEY,
    route_id VARCHAR(64) NOT NULL REFERENCES routes(route_id) ON DELETE CASCADE,
    from_stop_id VARCHAR(64) NOT NULL REFERENCES stops(stop_id) ON DELETE CASCADE,
    to_stop_id VARCHAR(64) NOT NULL REFERENCES stops(stop_id) ON DELETE CASCADE,
    sequence INTEGER NOT NULL,
    distance_meters DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_route_segment_seq UNIQUE (route_id, sequence)
);

CREATE INDEX IF NOT EXISTS idx_route_segments_route ON route_segments (route_id);
CREATE INDEX IF NOT EXISTS idx_route_segments_stops ON route_segments (from_stop_id, to_stop_id);

-- 2. Traversal Matrix & Staging (for atomic swap)
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

-- 3. Vehicle Telemetry Archive
CREATE TABLE IF NOT EXISTS vehicle_position_archive (
    id BIGSERIAL PRIMARY KEY,
    vehicle_id VARCHAR(64) NOT NULL,
    route_id VARCHAR(64) NOT NULL,
    trip_id VARCHAR(64),
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    bearing DOUBLE PRECISION,
    speed DOUBLE PRECISION,
    is_speed_suspect BOOLEAN DEFAULT FALSE,
    gtfs_timestamp BIGINT NOT NULL,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_archive_vehicle_time ON vehicle_position_archive (vehicle_id, gtfs_timestamp);
CREATE INDEX IF NOT EXISTS idx_archive_route_time ON vehicle_position_archive (route_id, gtfs_timestamp);

-- 4. Staff & Operations
CREATE TABLE IF NOT EXISTS staff (
    staff_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL CHECK (role IN ('conductor', 'driver', 'dispatcher', 'admin')),
    credential_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shift_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    staff_id UUID NOT NULL REFERENCES staff(staff_id),
    vehicle_id VARCHAR(64) NOT NULL,
    route_id VARCHAR(64) NOT NULL REFERENCES routes(route_id),
    start_time BIGINT NOT NULL,
    end_time BIGINT,
    status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enforce at most one active shift per staff member and per vehicle
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_staff_shift ON shift_assignments (staff_id) WHERE status = 'active';
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_vehicle_shift ON shift_assignments (vehicle_id) WHERE status = 'active';

-- 5. Incidents
CREATE TABLE IF NOT EXISTS incidents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    incident_type VARCHAR(64) NOT NULL CHECK (incident_type IN ('breakdown', 'accident', 'route_obstruction', 'medical', 'other')),
    description TEXT NOT NULL,
    reported_by_staff_id UUID NOT NULL REFERENCES staff(staff_id),
    vehicle_id VARCHAR(64) NOT NULL,
    route_id VARCHAR(64),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    status VARCHAR(32) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
    idempotency_key VARCHAR(128) NOT NULL UNIQUE,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents (status);
CREATE INDEX IF NOT EXISTS idx_incidents_vehicle ON incidents (vehicle_id);
