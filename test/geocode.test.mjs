// Photon geocoding: result shape, coarse area label, ~1 km location bias.
// Run with: npm test
import assert from "node:assert/strict";
let seen;
globalThis.fetch = async (url) => { seen = new URL(url); return { ok: true, json: async () => ({ features: [
  { geometry: { coordinates: [-84.4985, 38.0487] }, properties: { name: "Rupp Arena", housenumber: "430", street: "West Vine Street", district: "Downtown", city: "Lexington", state: "Kentucky", country: "United States", postcode: "40507" } },
  { geometry: { coordinates: [-84.49, 38.02] }, properties: { housenumber: "12", street: "Elm Street", city: "Lexington", state: "Kentucky" } },
  { geometry: {}, properties: { name: "broken" } },
] }) }; };
const { searchAddress } = await import("../src/lib/geocode.js");
const r = await searchAddress("rupp", { near: { lat: 38.031234, lng: -84.498765 } });
assert.equal(seen.searchParams.get("lat"), "38.03"); assert.equal(seen.searchParams.get("lon"), "-84.50");
assert.equal(r.length, 2);
assert.deepEqual(r[0], { name: "Rupp Arena, 430 West Vine Street", fullName: "Rupp Arena, 430 West Vine Street, 40507, Lexington, Kentucky, United States", area: "Downtown, Lexington", lat: 38.0487, lng: -84.4985 });
assert.equal(r[1].name, "12 Elm Street, Lexington"); assert.equal(r[1].area, "Lexington");
assert.deepEqual(await searchAddress("ab"), []);
console.log("geocode checks passed");
