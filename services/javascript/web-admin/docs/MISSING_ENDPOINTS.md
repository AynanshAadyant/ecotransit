# EcoTransit Web Admin & Staff Portal — Backend Integration Notes & Missing Endpoints

This document tracks endpoints and payload nuances discovered during frontend development.

## Missing or Desired Backend Endpoints

1. **`PATCH /api/auth/profile` or `PATCH /api/staff/profile`**
   - **Current state:** `GET /api/auth/me` exists and returns `{ id, name, email, phone, role, status, createdAt, updatedAt }`. However, there is no endpoint for staff members to update their contact details (e.g., phone number or notification preferences) without administrator privileges.
   - **Frontend mitigation:** The Staff Profile page currently operates in read-only mode for identity fields and displays current session attributes retrieved via `GET /api/auth/me`.

2. **`GET /api/admin/incidents/:id`**
   - **Current state:** Admin routes include `GET /api/admin/incidents` and `PATCH /api/admin/incidents/:id`. Single incident fetch endpoint is available under staff routes (`GET /api/staff/incidents/:id`).
   - **Frontend mitigation:** Admin pages fetch incidents using list filtering or utilize client-side lookup from the store.

3. **`GET /api/admin/fleet/live` or Redis telemetry query**
   - **Current state:** Admin dashboard metrics provide aggregated counts. Real-time updates stream through Socket.IO (`vehicle:location_updated`, `vehicle:status_changed`).
   - **Frontend mitigation:** Socket.IO listener handles incoming frames with periodic polling fallback to `/admin/vehicles` and `/admin/dashboard`.
