// ════════════════════════════════════════════════════════════
//  LOCATIONS — The places shown on the map.
//  Add/remove entries here to change the pickable locations.
//  (Each needs a name plus lat/lng coordinates.)
// ════════════════════════════════════════════════════════════

export const SAMPLE_LOCATIONS = [
  { name: "Downtown Transit Hub", lat: 38.04, lng: -84.5 },
  { name: "University of Kentucky", lat: 38.03, lng: -84.51 },
  { name: "Fayette Mall", lat: 38.0, lng: -84.53 },
  { name: "Bluegrass Airport (LEX)", lat: 38.04, lng: -84.61 },
  { name: "Keeneland", lat: 38.05, lng: -84.59 },
  { name: "Rupp Arena", lat: 38.05, lng: -84.5 },
  { name: "Hamburg Pavilion", lat: 38.01, lng: -84.44 },
  { name: "Kroger Field", lat: 38.02, lng: -84.51 },
  { name: "Tates Creek Centre", lat: 37.99, lng: -84.49 },
  { name: "Masterson Station Park", lat: 38.08, lng: -84.56 },
];

// The geographic box the map covers. If you move SAMPLE_LOCATIONS to
// a different city, update these so pins land in the right spot.
export const MAP_BOUNDS = {
  minLat: 37.96,
  maxLat: 38.1,
  minLng: -84.65,
  maxLng: -84.4,
};
