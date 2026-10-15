import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  NearbyStopsQuerySchema,
  SearchStopsQuerySchema,
  DirectJourneyQuerySchema,
  GetVehicleEtaSchema,
} from '../../src/dto/index.js';

describe('Unit Tests: Zod DTO Validation Schemas', () => {
  describe('NearbyStopsQuerySchema', () => {
    it('should validate correct lat/lon/radius inputs', () => {
      const parsed = NearbyStopsQuerySchema.parse({
        lat: '28.6139',
        lon: '77.2090',
        radius: '1500',
      });
      assert.equal(parsed.lat, 28.6139);
      assert.equal(parsed.lon, 77.2090);
      assert.equal(parsed.radius, 1500);
    });

    it('should reject invalid latitude (> 90)', () => {
      assert.throws(
        () => NearbyStopsQuerySchema.parse({ lat: 95.0, lon: 77.209 }),
        (err) => err instanceof Error,
      );
    });

    it('should reject invalid longitude (< -180)', () => {
      assert.throws(
        () => NearbyStopsQuerySchema.parse({ lat: 28.6, lon: -190.0 }),
        (err) => err instanceof Error,
      );
    });
  });

  describe('SearchStopsQuerySchema', () => {
    it('should trim and validate valid search string', () => {
      const parsed = SearchStopsQuerySchema.parse({ q: '  Connaught  ' });
      assert.equal(parsed.q, 'Connaught');
      assert.equal(parsed.limit, 20); // Default limit
    });

    it('should reject empty search string', () => {
      assert.throws(
        () => SearchStopsQuerySchema.parse({ q: '   ' }),
        (err) => err instanceof Error,
      );
    });
  });

  describe('DirectJourneyQuerySchema', () => {
    it('should validate distinct origin and destination stops', () => {
      const parsed = DirectJourneyQuerySchema.parse({
        originStopId: 'STOP_1',
        destinationStopId: 'STOP_2',
      });
      assert.equal(parsed.originStopId, 'STOP_1');
      assert.equal(parsed.destinationStopId, 'STOP_2');
    });

    it('should reject identical origin and destination stops', () => {
      assert.throws(
        () =>
          DirectJourneyQuerySchema.parse({
            originStopId: 'STOP_1',
            destinationStopId: 'STOP_1',
          }),
        (err) => err instanceof Error,
      );
    });
  });

  describe('GetVehicleEtaSchema', () => {
    it('should parse valid vehicleId and target stopId query', () => {
      const parsed = GetVehicleEtaSchema.parse({
        vehicleId: 'DL1PC1001',
        targetStopId: 'STOP_5',
      });
      assert.equal(parsed.vehicleId, 'DL1PC1001');
      assert.equal(parsed.targetStopId, 'STOP_5');
    });

    it('should reject missing target stopId', () => {
      assert.throws(
        () => GetVehicleEtaSchema.parse({ vehicleId: 'DL1PC1001', targetStopId: '' }),
        (err) => err instanceof Error,
      );
    });
  });
});
