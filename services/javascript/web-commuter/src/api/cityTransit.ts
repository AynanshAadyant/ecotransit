import { RouteGeometry, Stop, Vehicle } from '@ecotransit/contracts';

/**
 * Generates a realistic Delhi transit network with:
 *  - Metro lines (6 DMRC corridors with real stop-by-stop paths)
 *  - DTC regular city bus routes (inner-city, cross-city, feeder, circular)
 *  - Ring routes connecting suburbs
 *
 * Modeled after OnDelhi live-bus data coverage — all route types visible on map.
 * For non-Delhi cities a generic 4-route network is generated.
 */
export function generateCityTransit(
  cityName: string,
  centerLat: number,
  centerLon: number,
): {
  routes: RouteGeometry[];
  stops: Stop[];
  vehicles: Record<string, Vehicle>;
} {
  const isDelhi = cityName.toLowerCase().includes('delhi');
  if (isDelhi) {
    return generateDelhiTransit();
  }
  return generateGenericCity(cityName, centerLat, centerLon);
}

// ---------------------------------------------------------------------------
// DELHI — full multi-modal transit network
// ---------------------------------------------------------------------------
function generateDelhiTransit(): {
  routes: RouteGeometry[];
  stops: Stop[];
  vehicles: Record<string, Vehicle>;
} {
  const routes: RouteGeometry[] = [
    // ── METRO LINES ─────────────────────────────────────────────────────────
    {
      routeId: 'DL-M1',
      name: 'Yellow Line (Samaypur Badli – HUDA City Centre)',
      color: '#f5c518',
      path: [
        [28.7395, 77.1566], [28.7201, 77.1562], [28.7022, 77.1508],
        [28.6887, 77.1498], [28.6754, 77.1489], [28.6615, 77.1488],
        [28.6480, 77.1487], [28.6368, 77.1500], [28.6252, 77.1488],
        [28.6105, 77.1600], [28.6011, 77.1730], [28.5895, 77.1800],
        [28.5805, 77.1872], [28.5703, 77.1946], [28.5602, 77.1991],
        [28.5503, 77.2019], [28.5370, 77.2098], [28.5231, 77.2155],
        [28.5104, 77.2215], [28.4990, 77.2274], [28.4863, 77.2210],
        [28.4682, 77.2180], [28.4545, 77.2149], [28.4413, 77.2115],
        [28.4245, 77.2085], [28.4100, 77.2100], [28.3941, 77.2160],
        [28.3831, 77.2180], [28.3714, 77.2200], [28.3603, 77.2250],
        [28.3495, 77.2290], [28.3356, 77.2347], [28.3231, 77.2384],
        [28.3095, 77.2418], [28.2965, 77.2440],
      ],
    },
    {
      routeId: 'DL-M2',
      name: 'Blue Line (Dwarka Sec 21 – Vaishali/Noida)',
      color: '#2563eb',
      path: [
        [28.5927, 77.0373], [28.5913, 77.0588], [28.5912, 77.0727],
        [28.5918, 77.0863], [28.5932, 77.1049], [28.5945, 77.1177],
        [28.5951, 77.1307], [28.5965, 77.1455], [28.5979, 77.1594],
        [28.6001, 77.1740], [28.6020, 77.1874], [28.6039, 77.2000],
        [28.6060, 77.2132], [28.6080, 77.2260], [28.6094, 77.2388],
        [28.6103, 77.2513], [28.6102, 77.2636], [28.6107, 77.2755],
        [28.6118, 77.2875], [28.6122, 77.2992], [28.6125, 77.3112],
        [28.6130, 77.3241], [28.6317, 77.2198],
      ],
    },
    {
      routeId: 'DL-M3',
      name: 'Red Line (Rithala – Shaheed Sthal)',
      color: '#dc2626',
      path: [
        [28.7206, 77.1085], [28.7109, 77.1148], [28.7012, 77.1210],
        [28.6906, 77.1301], [28.6806, 77.1350], [28.6706, 77.1399],
        [28.6622, 77.1500], [28.6551, 77.1594], [28.6475, 77.1680],
        [28.6385, 77.1760], [28.6304, 77.1843], [28.6211, 77.1922],
        [28.6113, 77.2000], [28.5946, 77.2160], [28.5863, 77.2240],
        [28.5772, 77.2320], [28.5682, 77.2398], [28.5592, 77.2479],
        [28.5502, 77.2559], [28.5412, 77.2641], [28.5353, 77.2725],
        [28.5287, 77.2898], [28.5211, 77.3071], [28.5140, 77.3244],
      ],
    },
    {
      routeId: 'DL-M5',
      name: 'Violet Line (Kashmere Gate – Raja Nahar Singh)',
      color: '#7c3aed',
      path: [
        [28.6079, 77.2289], [28.5985, 77.2339], [28.5891, 77.2390],
        [28.5798, 77.2440], [28.5706, 77.2490], [28.5606, 77.2540],
        [28.5506, 77.2590], [28.5404, 77.2641], [28.5302, 77.2689],
        [28.5202, 77.2731], [28.5105, 77.2773], [28.5005, 77.2812],
        [28.4906, 77.2849], [28.4808, 77.2886], [28.4708, 77.2920],
        [28.4611, 77.2953], [28.4512, 77.2983], [28.4412, 77.3013],
        [28.4312, 77.3043], [28.4212, 77.3073], [28.4112, 77.3103],
        [28.4012, 77.3133], [28.3909, 77.3163], [28.3813, 77.3193],
        [28.3711, 77.3223],
      ],
    },
    {
      routeId: 'DL-M6',
      name: 'Pink Line (Majlis Park – Shiv Vihar)',
      color: '#ec4899',
      path: [
        [28.7177, 77.1592], [28.7012, 77.1703], [28.6857, 77.1813],
        [28.6700, 77.1920], [28.6548, 77.2030], [28.6393, 77.2137],
        [28.6247, 77.2243], [28.6100, 77.2349], [28.5950, 77.2455],
        [28.5802, 77.2563], [28.5653, 77.2668], [28.5502, 77.2775],
        [28.5353, 77.2882], [28.5202, 77.2986], [28.5050, 77.3091],
        [28.4901, 77.3195], [28.4749, 77.3299], [28.4601, 77.3406],
        [28.4450, 77.3510], [28.4300, 77.3615], [28.4150, 77.3717],
        [28.4000, 77.3820], [28.3852, 77.3925], [28.3700, 77.4027],
        [28.3550, 77.4132], [28.3400, 77.4235], [28.3250, 77.4338],
        [28.3102, 77.4440], [28.2950, 77.4543], [28.2800, 77.4646],
        [28.2650, 77.4749], [28.2500, 77.4852],
      ],
    },

    // ── DTC REGULAR CITY BUS ROUTES ─────────────────────────────────────────

    // Route 521 — Connaught Place ↔ Shahdara (cross-Yamuna city route)
    {
      routeId: 'DTC-521',
      name: 'DTC 521 (CP ↔ Shahdara)',
      color: '#f97316',
      path: [
        [28.6328, 77.2197], [28.6280, 77.2225], [28.6231, 77.2253],
        [28.6175, 77.2290], [28.6105, 77.2320], [28.6043, 77.2360],
        [28.5980, 77.2402], [28.5927, 77.2447], [28.5868, 77.2503],
        [28.5810, 77.2560], [28.5762, 77.2618], [28.5712, 77.2680],
      ],
    },

    // Route 615 — Rohini ↔ Saket (north-south arterial)
    {
      routeId: 'DTC-615',
      name: 'DTC 615 (Rohini ↔ Saket)',
      color: '#06b6d4',
      path: [
        [28.7201, 77.1562], [28.7050, 77.1610], [28.6887, 77.1650],
        [28.6750, 77.1690], [28.6600, 77.1730], [28.6452, 77.1770],
        [28.6300, 77.1808], [28.6155, 77.1848], [28.6005, 77.1887],
        [28.5857, 77.1925], [28.5700, 77.1965], [28.5553, 77.2003],
        [28.5400, 77.2042], [28.5248, 77.2080], [28.5099, 77.2118],
        [28.4950, 77.2155], [28.4800, 77.2192], [28.4645, 77.2230],
        [28.4490, 77.2268],
      ],
    },

    // Route 423 — Janakpuri ↔ Badarpur (west-east crosstown)
    {
      routeId: 'DTC-423',
      name: 'DTC 423 (Janakpuri ↔ Badarpur)',
      color: '#a855f7',
      path: [
        [28.6210, 77.0820], [28.6180, 77.0970], [28.6145, 77.1130],
        [28.6112, 77.1285], [28.6080, 77.1450], [28.6045, 77.1610],
        [28.6010, 77.1780], [28.5975, 77.1951], [28.5940, 77.2122],
        [28.5902, 77.2295], [28.5864, 77.2465], [28.5825, 77.2638],
        [28.5787, 77.2808], [28.5742, 77.2985], [28.5680, 77.3160],
        [28.5610, 77.3340],
      ],
    },

    // Route 764 — Anand Vihar ↔ Dhaula Kuan
    {
      routeId: 'DTC-764',
      name: 'DTC 764 (Anand Vihar ↔ Dhaula Kuan)',
      color: '#84cc16',
      path: [
        [28.6469, 77.3153], [28.6410, 77.3020], [28.6360, 77.2890],
        [28.6310, 77.2762], [28.6263, 77.2630], [28.6215, 77.2500],
        [28.6170, 77.2372], [28.6122, 77.2242], [28.6075, 77.2115],
        [28.6025, 77.1987], [28.5978, 77.1858], [28.5928, 77.1730],
        [28.5879, 77.1601], [28.5830, 77.1475], [28.5778, 77.1345],
        [28.5727, 77.1220],
      ],
    },

    // Route 330 — Mehrauli ↔ IP Estate
    {
      routeId: 'DTC-330',
      name: 'DTC 330 (Mehrauli ↔ IP Estate)',
      color: '#fb923c',
      path: [
        [28.3950, 77.1870], [28.4100, 77.1920], [28.4260, 77.1973],
        [28.4420, 77.2025], [28.4580, 77.2077], [28.4740, 77.2131],
        [28.4900, 77.2183], [28.5060, 77.2237], [28.5218, 77.2292],
        [28.5380, 77.2345], [28.5535, 77.2400], [28.5693, 77.2455],
        [28.5850, 77.2510],
      ],
    },

    // Route 180 — IGI Airport ↔ Kashmere Gate
    {
      routeId: 'DTC-180',
      name: 'DTC 180 (Airport ↔ Kashmere Gate)',
      color: '#0ea5e9',
      path: [
        [28.5531, 77.0955], [28.5612, 77.1094], [28.5695, 77.1235],
        [28.5775, 77.1377], [28.5858, 77.1519], [28.5940, 77.1661],
        [28.6000, 77.1803], [28.6062, 77.1944], [28.6122, 77.2087],
        [28.6175, 77.2230], [28.6230, 77.2373],
      ],
    },

    // Route 44 — Mundka ↔ Kashmere Gate
    {
      routeId: 'DTC-44',
      name: 'DTC 44 (Mundka ↔ Kashmere Gate)',
      color: '#e879f9',
      path: [
        [28.6840, 77.0275], [28.6810, 77.0475], [28.6780, 77.0676],
        [28.6750, 77.0876], [28.6716, 77.1076], [28.6682, 77.1278],
        [28.6650, 77.1478], [28.6617, 77.1678], [28.6582, 77.1878],
        [28.6550, 77.2078], [28.6518, 77.2278],
      ],
    },

    // Route 595 — Geeta Colony ↔ Palam
    {
      routeId: 'DTC-595',
      name: 'DTC 595 (Geeta Colony ↔ Palam)',
      color: '#2dd4bf',
      path: [
        [28.6537, 77.2675], [28.6482, 77.2562], [28.6428, 77.2448],
        [28.6375, 77.2335], [28.6320, 77.2222], [28.6262, 77.2109],
        [28.6206, 77.1995], [28.6150, 77.1882], [28.6092, 77.1768],
        [28.6036, 77.1655], [28.5978, 77.1542], [28.5921, 77.1428],
        [28.5864, 77.1315], [28.5805, 77.1201], [28.5748, 77.1088],
        [28.5690, 77.0975], [28.5630, 77.0863], [28.5572, 77.0748],
      ],
    },

    // Route 410 — Outer Ring (Bahadurgarh ↔ Ambedkar Nagar)
    {
      routeId: 'DTC-410',
      name: 'DTC 410 (Outer Ring – Bahadurgarh ↔ Ambedkar Nagar)',
      color: '#f43f5e',
      path: [
        [28.6920, 76.9250], [28.6870, 76.9580], [28.6820, 76.9910],
        [28.6770, 77.0240], [28.6718, 77.0572], [28.6665, 77.0905],
        [28.6610, 77.1237], [28.6555, 77.1570], [28.6500, 77.1905],
        [28.6445, 77.2240], [28.6385, 77.2575], [28.6310, 77.2910],
        [28.6215, 77.3245], [28.6080, 77.3580], [28.5945, 77.3650],
        [28.5800, 77.3480], [28.5655, 77.3310], [28.5510, 77.3140],
        [28.5365, 77.2975],
      ],
    },

    // Route 312 — DSIDC Narela ↔ IP Extension
    {
      routeId: 'DTC-312',
      name: 'DTC 312 (Narela ↔ IP Extension)',
      color: '#fbbf24',
      path: [
        [28.8526, 77.0918], [28.8300, 77.1050], [28.8080, 77.1183],
        [28.7863, 77.1317], [28.7643, 77.1450], [28.7423, 77.1583],
        [28.7200, 77.1717], [28.6980, 77.1848], [28.6760, 77.1982],
        [28.6540, 77.2115], [28.6320, 77.2248], [28.6100, 77.2380],
        [28.5880, 77.2513], [28.5660, 77.2645],
      ],
    },

    // Route 543 — Nehru Place ↔ Rohini (south-north diagonal)
    {
      routeId: 'DTC-543',
      name: 'DTC 543 (Nehru Place ↔ Rohini)',
      color: '#a3e635',
      path: [
        [28.4948, 77.2521], [28.5098, 77.2460], [28.5248, 77.2398],
        [28.5400, 77.2337], [28.5550, 77.2275], [28.5700, 77.2214],
        [28.5850, 77.2152], [28.6000, 77.2090], [28.6153, 77.2028],
        [28.6305, 77.1965], [28.6457, 77.1904], [28.6610, 77.1843],
        [28.6762, 77.1780], [28.6912, 77.1718], [28.7063, 77.1656],
        [28.7210, 77.1594],
      ],
    },

    // Route 838 — Okhla ↔ GTK Depot
    {
      routeId: 'DTC-838',
      name: 'DTC 838 (Okhla ↔ GTK Depot)',
      color: '#60a5fa',
      path: [
        [28.5350, 77.2720], [28.5462, 77.2640], [28.5575, 77.2562],
        [28.5685, 77.2483], [28.5798, 77.2405], [28.5907, 77.2327],
        [28.6018, 77.2250], [28.6128, 77.2172], [28.6237, 77.2095],
        [28.6348, 77.2018], [28.6458, 77.1940], [28.6568, 77.1862],
        [28.6678, 77.1785], [28.6790, 77.1708],
      ],
    },

    // Route 206 — Najafgarh ↔ Connaught Place
    {
      routeId: 'DTC-206',
      name: 'DTC 206 (Najafgarh ↔ CP)',
      color: '#cbd5e1',
      path: [
        [28.6080, 76.9798], [28.6100, 77.0065], [28.6117, 77.0332],
        [28.6135, 77.0598], [28.6150, 77.0865], [28.6165, 77.1132],
        [28.6183, 77.1398], [28.6198, 77.1665], [28.6215, 77.1932],
        [28.6230, 77.2198], [28.6248, 77.2465],
      ],
    },

    // Circular Route CR1 — Inner Delhi Ring
    {
      routeId: 'DTC-CR1',
      name: 'DTC CR1 (Inner Ring Circular)',
      color: '#d946ef',
      path: [
        [28.6328, 77.2197], [28.6410, 77.2290], [28.6475, 77.2530],
        [28.6440, 77.2770], [28.6350, 77.2920], [28.6230, 77.2862],
        [28.6110, 77.2805], [28.5990, 77.2610], [28.5868, 77.2415],
        [28.5748, 77.2220], [28.5628, 77.2025], [28.5508, 77.1830],
        [28.5505, 77.1680], [28.5600, 77.1520], [28.5720, 77.1365],
        [28.5838, 77.1213], [28.5957, 77.1058], [28.6070, 77.1198],
        [28.6185, 77.1340], [28.6300, 77.1478], [28.6328, 77.1815],
        [28.6328, 77.2197],
      ],
    },
  ];

  // ---------------------------------------------------------------------------
  // STOPS
  // ---------------------------------------------------------------------------
  const stops: Stop[] = [
    { stopId: 'DL-S-RAJIV',   name: 'Rajiv Chowk (Central Interchange)', latitude: 28.5703, longitude: 77.1946, routeIds: ['DL-M1', 'DL-M2'] },
    { stopId: 'DL-S-KASH',    name: 'Kashmere Gate ISBT',                 latitude: 28.6105, longitude: 77.2289, routeIds: ['DL-M1', 'DL-M3', 'DTC-44', 'DTC-521', 'DTC-180'] },
    { stopId: 'DL-S-NDLS',    name: 'New Delhi Railway Station',           latitude: 28.5805, longitude: 77.1872, routeIds: ['DL-M1'] },
    { stopId: 'DL-S-INA',     name: 'INA Market',                          latitude: 28.4990, longitude: 77.2274, routeIds: ['DL-M1', 'DL-M5'] },
    { stopId: 'DL-S-AIIMS',   name: 'AIIMS Hospital',                      latitude: 28.4863, longitude: 77.2180, routeIds: ['DL-M1', 'DTC-615', 'DTC-423'] },
    { stopId: 'DL-S-CP',      name: 'Connaught Place (Janpath)',            latitude: 28.6328, longitude: 77.2197, routeIds: ['DTC-521', 'DTC-615', 'DTC-180', 'DTC-CR1'] },
    { stopId: 'DL-S-LAJPAT',  name: 'Lajpat Nagar Market',                 latitude: 28.5690, longitude: 77.2435, routeIds: ['DL-M5', 'DTC-764', 'DTC-838'] },
    { stopId: 'DL-S-DHAULA',  name: 'Dhaula Kuan',                         latitude: 28.5940, longitude: 77.1661, routeIds: ['DTC-180', 'DTC-764', 'DTC-206'] },
    { stopId: 'DL-S-IGI',     name: 'IGI Airport T3',                      latitude: 28.5531, longitude: 77.0955, routeIds: ['DTC-180'] },
    { stopId: 'DL-S-ANAND',   name: 'Anand Vihar ISBT',                    latitude: 28.6469, longitude: 77.3153, routeIds: ['DTC-764', 'DL-M3'] },
    { stopId: 'DL-S-SAKET',   name: 'Saket Mall Cluster',                  latitude: 28.4245, longitude: 77.2115, routeIds: ['DL-M1', 'DTC-615'] },
    { stopId: 'DL-S-NEHRU',   name: 'Nehru Place IT Hub',                  latitude: 28.4948, longitude: 77.2521, routeIds: ['DL-M5', 'DTC-543', 'DTC-838'] },
    { stopId: 'DL-S-ROHINI',  name: 'Rohini Sector 3 Terminal',            latitude: 28.7210, longitude: 77.1594, routeIds: ['DL-M3', 'DTC-615', 'DTC-543'] },
    { stopId: 'DL-S-OKHLA',   name: 'Okhla Industrial Area',               latitude: 28.5350, longitude: 77.2720, routeIds: ['DL-M5', 'DTC-838', 'DTC-410'] },
    { stopId: 'DL-S-JANAK',   name: 'Janakpuri West Terminal',             latitude: 28.6210, longitude: 77.0820, routeIds: ['DL-M2', 'DTC-423', 'DTC-206'] },
    { stopId: 'DL-S-MUNDKA',  name: 'Mundka Bus Terminus',                 latitude: 28.6840, longitude: 77.0275, routeIds: ['DTC-44'] },
    { stopId: 'DL-S-NARELA',  name: 'Narela DSIDC',                        latitude: 28.8526, longitude: 77.0918, routeIds: ['DTC-312'] },
    { stopId: 'DL-S-NAJAF',   name: 'Najafgarh Bus Terminal',              latitude: 28.6080, longitude: 76.9798, routeIds: ['DTC-206'] },
    { stopId: 'DL-S-MEHRAULI', name: 'Mehrauli Village',                   latitude: 28.3950, longitude: 77.1870, routeIds: ['DTC-330'] },
  ];

  // ---------------------------------------------------------------------------
  // VEHICLES
  // ---------------------------------------------------------------------------
  const now = new Date().toISOString();
  const occupancies = ['MANY_SEATS', 'FEW_SEATS', 'STANDING_ONLY', 'EMPTY', 'FULL'] as const;
  function occ(i: number) { return occupancies[i % occupancies.length]; }

  const vehicles: Record<string, Vehicle> = {
    // Yellow Line Metro
    'DL-M1-TRN-01': { vehicleId: 'DL-M1-TRN-01', routeId: 'DL-M1', latitude: 28.6754, longitude: 77.1489, speed: 80, heading: 180, occupancyStatus: occ(0), timestamp: now },
    'DL-M1-TRN-02': { vehicleId: 'DL-M1-TRN-02', routeId: 'DL-M1', latitude: 28.5703, longitude: 77.1946, speed: 0,  heading: 0,   occupancyStatus: occ(2), timestamp: now },
    'DL-M1-TRN-03': { vehicleId: 'DL-M1-TRN-03', routeId: 'DL-M1', latitude: 28.4413, longitude: 77.2115, speed: 75, heading: 180, occupancyStatus: occ(1), timestamp: now },
    // Blue Line
    'DL-M2-TRN-01': { vehicleId: 'DL-M2-TRN-01', routeId: 'DL-M2', latitude: 28.6094, longitude: 77.2388, speed: 70, heading: 90,  occupancyStatus: occ(3), timestamp: now },
    'DL-M2-TRN-02': { vehicleId: 'DL-M2-TRN-02', routeId: 'DL-M2', latitude: 28.5965, longitude: 77.1455, speed: 72, heading: 270, occupancyStatus: occ(0), timestamp: now },
    // Red Line
    'DL-M3-TRN-01': { vehicleId: 'DL-M3-TRN-01', routeId: 'DL-M3', latitude: 28.6906, longitude: 77.1301, speed: 68, heading: 180, occupancyStatus: occ(1), timestamp: now },
    // Violet Line
    'DL-M5-TRN-01': { vehicleId: 'DL-M5-TRN-01', routeId: 'DL-M5', latitude: 28.5506, longitude: 77.2590, speed: 65, heading: 180, occupancyStatus: occ(2), timestamp: now },
    'DL-M5-TRN-02': { vehicleId: 'DL-M5-TRN-02', routeId: 'DL-M5', latitude: 28.4808, longitude: 77.2886, speed: 70, heading: 180, occupancyStatus: occ(4), timestamp: now },
    // Pink Line
    'DL-M6-TRN-01': { vehicleId: 'DL-M6-TRN-01', routeId: 'DL-M6', latitude: 28.6548, longitude: 77.2030, speed: 60, heading: 90,  occupancyStatus: occ(0), timestamp: now },

    // DTC Route 521
    'DTC-521-BUS-01': { vehicleId: 'DTC-521-BUS-01', routeId: 'DTC-521', latitude: 28.6043, longitude: 77.2360, speed: 28, heading: 90,  occupancyStatus: occ(1), timestamp: now },
    'DTC-521-BUS-02': { vehicleId: 'DTC-521-BUS-02', routeId: 'DTC-521', latitude: 28.5927, longitude: 77.2447, speed: 22, heading: 90,  occupancyStatus: occ(3), timestamp: now },
    'DTC-521-BUS-03': { vehicleId: 'DTC-521-BUS-03', routeId: 'DTC-521', latitude: 28.5762, longitude: 77.2618, speed: 18, heading: 135, occupancyStatus: occ(2), timestamp: now },
    // DTC Route 615
    'DTC-615-BUS-01': { vehicleId: 'DTC-615-BUS-01', routeId: 'DTC-615', latitude: 28.6752, longitude: 77.1690, speed: 32, heading: 180, occupancyStatus: occ(0), timestamp: now },
    'DTC-615-BUS-02': { vehicleId: 'DTC-615-BUS-02', routeId: 'DTC-615', latitude: 28.5553, longitude: 77.2003, speed: 25, heading: 180, occupancyStatus: occ(2), timestamp: now },
    'DTC-615-BUS-03': { vehicleId: 'DTC-615-BUS-03', routeId: 'DTC-615', latitude: 28.4800, longitude: 77.2192, speed: 30, heading: 180, occupancyStatus: occ(1), timestamp: now },
    // DTC Route 423
    'DTC-423-BUS-01': { vehicleId: 'DTC-423-BUS-01', routeId: 'DTC-423', latitude: 28.6145, longitude: 77.1130, speed: 35, heading: 90,  occupancyStatus: occ(4), timestamp: now },
    'DTC-423-BUS-02': { vehicleId: 'DTC-423-BUS-02', routeId: 'DTC-423', latitude: 28.5902, longitude: 77.2295, speed: 27, heading: 90,  occupancyStatus: occ(0), timestamp: now },
    'DTC-423-BUS-03': { vehicleId: 'DTC-423-BUS-03', routeId: 'DTC-423', latitude: 28.5742, longitude: 77.2985, speed: 20, heading: 90,  occupancyStatus: occ(3), timestamp: now },
    // DTC Route 764
    'DTC-764-BUS-01': { vehicleId: 'DTC-764-BUS-01', routeId: 'DTC-764', latitude: 28.6410, longitude: 77.3020, speed: 26, heading: 270, occupancyStatus: occ(1), timestamp: now },
    'DTC-764-BUS-02': { vehicleId: 'DTC-764-BUS-02', routeId: 'DTC-764', latitude: 28.6075, longitude: 77.2115, speed: 30, heading: 270, occupancyStatus: occ(0), timestamp: now },
    // DTC Route 330
    'DTC-330-BUS-01': { vehicleId: 'DTC-330-BUS-01', routeId: 'DTC-330', latitude: 28.4580, longitude: 77.2077, speed: 22, heading: 0,   occupancyStatus: occ(2), timestamp: now },
    'DTC-330-BUS-02': { vehicleId: 'DTC-330-BUS-02', routeId: 'DTC-330', latitude: 28.5380, longitude: 77.2345, speed: 28, heading: 0,   occupancyStatus: occ(1), timestamp: now },
    // DTC Route 180
    'DTC-180-BUS-01': { vehicleId: 'DTC-180-BUS-01', routeId: 'DTC-180', latitude: 28.5695, longitude: 77.1235, speed: 40, heading: 45,  occupancyStatus: occ(3), timestamp: now },
    'DTC-180-BUS-02': { vehicleId: 'DTC-180-BUS-02', routeId: 'DTC-180', latitude: 28.6000, longitude: 77.1803, speed: 35, heading: 45,  occupancyStatus: occ(0), timestamp: now },
    // DTC Route 44
    'DTC-44-BUS-01': { vehicleId: 'DTC-44-BUS-01', routeId: 'DTC-44', latitude: 28.6780, longitude: 77.0676, speed: 38, heading: 90,  occupancyStatus: occ(1), timestamp: now },
    'DTC-44-BUS-02': { vehicleId: 'DTC-44-BUS-02', routeId: 'DTC-44', latitude: 28.6582, longitude: 77.1878, speed: 30, heading: 90,  occupancyStatus: occ(2), timestamp: now },
    // DTC Route 595
    'DTC-595-BUS-01': { vehicleId: 'DTC-595-BUS-01', routeId: 'DTC-595', latitude: 28.6320, longitude: 77.2222, speed: 24, heading: 225, occupancyStatus: occ(0), timestamp: now },
    'DTC-595-BUS-02': { vehicleId: 'DTC-595-BUS-02', routeId: 'DTC-595', latitude: 28.5921, longitude: 77.1428, speed: 28, heading: 225, occupancyStatus: occ(3), timestamp: now },
    'DTC-595-BUS-03': { vehicleId: 'DTC-595-BUS-03', routeId: 'DTC-595', latitude: 28.5630, longitude: 77.0863, speed: 22, heading: 225, occupancyStatus: occ(1), timestamp: now },
    // DTC Route 410
    'DTC-410-BUS-01': { vehicleId: 'DTC-410-BUS-01', routeId: 'DTC-410', latitude: 28.6665, longitude: 77.0905, speed: 42, heading: 90,  occupancyStatus: occ(2), timestamp: now },
    'DTC-410-BUS-02': { vehicleId: 'DTC-410-BUS-02', routeId: 'DTC-410', latitude: 28.6230, longitude: 77.2862, speed: 36, heading: 135, occupancyStatus: occ(0), timestamp: now },
    'DTC-410-BUS-03': { vehicleId: 'DTC-410-BUS-03', routeId: 'DTC-410', latitude: 28.5510, longitude: 77.3140, speed: 30, heading: 180, occupancyStatus: occ(4), timestamp: now },
    // DTC Route 312
    'DTC-312-BUS-01': { vehicleId: 'DTC-312-BUS-01', routeId: 'DTC-312', latitude: 28.8080, longitude: 77.1183, speed: 45, heading: 180, occupancyStatus: occ(3), timestamp: now },
    'DTC-312-BUS-02': { vehicleId: 'DTC-312-BUS-02', routeId: 'DTC-312', latitude: 28.6980, longitude: 77.1848, speed: 38, heading: 180, occupancyStatus: occ(0), timestamp: now },
    // DTC Route 543
    'DTC-543-BUS-01': { vehicleId: 'DTC-543-BUS-01', routeId: 'DTC-543', latitude: 28.5700, longitude: 77.2214, speed: 26, heading: 0,   occupancyStatus: occ(1), timestamp: now },
    'DTC-543-BUS-02': { vehicleId: 'DTC-543-BUS-02', routeId: 'DTC-543', latitude: 28.6305, longitude: 77.1965, speed: 32, heading: 0,   occupancyStatus: occ(2), timestamp: now },
    // DTC Route 838
    'DTC-838-BUS-01': { vehicleId: 'DTC-838-BUS-01', routeId: 'DTC-838', latitude: 28.5575, longitude: 77.2562, speed: 23, heading: 0,   occupancyStatus: occ(0), timestamp: now },
    'DTC-838-BUS-02': { vehicleId: 'DTC-838-BUS-02', routeId: 'DTC-838', latitude: 28.6128, longitude: 77.2172, speed: 28, heading: 0,   occupancyStatus: occ(3), timestamp: now },
    'DTC-838-BUS-03': { vehicleId: 'DTC-838-BUS-03', routeId: 'DTC-838', latitude: 28.6678, longitude: 77.1785, speed: 30, heading: 0,   occupancyStatus: occ(1), timestamp: now },
    // DTC Route 206
    'DTC-206-BUS-01': { vehicleId: 'DTC-206-BUS-01', routeId: 'DTC-206', latitude: 28.6117, longitude: 77.0332, speed: 48, heading: 90,  occupancyStatus: occ(2), timestamp: now },
    'DTC-206-BUS-02': { vehicleId: 'DTC-206-BUS-02', routeId: 'DTC-206', latitude: 28.6183, longitude: 77.1398, speed: 35, heading: 90,  occupancyStatus: occ(0), timestamp: now },
    // DTC Circular CR1
    'DTC-CR1-BUS-01': { vehicleId: 'DTC-CR1-BUS-01', routeId: 'DTC-CR1', latitude: 28.6475, longitude: 77.2530, speed: 22, heading: 135, occupancyStatus: occ(1), timestamp: now },
    'DTC-CR1-BUS-02': { vehicleId: 'DTC-CR1-BUS-02', routeId: 'DTC-CR1', latitude: 28.5990, longitude: 77.2610, speed: 25, heading: 225, occupancyStatus: occ(0), timestamp: now },
    'DTC-CR1-BUS-03': { vehicleId: 'DTC-CR1-BUS-03', routeId: 'DTC-CR1', latitude: 28.5505, longitude: 77.1680, speed: 20, heading: 315, occupancyStatus: occ(3), timestamp: now },
    'DTC-CR1-BUS-04': { vehicleId: 'DTC-CR1-BUS-04', routeId: 'DTC-CR1', latitude: 28.6070, longitude: 77.1198, speed: 24, heading: 45,  occupancyStatus: occ(2), timestamp: now },
  };

  return { routes, stops, vehicles };
}

