-- ============================================================
-- ECO-TRANSIT SEED DATA
-- ============================================================

-- 1. SEED USERS
-- Admin Password: AdminPassword@123
-- Staff Password: StaffPassword@123
INSERT INTO users (name, email, password_hash, phone, role, status)
VALUES
    ('System Administrator', 'admin@ecotransit.org', '$2a$10$9uCrC70v92WLqgS3fcXRD.gJERGbsl9x4qUhU/XGxqPoCfj/94HPO', '+919876543210', 'ADMIN', 'active'),
    ('Ramesh Kumar', 'ramesh.staff@ecotransit.org', '$2a$10$O5aC0I3/9EySrEALuuKxDOnzZMtqMD3AY/5CQ2/l0y2GH.qpha3z2', '+919811223344', 'STAFF', 'active'),
    ('Priya Sharma', 'priya.staff@ecotransit.org', '$2a$10$O5aC0I3/9EySrEALuuKxDOnzZMtqMD3AY/5CQ2/l0y2GH.qpha3z2', '+919822334455', 'STAFF', 'active')
ON CONFLICT (email) DO NOTHING;

-- 2. SEED ROUTES
INSERT INTO routes (name, route_code, description, origin, destination, distance_km, status)
VALUES
    ('Delhi Eco Express', 'ROUTE-101', 'High frequency eco-bus connecting central business district to Airport Terminal 3', 'Connaught Place', 'Terminal 3 Airport', 18.50, 'active'),
    ('South Delhi Feeder', 'ROUTE-202', 'Circular metro feeder route connecting key university & commercial hubs', 'Hauz Khas Metro', 'Nehru Place Terminal', 8.20, 'active')
ON CONFLICT (route_code) DO NOTHING;

-- 3. SEED STOPS (with PostGIS Point geometry when extension is available)
INSERT INTO stops (name, stop_code, latitude, longitude, location, address, status)
VALUES
    ('Connaught Place Radial', 'STOP-CP-01', 28.6328, 77.2197, ST_SetSRID(ST_MakePoint(77.2197, 28.6328), 4326), 'Outer Circle, Connaught Place, New Delhi', 'active'),
    ('Dhaula Kuan Interchange', 'STOP-DK-02', 28.5921, 77.1563, ST_SetSRID(ST_MakePoint(77.1563, 28.5921), 4326), 'Ring Road Flyover, Dhaula Kuan, New Delhi', 'active'),
    ('Aerocity Metro Hub', 'STOP-AC-03', 28.5535, 77.1213, ST_SetSRID(ST_MakePoint(77.1213, 28.5535), 4326), 'Hospitality District, Aerocity, New Delhi', 'active'),
    ('Terminal 3 Airport', 'STOP-T3-04', 28.5562, 77.0867, ST_SetSRID(ST_MakePoint(77.0867, 28.5562), 4326), 'Arrival Forecourt, IGI Airport T3, New Delhi', 'active'),
    ('Hauz Khas Metro', 'STOP-HK-05', 28.5431, 77.2065, ST_SetSRID(ST_MakePoint(77.2065, 28.5431), 4326), 'Gate 2, Hauz Khas Metro Station, New Delhi', 'active'),
    ('IIT Gate Bus Stop', 'STOP-IIT-06', 28.5458, 77.1926, ST_SetSRID(ST_MakePoint(77.1926, 28.5458), 4326), 'Outer Ring Road, Near IIT Flyover, New Delhi', 'active'),
    ('Nehru Place Terminal', 'STOP-NP-07', 28.5494, 77.2524, ST_SetSRID(ST_MakePoint(77.2524, 28.5494), 4326), 'Bus Terminal, Nehru Place, New Delhi', 'active')
ON CONFLICT (stop_code) DO NOTHING;

-- 4. SEED ROUTE_STOPS (Ordered sequence)
INSERT INTO route_stops (route_id, stop_id, stop_order)
VALUES
    (1, 1, 1),
    (1, 2, 2),
    (1, 3, 3),
    (1, 4, 4),
    (2, 5, 1),
    (2, 6, 2),
    (2, 7, 3)
ON CONFLICT (route_id, stop_order) DO NOTHING;

-- 5. SEED VEHICLES
INSERT INTO vehicles (vehicle_number, registration_number, vehicle_type, capacity, route_id, device_id, status)
VALUES
    ('ECO-01', 'DL-1PC-4001', 'Electric Low-Floor 12m', 45, 1, 'ESP32-001', 'active'),
    ('ECO-02', 'DL-1PC-4002', 'Electric Feeder 9m', 30, 2, 'ESP32-002', 'active'),
    ('ECO-03', 'DL-1PC-4003', 'Electric Mini 7m', 20, NULL, 'ESP32-003', 'maintenance')
ON CONFLICT (vehicle_number) DO NOTHING;

-- 6. SEED DEVICES
INSERT INTO devices (device_id, vehicle_id, model, status, last_seen)
VALUES
    ('ESP32-001', 1, 'ESP32-NEO6M-V2', 'active', CURRENT_TIMESTAMP),
    ('ESP32-002', 2, 'ESP32-NEO6M-V2', 'active', CURRENT_TIMESTAMP),
    ('ESP32-003', 3, 'ESP32-NEO6M-V2', 'offline', CURRENT_TIMESTAMP - INTERVAL '2 days')
ON CONFLICT (device_id) DO NOTHING;

-- 7. SEED SAMPLE TRIPS
INSERT INTO trips (vehicle_id, route_id, staff_id, status, start_time, notes)
VALUES
    (1, 1, 2, 'active', CURRENT_TIMESTAMP - INTERVAL '40 minutes', 'Morning express run on Schedule A'),
    (2, 2, 3, 'scheduled', CURRENT_TIMESTAMP + INTERVAL '1 hour', 'Midday feeder route run')
ON CONFLICT DO NOTHING;

-- 8. SEED SAMPLE INCIDENTS
INSERT INTO incidents (type, description, severity, latitude, longitude, location, vehicle_id, route_id, reported_by, status)
VALUES
    ('traffic', 'Severe traffic congestion near Dhaula Kuan flyover due to VIP convoy', 'medium', 28.5921, 77.1563, ST_SetSRID(ST_MakePoint(77.1563, 28.5921), 4326), 1, 1, 2, 'reported')
ON CONFLICT DO NOTHING;
