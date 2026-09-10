export interface ColdStorageFacility {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  capacityPallets: number;
  availableCapacity: number;
  phone: string;
  tempRange: string;
  source: string;
  distanceKm?: number;
  estimatedTimeMin?: number;
  liveTemp?: number;
  liveHumidity?: number;
}

export const CURATED_FACILITIES: ColdStorageFacility[] = [
  {
    id: "f-snowman-taloja",
    name: "Snowman Logistics — Taloja Hub",
    address: "Plot 34, MIDC Taloja, Navi Mumbai",
    city: "Navi Mumbai",
    state: "Maharashtra",
    lat: 19.0641,
    lng: 73.1118,
    capacityPallets: 4500,
    availableCapacity: 820,
    phone: "+91 22 6835 1200",
    tempRange: "-25°C to +8°C",
    source: "Verified Cold Chain Listing",
  },
  {
    id: "f-coldman-pune",
    name: "Coldman Logistics — Chakan MIDC",
    address: "Phase 2, Chakan Industrial Area, Pune",
    city: "Pune",
    state: "Maharashtra",
    lat: 18.7513,
    lng: 73.8567,
    capacityPallets: 3800,
    availableCapacity: 650,
    phone: "+91 20 4012 8890",
    tempRange: "-20°C to +4°C",
    source: "Verified Cold Chain Listing",
  },
  {
    id: "f-crystal-delhi",
    name: "Crystal Logistic Cool Chain — Okhla",
    address: "Phase 3, Okhla Industrial Estate, New Delhi",
    city: "New Delhi",
    state: "Delhi NCR",
    lat: 28.5273,
    lng: 77.2796,
    capacityPallets: 5200,
    availableCapacity: 1100,
    phone: "+91 11 4165 9900",
    tempRange: "-25°C to +10°C",
    source: "Verified Cold Chain Listing",
  },
  {
    id: "f-freshcold-jaipur",
    name: "FreshCold Logistics — Amber Road",
    address: "NH-48 Jaipur Highway, Delhi NCR",
    city: "Gurugram",
    state: "Haryana",
    lat: 28.3804,
    lng: 76.9535,
    capacityPallets: 3100,
    availableCapacity: 430,
    phone: "+91 124 4567 112",
    tempRange: "-18°C to +8°C",
    source: "Verified Cold Chain Listing",
  },
  {
    id: "f-coldman-bhiwandi",
    name: "Coldman Logistics — Bhiwandi Park",
    address: "Mankoli Naka, Bhiwandi, Thane",
    city: "Thane",
    state: "Maharashtra",
    lat: 19.2812,
    lng: 73.0489,
    capacityPallets: 6000,
    availableCapacity: 1450,
    phone: "+91 22 2548 7765",
    tempRange: "-22°C to +6°C",
    source: "Verified Cold Chain Listing",
  },
  {
    id: "f-snowman-pune",
    name: "Snowman Logistics — Loni Kalbhor",
    address: "Pune-Solapur Highway, Loni Kalbhor, Pune",
    city: "Pune",
    state: "Maharashtra",
    lat: 18.4878,
    lng: 74.0211,
    capacityPallets: 2900,
    availableCapacity: 510,
    phone: "+91 20 6711 2345",
    tempRange: "-20°C to +8°C",
    source: "Verified Cold Chain Listing",
  },
  {
    id: "f-gubba-hyd",
    name: "Gubba Cold Storage — Medchal",
    address: "NH-44 Medchal Industrial Area, Hyderabad",
    city: "Hyderabad",
    state: "Telangana",
    lat: 17.6294,
    lng: 78.4813,
    capacityPallets: 4200,
    availableCapacity: 780,
    phone: "+91 40 2790 3456",
    tempRange: "-25°C to +5°C",
    source: "Verified Cold Chain Listing",
  },
  {
    id: "f-coldman-blr",
    name: "Coldman Logistics — Hoskote Hub",
    address: "Hoskote Industrial Area, Bengaluru",
    city: "Bengaluru",
    state: "Karnataka",
    lat: 13.0722,
    lng: 77.7981,
    capacityPallets: 5500,
    availableCapacity: 1200,
    phone: "+91 80 4321 9876",
    tempRange: "-25°C to +8°C",
    source: "Verified Cold Chain Listing",
  },
  {
    id: "f-adani-nashik",
    name: "Adani Agri Fresh Cold Storage — Nashik",
    address: "MIDC Ambad, Nashik",
    city: "Nashik",
    state: "Maharashtra",
    lat: 19.9542,
    lng: 73.7489,
    capacityPallets: 3400,
    availableCapacity: 620,
    phone: "+91 253 2381 456",
    tempRange: "-5°C to +12°C",
    source: "Verified Cold Chain Listing",
  }
];

// Haversine distance in km
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

// Simple estimated travel time at 40 km/h average
export function estimateTravelTime(distanceKm: number): number {
  const speedKmh = 40;
  return Math.max(2, Math.round((distanceKm / speedKmh) * 60)); // returns minutes
}

// Helper to sort and return nearest cold storage facilities for any given GPS coordinates
export function getNearestFacilities(lat: number, lng: number): ColdStorageFacility[] {
  return CURATED_FACILITIES.map((fac) => {
    const dist = calculateDistance(lat, lng, fac.lat, fac.lng);
    const time = estimateTravelTime(dist);
    return {
      ...fac,
      distanceKm: dist,
      estimatedTimeMin: time,
    };
  }).sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0));
}

