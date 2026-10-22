import asyncio
import json
import time
import httpx

BASE_URL = "http://localhost:4000"

async def test_rest_endpoints():
    print("=" * 70)
    print("QA TEST SUITE: API GATEWAY REAL DATA & EDGE CASE TESTING")
    print("=" * 70)

    async with httpx.AsyncClient(base_url=BASE_URL, timeout=10.0) as client:
        # 1. Health check
        print("\n[Test 1] Health Endpoint: GET /api/health")
        t0 = time.perf_counter()
        res = await client.get("/api/health")
        lat = (time.perf_counter() - t0) * 1000
        print(f"  Response ({res.status_code}, {lat:.1f}ms): {res.json()}")
        assert res.status_code == 200
        data = res.json()
        assert data.get("status") == "healthy"
        print("  [OK] /api/health passed")

        # 2. Nearby Stops (Connaught Place: 28.6315, 77.2167, radius 1000m)
        print("\n[Test 2] Nearby Stops: GET /api/stops/nearby?lat=28.6315&lon=77.2167&radius=1000")
        t0 = time.perf_counter()
        res = await client.get("/api/stops/nearby", params={"lat": 28.6315, "lon": 77.2167, "radius": 1000})
        lat = (time.perf_counter() - t0) * 1000
        assert res.status_code == 200
        stops = res.json()
        print(f"  Found {len(stops)} nearby stops in {lat:.1f}ms")
        assert len(stops) > 0, "Expected at least 1 stop near Connaught Place"
        sample_stop = stops[0]
        print(f"  Sample stop: ID={sample_stop.get('stopId')}, Name={sample_stop.get('stopName')}, raw={sample_stop}")
        print("  [OK] Nearby stops query passed")

        # 2b. Nearby Stops Edge Cases (Invalid Lat/Lon, negative radius, missing params)
        print("\n[Test 2b] Nearby Stops Validation Edge Cases")
        res_bad_lat = await client.get("/api/stops/nearby", params={"lat": 120.0, "lon": 77.2167, "radius": 1000})
        print(f"  Lat > 90 -> Status {res_bad_lat.status_code} ({res_bad_lat.json().get('error', {}).get('code')})")
        assert res_bad_lat.status_code in (400, 422)

        res_no_params = await client.get("/api/stops/nearby")
        print(f"  Missing params -> Status {res_no_params.status_code} ({res_no_params.json().get('error', {}).get('code')})")
        assert res_no_params.status_code in (400, 422)
        print("  [OK] Validation properly rejects out-of-bounds coordinates")

        # 3. Stop Search
        print("\n[Test 3] Stop Search: GET /api/stops/search?q=Kashmere")
        t0 = time.perf_counter()
        res = await client.get("/api/stops/search", params={"q": "Kashmere"})
        lat = (time.perf_counter() - t0) * 1000
        assert res.status_code == 200
        found_stops = res.json()
        print(f"  Search returned {len(found_stops)} matches in {lat:.1f}ms")
        assert len(found_stops) > 0
        target_stop_id = found_stops[0].get("stopId")
        print(f"  Found stop ID: {target_stop_id} ({found_stops[0].get('stopName')})")
        print("  [OK] Stop search passed")

        # 4. Stop by ID
        print(f"\n[Test 4] Stop By ID: GET /api/stops/{target_stop_id}")
        res_stop = await client.get(f"/api/stops/{target_stop_id}")
        assert res_stop.status_code == 200
        print(f"  Stop detail: {res_stop.json()}")
        print("  [OK] Stop detail passed")

        # 4b. Stop by non-existent ID
        print("\n[Test 4b] Non-existent Stop: GET /api/stops/NON_EXISTENT_ID_99999")
        res_404 = await client.get("/api/stops/NON_EXISTENT_ID_99999")
        print(f"  Status: {res_404.status_code}, Body: {res_404.json()}")
        assert res_404.status_code == 404
        print("  [OK] 404 correctly returned for non-existent stop")

        # 5. Routes serving Stop
        print(f"\n[Test 5] Routes Serving Stop: GET /api/stops/{target_stop_id}/routes")
        t0 = time.perf_counter()
        res_routes = await client.get(f"/api/stops/{target_stop_id}/routes")
        lat = (time.perf_counter() - t0) * 1000
        assert res_routes.status_code == 200
        serving_routes = res_routes.json()
        print(f"  Stop is served by {len(serving_routes)} routes in {lat:.1f}ms")
        print("  [OK] Routes serving stop passed")

        # 6. All Routes
        print("\n[Test 6] List Routes: GET /api/routes")
        t0 = time.perf_counter()
        res_all_routes = await client.get("/api/routes")
        lat = (time.perf_counter() - t0) * 1000
        assert res_all_routes.status_code == 200
        routes_list = res_all_routes.json()
        print(f"  Total routes returned: {len(routes_list)} in {lat:.1f}ms")
        assert len(routes_list) > 0
        sample_route = routes_list[0]
        sample_route_id = sample_route.get("routeId")
        print(f"  Sample route: ID={sample_route_id}, Name={sample_route.get('routeShortName')}")
        print("  [OK] Routes list passed")

        # 7. Route Stops
        print(f"\n[Test 7] Route Stops: GET /api/routes/{sample_route_id}/stops")
        t0 = time.perf_counter()
        res_route_stops = await client.get(f"/api/routes/{sample_route_id}/stops")
        lat = (time.perf_counter() - t0) * 1000
        assert res_route_stops.status_code == 200
        route_stops = res_route_stops.json()
        print(f"  Route {sample_route_id} has {len(route_stops)} ordered stops in {lat:.1f}ms")
        print("  [OK] Route stops passed")

        # 8. Live Vehicles
        print("\n[Test 8] All Live Vehicles: GET /api/vehicles/live")
        t0 = time.perf_counter()
        res_live = await client.get("/api/vehicles/live")
        lat = (time.perf_counter() - t0) * 1000
        assert res_live.status_code == 200
        live_vehicles = res_live.json()
        print(f"  Live vehicles returned from Redis: {len(live_vehicles)} in {lat:.1f}ms")
        sample_live_veh = None
        if live_vehicles:
            sample_live_veh = live_vehicles[0]
            print(f"  Sample live vehicle: ID={sample_live_veh.get('vehicleId')}, Route={sample_live_veh.get('routeId')}, Coord=({sample_live_veh.get('latitude')}, {sample_live_veh.get('longitude')})")
        print("  [OK] Live vehicles returned successfully")

        # 9. Vehicle by ID (Live)
        if sample_live_veh:
            vid = sample_live_veh.get("vehicleId")
            print(f"\n[Test 9] Vehicle by ID: GET /api/vehicles/live/{vid}")
            res_vid = await client.get(f"/api/vehicles/live/{vid}")
            assert res_vid.status_code == 200
            print(f"  Vehicle data: {res_vid.json()}")
            print("  [OK] Live vehicle by ID passed")

        # 10. ETA Calculation for Live Vehicle
        if sample_live_veh and route_stops and len(route_stops) > 2:
            vid = sample_live_veh.get("vehicleId")
            downstream_stop = route_stops[-1].get("stopId")
            print(f"\n[Test 10] ETA Calculation: GET /api/eta/{vid}?stopId={downstream_stop}")
            t0 = time.perf_counter()
            res_eta = await client.get(f"/api/eta/{vid}", params={"stopId": downstream_stop})
            lat = (time.perf_counter() - t0) * 1000
            print(f"  ETA Response ({res_eta.status_code}, {lat:.1f}ms): {res_eta.json()}")
            if res_eta.status_code == 200:
                eta_data = res_eta.json()
                print(f"  -> ETA Seconds: {eta_data.get('etaSeconds')}, Variance: {eta_data.get('varianceTotal')}, Weakest Support: {eta_data.get('weakestCellSupport')}")
            print("  [OK] ETA Calculation endpoint tested")

        # 10b. ETA for offline vehicle (should 404)
        print("\n[Test 10b] ETA for Offline Vehicle: GET /api/eta/OFFLINE_BUS_9999?stopId=STOP_1")
        res_offline_eta = await client.get("/api/eta/OFFLINE_BUS_9999", params={"stopId": "STOP_1"})
        print(f"  Status: {res_offline_eta.status_code}, Error: {res_offline_eta.json().get('error', {}).get('message')}")
        assert res_offline_eta.status_code == 404
        print("  [OK] Offline vehicle ETA correctly returned 404")

        # 11. Direct Journey Search
        if len(stops) >= 2:
            s1 = stops[0].get("stopId")
            s2 = stops[1].get("stopId")
            print(f"\n[Test 11] Direct Journey Search: GET /api/routes/search?originStopId={s1}&destinationStopId={s2}")
            res_journey = await client.get("/api/routes/search", params={"originStopId": s1, "destinationStopId": s2})
            print(f"  Status: {res_journey.status_code}, Journeys: {res_journey.json()}")
            assert res_journey.status_code == 200
            print("  [OK] Journey search endpoint passed")

async def main():
    await test_rest_endpoints()
    print("\n" + "=" * 70)
    print("ALL API GATEWAY REST ENDPOINTS LIVE TESTS PASSED!")
    print("=" * 70)

if __name__ == "__main__":
    asyncio.run(main())
