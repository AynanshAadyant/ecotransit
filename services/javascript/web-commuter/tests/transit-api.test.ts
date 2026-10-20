import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  GetVehicleEtaSchema,
  SearchStopsQuerySchema,
  NearbyStopsQuerySchema,
  RouteIdParamSchema,
  DirectJourneyQuerySchema,
} from '@ecotransit/contracts';

describe('Web Commuter: Client-Side Edge Validation', () => {
  it('prevents malformed stop search query before dispatch', () => {
    const invalid = SearchStopsQuerySchema.safeParse({ q: '' });
    assert.equal(invalid.success, false);
  });

  it('validates nearby coordinates with default radius before dispatch', () => {
    const valid = NearbyStopsQuerySchema.safeParse({ lat: 28.6139, lon: 77.2090 });
    assert.equal(valid.success, true);
    if (valid.success) {
      assert.equal(valid.data.radius, 1000);
    }
  });

  it('blocks route search when origin and destination are identical', () => {
    const invalid = DirectJourneyQuerySchema.safeParse({
      originStopId: 'STOP_1',
      destinationStopId: 'STOP_1',
    });
    assert.equal(invalid.success, false);
  });

  it('validates vehicle ETA parameters before making server request', () => {
    const valid = GetVehicleEtaSchema.safeParse({
      vehicleId: 'DL-M1-TRN-01',
      targetStopId: 'DL-S-RAJIV',
    });
    assert.equal(valid.success, true);
  });

  it('rejects invalid route ID with empty string', () => {
    const invalid = RouteIdParamSchema.safeParse({ routeId: '   ' });
    assert.equal(invalid.success, false);
  });
});