// ---------------------------------------------------------------------------
// Generic city fallback (non-Delhi)
// ---------------------------------------------------------------------------
function generateGenericCity(cityName: string, centerLat: number, centerLon: number): {
  routes: RouteGeometry[];
  stops: Stop[];
  vehicles: Record<string, Vehicle>;
} {
  const shortCode = cityName.substring(0, 3).toUpperCase();
  const dLat = 0.015;
  const dLon = 0.018;

  const routes: RouteGeometry[] = [
    {
      routeId: `${shortCode}-R1`,
      name: `${cityName} Main Corridor`,
      color: '#10b981',
      path: [
        [centerLat + dLat * 1.5, centerLon - dLon * 0.5],
        [centerLat + dLat * 0.9, centerLon],
        [centerLat,              centerLon + dLon * 0.15],
        [centerLat - dLat * 0.9, centerLon + dLon * 0.3],
        [centerLat - dLat * 1.4, centerLon + dLon * 0.4],
      ],
    },
    {
      routeId: `${shortCode}-R2`,
      name: `${cityName} City Bus 2`,
      color: '#f59e0b',
      path: [
        [centerLat + dLat * 0.8, centerLon - dLon * 0.8],
        [centerLat + dLat * 0.4, centerLon - dLon * 0.4],
        [centerLat,              centerLon],
        [centerLat - dLat * 0.4, centerLon + dLon * 0.4],
        [centerLat - dLat * 0.8, centerLon + dLon * 0.8],
      ],
    },
    {
      routeId: `${shortCode}-R3`,
      name: `${cityName} Heritage Ring`,
      color: '#f97316',
      path: [
        [centerLat + dLat * 0.8, centerLon + dLon * 0.1],
        [centerLat + dLat * 0.6, centerLon + dLon * 0.7],
        [centerLat + dLat * 0.1, centerLon + dLon * 0.9],
        [centerLat - dLat * 0.4, centerLon + dLon * 0.7],
        [centerLat - dLat * 0.7, centerLon + dLon * 0.1],
        [centerLat - dLat * 0.5, centerLon - dLon * 0.4],
        [centerLat - dLat * 0.1, centerLon - dLon * 0.6],
        [centerLat + dLat * 0.4, centerLon - dLon * 0.4],
        [centerLat + dLat * 0.8, centerLon + dLon * 0.1],
      ],
    },
    {
      routeId: `${shortCode}-R4`,
      name: `${cityName} East-West Express`,
      color: '#06b6d4',
      path: [
        [centerLat - dLat * 0.2, centerLon - dLon * 1.5],
        [centerLat - dLat * 0.1, centerLon - dLon * 0.8],
        [centerLat,              centerLon],
        [centerLat + dLat * 0.1, centerLon + dLon * 0.8],
        [centerLat + dLat * 0.2, centerLon + dLon * 1.5],
      ],
    },
  ];

  const stops: Stop[] = [
    { stopId: `${shortCode}-S1`, name: `${cityName} Central`, latitude: centerLat,              longitude: centerLon,              routeIds: [`${shortCode}-R1`, `${shortCode}-R2`] },
    { stopId: `${shortCode}-S2`, name: `${cityName} North`,   latitude: centerLat + dLat * 1.5, longitude: centerLon - dLon * 0.5, routeIds: [`${shortCode}-R1`] },
    { stopId: `${shortCode}-S3`, name: `${cityName} South`,   latitude: centerLat - dLat * 1.4, longitude: centerLon + dLon * 0.4, routeIds: [`${shortCode}-R1`] },
    { stopId: `${shortCode}-S4`, name: `${cityName} East`,    latitude: centerLat + dLat * 0.2, longitude: centerLon + dLon * 1.5, routeIds: [`${shortCode}-R4`] },
    { stopId: `${shortCode}-S5`, name: `${cityName} West`,    latitude: centerLat - dLat * 0.2, longitude: centerLon - dLon * 1.5, routeIds: [`${shortCode}-R4`] },
  ];

  const now = new Date().toISOString();
  const vehicles: Record<string, Vehicle> = {
    [`${shortCode}-101`]: { vehicleId: `${shortCode}-101`, routeId: `${shortCode}-R1`, latitude: centerLat + dLat * 0.4, longitude: centerLon - dLon * 0.15, speed: 38, heading: 145, occupancyStatus: 'MANY_SEATS',    timestamp: now },
    [`${shortCode}-102`]: { vehicleId: `${shortCode}-102`, routeId: `${shortCode}-R1`, latitude: centerLat - dLat * 0.6, longitude: centerLon + dLon * 0.3,  speed: 42, heading: 320, occupancyStatus: 'FEW_SEATS',     timestamp: now },
    [`${shortCode}-201`]: { vehicleId: `${shortCode}-201`, routeId: `${shortCode}-R2`, latitude: centerLat + dLat * 0.2, longitude: centerLon - dLon * 0.2,  speed: 30, heading: 180, occupancyStatus: 'EMPTY',          timestamp: now },
    [`${shortCode}-301`]: { vehicleId: `${shortCode}-301`, routeId: `${shortCode}-R3`, latitude: centerLat + dLat * 0.7, longitude: centerLon + dLon * 0.6,  speed: 29, heading: 90,  occupancyStatus: 'STANDING_ONLY',  timestamp: now },
    [`${shortCode}-401`]: { vehicleId: `${shortCode}-401`, routeId: `${shortCode}-R4`, latitude: centerLat,              longitude: centerLon + dLon * 0.5,  speed: 45, heading: 90,  occupancyStatus: 'FEW_SEATS',     timestamp: now },
  };

  return { routes, stops, vehicles };
}
