// ════════════════════════════════════════════════════════════
//  GEOCODE — Turn typed text into real places, using OpenStreetMap's
//  free Nominatim service. Returns [{ name, lat, lng }].
//
//  NOTE: Nominatim's public server is for light/dev use (≈1 req/sec,
//  be polite). For production, switch to a self-hosted Nominatim or a
//  paid geocoder (Mapbox, Google, Maptiler) — keep this same return
//  shape and nothing else needs to change.
// ════════════════════════════════════════════════════════════

const ENDPOINT = "https://nominatim.openstreetmap.org/search";

// Shorten a long "display_name" to its first couple of parts so it
// fits nicely in cards (e.g. "Bluegrass Airport, Lexington").
function tidyName(displayName) {
  return displayName.split(",").slice(0, 2).join(",").trim();
}

export async function searchAddress(query, limit = 5) {
  const q = query.trim();
  if (q.length < 3) return [];
  const url = `${ENDPOINT}?format=jsonv2&limit=${limit}&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { "Accept-Language": "en" } });
  if (!res.ok) throw new Error("Address search failed");
  const data = await res.json();
  return data.map((d) => ({
    name: tidyName(d.display_name),
    fullName: d.display_name,
    lat: parseFloat(d.lat),
    lng: parseFloat(d.lon),
  }));
}
