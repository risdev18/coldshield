export interface ColdStorageFacility {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  source: string;
}

export const CURATED_FACILITIES: ColdStorageFacility[] = [
  {
    id: "f-snowman-taloja",
    name: "Snowman Logistics",
    address: "Taloja, Navi Mumbai, Maharashtra",
    lat: 19.0641,
    lng: 73.1118,
    source: "Verified Business Listing",
  },
  {
    id: "f-coldman-pune",
    name: "Coldman Logistics",
    address: "Chakan MIDC, Pune, Maharashtra",
    lat: 18.7513,
    lng: 73.8567,
    source: "Verified Business Listing",
  },
  {
    id: "f-crystal-delhi",
    name: "Crystal Logistic Cool Chain",
    address: "Okhla Industrial Area, New Delhi",
    lat: 28.5273,
    lng: 77.2796,
    source: "Verified Business Listing",
  },
];

// Haversine distance in km
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c;
}

// Simple estimated travel time at 40 km/h average
export function estimateTravelTime(distanceKm: number): number {
  const speedKmh = 40; 
  return Math.round((distanceKm / speedKmh) * 60); // returns minutes
}
