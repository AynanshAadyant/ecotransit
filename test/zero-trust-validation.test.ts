import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  NearbyStopsQuerySchema,
  SearchStopsQuerySchema,
  StopIdParamSchema,
  RouteIdParamSchema,
  DirectJourneyQuerySchema,
  JourneyByCoordsQuerySchema,
  VehicleIdParamSchema,
  GetVehicleEtaSchema,
  VehiclePositionSchema,
  TelemetryBatchFrameSchema,
  CoordinateSchema,
} from '../shared/javascript/contracts/src/validation.js';

describe('Zero-Trust Architecture: Edge Validation Security Tests', () => {
  describe('CoordinateSchema & Spatial Bounds', () => {
    it('accepts valid coordinates within Delhi NCR', () => {
      const valid = CoordinateSchema.safeParse({ lat: 28.6139, lon: 77.209 });
      assert.equal(valid.success, true);
    });

    it('rejects out-of-bounds latitude > 90', () => {
      const invalid = CoordinateSchema.safeParse({ lat: 91.5, lon: 77.209 });
      assert.equal(invalid.success, false);
      if (!invalid.success) {
        assert.match(invalid.error.issues[0]?.message ?? '', /Latitude must be <= 90/);
      }
    });

    it('rejects out-of-bounds latitude < -90', () => {
      const invalid = CoordinateSchema.safeParse({ lat: -95.0, lon: 77.209 });
      assert.equal(invalid.success, false);
    });

    it('rejects out-of-bounds longitude > 180', () => {
      const invalid = CoordinateSchema.safeParse({ lat: 28.6139, lon: 181.0 });
      assert.equal(invalid.success, false);
    });

    it('rejects non-numeric coordinates (prevent type injection)', () => {
      const invalid = CoordinateSchema.safeParse({ lat: 'not-a-number', lon: 77.209 });
      assert.equal(invalid.success, false);
    });
  });

  describe('NearbyStopsQuerySchema', () => {
    it('applies default radius when omitted', () => {
      const res = NearbyStopsQuerySchema.safeParse({ lat: 28.6139, lon: 77.209 });
      assert.equal(res.success, true);
      if (res.success) {
        assert.equal(res.data.radius, 1000);
      }
    });

    it('rejects negative radius (malicious query defense)', () => {
      const res = NearbyStopsQuerySchema.safeParse({ lat: 28.6139, lon: 77.209, radius: -500 });
      assert.equal(res.success, false);
    });

    it('rejects excessively large radius > 50km (DoS prevention)', () => {
      const res = NearbyStopsQuerySchema.safeParse({ lat: 28.6139, lon: 77.209, radius: 100000 });
      assert.equal(res.success, false);
      if (!res.success) {
        assert.match(res.error.issues[0]?.message ?? '', /cannot exceed 50,000m/);
      }
    });
  });

  describe('SearchStopsQuerySchema', () => {
    it('accepts and trims normal stop query', () => {
      const res = SearchStopsQuerySchema.safeParse({ q: '  Rajiv Chowk  ' });
      assert.equal(res.success, true);
      if (res.success) {
        assert.equal(res.data.q, 'Rajiv Chowk');
        assert.equal(res.data.limit, 20);
      }
    });

    it('rejects empty string search', () => {
      const res = SearchStopsQuerySchema.safeParse({ q: '   ' });
      assert.equal(res.success, false);
    });

    it('rejects search query exceeding 100 characters (buffer overflow defense)', () => {
      const oversized = 'A'.repeat(101);
      const res = SearchStopsQuerySchema.safeParse({ q: oversized });
      assert.equal(res.success, false);
      if (!res.success) {
        assert.match(res.error.issues[0]?.message ?? '', /cannot exceed 100 characters/);
      }
    });
  });

  describe('DirectJourneyQuerySchema', () => {
    it('accepts distinct origin and destination stops', () => {
      const res = DirectJourneyQuerySchema.safeParse({
        originStopId: 'STOP_RAJIV',
        destinationStopId: 'STOP_KASHMERE',
      });
      assert.equal(res.success, true);
    });

    it('rejects identical origin and destination stop IDs', () => {
      const res = DirectJourneyQuerySchema.safeParse({
        originStopId: 'STOP_RAJIV',
        destinationStopId: 'STOP_RAJIV',
      });
      assert.equal(res.success, false);
      if (!res.success) {
        assert.match(res.error.issues[0]?.message ?? '', /Origin and destination stops must be distinct/);
      }
    });
  });

  describe('GetVehicleEtaSchema', () => {
    it('accepts valid vehicleId and target stopId', () => {
      const res = GetVehicleEtaSchema.safeParse({
        vehicleId: 'DL1PC8888',
        targetStopId: 'STOP_105',
      });
      assert.equal(res.success, true);
    });

    it('rejects empty target stopId', () => {
      const res = GetVehicleEtaSchema.safeParse({
        vehicleId: 'DL1PC8888',
        targetStopId: '   ',
      });
      assert.equal(res.success, false);
    });

    it('rejects oversized vehicleId (> 64 chars)', () => {
      const res = GetVehicleEtaSchema.safeParse({
        vehicleId: 'V'.repeat(65),
        targetStopId: 'STOP_105',
      });
      assert.equal(res.success, false);
    });
  });

  describe('TelemetryBatchFrameSchema & VehiclePositionSchema', () => {
    it('validates authentic telemetry frame broadcast payload', () => {
      const frame = {
        timestamp: Math.floor(Date.now() / 1000),
        frameType: 'full',
        vehicles: [
          {
            vehicleId: 'DL1PC0001',
            routeId: '521',
            latitude: 28.6328,
            longitude: 77.2197,
            bearing: 90,
            speed: 12.5,
            timestamp: Math.floor(Date.now() / 1000),
          },
        ],
      };
      const res = TelemetryBatchFrameSchema.safeParse(frame);
      assert.equal(res.success, true);
    });

    it('rejects corrupt frame with invalid frameType', () => {
      const corruptFrame = {
        timestamp: Math.floor(Date.now() / 1000),
        frameType: 'malicious_type',
        vehicles: [],
      };
      const res = TelemetryBatchFrameSchema.safeParse(corruptFrame);
      assert.equal(res.success, false);
    });

    it('rejects corrupt vehicle with negative speed or invalid coordinates', () => {
      const corruptVehicle = {
        vehicleId: 'DL1PC0001',
        routeId: '521',
        latitude: 999.0, // invalid
        longitude: 77.2197,
        speed: -10, // invalid negative speed
        timestamp: Math.floor(Date.now() / 1000),
      };
      const res = VehiclePositionSchema.safeParse(corruptVehicle);
      assert.equal(res.success, false);
    });
  });
});
