// ════════════════════════════════════════════════════════════
//  ROUTING — Get a real driving route between points, using the
//  public OSRM demo server. Returns the route geometry plus its
//  distance and duration.
//
//  NOTE: router.project-osrm.org is a demo server (rate-limited, no
//  uptime guarantee). For production, self-host OSRM or use a paid
//  routing API (Mapbox Directions, GraphHopper, Google) — keep this
//  same return shape.
// ════════════════════════════════════════════════════════════

const ENDPOINT = "https://router.project-osrm.org/route/v1/driving";

// points: [{ lat, lng }, ...] (need at least 2).
// Returns { coordinates: [[lng,lat],...], distanceMeters, durationSeconds }.
export async function getDrivingRoute(points) {
  if (!points || points.length < 2) return null;
  const coords = points.map((p) => `${p.lng},${p.lat}`).join(";");
  const url = `${ENDPOINT}/${coords}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Routing request failed");
  const data = await res.json();
  const route = data.routes?.[0];
  if (!route) return null;
  return {
    coordinates: route.geometry.coordinates,
    distanceMeters: route.distance,
    durationSeconds: route.duration,
  };
}

// Convenience: driving distance in miles (or null if it fails).
export function metersToMiles(meters) {
  return meters / 1609.344;
}
