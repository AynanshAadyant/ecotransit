-- Migration: 002_performance_indexes.sql
-- Description: Indexes on route_stops for high-speed corridor and journey matching

CREATE INDEX IF NOT EXISTS idx_route_stops_stop_id ON route_stops (stop_id);
CREATE INDEX IF NOT EXISTS idx_route_stops_route_stop ON route_stops (route_id, stop_id);
