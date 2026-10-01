import { Vehicle, JourneyResult, EtaResponse, Stop, RouteGeometry, HeatmapBucket } from '@ecotransit/contracts';

/**
 * Mock transit API — all functions return local data so no backend is required.
 * searchJourney generates realistic Delhi transit routes based on origin/destination.
 */

// ---------------------------------------------------------------------------
// Journey search — smart mock for Delhi transit
// ---------------------------------------------------------------------------

const DELHI_ROUTES = [
  { id: 'DEL-R1', name: 'Yellow Line Metro', color: '#f5c518' },
  { id: 'DEL-R2', name: 'Blue Line Metro',   color: '#2563eb' },
  { id: 'DEL-R3', name: 'Red Line Metro',    color: '#dc2626' },
  { id: 'DEL-R4', name: 'Green Line Metro',  color: '#16a34a' },
  { id: 'DEL-B1', name: 'DTC Express 501',   color: '#10b981' },
  { id: 'DEL-B2', name: 'DTC Rapid 302',     color: '#38bdf8' },
];

function titleCase(str: string) {
  return str.trim().replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase());
}

function pickRoute(seed: number) {
  return DELHI_ROUTES[Math.abs(seed) % DELHI_ROUTES.length];
}

function mockDelay(ms = 700) {
  return new Promise<void>((res) => setTimeout(res, ms));
}

export async function searchJourney(origin: string, destination: string): Promise<JourneyResult[]> {
  await mockDelay();

  const from = titleCase(origin);
  const to   = titleCase(destination);
  const seed  = (from.charCodeAt(0) + to.charCodeAt(0)) % DELHI_ROUTES.length;

  const routeA = pickRoute(seed);
  const routeB = pickRoute(seed + 2);

  const results: JourneyResult[] = [
    // Option 1 – direct single-route journey
    {
      journeyId: `mock-j-${seed}-direct`,
      origin: from,
      destination: to,
      totalDurationMinutes: 22 + seed * 3,
      fare: 30 + seed * 5,
      segments: [
        {
          segmentId: `seg-${seed}-1`,
          routeId:   routeA.id,
          routeName: routeA.name,
          fromStop:  from,
          toStop:    to,
          departureTime: '08:15',
          arrivalTime:   '08:37',
          durationMinutes: 22 + seed * 3,
        },
      ],
    },
    // Option 2 – one interchange at Rajiv Chowk
    {
      journeyId: `mock-j-${seed}-change`,
      origin: from,
      destination: to,
      totalDurationMinutes: 34 + seed,
      fare: 40 + seed * 4,
      segments: [
        {
          segmentId: `seg-${seed}-2a`,
          routeId:   routeA.id,
          routeName: routeA.name,
          fromStop:  from,
          toStop:    'Rajiv Chowk',
          departureTime: '08:10',
          arrivalTime:   '08:28',
          durationMinutes: 18,
        },
        {
          segmentId: `seg-${seed}-2b`,
          routeId:   routeB.id,
          routeName: routeB.name,
          fromStop:  'Rajiv Chowk',
          toStop:    to,
          departureTime: '08:31',
          arrivalTime:   '08:47',
          durationMinutes: 16 + seed,
        },
      ],
    },
    // Option 3 – DTC bus (slower but cheaper)
    {
      journeyId: `mock-j-${seed}-bus`,
      origin: from,
      destination: to,
      totalDurationMinutes: 45 + seed * 2,
      fare: 15,
      segments: [
        {
          segmentId: `seg-${seed}-3`,
          routeId:   'DEL-B1',
          routeName: 'DTC Express 501',
          fromStop:  from,
          toStop:    to,
          departureTime: '08:05',
          arrivalTime:   '08:52',
          durationMinutes: 45 + seed * 2,
        },
      ],
    },
  ];

  return results;
}

// ---------------------------------------------------------------------------
// Other endpoints — return empty arrays (map data seeded via cityTransit)
// ---------------------------------------------------------------------------

export async function getLiveVehicles(): Promise<Vehicle[]> {
  return [];
}

export async function getStops(): Promise<Stop[]> {
  return [];
}

export async function getRoutes(): Promise<RouteGeometry[]> {
  return [];
}

export async function getHeatmap(_routeId?: string): Promise<HeatmapBucket[]> {
  return [];
}

export async function getEta(routeId: string, segmentIds: string[]): Promise<EtaResponse> {
  return {
    routeId,
    segmentId: segmentIds[0] ?? '',
    eta_seconds: 240,
    variance_total: 18,
    weakest_cell_support: 32,
  };
}
